"""
聊天相关的 API 路由
支持 Server-Sent Events (SSE) 流式输出
"""

import json
import logging
import uuid
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from app.core.graph import build_interview_graph
from app.models.schemas import ChatRequest, ChatStreamResponse, InterviewStartRequest, ErrorResponse, RollbackRequest
from app.services.session_service import SessionService

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["聊天"])

# 实例化会话服务
session_service = SessionService()


@router.post("/start")
async def start_interview(request: InterviewStartRequest):
    """
    开始新的面试会话
    
    Args:
        request: 面试开始请求
        
    Returns:
        dict: 会话开始结果
    """
    try:
        # 初始化图谱（异步）
        graph = await build_interview_graph(request.mode)
        
        # 配置线程 ID
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 构建初始状态（新架构）
        inputs = {
            "messages": [],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "company_info": getattr(request, "company_info", "未知"),
            "mode": request.mode,
            "interview_plan": [],  # 将由 planner 节点填充
            "current_question_index": 0,
            "max_questions": request.max_questions,
            "eval_status": "start_new",
            "eval_reason": "",
            "follow_up_count": 0,
            "clarify_count": 0,
            "question_count": 0
        }
        
        # 检查会话是否已存在，如果不存在则创建
        session = await session_service.get_session(request.thread_id)
        if session is None:
            await session_service.create_session(
                session_id=request.thread_id,
                mode=request.mode,
                resume_filename=request.resume_filename,
                resume_content=request.resume_context,
                job_description=request.job_description,
                company_info=getattr(request, "company_info", "未知"),
                max_questions=request.max_questions
            )
        
        # 生成并更新会话标题
        mode_str = "辅导模式" if request.mode == "coach" else "模拟面试"
        # 截取前20个字符作为摘要，防止过长
        summary = request.job_description[:20] + "..." if len(request.job_description) > 20 else request.job_description
        title = f"{mode_str}-{summary}"
        
        # 更新数据库中的会话标题
        await session_service.update_session(request.thread_id, title=title)

        # 返回会话信息
        return {
            "success": True,
            "message": "面试会话已初始化",
            "thread_id": request.thread_id,
            "mode": request.mode,
            "max_questions": request.max_questions,
            "session_title": title
        }
        
    except Exception as e:
        logger.error(f"开始面试会话失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "开始面试会话失败"
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
        
        # 构建输入状态（新架构）
        inputs = {
            "messages": [HumanMessage(content=request.message)],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "company_info": getattr(request, "company_info", "未知"),
            "mode": request.mode,
            "interview_plan": [],  # 会从 checkpoint 恢复
            "current_question_index": 0,  # 会从 checkpoint 恢复
            "max_questions": request.max_questions,
            "eval_status": "start_new",
            "eval_reason": "",
            "follow_up_count": 0,
            "clarify_count": 0,
            "question_count": 0  # 这个值会从数据库中恢复
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
    
    try:
        # 保存用户消息到会话
        await session_service.add_message(
            session_id=thread_id,
            role="user",
            content=user_message
        )
        
        async for event in graph.astream_events(inputs, config=config, version="v1"):
            kind = event["event"]
            
            # 处理 LLM 生成的 token
            if kind == "on_chat_model_stream":
                # 获取当前节点名称
                # 注意：langgraph_node 是 LangGraph 注入的元数据，用于标识当前运行的节点
                node_name = event.get("metadata", {}).get("langgraph_node", "")
                
                # 只流式传输面向用户的节点输出 (interviewer 和 summary)
                # 过滤掉 planner (生成 JSON 计划) 和 evaluator (评估用户回答) 的内部思考过程
                if node_name in ["interviewer", "summary"]:
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
                                "max_questions": output.get("max_questions", 5)
                            })
                        )
                        yield f"data: {response.model_dump_json()}\n\n"
        
        # 保存AI响应到会话
        if ai_response_content:
            await session_service.add_message(
                session_id=thread_id,
                role="ai",
                content=ai_response_content
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
async def rollback_chat(request: RollbackRequest):
    """
    回退聊天会话
    
    Args:
        request: 回退请求
        
    Returns:
        dict: 回退结果
    """
    try:
        success = await session_service.rollback_session(request.thread_id, request.index)
        
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