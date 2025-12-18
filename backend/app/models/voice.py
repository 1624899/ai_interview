from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class VoiceStartRequest(BaseModel):
    """语音面试开始请求"""
    thread_id: str = Field(..., description="会话ID")
    api_config: Dict[str, Any] = Field(..., description="API配置")
    resume_content: Optional[str] = None
    resume_filename: Optional[str] = None
    job_description: Optional[str] = None
    company_info: Optional[str] = None
    max_questions: int = 5


class VoiceChatRequest(BaseModel):
    """语音对话请求"""
    audio: Optional[str] = None
    message: Optional[str] = None  # 浏览器语音识别的文本
    system_prompt: str
    session_id: str
    api_config: Dict[str, Any]
    history: List[Dict[str, Any]] = []
    is_greeting: bool = False  # 是否为开场白模式（直接 TTS，不需要 AI 回复）
    audio_id: Optional[str] = None  # 浏览器端 IndexedDB 存储的音频 ID


class VoiceStartResponse(BaseModel):
    """语音面试开始响应"""
    success: bool
    session_id: str
    system_prompt: str
    first_question: str
    audio: Optional[str] = None
    greeting_text: Optional[str] = None  # 添加此字段，用于前端 TTS 流式生成
    history: List[Dict[str, Any]] = []   # 返回历史消息，用于前端恢复上下文
    round_index: int = 1  # 当前轮次（用于多轮面试）
    question_count: int = 0  # 当前进度
    max_questions: int = 5  # 总题数


class VoiceCloneRequest(BaseModel):
    """克隆语音会话请求"""
    source_session_id: str
    max_questions: Optional[int] = None
