"""
文件上传相关的 API 路由
"""

import os
import logging
from typing import List
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse

from app.services.file_service import FileService, FileServiceError, UnsupportedFileTypeError, FileSizeExceededError
from app.models.schemas import FileUploadResponse, ResumeListResponse, ResumeInfo, ErrorResponse

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["文件上传"])

# 实例化文件服务
file_service = FileService()


@router.post("/resume", response_model=FileUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    上传简历文件
    
    Args:
        file: 上传的文件对象
        
    Returns:
        FileUploadResponse: 上传结果
        
    Raises:
        HTTPException: 文件处理失败时抛出异常
    """
    try:
        # 处理文件
        text_content = await file_service.process_fastapi_file(file)
        
        return FileUploadResponse(
            success=True,
            message=f"文件 {file.filename} 上传并处理成功",
            filename=file.filename,
            content_length=len(text_content),
            text_content=text_content
        )
        
    except UnsupportedFileTypeError as e:
        logger.error(f"不支持的文件类型: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "UnsupportedFileType",
                "message": str(e),
                "supported_formats": file_service.allowed_extensions
            }
        )
        
    except FileSizeExceededError as e:
        logger.error(f"文件大小超限: {str(e)}")
        raise HTTPException(
            status_code=413,
            detail={
                "error": "FileSizeExceeded",
                "message": str(e),
                "max_size_mb": file_service.max_file_size_bytes / (1024 * 1024)
            }
        )
        
    except FileServiceError as e:
        logger.error(f"文件服务错误: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "FileServiceError",
                "message": str(e)
            }
        )
        
    except Exception as e:
        logger.error(f"上传文件时发生未知错误: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "服务器内部错误，请稍后重试"
            }
        )


@router.get("/resumes", response_model=ResumeListResponse)
async def get_resume_list():
    """
    获取已上传的简历列表
    
    Returns:
        ResumeListResponse: 简历列表
    """
    try:
        resumes_data = file_service.get_resume_list()
        
        # 转换为 ResumeInfo 对象
        resumes = []
        for resume_data in resumes_data:
            resume = ResumeInfo(**resume_data)
            resumes.append(resume)
        
        return ResumeListResponse(
            success=True,
            resumes=resumes
        )
        
    except Exception as e:
        logger.error(f"获取简历列表失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取简历列表失败"
            }
        )


@router.get("/resumes/{filename}", response_model=FileUploadResponse)
async def get_resume_content(filename: str):
    """
    获取指定简历的文本内容
    
    Args:
        filename: 存储的文件名
        
    Returns:
        FileUploadResponse: 简历内容
    """
    try:
        # 获取简历信息
        resume_info = file_service.get_resume_by_filename(filename)
        
        # 构建文件路径
        file_path = os.path.join(file_service.upload_dir, filename)
        
        # 提取文本内容
        text_content = file_service.extract_text(file_path)
        
        # 更新使用统计
        file_service.update_usage_stats(filename)
        
        return FileUploadResponse(
            success=True,
            message=f"简历 {resume_info['original_name']} 加载成功",
            filename=filename,
            content_length=len(text_content),
            text_content=text_content
        )
        
    except FileNotFoundError as e:
        logger.error(f"简历文件未找到: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail={
                "error": "FileNotFound",
                "message": str(e)
            }
        )
        
    except Exception as e:
        logger.error(f"获取简历内容失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "获取简历内容失败"
            }
        )


@router.delete("/resumes/{filename}")
async def delete_resume(filename: str):
    """
    删除指定的简历文件
    
    Args:
        filename: 存储的文件名
        
    Returns:
        dict: 删除结果
    """
    try:
        # 获取简历信息
        resume_info = file_service.get_resume_by_filename(filename)
        
        # 构建文件路径
        file_path = os.path.join(file_service.upload_dir, filename)
        
        # 删除物理文件
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"删除简历文件: {filename}")
        else:
            logger.warning(f"文件不存在，跳过删除: {filename}")
        
        # 从元数据中删除
        metadata = file_service._load_metadata()
        if filename in metadata:
            del metadata[filename]
            file_service._save_metadata(metadata)
            logger.info(f"从元数据中删除简历: {filename}")
        
        return {
            "success": True,
            "message": f"简历 {resume_info['original_name']} 删除成功"
        }
        
    except FileNotFoundError as e:
        logger.error(f"简历文件未找到: {str(e)}")
        raise HTTPException(
            status_code=404,
            detail={
                "error": "FileNotFound",
                "message": str(e)
            }
        )
        
    except Exception as e:
        logger.error(f"删除简历失败: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "InternalServerError",
                "message": "删除简历失败"
            }
        )