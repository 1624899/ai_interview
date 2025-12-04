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

llm = llms.get_smart_llm()

class InterviewQuestion(BaseModel):
    """面试问题数据模型"""
    id: int = Field(description="题目序号")
    topic: str = Field(description="考察主题，如Java并发")
    content: str = Field(description="具体的问题描述")
    type: str = Field(description="题目类型：intro, tech, behavior, system_design")


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


# ============================================================================
# 节点函数
# ============================================================================

async def node_planner(state: InterviewState):
    """
    规划节点：生成面试题目
    """
    job_desc = state["job_description"]
    resume = state["resume_context"]
    company_info = state.get("company_info", "")
    max_q = state.get("max_questions", 5)
    
    company_section = f"\n    【公司信息】：\n    {company_info}\n" if company_info else ""

    prompt = f"""你是一位资深技术面试官。请根据以下信息设计 {max_q} 道面试题目。
    
    【岗位描述】：
    {job_desc}
    {company_section}
    【候选人简历摘要】：
    {resume[:2000]}
    
    要求：
    1. 题目难度适中，覆盖核心技能点。
    2. 第 1 道为自我介绍题。
    3. 至少包含 1 道行为面试题（Behavioral Question）。
    4. 题目描述要清晰具体。
    
    请严格按照以下 JSON 结构输出，确保包含所有字段。
    【重要】：不要包含 markdown 格式（如 ```json ... ```），只输出纯 JSON 字符串。
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
    
    # 禁用流式输出以避免 OpenAI structured output 的 bug
    structured_llm = llm.with_structured_output(PlanOutput).with_config({"run_name": "planner"})
    plan = await structured_llm.ainvoke(prompt, config={"callbacks": []})
    
    interview_plan = [q.model_dump() for q in plan.questions]
    
    # 保存 interview_plan 到数据库
    session_id = state.get("session_id")
    if session_id:
        try:
            from app.database.session_service import SessionService
            service = SessionService()
            await service.save_interview_plan(session_id, interview_plan)
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
    
    # 使用 Fast LLM 保证速度
    fast_llm = llms.get_fast_llm()
    
    # ==========================================
    # 1. 开场阶段 (Opening Phase)
    # ==========================================
    if turn_phase == "opening":
        current_question = plan[idx]["content"]
        
        prompt = f"""你是一位专业的技术面试官。请直接向候选人提出以下问题。
        
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
回答：{user_response[:800]}

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
        
        # 提取必要信息
        resume = state.get("resume_context", "")
        job_desc = state.get("job_description", "")
        company_info = state.get("company_info", "未知")
        
        # 构建 QA 历史
        messages = state.get("messages", [])
        qa_history = []
        
        # 正确解析 messages 列表
        # 结构：[AI 问题1, User 回答1, AI 问题2, User 回答2, ...]
        for i in range(0, len(messages) - 1, 2):
            if i + 1 < len(messages):
                ai_msg = messages[i]
                user_msg = messages[i + 1]
                
                # 提取内容
                question = ai_msg.content if hasattr(ai_msg, 'content') else str(ai_msg)
                answer = user_msg.content if hasattr(user_msg, 'content') else str(user_msg)
                
                # 只保留有效的 QA 对
                if question.strip() and answer.strip():
                    qa_history.append({
                        "question": question,
                        "answer": answer
                    })
        
        # 如果没有 QA 历史，不触发分析
        if not qa_history:
            logger.debug("[AnalysisService] QA 历史为空，跳过分析")
            return
        
        # 获取 session_id
        session_id = state.get("session_id")
        if not session_id:
            logger.warning("[AnalysisService] session_id 缺失，跳过分析")
            return
        
        logger.info(f"[AnalysisService] 开始异步分析会话 {session_id}，共 {len(qa_history)} 轮对话")
        
        # 调用分析服务
        service = get_analysis_service()
        await service.analyze_candidate(session_id, resume, job_desc, company_info, qa_history)
        
    except Exception as e:
        logger.error(f"后台分析触发失败: {str(e)}")


async def node_summary(state: InterviewState):
    """
    总结节点：生成面试报告
    """
    mode = state.get("mode", "mock")
    
    # 使用策略模式获取对应模式的反馈提示词
    strategy = ModeStrategyFactory.get_strategy(mode)
    system_prompt = strategy.get_feedback_prompt()
    
    # 调用 LLM 生成总结
    # 使用 Smart LLM
    smart_llm = llms.get_smart_llm()
    
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = await smart_llm.ainvoke(messages)
    
    # ==========================================
    # 触发后台异步分析（面试结束，生成完整画像）
    # ==========================================
    asyncio.create_task(_trigger_background_analysis(state))
    
    return {"messages": [response]}


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
