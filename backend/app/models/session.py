"""
会话数据模型
定义面试会话的数据结构
"""

from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class MessageItem(BaseModel):
    """单条消息模型"""
    role: Literal["user", "ai", "system"] = Field(..., description="消息角色")
    content: str = Field(..., description="消息内容")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="消息时间戳")
    question_index: int = Field(default=0, description="对应的问题序号")


class SessionMetadata(BaseModel):
    """会话元数据"""
    mode: Literal["mock"] = Field(..., description="面试模式")
    resume_filename: Optional[str] = Field(None, description="简历文件名")
    resume_content: Optional[str] = Field(None, description="简历全文内容")
    job_description: Optional[str] = Field(None, description="岗位描述")
    company_info: Optional[str] = Field(None, description="公司信息")
    question_count: int = Field(default=0, description="已提问数量")
    max_questions: int = Field(default=5, description="最大问题数量")
    status: Literal["active", "completed", "archived"] = Field(default="active", description="会话状态")
    pinned: bool = Field(default=False, description="是否置顶")


class InterviewSession(BaseModel):
    """面试会话完整模型"""
    session_id: str = Field(..., description="会话ID (thread_id)")
    title: str = Field(..., description="会话标题")
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat(), description="创建时间")
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat(), description="更新时间")
    metadata: SessionMetadata = Field(..., description="会话元数据")
    messages: List[MessageItem] = Field(default_factory=list, description="消息列表")


class SessionListItem(BaseModel):
    """会话列表项（简化版）"""
    session_id: str = Field(..., description="会话ID")
    title: str = Field(..., description="会话标题")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")
    mode: Literal["mock"] = Field(..., description="面试模式")
    status: Literal["active", "completed", "archived"] = Field(..., description="会话状态")
    message_count: int = Field(default=0, description="消息数量")
    question_count: int = Field(default=0, description="已提问数量")
    pinned: bool = Field(default=False, description="是否置顶")


class SessionCreateRequest(BaseModel):
    """创建会话请求"""
    title: Optional[str] = Field(None, description="会话标题（可选，自动生成）")
    mode: Literal["mock"] = Field(..., description="面试模式")
    resume_filename: Optional[str] = Field(None, description="简历文件名")
    job_description: Optional[str] = Field(None, description="岗位描述")
    max_questions: int = Field(default=5, description="最大问题数量")


class SessionUpdateRequest(BaseModel):
    """更新会话请求"""
    title: Optional[str] = Field(None, description="会话标题")
    status: Optional[Literal["active", "completed", "archived"]] = Field(None, description="会话状态")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据更新")


class SessionListResponse(BaseModel):
    """会话列表响应"""
    success: bool = Field(..., description="是否成功")
    sessions: List[SessionListItem] = Field(..., description="会话列表")
    total: int = Field(..., description="总数量")


class SessionDetailResponse(BaseModel):
    """会话详情响应"""
    success: bool = Field(..., description="是否成功")
    session: InterviewSession = Field(..., description="会话详情")
