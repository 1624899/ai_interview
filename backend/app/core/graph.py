import operator
import asyncio
from typing import Annotated, List, Literal,TypedDict,Union

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
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

# 定义状态
class InterviewState(TypedDict):
    """
    状态定义
    """
    # 面试消息历史记录
    messages: Annotated[List[BaseMessage], operator.add]
    # 简历上下文
    resume_context: str
    # 岗位描述
    job_description: str
    # 面试模式：coach 辅导模式或 mock模拟面试
    mode: Literal["coach", "mock"]
    # 已问问题数量
    question_count: int
    # 最大问题数量
    max_questions: int

llm = llms.get_llm()

# ============================================================================
# Mock 模拟面试模式 - 专用节点
# ============================================================================

def node_mock_interviewer(state: InterviewState):
    """
    模拟面试官节点：专业、简洁的提问，不给出答案和评价
    """
    resume = state["resume_context"]
    jd = state["job_description"]
    current_count = state["question_count"]

    system_prompt = prompt_module.get_mock_interviewer_prompt(resume, jd, current_count)

    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("placeholder", "{messages}")
    ])
    
    chain = chat_prompt | llm
    response = chain.invoke({
        "messages": state["messages"],
    })

    # 增加问题计数
    new_count = current_count + 1
    return {
        "messages": [response],
        "question_count": new_count
    }

def node_mock_feedback(state: InterviewState):
    """
    模拟面试总结节点：生成简短的面试反馈
    """
    system_prompt = prompt_module.get_mock_feedback_prompt()
    messages = [SystemMessage(content=system_prompt)] + state["messages"] + [HumanMessage(content="面试结束，请生成报告。")]
    response = llm.invoke(messages)
    return {
        "messages": [response]
    }

# ============================================================================
# Coach 辅导模式 - 专用节点
# ============================================================================

def node_coach_interviewer(state: InterviewState):
    """
    辅导模式面试官节点：详细点评 + 正确答案 + 新问题
    """
    resume = state["resume_context"]
    jd = state["job_description"]
    current_count = state["question_count"]

    system_prompt = prompt_module.get_coach_interviewer_prompt(resume, jd, current_count)

    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("placeholder", "{messages}")
    ])
    
    chain = chat_prompt | llm
    response = chain.invoke({
        "messages": state["messages"],
    })

    # 增加问题计数
    new_count = current_count + 1
    return {
        "messages": [response],
        "question_count": new_count
    }

def node_coach_feedback(state: InterviewState):
    """
    辅导模式总结节点：生成详细的学习报告
    """
    system_prompt = prompt_module.get_coach_feedback_prompt()
    messages = [SystemMessage(content=system_prompt)] + state["messages"] + [HumanMessage(content="辅导结束，请生成学习报告。")]
    response = llm.invoke(messages)
    return {
        "messages": [response]
    }

def node_coach_analysis(state: InterviewState):
    """
    辅导模式分析节点：仅对最后一个问题进行分析，不提出新问题
    """
    resume = state["resume_context"]
    jd = state["job_description"]
    current_count = state["question_count"]

    system_prompt = prompt_module.get_coach_analysis_prompt(resume, jd, current_count)

    chat_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("placeholder", "{messages}")
    ])
    
    chain = chat_prompt | llm
    response = chain.invoke({
        "messages": state["messages"],
    })

    return {
        "messages": [response]
    }

# ============================================================================
# 条件判断函数（两种模式共用）
# ============================================================================

def should_continue_mock(state: InterviewState) -> Literal["continue", "end"]:
    """
    模拟面试模式判断逻辑
    """
    if state["question_count"] < state["max_questions"]:
        return "continue"
    else:
        return "end"

def should_continue_coach(state: InterviewState) -> Literal["continue", "analysis"]:
    """
    辅导模式判断逻辑
    """
    if state["question_count"] < state["max_questions"]:
        return "continue"
    else:
        return "analysis"

def node_router(state: InterviewState):
    """
    路由节点：仅用于决定下一步流向
    """
    return {}

# ============================================================================
# Graph 构建函数
# ============================================================================

async def build_mock_interview_graph():
    """
    构建模拟面试图谱
    """
    workflow = StateGraph(InterviewState)
    
    # 获取记忆保存器（使用异步SQLite持久化）
    checkpointer = await get_async_sqlite_saver()

    # 添加节点
    workflow.add_node("router", node_router)
    workflow.add_node("interviewer", node_mock_interviewer)
    workflow.add_node("feedback_generator", node_mock_feedback)

    # 设置入口点为路由
    workflow.set_entry_point("router")

    # 添加条件边：从路由出发
    workflow.add_conditional_edges(
        "router",
        should_continue_mock,
        {
            "continue": "interviewer",
            "end": "feedback_generator"
        }
    )

    # 面试官节点结束后，直接结束（等待用户输入）
    workflow.add_edge("interviewer", END)
    workflow.add_edge("feedback_generator", END)

    graph = workflow.compile(checkpointer=checkpointer)
    return register_graph_instance(graph)

async def build_coach_interview_graph():
    """
    构建辅导模式图谱
    """
    workflow = StateGraph(InterviewState)
    
    # 获取记忆保存器（使用异步SQLite持久化）
    checkpointer = await get_async_sqlite_saver()

    # 添加节点
    workflow.add_node("router", node_router)
    workflow.add_node("interviewer", node_coach_interviewer)
    workflow.add_node("analysis", node_coach_analysis)
    workflow.add_node("feedback_generator", node_coach_feedback)

    # 设置入口点为路由
    workflow.set_entry_point("router")

    # 添加条件边：从路由出发
    workflow.add_conditional_edges(
        "router",
        should_continue_coach,
        {
            "continue": "interviewer",
            "analysis": "analysis"
        }
    )

    # 面试官节点结束后，直接结束（等待用户输入）
    workflow.add_edge("interviewer", END)
    # 分析节点结束后，去生成总结
    workflow.add_edge("analysis", "feedback_generator")
    workflow.add_edge("feedback_generator", END)

    graph = workflow.compile(checkpointer=checkpointer)
    return register_graph_instance(graph)

# ============================================================================
# 向后兼容函数（可选）
# ============================================================================

async def build_interview_graph(mode: str = "coach"):
    """
    工厂函数：根据模式构建对应的图谱
    向后兼容旧代码
    """
    if mode == "mock":
        return await build_mock_interview_graph()
    else:
        return await build_coach_interview_graph()
