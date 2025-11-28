"""
Pydantic 数据模型定义
用于 FastAPI 的请求和响应数据验证
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """聊天请求模型"""
    message: str = Field(..., description="用户消息内容")
    thread_id: str = Field(..., description="会话线程ID")
    mode: Literal["coach", "mock"] = Field(default="coach", description="面试模式")
    resume_context: str = Field(..., description="简历上下文")
    job_description: str = Field(..., description="岗位描述")
    max_questions: int = Field(default=5, description="最大问题数量")


class ChatStreamResponse(BaseModel):
    """聊天流式响应模型"""
    type: str = Field(..., description="响应类型: token, error, done")
    content: Optional[str] = Field(None, description="响应内容")
    

class FileUploadResponse(BaseModel):
    """文件上传响应模型"""
    success: bool = Field(..., description="上传是否成功")
    message: str = Field(..., description="响应消息")
    filename: Optional[str] = Field(None, description="存储的文件名")
    content_length: Optional[int] = Field(None, description="提取的文本长度")
    text_content: Optional[str] = Field(None, description="提取的文本内容")


class ResumeInfo(BaseModel):
    """简历信息模型"""
    original_name: str = Field(..., description="原始文件名")
    stored_name: str = Field(..., description="存储的文件名")
    upload_time: str = Field(..., description="上传时间")
    file_size: int = Field(..., description="文件大小（字节）")
    content_length: int = Field(..., description="文本内容长度")
    use_count: int = Field(default=0, description="使用次数")
    last_used: Optional[str] = Field(None, description="最后使用时间")


class ResumeListResponse(BaseModel):
    """简历列表响应模型"""
    success: bool = Field(..., description="获取是否成功")
    resumes: List[ResumeInfo] = Field(..., description="简历列表")


class InterviewStartRequest(BaseModel):
    """面试开始请求模型"""
    thread_id: str = Field(..., description="会话线程ID")
    mode: Literal["coach", "mock"] = Field(..., description="面试模式")
    resume_context: str = Field(..., description="简历上下文")
    job_description: str = Field(..., description="岗位描述")
    max_questions: int = Field(default=5, description="最大问题数量")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    details: Optional[dict] = Field(None, description="错误详情")


class RollbackRequest(BaseModel):
    """回退请求模型"""
    thread_id: str = Field(..., description="会话线程ID")
    index: int = Field(..., description="回退到的消息索引（0-based）")