"""
简历工具 API 路由
提供简历竞争力分析和简历内容优化接口
"""

import json
import logging
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse

from app.models.resume_schemas import (
    ResumeAnalyzeRequest,
    ResumeAnalyzeResponse,
    ResumeOptimizeRequest,
    ResumeOptimizeResponse,
    CompletedSessionsResponse,
    CompletedSessionItem,
    ResumeGenerateInitRequest,
    ResumeGenerateSubmitRequest,
    ResumeGenerateInitResponse,
    ResumeGenerateSubmitResponse,
    GeneratedResumeItem,
    GeneratedResumesResponse
)
from app.database.session_service import SessionService
from app.database.resume_service import get_resume_service
from app.database.resume_generation_service import get_generation_service
from app.core.resume_analyzer_graph import analyze_resume
from app.core.resume_optimizer_graph import optimize_resume, optimize_resume_streaming
from app.core.resume_generation_graph import (
    init_generation_session,
    submit_user_answers,
    get_session_status
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resume", tags=["简历工具"])

# 实例化服务
session_service = SessionService()


@router.post("/analyze", response_model=ResumeAnalyzeResponse)
async def analyze_resume_endpoint(
    request: ResumeAnalyzeRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    简历竞争力分析接口
    
    对简历进行多维度分析，返回评分、优缺点和改进建议。
    可选择关联面试记录以获得更精准的分析。
    """
    user_id = x_user_id or request.user_id or "default_user"
    
    # 验证 session_ids 数量
    if len(request.session_ids) > 3:
        raise HTTPException(
            status_code=400,
            detail="最多只能选择 3 个面试记录"
        )
    
    # 验证 API 配置
    if not request.api_config:
        raise HTTPException(
            status_code=400,
            detail="请先配置 API Key"
        )
    
    try:
        # 执行分析
        result = await analyze_resume(
            resume_content=request.resume_content,
            job_description=request.job_description,
            session_ids=request.session_ids,
            user_id=user_id,
            api_config=request.api_config.model_dump() if request.api_config else None
        )
        
        # 保存结果
        resume_service = get_resume_service()
        result_id = await resume_service.save_result(
            user_id=user_id,
            result_type="analyze",
            resume_content=request.resume_content,
            result_data=result,
            job_description=request.job_description,
            session_ids=request.session_ids
        )
        
        return ResumeAnalyzeResponse(
            success=True,
            result=result,
            result_id=result_id
        )
        
    except ValueError as e:
        # API 配置错误等
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"简历分析失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"分析失败: {str(e)}"
        )


@router.post("/optimize", response_model=ResumeOptimizeResponse)
async def optimize_resume_endpoint(
    request: ResumeOptimizeRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    简历内容优化接口
    
    采用圆桌会议式多智能体架构，包括匹配分析师、内容优化师、HR审核官的协作分析。
    可选择关联面试记录和综合能力画像以获得更精准的优化建议。
    """
    user_id = x_user_id or request.user_id or "default_user"
    
    # 验证 session_ids 数量
    if len(request.session_ids) > 3:
        raise HTTPException(
            status_code=400,
            detail="最多只能选择 3 个面试记录"
        )
    
    # 验证 API 配置
    if not request.api_config:
        raise HTTPException(
            status_code=400,
            detail="请先配置 API Key"
        )
    
    try:
        # 执行优化
        result = await optimize_resume(
            resume_content=request.resume_content,
            job_description=request.job_description,
            session_ids=request.session_ids,
            include_overall_profile=request.include_overall_profile,
            user_id=user_id,
            api_config=request.api_config.model_dump() if request.api_config else None
        )
        
        # 保存结果
        resume_service = get_resume_service()
        result_id = await resume_service.save_result(
            user_id=user_id,
            result_type="optimize",
            resume_content=request.resume_content,
            result_data=result,
            job_description=request.job_description,
            session_ids=request.session_ids,
            include_profile=request.include_overall_profile
        )
        
        return ResumeOptimizeResponse(
            success=True,
            result=result,
            result_id=result_id
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"简历优化失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"优化失败: {str(e)}"
        )


@router.post("/optimize/stream")
async def optimize_resume_stream_endpoint(
    request: ResumeOptimizeRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    简历内容优化接口 (SSE 流式)
    
    采用圆桌会议式多智能体架构，实时推送优化进度。
    """
    user_id = x_user_id or request.user_id or "default_user"
    
    # 验证 session_ids 数量
    if len(request.session_ids) > 3:
        raise HTTPException(
            status_code=400,
            detail="最多只能选择 3 个面试记录"
        )
    
    # 验证 API 配置
    if not request.api_config:
        raise HTTPException(
            status_code=400,
            detail="请先配置 API Key"
        )
    
    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE 事件生成器"""
        final_result = None
        try:
            async for event in optimize_resume_streaming(
                resume_content=request.resume_content,
                job_description=request.job_description,
                session_ids=request.session_ids,
                include_overall_profile=request.include_overall_profile,
                user_id=user_id,
                api_config=request.api_config.model_dump() if request.api_config else None
            ):
                # 捕获最终结果
                if event.get("type") == "result":
                    final_result = event.get("data")
                
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            
            # 保存结果到数据库
            result_id = None
            if final_result:
                try:
                    resume_service = get_resume_service()
                    result_id = await resume_service.save_result(
                        user_id=user_id,
                        result_type="optimize",
                        resume_content=request.resume_content,
                        result_data=final_result,
                        job_description=request.job_description,
                        session_ids=request.session_ids,
                        include_profile=request.include_overall_profile
                    )
                    logger.info(f"流式优化结果已保存: ID={result_id}")
                except Exception as save_error:
                    logger.error(f"保存流式优化结果失败: {save_error}")
            
            # 发送结束信号（包含 result_id 供前端选中）
            yield f"data: {json.dumps({'type': 'done', 'content': '[DONE]', 'result_id': result_id})}\n\n"
            
        except Exception as e:
            logger.error(f"SSE 流式优化失败: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/sessions", response_model=CompletedSessionsResponse)
async def get_completed_sessions(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    limit: int = 10
):
    """
    获取可用于简历优化的已完成面试会话列表
    """
    user_id = x_user_id or "default_user"
    logger.info(f"获取已完成会话: user_id={user_id}, header={x_user_id}")
    
    try:
        sessions = await session_service.get_completed_sessions_for_resume(
            user_id=user_id,
            limit=limit
        )
        
        return CompletedSessionsResponse(
            success=True,
            sessions=[
                CompletedSessionItem(
                    session_id=s['session_id'],
                    title=s['title'],
                    updated_at=s['updated_at'],
                    round_index=s['round_index'],
                    round_type=s['round_type'],
                    message_count=s['message_count']
                )
                for s in sessions
            ]
        )
        
    except Exception as e:
        logger.error(f"获取已完成会话列表失败: {e}", exc_info=True)
        return CompletedSessionsResponse(
            success=False,
            sessions=[],
            message=f"获取失败: {str(e)}"
        )


@router.get("/results")
async def list_resume_results(
    result_type: Optional[str] = None,
    limit: int = 20,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取用户的简历分析/优化历史记录
    """
    user_id = x_user_id or "default_user"
    
    try:
        resume_service = get_resume_service()
        results = await resume_service.list_results(
            user_id=user_id,
            result_type=result_type,
            limit=limit
        )
        
        return {
            "success": True,
            "results": results
        }
        
    except Exception as e:
        logger.error(f"获取历史记录失败: {e}", exc_info=True)
        return {
            "success": False,
            "results": [],
            "message": str(e)
        }


@router.get("/results/{result_id}")
async def get_resume_result(
    result_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取单个简历分析/优化结果
    """
    user_id = x_user_id or "default_user"
    
    try:
        resume_service = get_resume_service()
        result = await resume_service.get_result(result_id, user_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="结果不存在")
        
        return {
            "success": True,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/results/{result_id}")
async def delete_resume_result(
    result_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    删除简历分析/优化结果
    """
    user_id = x_user_id or "default_user"
    
    try:
        resume_service = get_resume_service()
        success = await resume_service.delete_result(result_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="结果不存在或无权删除")
        
        return {"success": True, "message": "删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除结果失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# 简历生成接口
# ============================================================================

@router.post("/generation/init", response_model=ResumeGenerateInitResponse)
async def init_resume_generation(
    request: ResumeGenerateInitRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    初始化简历生成会话
    
    根据优化结果启动简历生成流程。如果需要用户补充信息，返回问题列表；
    否则直接返回生成的简历。
    """
    user_id = x_user_id or request.user_id or "default_user"
    
    if not request.api_config:
        raise HTTPException(status_code=400, detail="请先配置 API Key")
    
    try:
        result = await init_generation_session(
            resume_content=request.resume_content,
            job_description=request.job_description,
            optimization_result=request.optimization_result,
            user_id=user_id,
            template_style=request.template_style,
            api_config=request.api_config.model_dump() if request.api_config else None
        )
        
        return ResumeGenerateInitResponse(
            success=True,
            session_id=result["session_id"],
            needs_input=result["needs_input"],
            questions=result.get("questions", []),
            result=result.get("result")
        )
        
    except Exception as e:
        logger.error(f"初始化简历生成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generation/submit", response_model=ResumeGenerateSubmitResponse)
async def submit_generation_answers(
    request: ResumeGenerateSubmitRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    提交用户回答并完成简历生成
    """
    if not request.api_config:
        raise HTTPException(status_code=400, detail="请先配置 API Key")
    
    try:
        result = await submit_user_answers(
            session_id=request.session_id,
            answers=request.answers,
            api_config=request.api_config.model_dump() if request.api_config else None
        )
        
        return ResumeGenerateSubmitResponse(
            success=True,
            resume_id=result.get("resume_id"),
            title=result.get("title"),
            content=result.get("content")
        )
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"提交生成回答失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generation/session/{session_id}")
async def get_generation_session_status(session_id: str):
    """
    获取生成会话状态（用于页面刷新后恢复）
    """
    status = await get_session_status(session_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="会话不存在或已过期")
    
    return {"success": True, "data": status}


@router.get("/generated", response_model=GeneratedResumesResponse)
async def list_generated_resumes(
    limit: int = 20,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取用户生成的简历列表
    """
    user_id = x_user_id or "default_user"
    
    try:
        service = get_generation_service()
        resumes = await service.list_generated_resumes(user_id, limit)
        
        return GeneratedResumesResponse(
            success=True,
            resumes=[
                GeneratedResumeItem(
                    id=r["id"],
                    title=r["title"],
                    job_description=r.get("job_description"),
                    created_at=r["created_at"]
                )
                for r in resumes
            ]
        )
        
    except Exception as e:
        logger.error(f"获取生成的简历列表失败: {e}", exc_info=True)
        return GeneratedResumesResponse(success=False, message=str(e))


@router.get("/generated/{resume_id}")
async def get_generated_resume(
    resume_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    获取单个生成的简历
    """
    user_id = x_user_id or "default_user"
    
    try:
        service = get_generation_service()
        resume = await service.get_generated_resume(resume_id, user_id)
        
        if not resume:
            raise HTTPException(status_code=404, detail="简历不存在")
        
        return {"success": True, "resume": resume}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取生成的简历失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/generated/{resume_id}")
async def delete_generated_resume(
    resume_id: int,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
):
    """
    删除生成的简历
    """
    user_id = x_user_id or "default_user"
    
    try:
        service = get_generation_service()
        success = await service.delete_generated_resume(resume_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="简历不存在或无权删除")
        
        return {"success": True, "message": "删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除生成的简历失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
