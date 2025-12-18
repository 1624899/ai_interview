"""
聊天相关的 API 路由
支持 Server-Sent Events (SSE) 流式输出
"""

import json
import logging
import uuid
from typing import AsyncGenerator
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Body
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from app.core.graph import build_interview_graph
from app.models.schemas import ChatRequest, ChatStreamResponse, InterviewStartRequest, ErrorResponse, RollbackRequest, ProfileGenerateRequest
from app.database.session_service import SessionService

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["聊天"])

# 实例化会话服务
session_service = SessionService()


@router.get("/hint/{session_id}/{question_index}")
async def get_hint(session_id: str, question_index: int):
    """
    获取指定问题的回答提示
    
    直接从 interview_plan 中读取，无需调用 LLM
    
    Args:
        session_id: 会话ID
        question_index: 当前问题索引（从0开始）
        
    Returns:
        dict: 包含提示内容
    """
    try:
        plan = await session_service.get_interview_plan(session_id)
        
        if not plan:
            raise HTTPException(status_code=404, detail="面试计划不存在")
        
        if question_index < 0 or question_index >= len(plan):
            raise HTTPException(status_code=404, detail="问题索引超出范围")
        
        question = plan[question_index]
        hint = question.get("hint")
        
        # 检查提示是否已生成
        if not hint:
            return {
                "success": True,
                "generating": True,
                "hint": "提示正在生成中，请稍后再试...",
                "topic": question.get("topic", ""),
                "question": question.get("content", "")
            }
        
        return {
            "success": True,
            "generating": False,
            "hint": hint,
            "topic": question.get("topic", ""),
            "question": question.get("content", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取回答提示失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取回答提示失败"
            }
        )


@router.post("/start")
async def start_interview(
    request: InterviewStartRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    开始新的面试会话
    
    Args:
        request: 面试开始请求
        
    Returns:
        dict: 会话开始结果
    """
    
    session_created = False  # 标记是否新创建了会话（用于异常时清理）
    
    try:
        # 初始化图谱（异步）
        graph = await build_interview_graph(request.mode)
        
        # 配置线程 ID
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 构建初始状态（新架构）
        # 解析用户的 API 配置
        api_config = None
        if request.api_config:
            api_config = {
                "smart": {
                    "api_key": request.api_config.smart.api_key,
                    "base_url": request.api_config.smart.base_url,
                    "model": request.api_config.smart.model
                },
                "fast": {
                    "api_key": request.api_config.fast.api_key,
                    "base_url": request.api_config.fast.base_url,
                    "model": request.api_config.fast.model
                }
            }
        
        inputs = {
            "messages": [],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "company_info": getattr(request, "company_info", "未知"),
            "mode": request.mode,
            "session_id": request.thread_id,  # 添加 session_id
            "interview_plan": [],  # 将由 planner 节点填充
            "current_question_index": 0,
            "max_questions": request.max_questions,
            "question_count": 0,
            "question_count": 0,
            "api_config": api_config,  # 添加用户 API 配置
            "round_index": 1,
            "round_type": "tech_initial"
        }
        
        # 检查会话是否已存在，如果不存在则创建
        session = await session_service.get_session(request.thread_id, include_resume_content=True)
        if session is None:
            await session_service.create_session(
                session_id=request.thread_id,
                mode=request.mode,
                resume_filename=request.resume_filename,
                resume_content=request.resume_context,
                job_description=request.job_description,
                company_info=getattr(request, "company_info", "未知"),
                max_questions=request.max_questions,
                user_id=x_user_id or "default_user"
            )
            session_created = True  # 标记为新创建
        else:
            # 会话已存在（例如：下一轮面试），从数据库加载继承的简历和JD
            if not request.resume_context and session.metadata.resume_content:
                inputs["resume_context"] = session.metadata.resume_content
            if not request.job_description and session.metadata.job_description:
                inputs["job_description"] = session.metadata.job_description
            if session.metadata.company_info:
                inputs["company_info"] = session.metadata.company_info
            
            # 重要：从元数据中继承轮次信息
            inputs["round_index"] = session.metadata.round_index or 1
            inputs["round_type"] = session.metadata.round_type or "tech_initial"
        
        # 生成并更新会话标题：{JD摘要} - 第 X 轮
        current_r_idx = inputs["round_index"]
        jd_for_title = inputs["job_description"] or request.job_description or ""
        summary = jd_for_title[:15] + "..." if len(jd_for_title) > 15 else jd_for_title
        title = f"{summary} - 第{current_r_idx}轮"
        
        # 更新数据库中的会话标题
        await session_service.update_session(request.thread_id, title=title)

        # 执行图以生成第一题
        first_question = ""
        async for event in graph.astream_events(inputs, config=config, version="v1"):
            kind = event["event"]
            
            # 收集 responder 节点的输出
            if kind == "on_chat_model_stream":
                node_name = event.get("metadata", {}).get("langgraph_node", "")
                if node_name == "responder":
                    content = event["data"]["chunk"].content
                    if content:
                        first_question += content
        
        # 保存第一题到会话
        if first_question:
            await session_service.add_message(
                session_id=request.thread_id,
                role="assistant",
                content=first_question,
                question_index=0
            )

        # 返回会话信息
        return {
            "success": True,
            "message": "面试会话已初始化",
            "thread_id": request.thread_id,
            "mode": request.mode,
            "max_questions": request.max_questions,
            "session_title": title,
            "first_question": first_question  # 返回第一题
        }
        
    except Exception as e:
        error_str = str(e).lower()
        logger.error(f"开始面试会话失败: {str(e)}", exc_info=True)
        
        # 如果新创建了会话但 LLM 调用失败，删除该空会话
        if session_created:
            try:
                await session_service.delete_session(request.thread_id)
                logger.info(f"已清理失败的会话: {request.thread_id}")
            except Exception as cleanup_error:
                logger.warning(f"清理失败会话时出错: {cleanup_error}")
        
        if "401" in error_str or "unauthorized" in error_str or "invalid api key" in error_str or "authentication" in error_str:
            message = "API Key 无效，请检查配置"
            error_type = "AuthenticationError"
        elif "404" in error_str or "not found" in error_str or "model" in error_str and "does not exist" in error_str:
            message = "模型不存在或 API 地址错误，请检查配置"
            error_type = "NotFoundError"
        elif "timeout" in error_str or "timed out" in error_str:
            message = "连接超时，请检查网络或 API 地址"
            error_type = "TimeoutError"
        elif "connection" in error_str or "connect" in error_str or "network" in error_str:
            message = "无法连接到 API 服务器，请检查 Base URL"
            error_type = "ConnectionError"
        elif "rate limit" in error_str or "429" in error_str:
            message = "API 请求过于频繁，请稍后重试"
            error_type = "RateLimitError"
        elif "insufficient" in error_str or "quota" in error_str or "balance" in error_str:
            message = "API 余额不足，请充值后重试"
            error_type = "QuotaError"
        else:
            message = f"开始面试会话失败: {str(e)[:100]}"
            error_type = "InternalServerError"
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": error_type,
                "message": message
            }
        )


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    """
    SSE 端点：流式聊天接口
    前端建立连接后，服务器不断推送 chunk
    
    Args:
        request: 聊天请求
        
    Returns:
        StreamingResponse: SSE 流式响应
    """
    try:
        # 初始化图谱（异步）
        graph = await build_interview_graph(request.mode)
        
        # 配置线程 ID
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 校验消息非空
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
            
        # 1. 获取会话完整信息（用于状态注水）
        # 即使 Checkpoint 丢失，也能通过数据库恢复上下文
        session = await session_service.get_session(request.thread_id)
        interview_plan = await session_service.get_interview_plan(request.thread_id)
        
        # 2. 构建输入状态（新架构 - 状态注水模式）
        # 总是传入最新的上下文信息，确保 Graph 状态与数据库一致
        
        # 解析用户的 API 配置
        api_config = None
        if request.api_config:
            api_config = {
                "smart": {
                    "api_key": request.api_config.smart.api_key,
                    "base_url": request.api_config.smart.base_url,
                    "model": request.api_config.smart.model
                },
                "fast": {
                    "api_key": request.api_config.fast.api_key,
                    "base_url": request.api_config.fast.base_url,
                    "model": request.api_config.fast.model
                }
            }
        
        inputs = {
            "messages": [HumanMessage(content=request.message)],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "company_info": getattr(request, "company_info", "未知"),
            "mode": request.mode,
            "session_id": request.thread_id,
            "max_questions": request.max_questions,
            
            # 状态注水（恢复）
            "interview_plan": interview_plan if interview_plan else [],
            
            # 动态计算进度：基于最后一条消息的 question_index
            "question_count": session.messages[-1].question_index if session and session.messages else 0,
            "current_question_index": session.messages[-1].question_index if session and session.messages else 0,
            
            # 因为 stream 接口总是处理用户的回答，所以必须进入 feedback 阶段，否则默认为 opening 会导致系统重复当前问题而不是推进到下一题
            "turn_phase": "feedback",
            
            # 添加用户 API 配置
            "api_config": api_config,
            
            # 分配轮次信息
            "round_index": session.metadata.round_index if session else 1,
            "round_type": session.metadata.round_type if session else "tech_initial"
        }
        
        return StreamingResponse(
            event_generator(graph, inputs, config, request.thread_id, request.message),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except Exception as e:
        logger.error(f"流式聊天初始化失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "流式聊天初始化失败"
            }
        )


async def event_generator(graph, inputs, config, thread_id: str, user_message: str) -> AsyncGenerator[str, None]:
    """
    生成器：将 LangGraph 事件转换为 SSE 格式
    
    Args:
        graph: LangGraph 实例
        inputs: 输入状态
        config: 配置参数
        thread_id: 会话线程ID
        user_message: 用户消息内容
        
    Yields:
        str: SSE 格式的事件数据
    """
    ai_response_content = ""
    final_question_index = inputs.get("current_question_index", 0)
    
    try:
        # 保存用户消息到会话
        await session_service.add_message(
            session_id=thread_id,
            role="user",
            content=user_message,
            question_index=inputs.get("current_question_index", 0)
        )
        
        async for event in graph.astream_events(inputs, config=config, version="v1"):
            kind = event["event"]
            
            # 处理 LLM 生成的 token
            if kind == "on_chat_model_stream":
                # 获取当前节点名称
                node_name = event.get("metadata", {}).get("langgraph_node", "")
                
                # 只流式传输面向用户的节点输出 (responder 和 summary)
                # 过滤掉 planner (生成 JSON 计划) 和 evaluator (评估用户回答) 的内部思考过程
                if node_name in ["responder", "summary"]:
                    content = event["data"]["chunk"].content
                    if content:
                        ai_response_content += content
                        # SSE 格式: data: <json>\n\n
                        response = ChatStreamResponse(
                            type="token",
                            content=content
                        )
                        yield f"data: {response.model_dump_json()}\n\n"
            
            # 处理链结束，获取完整状态
            elif kind == "on_chain_end":
                output = event["data"].get("output")
                if output and isinstance(output, dict):
                    if "current_question_index" in output:
                        final_question_index = output["current_question_index"]
                    
                    # 可以在这里发送状态更新事件
                    if "question_count" in output:
                        # 更新会话元数据
                        await session_service.update_session(
                            session_id=thread_id,
                            metadata_updates={
                                "question_count": output["question_count"]
                            }
                        )
                        
                        response = ChatStreamResponse(
                            type="state_update",
                            content=json.dumps({
                                "question_count": output["question_count"],
                                "max_questions": output.get("max_questions", inputs.get("max_questions", 5))
                            })
                        )
                        yield f"data: {response.model_dump_json()}\n\n"
        
        # 保存AI响应到会话
        if ai_response_content:
            await session_service.add_message(
                session_id=thread_id,
                role="assistant",
                content=ai_response_content,
                question_index=final_question_index
            )
        
        # 发送结束信号
        response = ChatStreamResponse(
            type="done",
            content="[DONE]"
        )
        yield f"data: {response.model_dump_json()}\n\n"
        
    except Exception as e:
        logger.error(f"流式事件生成器错误: {str(e)}")
        # 发送错误事件
        response = ChatStreamResponse(
            type="error",
            content=str(e)
        )
        yield f"data: {response.model_dump_json()}\n\n"


@router.get("/status/{thread_id}")
async def get_chat_status(thread_id: str):
    """
    获取聊天会话状态
    
    Args:
        thread_id: 线程 ID
        
    Returns:
        dict: 会话状态信息
    """
    try:
        # 这里可以实现获取会话状态的逻辑
        # 目前返回基本信息
        return {
            "success": True,
            "thread_id": thread_id,
            "status": "active"
        }
        
    except Exception as e:
        logger.error(f"获取聊天状态失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取聊天状态失败"
            }
        )


@router.delete("/session/{thread_id}")
async def end_chat_session(thread_id: str):
    """
    结束聊天会话
    
    Args:
        thread_id: 线程 ID
        
    Returns:
        dict: 会话结束结果
    """
    try:
        # 这里可以实现清理会话的逻辑
        return {
            "success": True,
            "message": f"会话 {thread_id} 已结束",
            "thread_id": thread_id
        }
        
    except Exception as e:
        logger.error(f"结束聊天会话失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "结束聊天会话失败"
            }
        )


@router.post("/rollback")
async def rollback_chat(
    request: RollbackRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    回退聊天会话
    
    Args:
        request: 回退请求
        x_user_id: 用户ID（从 Header 中获取，用于权限校验）
        
    Returns:
        dict: 回退结果
    """
    try:
        success = await session_service.rollback_session(
            request.thread_id, 
            request.index,
            user_id=x_user_id
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Session or message not found")
            
        return {
            "success": True,
            "message": f"会话已回退至索引 {request.index}",
            "thread_id": request.thread_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"回退会话失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "回退会话失败"
            }
        )


@router.post("/profile/generate")
async def generate_profile(
    request: Optional[ProfileGenerateRequest] = Body(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    手动触发：生成用户综合能力画像
    
    基于最近 5 次面试，使用时间加权聚合算法生成综合画像
    
    Returns:
        dict: 生成结果
    """
    try:
        from app.services.ability_service import get_ability_service
        
        # 优先从 request 用 user_id，其次用 header，最后 default
        user_id = (request.user_id if request else None) or x_user_id or "default_user"
        api_config_dict = request.api_config.model_dump() if (request and request.api_config) else None
        
        service = get_ability_service()
        # 注意：现在返回的是字典 {"profile": CandidateProfile, "warning": str}
        # 传递 api_config 供服务层使用
        result = await service.generate_overall_profile(user_id=user_id, api_config=api_config_dict)
        
        profile = result["profile"]
        warning = result.get("warning")
        
        # 检查是否是空画像（无数据）
        if profile.overall_assessment == "暂无面试记录，请先进行模拟面试。":
            return {
                "success": False,
                "message": "暂无面试记录，无法生成画像。请先完成至少一次模拟面试。"
            }
        
        response = {
            "success": True,
            "message": "综合能力画像已生成",
            "profile": profile.model_dump()
        }
        
        if warning:
            response["warning"] = warning
            
        return response
        
    except ValueError as e:
        # 处理冷却时间等业务逻辑错误
        return {
            "success": False,
            "message": str(e)
        }
    except Exception as e:
        logger.error(f"生成综合能力画像失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": f"生成综合能力画像失败: {str(e)}"
            }
        )


@router.get("/profile/overall")
async def get_overall_profile(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取用户综合能力画像（从数据库读取已生成的画像）
    
    如果尚未生成，返回提示信息
    
    Returns:
        dict: 画像数据或提示信息
    """
    try:
        from app.services.ability_service import get_ability_service
        
        user_id = x_user_id or "default_user"
        service = get_ability_service()
        result = await service.get_overall_profile(user_id=user_id)
        
        if result is None:
            return {
                "success": False,
                "message": "尚未生成综合能力画像。请点击「生成画像」按钮。"
            }
        
        return {
            "success": True,
            "profile": result["profile"],
            "generated_at": result["updated_at"]
        }
        
    except Exception as e:
        logger.error(f"获取综合能力画像失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取综合能力画像失败"
            }
        )


@router.get("/profile/session/{session_id}")
async def get_session_profile(
    session_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取单个会话的能力画像
    
    Args:
        session_id: 会话ID
        
    Returns:
        dict: 画像数据或生成中提示
    """
    try:
        profile = await session_service.get_profile(session_id)
        
        if profile is None:
            return {
                "success": False,
                "message": "画像生成中，请稍后刷新"
            }
        
        return {
            "success": True,
            "profile": profile
        }
        
    except Exception as e:
        logger.error(f"获取会话画像失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取会话画像失败"
            }
        )