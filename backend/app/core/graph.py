"""
面试系统 Graph 定义
实现 Planner-Executor-Evaluator 架构
支持动态追问、意图识别和智能评估
"""

import operator
from typing import Annotated, List, Literal, TypedDict, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from . import llms
from . import prompt as prompt_module
from .memory import get_async_sqlite_saver

# 全局变量用于跟踪图实例
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

llm = llms.get_llm()

# ============================================================================
# 数据结构定义
# ============================================================================

class InterviewQuestion(BaseModel):
    """面试问题数据模型"""
    id: int = Field(description="题目序号")
    topic: str = Field(description="考察主题，如Java并发")
    content: str = Field(description="具体的问题描述")
    type: str = Field(description="题目类型：intro, tech, behavior, system_design")


class PlanOutput(BaseModel):
    """规划输出数据模型"""
    questions: List[InterviewQuestion]


class EvaluationOutput(BaseModel):
    """评估输出数据模型"""
    decision: Literal["ANSWER_PASS", "ANSWER_WEAK", "ASK_CLARIFICATION", "UNKNOWN"] = Field(
        description="决策结果"
    )
    reason: str = Field(description="决策理由或追问方向")


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
    mode: Literal["coach", "mock"]  # 面试模式
    
    # 规划相关
    interview_plan: List[dict]  # 存储问题清单
    current_question_index: int
    max_questions: int
    
    # 动态控制相关
    eval_status: Literal["start_new", "follow_up", "clarify", "pass"]
    eval_reason: str
    follow_up_count: int  # 限制追问次数
    clarify_count: int  # 限制澄清/提问次数
    
    # 统计信息
    question_count: int  # 已完成的问题数（不含追问）


# ============================================================================
# Planner-Executor-Evaluator 节点
# ============================================================================

def node_planner(state: InterviewState):
    """
    规划节点：一次性生成题目清单
    """
    import json
    import re
    
    # 1. 准备 Prompt
    sys_prompt = prompt_module.get_planner_prompt(
        state["resume_context"], 
        state["job_description"], 
        state.get("company_info", "未知"),
        state.get("max_questions", 5)
    )
    
    # 2. 调用 LLM 生成结构化数据
    response = llm.invoke(sys_prompt)
    content = response.content
    
    # 3. 提取 JSON（处理可能的 markdown 标记）
    # 尝试提取 ```json ... ``` 中的内容
    json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # 如果没有 markdown 标记，直接使用内容
        json_str = content
    
    # 4. 解析 JSON
    try:
        questions_data = json.loads(json_str)
        
        # 如果返回的是 {"questions": [...]} 格式
        if isinstance(questions_data, dict) and "questions" in questions_data:
            questions_list = questions_data["questions"]
        else:
            questions_list = questions_data
        
        # 转换为 InterviewQuestion 对象
        questions = [
            InterviewQuestion(
                id=q.get("id", i+1),
                topic=q.get("topic", "未知主题"),
                content=q.get("content", ""),
                type=q.get("type", "tech")
            )
            for i, q in enumerate(questions_list)
        ]
        
    except json.JSONDecodeError as e:
        # 如果解析失败，使用默认问题
        print(f"警告: JSON 解析失败: {e}")
        print(f"原始内容: {content[:200]}...")
        questions = [
            InterviewQuestion(
                id=1,
                topic="自我介绍",
                content="请先做一个简单的自我介绍，包括你的工作经验和技术栈。",
                type="intro"
            )
        ]
    
    # 5. 初始化状态
    return {
        "interview_plan": [q.dict() for q in questions],
        "current_question_index": 0,
        "eval_status": "start_new",  # 初始状态为开始新题
        "follow_up_count": 0,
        "clarify_count": 0,  # 初始化澄清计数
        "question_count": 0,
        "messages": [AIMessage(content="[系统] 面试准备就绪，即将开始。")]
    }



def node_interviewer(state: InterviewState):
    """
    执行节点：负责提问、追问或解释
    """
    plan = state["interview_plan"]
    idx = state["current_question_index"]
    mode = state.get("mode", "mock")
    
    # 边界检查 - 如果所有问题都完成了，不再生成新问题
    if idx >= len(plan):
        # 返回空更新，让流程继续到 Evaluator，然后路由到 Summary
        return {}

    current_q = plan[idx]
    
    # 获取动态 Prompt
    system_prompt_str = prompt_module.get_dynamic_interviewer_prompt(
        current_question_content=current_q["content"],
        eval_status=state["eval_status"],
        eval_reason=state.get("eval_reason", ""),
        mode=mode  # 传递模式参数
    )
    
    # 调用 LLM
    # 为了节省 token，只保留最近的对话历史
    recent_messages = state["messages"][-10:] if len(state["messages"]) > 10 else state["messages"]
    messages = [SystemMessage(content=system_prompt_str)] + recent_messages
    response = llm.invoke(messages)
    
    return {"messages": [response]}




def node_evaluator(state: InterviewState):
    """
    评估节点：判断用户意图和回答质量
    """
    import json
    import re
    
    # 获取用户最新的一条回复
    user_messages = [msg for msg in state["messages"] if isinstance(msg, HumanMessage)]
    if not user_messages:
        # 没有用户消息，直接通过
        return {
            "eval_status": "pass",
            "eval_reason": "无用户输入"
        }
    
    last_user_msg = user_messages[-1]
    
    # 获取当前题目
    plan = state["interview_plan"]
    idx = state["current_question_index"]
    
    if idx >= len(plan):
        return {
            "eval_status": "pass",
            "eval_reason": "面试已结束"
        }
    
    current_q = plan[idx]
    
    # 准备 Prompt
    prompt_str = prompt_module.get_evaluator_prompt(
        current_question=current_q["content"],
        user_response=last_user_msg.content
    )
    
    # 调用 LLM 进行分类
    response = llm.invoke(prompt_str)
    content = response.content
    
    # 尝试解析 JSON
    try:
        # 提取 JSON（处理可能的 markdown 标记）
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            json_str = content
        
        eval_data = json.loads(json_str)
        decision = eval_data.get("decision", "UNKNOWN")
        reason = eval_data.get("reason", "")
        
    except (json.JSONDecodeError, AttributeError):
        # 如果 JSON 解析失败，使用简单的关键词匹配
        user_text = last_user_msg.content.lower()
        
        # 检查是否是提问
        question_keywords = ["什么", "为什么", "怎么", "如何", "请问", "能否", "可以", "?", "？"]
        if any(kw in user_text for kw in question_keywords) and len(user_text) < 50:
            decision = "ASK_CLARIFICATION"
            reason = "用户似乎在提问"
        # 检查是否完全不会
        elif any(kw in user_text for kw in ["不知道", "不会", "没了解", "不清楚"]):
            decision = "UNKNOWN"
            reason = "用户表示不了解"
        # 检查回答是否太简短
        elif len(user_text) < 20:
            decision = "ANSWER_WEAK"
            reason = "回答过于简短"
        else:
            decision = "ANSWER_PASS"
            reason = "回答基本完整"
    
    # 逻辑处理
    new_status = "pass"
    current_idx = idx
    follow_up_cnt = state.get("follow_up_count", 0)
    clarify_cnt = state.get("clarify_count", 0)
    question_cnt = state.get("question_count", 0)
    mode = state.get("mode", "mock")
    
    if decision == "ANSWER_PASS":
        # 回答通过 -> 准备下一题
        new_status = "start_new"
        current_idx += 1
        follow_up_cnt = 0
        clarify_cnt = 0  # 重置澄清计数
        question_cnt += 1  # 完成了一个问题
        
    elif decision == "ANSWER_WEAK":
        # 回答较弱 -> 判断是否追问
        if follow_up_cnt < 2:  # 最多追问2次
            new_status = "follow_up"
            follow_up_cnt += 1
            clarify_cnt = 0  # 重置澄清计数
        else:
            # 追问太多了，放过他，下一题
            new_status = "start_new"
            current_idx += 1
            follow_up_cnt = 0
            clarify_cnt = 0
            question_cnt += 1
            
    elif decision == "ASK_CLARIFICATION":
        # 用户提问 -> 需要解释
        if clarify_cnt < 2:  # 最多解释2次
            new_status = "clarify"
            clarify_cnt += 1
            # index 不变，follow_up_count 不变
        else:
            # 用户反复提问，强制进入下一题
            new_status = "start_new"
            current_idx += 1
            follow_up_cnt = 0
            clarify_cnt = 0
            question_cnt += 1
            reason = "用户反复提问超过限制，跳过此题"
        
    else:  # UNKNOWN - 用户表示不会
        if mode == "coach":
            # Coach 模式：给出答案和讲解，然后进入下一题
            new_status = "start_new"
            current_idx += 1
            follow_up_cnt = 0
            clarify_cnt = 0
            question_cnt += 1
            reason = "用户表示不会，Coach 模式将给出答案和讲解"
        else:
            # Mock 模式：直接跳过，不给答案
            new_status = "start_new"
            current_idx += 1
            follow_up_cnt = 0
            clarify_cnt = 0
            question_cnt += 1
            reason = "用户表示不会，跳过此题"

    return {
        "eval_status": new_status,
        "eval_reason": reason,
        "current_question_index": current_idx,
        "follow_up_count": follow_up_cnt,
        "clarify_count": clarify_cnt,
        "question_count": question_cnt
    }





def node_summary(state: InterviewState):
    """
    总结节点：生成面试报告
    """
    mode = state.get("mode", "mock")
    
    # 根据模式选择不同的总结 Prompt
    if mode == "coach":
        system_prompt = prompt_module.get_coach_feedback_prompt()
    else:
        system_prompt = prompt_module.get_mock_feedback_prompt()
    
    # 调用 LLM 生成总结
    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    response = llm.invoke(messages)
    
    return {"messages": [response]}


# ============================================================================
# 路由逻辑
# ============================================================================

def route_entry(state: InterviewState):
    """
    入口路由：判断是否已经有规划
    """
    if state.get("interview_plan"):
        return "evaluator"
    return "planner"


def route_after_evaluator(state: InterviewState):
    """
    Evaluator 之后的路由逻辑
    """
    idx = state["current_question_index"]
    plan = state.get("interview_plan", [])
    
    if idx >= len(plan):
        return "summary"  # 改为跳转到总结节点
    
    return "continue"


# ============================================================================
# Graph 构建函数
# ============================================================================

async def build_interview_graph(mode: str = "coach"):
    """
    构建 Planner-Executor-Evaluator 架构的面试图谱
    
    Args:
        mode: 面试模式（coach/mock），保留参数以兼容旧代码
    
    Returns:
        编译后的图谱实例
    """
    workflow = StateGraph(InterviewState)
    checkpointer = await get_async_sqlite_saver()

    # 添加节点
    workflow.add_node("planner", node_planner)
    workflow.add_node("interviewer", node_interviewer)
    workflow.add_node("evaluator", node_evaluator)
    workflow.add_node("summary", node_summary)  # 新增总结节点
    
    # 流程编排
    # 1. 条件入口：如果有 plan 了，直接去 Evaluator；否则去 Planner
    workflow.set_conditional_entry_point(
        route_entry,
        {
            "planner": "planner",
            "evaluator": "evaluator"
        }
    )
    
    # 2. Planner -> Interviewer (提出第一个问题)
    workflow.add_edge("planner", "interviewer")
    
    # 3. Interviewer -> END (发送给用户，等待用户回复)
    workflow.add_edge("interviewer", END)
    
    # 4. Evaluator -> Interviewer 或 Summary (根据评估结果决定)
    workflow.add_conditional_edges(
        "evaluator",
        route_after_evaluator,
        {
            "continue": "interviewer",
            "summary": "summary"  # 所有问题完成后，跳转到总结
        }
    )
    
    # 5. Summary -> END (生成报告后结束)
    workflow.add_edge("summary", END)
    
    graph = workflow.compile(checkpointer=checkpointer)
    return register_graph_instance(graph)


# ============================================================================
# 向后兼容的构建函数
# ============================================================================

async def build_mock_interview_graph():
    """
    构建模拟面试图谱（向后兼容）
    """
    return await build_interview_graph(mode="mock")


async def build_coach_interview_graph():
    """
    构建辅导模式图谱（向后兼容）
    """
    return await build_interview_graph(mode="coach")
