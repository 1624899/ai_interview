"""
Pydantic 数据模型定义
用于 FastAPI 的请求和响应数据验证
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field
from enum import Enum


# ============================================================================
# 用户 API 配置模型
# ============================================================================

class ModelChannelConfig(BaseModel):
    """单个通道的模型配置"""
    api_key: str = Field(..., description="API Key")
    base_url: str = Field(..., description="API Base URL")
    model: str = Field(..., description="模型名称")


class ApiConfig(BaseModel):
    """用户自定义的 API 配置 - 支持双通道独立配置"""
    smart: ModelChannelConfig = Field(..., description="Smart 通道配置（复杂任务）")
    fast: ModelChannelConfig = Field(..., description="Fast 通道配置（快速响应）")


# ============================================================================
# 请求/响应模型
# ============================================================================

class ChatRequest(BaseModel):
    """聊天请求模型"""
    message: str = Field(..., description="用户消息内容")
    thread_id: str = Field(..., description="会话线程ID")
    mode: Literal["mock"] = Field(default="mock", description="面试模式")
    resume_context: str = Field(..., description="简历上下文")
    job_description: str = Field(..., description="岗位描述")
    company_info: str = Field(default="未知", description="公司背景信息")
    max_questions: int = Field(default=5, description="最大问题数量")
    # 用户配置（可选）
    user_id: Optional[str] = Field(default=None, description="用户标识")
    api_config: Optional[ApiConfig] = Field(default=None, description="用户自定义 API 配置")


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


class InterviewStartRequest(BaseModel):
    """面试开始请求模型"""
    thread_id: str = Field(..., description="会话线程ID")
    mode: Literal["mock"] = Field(..., description="面试模式")
    resume_context: str = Field(..., description="简历上下文")
    resume_filename: str = Field(default="", description="简历文件名")
    job_description: str = Field(..., description="岗位描述")
    company_info: str = Field(default="未知", description="公司背景信息")
    max_questions: int = Field(default=5, description="最大问题数量")
    # 用户配置（可选）
    user_id: Optional[str] = Field(default=None, description="用户标识")
    api_config: Optional[ApiConfig] = Field(default=None, description="用户自定义 API 配置")


class ErrorResponse(BaseModel):
    """错误响应模型"""
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误消息")
    details: Optional[dict] = Field(None, description="错误详情")


class RollbackRequest(BaseModel):
    """回退请求模型"""
    thread_id: str = Field(..., description="会话线程ID")
    index: int = Field(..., description="回退到的消息索引（0-based）")


class ApiConfigValidateRequest(BaseModel):
    """API 配置验证请求"""
    api_key: str = Field(..., description="API Key")
    base_url: str = Field(..., description="API Base URL")
    model: str = Field(..., description="模型名称")


# ============================================================================
# 评估结果数据模型（用于 Tool Calling 和结构化输出）
# ============================================================================

class EvaluationDecision(str, Enum):
    """评估决策枚举 - 严格限定评估结果的类型"""
    ANSWER_PASS = "ANSWER_PASS"
    ANSWER_WEAK = "ANSWER_WEAK"
    ANSWER_INCORRECT = "ANSWER_INCORRECT"
    ASK_CLARIFICATION = "ASK_CLARIFICATION"
    UNKNOWN = "UNKNOWN"


class EvaluationResult(BaseModel):
    """
    评估结果数据模型
    
    用于 Tool Calling 的强类型约束，彻底抛弃不稳定的正则 JSON 提取方法。
    严格限定 decision 字段为枚举值，并要求 reason 字段为字符串。
    """
    decision: EvaluationDecision = Field(
        ...,
        description="评估决策结果，必须是预定义的枚举值之一"
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="决策理由或追问方向，必须提供具体原因"
    )
    
    class Config:
        """Pydantic 配置"""
        use_enum_values = True  # 允许枚举值序列化
        json_encoders = {
            EvaluationDecision: lambda v: v.value
        }
    
    def __str__(self) -> str:
        """字符串表示"""
        return f"EvaluationResult(decision={self.decision.value}, reason={self.reason})"


class InterviewTurnResult(BaseModel):
    """单次面试交互的完整结果"""
    
    # 核心决策：决定状态机是否流转
    action: Literal["CONTINUE_CURRENT", "MOVE_NEXT", "FINISH_INTERVIEW"] = Field(
        ..., 
        description="决策：需要追问或纠正选 CONTINUE_CURRENT；通过或跳过选 MOVE_NEXT；全部结束选 FINISH_INTERVIEW"
    )
    
    # 回复内容：直接展示给用户的文本
    reply_to_user: str = Field(
        ..., 
        description="面试官对用户的具体回复内容（包含点评、追问或下一题的题干）"
    )
    
    # 内部理由：用于调试
    reasoning: str = Field(
        ..., 
        description="做出该决策的简短理由"
    )