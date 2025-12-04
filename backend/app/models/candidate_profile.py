"""
候选人能力画像数据模型
用于后台异步分析服务
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class DimensionScore(BaseModel):
    """单个维度的评分"""
    score: float = Field(ge=0, le=10, description="评分 (0-10)")
    evidence: str = Field(description="支撑该评分的证据")
    trend: Optional[str] = Field(default=None, description="变化趋势: improving/stable/declining")


class CandidateProfile(BaseModel):
    """候选人综合能力画像"""
    
    # 核心维度评分
    technical_depth: DimensionScore = Field(description="技术深度")
    technical_breadth: DimensionScore = Field(description="知识广度")
    communication: DimensionScore = Field(description="沟通表达能力")
    problem_solving: DimensionScore = Field(description="问题解决思路")
    resume_authenticity: DimensionScore = Field(description="简历真实性/匹配度")
    
    # 元信息
    total_questions_analyzed: int = Field(default=0, description="已分析的问题数")
    last_updated: str = Field(description="最后更新时间")
    
    # 综合评价
    overall_assessment: Optional[str] = Field(default=None, description="整体评价摘要")
    key_strengths: List[str] = Field(default_factory=list, description="主要优势")
    key_weaknesses: List[str] = Field(default_factory=list, description="主要不足")
    
    # 推荐结果
    recommendation: Optional[str] = Field(default=None, description="录用建议: hire/maybe/no_hire")
    confidence: Optional[float] = Field(default=None, ge=0, le=1, description="推荐置信度")


class AnalysisContext(BaseModel):
    """分析上下文"""
    resume: str
    job_description: str
    company_info: str
    qa_history: List[Dict[str, str]]  # [{"question": "...", "answer": "..."}]
    previous_profile: Optional[CandidateProfile] = None
