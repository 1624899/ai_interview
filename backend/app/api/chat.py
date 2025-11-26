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
from app.models.schemas import ChatRequest, ChatStreamResponse, InterviewStartRequest, ErrorResponse

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["聊天"])


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
        # 初始化图谱
        graph = build_interview_graph(request.mode)
        
        # 配置线程 ID
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 构建初始状态
        inputs = {
            "messages": [],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "mode": request.mode,
            "question_count": 0,
            "max_questions": request.max_questions
        }
        
        # 返回会话信息
        return {
            "success": True,
            "message": "面试会话已初始化",
            "thread_id": request.thread_id,
            "mode": request.mode,
            "max_questions": request.max_questions
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
        # 初始化图谱
        graph = build_interview_graph(request.mode)
        
        # 配置线程 ID
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # 构建输入状态
        inputs = {
            "messages": [HumanMessage(content=request.message)],
            "resume_context": request.resume_context,
            "job_description": request.job_description,
            "mode": request.mode,
            "question_count": 0,  # 这个值会从数据库中恢复
            "max_questions": request.max_questions
        }
        
        return StreamingResponse(
            event_generator(graph, inputs, config),
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


async def event_generator(graph, inputs, config) -> AsyncGenerator[str, None]:
    """
    生成器：将 LangGraph 事件转换为 SSE 格式
    
    Args:
        graph: LangGraph 实例
        inputs: 输入状态
        config: 配置参数
        
    Yields:
        str: SSE 格式的事件数据
    """
    try:
        async for event in graph.astream_events(inputs, config=config, version="v1"):
            kind = event["event"]
            
            # 处理 LLM 生成的 token
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
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
                        response = ChatStreamResponse(
                            type="state_update",
                            content=json.dumps({
                                "question_count": output["question_count"],
                                "max_questions": output.get("max_questions", 5)
                            })
                        )
                        yield f"data: {response.model_dump_json()}\n\n"
        
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