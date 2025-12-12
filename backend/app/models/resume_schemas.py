"""
简历工具相关的请求/响应模型
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.models.schemas import ApiConfig


# ============================================================================
# 请求模型
# ============================================================================

class ResumeOptimizeRequest(BaseModel):
    """简历优化请求"""
    resume_content: str = Field(..., description="简历内容")
    job_description: str = Field(..., description="目标职位描述")
    session_ids: List[str] = Field(default=[], description="关联的面试 session_id 列表，最多3个")
    include_overall_profile: bool = Field(default=False, description="是否包含综合能力画像")
    user_id: Optional[str] = Field(default=None, description="用户标识")
    api_config: Optional[ApiConfig] = Field(default=None, description="用户自定义 API 配置")


class ResumeAnalyzeRequest(BaseModel):
    """简历竞争力分析请求"""
    resume_content: str = Field(..., description="简历内容")
    job_description: Optional[str] = Field(default=None, description="目标职位描述（可选）")
    session_ids: List[str] = Field(default=[], description="关联的面试 session_id 列表，最多3个")
    user_id: Optional[str] = Field(default=None, description="用户标识")
    api_config: Optional[ApiConfig] = Field(default=None, description="用户自定义 API 配置")


# ============================================================================
# 响应模型
# ============================================================================

class DimensionScore(BaseModel):
    """维度评分"""
    score: float = Field(..., ge=0, le=100, description="评分 (0-100)")
    comment: str = Field(..., description="评价说明")


class ResumeOptimizeResult(BaseModel):
    """简历优化结果"""
    match_score: float = Field(..., ge=0, le=100, description="JD 匹配度 (0-100)")
    hr_pass_rate: float = Field(..., ge=0, le=100, description="HR 通过率预估 (0-100)")
    optimized_sections: List[Dict[str, Any]] = Field(..., description="各部分优化建议")
    key_improvements: List[str] = Field(..., description="关键改进点")
    interview_insights: Optional[str] = Field(default=None, description="基于面试的洞察")
    keyword_analysis: Optional[Dict[str, Any]] = Field(default=None, description="关键词分析")


class ResumeAnalyzeResult(BaseModel):
    """简历竞争力分析结果"""
    overall_score: float = Field(..., ge=0, le=100, description="综合评分 (0-100)")
    dimension_scores: Dict[str, DimensionScore] = Field(..., description="各维度评分")
    strengths: List[str] = Field(..., description="优势")
    weaknesses: List[str] = Field(..., description="不足")
    priority_improvements: List[str] = Field(..., description="优先改进建议")
    interview_insights: Optional[str] = Field(default=None, description="基于面试的洞察")


# ============================================================================
# API 响应包装
# ============================================================================

class ResumeOptimizeResponse(BaseModel):
    """简历优化 API 响应"""
    success: bool = Field(..., description="是否成功")
    result: Optional[ResumeOptimizeResult] = Field(default=None, description="优化结果")
    result_id: Optional[int] = Field(default=None, description="结果 ID（用于后续查询）")
    message: Optional[str] = Field(default=None, description="消息")


class ResumeAnalyzeResponse(BaseModel):
    """简历分析 API 响应"""
    success: bool = Field(..., description="是否成功")
    result: Optional[ResumeAnalyzeResult] = Field(default=None, description="分析结果")
    result_id: Optional[int] = Field(default=None, description="结果 ID（用于后续查询）")
    message: Optional[str] = Field(default=None, description="消息")


class CompletedSessionItem(BaseModel):
    """可用于简历优化的已完成会话"""
    session_id: str = Field(..., description="会话 ID")
    title: str = Field(..., description="会话标题")
    updated_at: str = Field(..., description="更新时间")
    round_index: int = Field(default=1, description="面试轮次")
    round_type: str = Field(default="tech_initial", description="面试类型")
    message_count: int = Field(default=0, description="消息数量")


class CompletedSessionsResponse(BaseModel):
    """已完成会话列表响应"""
    success: bool = Field(..., description="是否成功")
    sessions: List[CompletedSessionItem] = Field(default=[], description="会话列表")
    message: Optional[str] = Field(default=None, description="消息")


# ============================================================================
# 简历生成相关模型
# ============================================================================

class ResumeGenerateInitRequest(BaseModel):
    """简历生成初始化请求"""
    optimization_result_id: Optional[int] = Field(default=None, description="关联的优化结果 ID")
    resume_content: str = Field(..., description="简历内容")
    job_description: str = Field(..., description="目标职位描述")
    optimization_result: Dict[str, Any] = Field(..., description="优化结果数据")
    template_style: str = Field(default="professional", description="模板风格: professional/academic/creative")
    user_id: Optional[str] = Field(default=None, description="用户标识")
    api_config: Optional[ApiConfig] = Field(default=None, description="API 配置")


class ResumeGenerateSubmitRequest(BaseModel):
    """简历生成提交回答请求"""
    session_id: str = Field(..., description="会话 ID")
    answers: Dict[str, str] = Field(..., description="用户回答 {问题: 回答}")
    api_config: Optional[ApiConfig] = Field(default=None, description="API 配置")


class ResumeGenerateInitResponse(BaseModel):
    """简历生成初始化响应"""
    success: bool = Field(..., description="是否成功")
    session_id: str = Field(..., description="会话 ID")
    needs_input: bool = Field(..., description="是否需要用户输入")
    questions: List[str] = Field(default=[], description="需要用户回答的问题")
    result: Optional[Dict[str, Any]] = Field(default=None, description="如果无需输入，直接返回结果")
    message: Optional[str] = Field(default=None, description="消息")


class ResumeGenerateSubmitResponse(BaseModel):
    """简历生成提交响应"""
    success: bool = Field(..., description="是否成功")
    resume_id: Optional[int] = Field(default=None, description="生成的简历 ID")
    title: Optional[str] = Field(default=None, description="简历标题")
    content: Optional[str] = Field(default=None, description="生成的简历内容 (Markdown)")
    message: Optional[str] = Field(default=None, description="消息")


class GeneratedResumeItem(BaseModel):
    """生成的简历列表项"""
    id: int = Field(..., description="ID")
    title: str = Field(..., description="标题")
    job_description: Optional[str] = Field(default=None, description="目标职位")
    created_at: str = Field(..., description="创建时间")


class GeneratedResumesResponse(BaseModel):
    """生成的简历列表响应"""
    success: bool = Field(..., description="是否成功")
    resumes: List[GeneratedResumeItem] = Field(default=[], description="简历列表")
    message: Optional[str] = Field(default=None, description="消息")

