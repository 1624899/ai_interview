"""
面试系统 Graph 定义
实现双层架构：轻量对话 + 后台画像
支持极速响应和多维度分析
"""

import asyncio
import json
import logging
import operator
import re
from typing import Annotated, List, Literal, TypedDict, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from . import llms
from .memory import get_async_sqlite_saver
from .mode_strategy import ModeStrategyFactory

logger = logging.getLogger(__name__)


# ============================================================================
# 数据结构定义
# ============================================================================


_graph_instances = []

def register_graph_instance(graph):
    """注册图实例以便后续清理"""
    _graph_instances.append(graph)
    return graph

def get_graph_instances():
    """获取所有图实例"""
    return _graph_instances

def clear_graph_instances():
    """清空图实例列表"""
    _graph_instances.clear()



class InterviewQuestion(BaseModel):
    """面试问题数据模型"""
    id: int = Field(description="题目序号")
    topic: str = Field(description="考察主题，如Java并发")
    content: str = Field(description="具体的问题描述")
    type: str = Field(description="题目类型：intro, tech, behavior, system_design")
    hint: str = Field(default="", description="回答提示，帮助候选人组织回答思路")


class PlanOutput(BaseModel):
    """规划输出数据模型"""
    questions: List[InterviewQuestion]





class InterviewState(TypedDict):
    """
    面试状态定义 - 统一的状态结构
    """

    # 消息历史
    messages: Annotated[List[BaseMessage], operator.add]

    # 基础信息
    resume_context: str
    job_description: str
    company_info: str  # 公司信息
    mode: Literal["mock"]  # 面试模式
    session_id: str  # 会话ID（用于后台分析）

    # 规划相关
    interview_plan: List[dict]  # 存储问题清单
    current_question_index: int
    max_questions: int

    # 统计信息
    question_count: int  # 已完成的问题数（不含追问）
    follow_up_count: int  # 当前主线问题的追问次数
    
    # 阶段控制
    turn_phase: Literal["opening", "feedback"]
    
    # 追问控制
    current_sub_question: Optional[str]
    max_follow_ups: int
    
    # 用户 API 配置（可选）
    api_config: Optional[dict]


# ============================================================================
# 节点函数
# ============================================================================

async def _generate_hints_async(
    session_id: str,
    interview_plan: list,
    resume: str,
    job_desc: str,
    api_config: dict = None
):
    """
    异步生成回答提示（后台任务）
    
    使用 fast 模型为每道题目生成回答提示，完成后更新数据库
    """
    try:
        logger.info(f"[HintGenerator] 开始为会话 {session_id} 生成回答提示")
        
        # 使用 fast 模型
        fast_llm = llms.get_llm_for_request(api_config, channel="fast")
        
        # 构建所有问题的提示生成 prompt
        questions_text = "\n".join([
            f"{i+1}. [{q.get('topic', '')}] {q.get('content', '')}"
            for i, q in enumerate(interview_plan)
        ])
        
        prompt = f"""你是一位面试辅导专家。以下是面试官将要问候选人的问题列表。
请为每道题目生成简洁的回答提示，帮助候选人组织回答思路。

【面试问题列表】：
{questions_text}

请为每道题生成回答提示，格式要求：
1. 每道题的提示控制在50-100字
2. 提示应包含：回答的角度、需要涵盖的要点、可以举例的方向
3. 不要直接给出答案，而是引导思路

请严格按照以下 JSON 格式输出，标点符号使用英文格式，不要包含 markdown 格式，不要有emoji表情：
{{
    "hints": [
        "第1题的回答提示...",
        "第2题的回答提示...",
        ...
    ]
}}
"""
        
        response = await fast_llm.ainvoke(prompt)
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # 解析 JSON
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()
        
        hints_data = json.loads(cleaned_text)
        hints_list = hints_data.get("hints", [])
        
        # 将提示合并到 interview_plan
        for i, q in enumerate(interview_plan):
            if i < len(hints_list):
                q["hint"] = hints_list[i]
            else:
                q["hint"] = "可以结合自身经验，从实际案例出发进行回答。"
        
        # 更新数据库
        from app.database.session_service import SessionService
        service = SessionService()
        await service.save_interview_plan(session_id, interview_plan)
        
        logger.info(f"[HintGenerator] 会话 {session_id} 的回答提示已生成并保存")
        
    except Exception as e:
        logger.error(f"[HintGenerator] 生成回答提示失败: {str(e)}", exc_info=True)

async def node_planner(state: InterviewState):
    """
    规划节点：生成面试题目
    根据轮次类型调整面试侧重点
    """
    job_desc = state["job_description"]
    resume = state["resume_context"]
    company_info = state.get("company_info", "")
    max_q = state.get("max_questions", 5)
    session_id = state.get("session_id")
    
    # 获取轮次信息
    round_index = 1
    round_type = "tech_initial"
    previous_profile = None
    previous_questions = []  # 上一轮的问题列表
    
    if session_id:
        try:
            from app.database.session_service import SessionService
            service = SessionService()
            session = await service.get_session(session_id)
            if session:
                round_index = session.metadata.round_index
                round_type = session.metadata.round_type
                
                # 获取上一轮画像和问题（如果是第二轮及以后）
                if round_index > 1 and session.metadata.parent_session_id:
                    previous_profile = await service.get_profile(session.metadata.parent_session_id)
                    # 获取上一轮的面试计划
                    parent_plan = await service.get_interview_plan(session.metadata.parent_session_id)
                    if parent_plan:
                        previous_questions = [q.get("content", q.get("topic", "")) for q in parent_plan]
        except Exception as e:
            logger.error(f"获取轮次信息失败: {e}")
    
    company_section = f"\n    【公司信息】：\n    {company_info}\n" if company_info else ""
    
    # 根据轮次类型定制策略
    round_strategies = {
        "tech_initial": {
            "focus": "基础专业能力和项目/工作经验",
            "requirements": """
    1. 第 1 道为自我介绍题。
    2. 重点考察简历中提到的核心技能和专业知识。
    3. 至少包含 1 道行为面试题（如：团队合作、解决冲突的经历）。
    4. 题目难度适中，覆盖广度而非深度。
    5. 每道题应该是独立的、具体的问题，不要一道题包含过多子问题。"""
        },
        "tech_deep": {
            "focus": "针对简历项目/经历的深入追问",
            "requirements": f"""
    1. 不需要自我介绍，直接进入专业问题。
    2. 【重要】基于简历中的具体项目或工作经历进行深挖，而不是出全新的宏大开放题。
    3. 从简历已有内容延伸，逐步深入到专业原理和细节层面。{f' 上一轮评估供参考：{previous_profile.get("overall_assessment", "")[:200]}' if previous_profile else ''}
    4. 可以包含 1 道中等规模的案例分析或方案设计题。
    5. 每道题聚焦单一知识点或能力维度，避免一道题问太多内容。"""
        },
        "hr_comprehensive": {
            "focus": "综合素质、全局思维和软技能",
            "requirements": """
    1. 可以包含 1 道综合性案例题（考察全局分析和方案设计能力）。
    2. 至少包含 2 道行为面试题（考察领导力、抗压能力、职业规划等）。
    3. 考察候选人的沟通表达、价值观和文化匹配度。
    4. 可以出开放性问题，考察候选人的思维广度和深度。"""
        }
    }
    
    strategy = round_strategies.get(round_type, round_strategies["tech_initial"])
    
    # 构建上一轮问题的提示
    previous_questions_section = ""
    if previous_questions:
        questions_text = "\n".join([f"    - {q}" for q in previous_questions])
        previous_questions_section = f"""
    【上一轮已问过的问题（请勿重复）】：
{questions_text}
"""
    
    prompt = f"""你是一位资深面试官。这是第 {round_index} 轮面试（类型：{round_type}）。请根据以下信息设计 {max_q} 道面试题目。
    
    【岗位描述】：
    {job_desc}
    {company_section}
    【候选人简历】：
    {resume}
    {previous_questions_section}
    【本轮面试侧重点】：{strategy['focus']}
    
    要求：
    {strategy['requirements']}
    
    请严格按照以下 JSON 结构输出，确保包含所有字段。
    【重要】：不要包含 markdown 格式（如 ```json ... ```），只输出纯 JSON 字符串，使用英文字符，禁止使用emoji。
    {{
        "questions": [
            {{
                "id": 1,
                "topic": "考察主题",
                "content": "具体问题内容",
                "type": "题目类型(intro/tech/behavior/system_design)"
            }}
        ]
    }}
    """
    
    # 使用用户配置的 LLM
    api_config = state.get("api_config")
    current_llm = llms.get_llm_for_request(api_config, channel="smart")
    
    # 直接调用 LLM，手动解析 JSON
    response = await current_llm.ainvoke(prompt)
    response_text = response.content if hasattr(response, 'content') else str(response)
    
    # 解析 JSON
    try:
        # 尝试清理可能的 markdown 格式
        cleaned_text = response_text.strip()
        if cleaned_text.startswith("```json"):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith("```"):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith("```"):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()
        
        plan_data = json.loads(cleaned_text)
        interview_plan = plan_data.get("questions", [])
        
        # 验证数据结构
        for i, q in enumerate(interview_plan):
            if "id" not in q:
                q["id"] = i + 1
            if "topic" not in q:
                q["topic"] = "未知主题"
            if "content" not in q:
                q["content"] = q.get("question", "请描述一下相关经验")
            if "type" not in q:
                q["type"] = "tech"
                
    except json.JSONDecodeError as e:
        logger.error(f"解析面试计划 JSON 失败: {e}")
        logger.error(f"原始响应: {response_text[:500]}")
        # 使用默认问题
        interview_plan = [
            {"id": 1, "topic": "自我介绍", "content": "请先做一个简短的自我介绍", "type": "intro"}
        ]
    
    # 保存 interview_plan 到数据库
    if session_id:
        try:
            from app.database.session_service import SessionService
            service = SessionService()
            await service.save_interview_plan(session_id, interview_plan)
            
            # 异步生成回答提示（后台任务，不阻塞主流程）
            asyncio.create_task(_generate_hints_async(
                session_id=session_id,
                interview_plan=interview_plan,
                resume=resume,
                job_desc=job_desc,
                api_config=api_config
            ))
            logger.info(f"已触发后台提示生成任务: {session_id}")
            
        except Exception as e:
            logger.error(f"保存 interview_plan 到数据库失败: {e}")
    
    return {
        "interview_plan": interview_plan,
        "current_question_index": 0,
        "question_count": 0,
        "follow_up_count": 0,
        "turn_phase": "opening",
        "current_sub_question": None,
        "max_follow_ups": 2
    }


async def node_responder(state: InterviewState):
    """
    回复节点：极速响应模式 (Fast Channel)
    """
    idx = state.get("current_question_index", 0)
    plan = state.get("interview_plan", [])
    messages = state.get("messages", [])
    turn_phase = state.get("turn_phase", "opening")
    
    # 使用用户配置的 LLM 或默认 Fast LLM
    api_config = state.get("api_config")
    fast_llm = llms.get_llm_for_request(api_config, channel="fast")
    
    # ==========================================
    # 1. 开场阶段 (Opening Phase)
    # ==========================================
    if turn_phase == "opening":
        current_question = plan[idx]["content"]
        
        prompt = f"""你是一位专业的技术面试官。请输出“你好我是你的面试官”并直接向候选人提出以下问题。
        
        问题：{current_question}
        """
        
        response = await fast_llm.ainvoke([HumanMessage(content=prompt)])
        
        return {
            "messages": [response],
            "turn_phase": "feedback" # 切换到反馈阶段，准备处理用户的下一个回答
        }
        
    # ==========================================
    # 2. 反馈阶段 (Feedback Phase)
    # ==========================================
    # 用户已经回答了上一题
    
    # 获取用户回答
    user_response = messages[-1].content if messages else ""
    
    # 准备下一题索引
    next_idx = idx + 1
    
    # 检查是否所有题目都问完了
    if next_idx >= len(plan):
        # 所有题目都问完了，直接结束
        return {
            "current_question_index": next_idx,
            "question_count": state.get("question_count", 0) + 1
        }
    
    current_question = plan[idx]["content"]
    next_question = plan[next_idx]["content"]
    
    # ==========================================
    # 简单回复逻辑（Fast Model）
    # ==========================================
    # Prompt: 引导 LLM 生成过渡语和下一题
    prompt = f"""你是一位专业的技术面试官。

候选人刚回答了以下问题：
问题：{current_question}
回答：{user_response}

请生成一句简短的评价（一句话即可，不要深入点评），然后自然地引出下一道题目。

下一道题目：{next_question}

请直接输出你的回复（不要输出"回复："等前缀）。"""
    
    response = await fast_llm.ainvoke([HumanMessage(content=prompt)])
    
    return {
        "messages": [response],
        "current_question_index": next_idx,
        "question_count": state.get("question_count", 0) + 1,
        "current_sub_question": None,
        "follow_up_count": 0,
        "max_questions": state.get("max_questions", 5)
    }





async def _trigger_background_analysis(state):
    """触发后台画像分析（异步任务）"""
    try:
        from app.services.analysis_service import get_analysis_service
        from app.database.session_service import SessionService
        
        # 获取 session_id
        session_id = state.get("session_id")
        if not session_id:
            logger.warning("[AnalysisService] session_id 缺失，跳过分析")
            return

        logger.info(f"[AnalysisService] 开始触发后台分析，session_id: {session_id}")

        # 从数据库获取完整会话信息（包括消息和简历内容）
        # 这样即使发生回退，也能获取到数据库中存储的完整/最新状态
        session_service = SessionService()
        session = await session_service.get_session(session_id, include_resume_content=True)
        
        if not session:
            logger.warning(f"[AnalysisService] 无法从数据库获取会话 {session_id}")
            return

        # 提取必要信息
        resume = session.metadata.resume_content or ""
        job_desc = session.metadata.job_description or ""
        company_info = session.metadata.company_info or "未知"
        messages = session.messages
        
        logger.info(f"[AnalysisService] 从数据库获取到 {len(messages)} 条消息")
        
        # 构建 QA 历史
        qa_history = []
        
        # 解析 messages 列表
        # 结构：[AI 问题1, User 回答1, AI 问题2, User 回答2, ...]
        # 注意：数据库中的消息是按时间顺序排列的
        for i in range(0, len(messages) - 1):
            msg = messages[i]
            next_msg = messages[i+1]
            
            # 寻找 "AI提问 -> User回答" 的模式
            if msg.role == "ai" and next_msg.role == "user":
                question = msg.content
                answer = next_msg.content
                
                if question.strip() and answer.strip():
                    qa_history.append({
                        "question": question,
                        "answer": answer
                    })
        
        logger.info(f"[AnalysisService] 解析出 {len(qa_history)} 个有效的 QA 对")
        
        # 如果没有 QA 历史，不触发分析
        if not qa_history:
            logger.warning("[AnalysisService] QA 历史为空，跳过分析")
            logger.warning(f"[AnalysisService] 消息详情: {[(m.role, len(m.content)) for m in messages[:10]]}")
            return
        
        # 获取用户的 API 配置
        api_config = state.get("api_config")
        
        logger.info(f"[AnalysisService] 开始异步分析会话 {session_id}，共 {len(qa_history)} 轮对话")
        
        # 调用分析服务（传入用户的 API 配置）
        service = get_analysis_service()
        await service.analyze_candidate(session_id, resume, job_desc, company_info, qa_history, api_config)
        
        logger.info(f"[AnalysisService] 会话 {session_id} 的画像分析已完成")
        
    except Exception as e:
        logger.error(f"后台分析触发失败: {str(e)}", exc_info=True)


async def node_summary(state: InterviewState):
    """
    总结节点：生成面试报告
    """
    mode = state.get("mode", "mock")
    session_id = state.get("session_id")
    
    # 使用策略模式获取对应模式的反馈提示词
    strategy = ModeStrategyFactory.get_strategy(mode)
    system_prompt = strategy.get_feedback_prompt()
    
    # 调用 LLM 生成总结
    # 使用用户配置的 LLM 或默认 Smart LLM
    api_config = state.get("api_config")
    smart_llm = llms.get_llm_for_request(api_config, channel="smart")
    
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await smart_llm.ainvoke(messages)
    
    # ==========================================
    # 更新会话状态为 completed
    # ==========================================
    if session_id:
        try:
            from app.database.session_service import SessionService
            session_service = SessionService()
            await session_service.update_session(
                session_id=session_id,
                status="completed"
            )
            logger.info(f"[Summary] 会话 {session_id} 状态已更新为 completed")
        except Exception as e:
            logger.error(f"[Summary] 更新会话状态失败: {e}")
    
    # ==========================================
    # 触发后台异步分析（面试结束，生成完整画像）
    # ==========================================
    asyncio.create_task(_trigger_background_analysis(state))
    
    return {
        "messages": [response],
        "question_count": state.get("question_count"),
        "max_questions": state.get("max_questions")
    }


# ============================================================================
# 路由逻辑
# ============================================================================

def route_entry(state: InterviewState):
    """
    入口路由：根据当前状态决定进入哪个节点
    """
    plan = state.get("interview_plan", [])
    
    # 如果没有计划，进入规划
    if not plan:
        return "planner"
            
    # 其他情况，进入 Responder 处理
    return "responder"


def route_after_responder(state: InterviewState):
    """
    Responder 之后的路由
    """
    idx = state.get("current_question_index", 0)
    plan = state.get("interview_plan", [])
    
    # 检查是否所有题目都问完了
    if idx >= len(plan):
        # 所有题目都问完了，去总结
        return "summary"
        
    # 还有题目，等待用户回答
    return END


# ============================================================================
# 图构建
# ============================================================================

async def build_interview_graph(mode: str = "mock"):
    """
    构建面试图谱
    """
    workflow = StateGraph(InterviewState)
    
    # 添加节点
    workflow.add_node("planner", node_planner)
    workflow.add_node("responder", node_responder)
    workflow.add_node("summary", node_summary)
    
    # 设置入口
    workflow.set_conditional_entry_point(
        route_entry,
        {
            "planner": "planner",
            "responder": "responder"
        }
    )
    
    # Planner -> Responder
    workflow.add_edge("planner", "responder")
    
    # Responder -> Human (or Summary)
    workflow.add_conditional_edges(
        "responder",
        route_after_responder,
        {
            END: END,
            "summary": "summary"
        }
    )

    
    # Summary -> END
    workflow.add_edge("summary", END)
    
    # 注册图实例
    checkpointer = await get_async_sqlite_saver()
    graph = workflow.compile(checkpointer=checkpointer)
    register_graph_instance(graph)
    
    return graph
