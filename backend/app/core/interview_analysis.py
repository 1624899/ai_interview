"""
面试分析统一模块
将 graph.py 中的后台分析逻辑抽离复用
支持文字面试和语音面试共用
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional

from . import llms

logger = logging.getLogger(__name__)


# ============================================================================
# 后台画像分析
# ============================================================================

async def trigger_background_analysis(
    session_id: str,
    api_config: Optional[Dict[str, Any]] = None
):
    """
    触发后台画像分析（异步任务）
    
    从数据库获取会话信息，构建 QA 历史，调用分析服务生成候选人画像。
    
    Args:
        session_id: 会话 ID
        api_config: API 配置（可选，用于 LLM 调用）
    """
    try:
        from app.services.analysis_service import get_analysis_service
        from app.database.session_service import SessionService
        
        if not session_id:
            logger.warning("[AnalysisService] session_id 缺失，跳过分析")
            return

        logger.info(f"[AnalysisService] 开始触发后台分析，session_id: {session_id}")

        # 从数据库获取完整会话信息（包括消息和简历内容）
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
        qa_history = build_qa_history(messages)
        
        logger.info(f"[AnalysisService] 解析出 {len(qa_history)} 个有效的 QA 对")
        
        # 如果没有 QA 历史，不触发分析
        if not qa_history:
            logger.warning("[AnalysisService] QA 历史为空，跳过分析")
            if messages:
                logger.warning(f"[AnalysisService] 消息详情: {[(m.role, len(m.content) if m.content else 0) for m in messages[:10]]}")
            return
        
        logger.info(f"[AnalysisService] 开始异步分析会话 {session_id}，共 {len(qa_history)} 轮对话")
        
        # 调用分析服务（传入用户的 API 配置）
        service = get_analysis_service()
        await service.analyze_candidate(session_id, resume, job_desc, company_info, qa_history, api_config)
        
        logger.info(f"[AnalysisService] 会话 {session_id} 的画像分析已完成")
        
    except Exception as e:
        logger.error(f"[AnalysisService] 后台分析触发失败: {str(e)}", exc_info=True)


def build_qa_history(messages: List[Any]) -> List[Dict[str, str]]:
    """
    从消息列表中构建 QA 历史
    
    解析消息列表，提取 "AI提问 -> User回答" 的配对模式。
    
    Args:
        messages: 消息列表（可以是 Pydantic 模型或字典）
        
    Returns:
        QA 历史列表，格式为 [{"question": "...", "answer": "..."}, ...]
    """
    qa_history = []
    
    if not messages:
        return qa_history
    
    # 解析 messages 列表
    # 结构：[AI 问题1, User 回答1, AI 问题2, User 回答2, ...]
    for i in range(0, len(messages) - 1):
        msg = messages[i]
        next_msg = messages[i+1]
        
        # 获取 role（兼容 Pydantic 模型和字典）
        msg_role = msg.role if hasattr(msg, 'role') else msg.get('role', '')
        next_role = next_msg.role if hasattr(next_msg, 'role') else next_msg.get('role', '')
        
        # 获取 content
        msg_content = msg.content if hasattr(msg, 'content') else msg.get('content', '')
        next_content = next_msg.content if hasattr(next_msg, 'content') else next_msg.get('content', '')
        
        # 寻找 "AI提问 -> User回答" 的模式
        if msg_role == "assistant" and next_role == "user":
            question = msg_content or ""
            answer = next_content or ""
            
            if question.strip() and answer.strip():
                qa_history.append({
                    "question": question,
                    "answer": answer
                })
    
    return qa_history


# ============================================================================
# 面试完成处理
# ============================================================================

async def handle_interview_complete(
    session_id: str,
    api_config: Optional[Dict[str, Any]] = None,
    trigger_analysis: bool = True
):
    """
    处理面试完成
    
    更新会话状态为 completed，并可选地触发后台画像分析。
    
    Args:
        session_id: 会话 ID
        api_config: API 配置
        trigger_analysis: 是否触发后台画像分析
    """
    try:
        from app.database.session_service import SessionService
        
        if not session_id:
            logger.warning("[InterviewComplete] session_id 缺失")
            return
        
        # 更新会话状态为 completed
        session_service = SessionService()
        await session_service.update_session(
            session_id=session_id,
            status="completed"
        )
        logger.info(f"[InterviewComplete] 会话 {session_id} 状态已更新为 completed")
        
        # 触发后台画像分析
        if trigger_analysis:
            asyncio.create_task(trigger_background_analysis(session_id, api_config))
            logger.info(f"[InterviewComplete] 已触发会话 {session_id} 的后台画像分析")
        
    except Exception as e:
        logger.error(f"[InterviewComplete] 处理面试完成失败: {e}", exc_info=True)


# ============================================================================
# 面试总结生成
# ============================================================================

async def generate_interview_summary(
    messages: List[Any],
    mode: str = "mock",
    api_config: Optional[Dict[str, Any]] = None
) -> str:
    """
    生成面试总结
    
    使用 LLM 根据对话历史生成面试反馈总结。
    
    Args:
        messages: 对话消息列表
        mode: 面试模式（mock, real 等）
        api_config: API 配置
        
    Returns:
        面试总结文本
    """
    try:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        from .mode_strategy import ModeStrategyFactory
        
        # 使用策略模式获取对应模式的反馈提示词
        strategy = ModeStrategyFactory.get_strategy(mode)
        system_prompt = strategy.get_feedback_prompt()
        
        # 构建消息列表
        llm_messages = [SystemMessage(content=system_prompt)]
        
        for msg in messages:
            # 兼容多种消息类型：
            # 1. 普通字典: {"role": "user", "content": "..."}
            # 2. Pydantic 模型: 有 role 和 content 属性
            # 3. LangChain 消息: HumanMessage/AIMessage 有 type 属性而非 role
            
            # 获取 role
            if hasattr(msg, 'role'):
                role = msg.role
            elif hasattr(msg, 'type'):
                # LangChain 消息类型映射
                type_to_role = {"human": "user", "ai": "assistant", "system": "system"}
                role = type_to_role.get(msg.type, "")
            elif isinstance(msg, dict):
                role = msg.get('role', '')
            else:
                role = ""
            
            # 获取 content
            if hasattr(msg, 'content'):
                content = msg.content
            elif isinstance(msg, dict):
                content = msg.get('content', '')
            else:
                content = ""
            
            if role == "user":
                llm_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                llm_messages.append(AIMessage(content=content))
        
        # 调用 LLM 生成总结
        smart_llm = llms.get_llm_for_request(api_config, channel="smart")
        response = await smart_llm.ainvoke(llm_messages)
        
        summary = response.content if hasattr(response, 'content') else str(response)
        logger.info(f"[Summary] 成功生成面试总结，长度: {len(summary)} 字符")
        
        return summary
        
    except Exception as e:
        logger.error(f"[Summary] 生成面试总结失败: {e}", exc_info=True)
        return "面试总结生成失败，请稍后重试。"


# ============================================================================
# 统一总结流程
# ============================================================================

async def process_interview_summary(
    session_id: str,
    messages: List[Any],
    mode: str = "mock",
    api_config: Optional[Dict[str, Any]] = None,
    trigger_analysis: bool = True
) -> str:
    """
    执行完整的总结处理流程：生成总结 -> 状态更新 -> 画像分析
    """
    # 1. 生成总结
    summary = await generate_interview_summary(messages, mode, api_config)
    
    # 2. 调用处理面试完成
    await handle_interview_complete(
        session_id=session_id,
        api_config=api_config,
        trigger_analysis=trigger_analysis
    )
    
    return summary

