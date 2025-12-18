"""
语音面试 API 路由
只负责请求/响应处理，业务逻辑在 core/voice_interview.py
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.models.voice import (
    VoiceStartRequest,
    VoiceChatRequest,
    VoiceStartResponse,
    VoiceCloneRequest,
)

from app.database.session_service import SessionService
from app.core.voice_interview import (
    generate_interview_plan,
    build_system_prompt,
    get_opening_message,
    process_voice_chat,
    generate_greeting_audio,
    save_message_async,
    generate_voice_summary,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["语音面试"])




# ============================================================================
# 接口实现
# ============================================================================

@router.post("/start", response_model=VoiceStartResponse)
async def start_voice_interview(
    request: VoiceStartRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    开始语音面试
    """
    try:
        session_id = request.thread_id
        api_config = request.api_config
        
        logger.info(f"[Voice] 开始语音面试: {session_id}")
        
        # 1. 获取或创建会话信息
        service = SessionService()
        session = await service.get_session(session_id, include_resume_content=True)
        
        # 核心逻辑：只有从文字面试 (mock) 切换过来时需要复用、新增对话
        is_switching_from_text = session and session.metadata.mode == 'mock'
        
        if is_switching_from_text:
            logger.info(f"[Voice] 检测到文字面试切换: {session_id}，执行复用逻辑...")
            # 克隆会话及其所有历史消息，优先使用当前请求中的 max_questions
            new_session = await service.clone_session_for_voice(
                session_id, 
                user_id=x_user_id,
                max_questions=request.max_questions
            )
            # 后续逻辑使用克隆后的新 ID 和新 Session
            session = new_session
            session_id = new_session.session_id
            logger.info(f"[Voice] 已复用并生成新对话: {session_id}")
        
        if not session:
            logger.info(f"[Voice] 会话 {session_id} 不存在，正在创建新会话...")
            # 如果请求中带有上下文，则创建新会话
            await service.create_session(
                session_id=session_id,
                mode='voice',
                resume_filename=request.resume_filename,
                resume_content=request.resume_content,
                job_description=request.job_description,
                company_info=request.company_info or "未知",
                max_questions=request.max_questions,
                user_id=x_user_id or "default_user"
            )
            # 重新获取会话
            session = await service.get_session(session_id, include_resume_content=True)
            if not session:
                raise HTTPException(status_code=500, detail="创建会话失败")

        # 构建历史消息列表 (用于前端回显)
        history_messages = []
        if session.messages:
            for msg in session.messages:
                if msg.role != "system" and msg.content:
                    history_messages.append({
                        "role": msg.role,
                        "content": msg.content,
                        "audio_url": msg.audio_url,
                    })
        
        # 2. 获取面试计划（不存在则生成）
        interview_plan = await service.get_interview_plan(session_id)
        if not interview_plan:
            logger.info(f"[Voice] 会话 {session_id} 计划为空，正在生成...")
            interview_plan = await generate_interview_plan(
                resume=session.metadata.resume_content or "",
                job_description=session.metadata.job_description or "",
                company_info=session.metadata.company_info or "",
                max_questions=session.metadata.max_questions or 5,
                api_config=api_config,
                session_id=session_id
            )
            await service.save_interview_plan(session_id, interview_plan)
        else:
            logger.info(f"[Voice] 已有面试计划, 共 {len(interview_plan)} 道题")
        
        # 4. 获取轮次和开场白
        round_index = getattr(session.metadata, 'round_index', 1) or 1
        
        # 5. 生成开场白
        first_question_content = None
        if interview_plan and len(interview_plan) > 0:
            # 如果是有历史记录的复用，面试官应该从当前进度继续
            current_q_idx = getattr(session.metadata, 'question_count', 0)
            if current_q_idx < len(interview_plan):
                first_question_content = interview_plan[current_q_idx].get("content", None)
        
        if is_switching_from_text:
            opening_msg_text = "好的，那我们切换到语音模式继续。关于刚才的话题，或者我们换个方向，我想请问一下：" + (first_question_content or "准备好了吗？")
        else:
            opening_msg_text = get_opening_message(first_question_content, round_index)
        
        # 6. 幂等检查：普通恢复模式下跳过，但切换模式下需要生成新消息
        last_message = session.messages[-1] if session.messages else None
        has_history = len(history_messages) > 0
        
        # 只有在不是切换模式的情况下，才进行幂等检查（已有历史则不再朗读）
        if not is_switching_from_text:
            opening_keywords = ["我是你的面试官", "我是本轮的面试官", "我将继续担任你的面试官"]
            is_opening_message = last_message and last_message.role == "assistant" and any(kw in last_message.content for kw in opening_keywords)
            
            if is_opening_message or has_history:
                logger.info(f"[Voice] 会话 {session_id} 已有历史，执行静默恢复")
                return {
                    "success": True,
                    "session_id": session_id,
                    "system_prompt": build_system_prompt(interview_plan),
                    "first_question": last_message.content if last_message else "",
                    "audio": None,
                    "greeting_text": None,
                    "history": history_messages,
                    "round_index": round_index,
                    "question_count": getattr(session.metadata, 'question_count', 0),
                    "max_questions": session.metadata.max_questions or 5
                }
        
        # 7. 构造响应（包含开场白，触发前端朗读）
        system_prompt = build_system_prompt(interview_plan)
        
        return {
            "success": True,
            "session_id": session_id,
            "system_prompt": system_prompt,
            "first_question": opening_msg_text,
            "audio": None,
            "greeting_text": opening_msg_text,
            "history": history_messages,
            "round_index": round_index,
            "question_count": getattr(session.metadata, 'question_count', 0),
            "max_questions": session.metadata.max_questions or 5
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Voice] 启动面试失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def voice_chat_endpoint(request: VoiceChatRequest):
    """
    语音对话接口 (SSE 流式输出)
    """
    # 创建生成器
    generator = process_voice_chat(
        session_id=request.session_id,
        system_prompt=request.system_prompt,
        history=request.history,
        audio_base64=request.audio,
        text_message=request.message,
        api_config=request.api_config,
        is_greeting=request.is_greeting,
        audio_id=request.audio_id  # 浏览器端存储的音频 ID
    )
    
    # 返回 SSE 流式响应
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Nginx 禁用缓冲
        }
    )



@router.post("/clone")
async def clone_voice_session(
    request: VoiceCloneRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    克隆当前会话用于语音面试
    """
    try:
        service = SessionService()
        new_session = await service.clone_session_for_voice(
            request.source_session_id,
            user_id=x_user_id,
            max_questions=request.max_questions if hasattr(request, 'max_questions') else None
        )
        return {"success": True, "new_session_id": new_session.session_id}
    except Exception as e:
        logger.error(f"[Voice] 克隆会话失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class VoiceSummaryRequest(BaseModel):
    session_id: str
    api_config: Dict[str, Any]


@router.post("/summary")
async def voice_summary_endpoint(request: VoiceSummaryRequest):
    """
    生成语音面试总结（SSE 流式输出）
    
    在面试完成后调用此接口生成面试反馈总结。
    """
    generator = generate_voice_summary(
        session_id=request.session_id,
        api_config=request.api_config
    )
    
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
