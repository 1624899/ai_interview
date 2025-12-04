"""
文件上传相关的 API 路由
"""

import logging
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services.file_service import FileService, FileServiceError, UnsupportedFileTypeError, FileSizeExceededError
from app.models.schemas import FileUploadResponse

# 配置日志
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["文件上传"])

# 实例化文件服务
file_service = FileService()


@router.post("/resume", response_model=FileUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    上传简历文件并提取文本内容
    
    注意：文件不会被保存，只提取文本内容返回给前端
    简历内容会在后续创建会话时保存到 sessions 表中
    
    Args:
        file: 上传的文件对象
        
    Returns:
        FileUploadResponse: 上传结果，包含提取的文本内容
        
    Raises:
        HTTPException: 文件处理失败时抛出异常
    """
    try:
        # 处理文件并提取文本
        text_content = await file_service.process_fastapi_file(file)
        
        return FileUploadResponse(
            success=True,
            message=f"文件 {file.filename} 处理成功",
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