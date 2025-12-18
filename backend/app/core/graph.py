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
    
    # 轮次信息
    round_index: int
    round_type: str


# ============================================================================
# 节点函数
# ============================================================================

async def node_planner(state: InterviewState):
    """
    规划节点：生成面试题目
    使用统一的 interview_planner 模块
    """
    from . import interview_planner
    
    job_desc = state["job_description"]
    resume = state["resume_context"]
    company_info = state.get("company_info", "")
    max_q = state.get("max_questions", 5)
    session_id = state.get("session_id")
    api_config = state.get("api_config")
    
    # 获取轮次信息
    round_index = 1
    round_type = "tech_initial"
    previous_profile = None
    previous_questions = []
    
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
                    parent_plan = await service.get_interview_plan(session.metadata.parent_session_id)
                    if parent_plan:
                        previous_questions = [q.get("content", q.get("topic", "")) for q in parent_plan]
        except Exception as e:
            logger.error(f"获取轮次信息失败: {e}")
    
    # 使用统一的规划模块
    interview_plan = await interview_planner.generate_interview_plan(
        resume=resume,
        job_description=job_desc,
        company_info=company_info,
        max_questions=max_q,
        api_config=api_config,
        round_type=round_type,
        round_index=round_index,
        previous_profile=previous_profile,
        previous_questions=previous_questions,
        output_format="full",
        session_id=session_id,
        save_to_db=True,
        generate_hints=True
    )
    
    return {
        "interview_plan": interview_plan,
        "current_question_index": 0,
        "question_count": 0,
        "follow_up_count": 0,
        "turn_phase": "opening",
        "current_sub_question": None,
        "max_follow_ups": 2,
        "round_index": round_index,
        "round_type": round_type
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
        round_index = state.get("round_index", 1)
        round_type = state.get("round_type", "tech_initial")
        
        # 获取侧重点描述
        from .interview_planner import ROUND_STRATEGIES
        strategy = ROUND_STRATEGIES.get(round_type, ROUND_STRATEGIES["tech_initial"])
        focus = strategy["focus"]
        
        prompt = f"""你是一位专业的技术面试官。
        今天是第 {round_index} 轮面试（侧重：{focus}）。
        请输出“你好我是你的面试官”并说明本轮面试的重点，然后直接向候选人提出以下第一个问题。
        
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





async def node_summary(state: InterviewState):
    """
    总结节点：生成面试报告
    使用统一的 interview_analysis 模块
    """
    from . import interview_analysis
    from langchain_core.messages import AIMessage
    
    mode = state.get("mode", "mock")
    session_id = state.get("session_id")
    api_config = state.get("api_config")
    
    # 执行统一流程（生成文本 + 状态更新 + 画像分析）
    summary = await interview_analysis.process_interview_summary(
        session_id=session_id,
        messages=state["messages"],
        mode=mode,
        api_config=api_config,
        trigger_analysis=True
    )
    
    return {
        "messages": [AIMessage(content=summary)],
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
