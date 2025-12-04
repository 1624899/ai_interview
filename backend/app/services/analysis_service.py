"""
候选人画像分析服务
基于 Smart Model 进行深度、多维度分析
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.models.candidate_profile import CandidateProfile, AnalysisContext, DimensionScore
from app.core.llms import get_smart_llm
from app.database.session_service import SessionService

logger = logging.getLogger(__name__)


class CandidateAnalysisService:
    """候选人画像分析服务（后台异步运行）"""
    
    def __init__(self):
        self.smart_llm = get_smart_llm()
        self.session_service = SessionService()
        # 缓存：session_id -> CandidateProfile
        self._profile_cache: Dict[str, CandidateProfile] = {}
    
    async def analyze_candidate(
        self,
        session_id: str,
        resume: str,
        job_description: str,
        company_info: str,
        qa_history: List[Dict[str, str]]
    ) -> CandidateProfile:
        """
        异步分析候选人能力画像
        
        Args:
            session_id: 会话ID
            resume: 简历内容
            job_description: 岗位描述
            company_info: 公司信息
            qa_history: 问答历史 [{"question": "...", "answer": "..."}]
            
        Returns:
            CandidateProfile: 更新后的能力画像
        """
        try:
            # 获取之前的画像（优先从缓存，其次从数据库）
            previous_profile = await self.get_cached_profile(session_id)
            
            # 构建分析上下文
            context = AnalysisContext(
                resume=resume,
                job_description=job_description,
                company_info=company_info,
                qa_history=qa_history,
                previous_profile=previous_profile
            )
            
            # 调用 Smart LLM 进行分析
            profile = await self._perform_analysis(context)
            
            # 更新缓存
            self._profile_cache[session_id] = profile
            
            # 持久化到数据库
            await self.session_service.save_profile(session_id, profile.model_dump())
            
            logger.info(f"[AnalysisService] 完成会话 {session_id} 的画像分析，共分析 {len(qa_history)} 轮对话")
            
            return profile
            
        except Exception as e:
            logger.error(f"[AnalysisService] 分析失败: {str(e)}")
            # 返回默认画像
            return self._get_default_profile()
    
    async def _perform_analysis(self, context: AnalysisContext) -> CandidateProfile:
        """执行实际的 LLM 分析"""
        import json
        import re
        
        # 构建 Prompt
        prompt = self._build_analysis_prompt(context)
        
        try:
            # 普通 LLM 调用
            response = await self.smart_llm.ainvoke(prompt)
            response_text = response.content
            
            logger.debug(f"[AnalysisService] LLM 原始响应长度: {len(response_text)} 字符")
            
            # 尝试提取 JSON（可能被 markdown 包裹）
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                # 如果没有 markdown 包裹，尝试直接解析
                json_str = response_text.strip()
            
            # 解析 JSON
            profile_data = json.loads(json_str)
            
            # 创建 CandidateProfile 实例
            profile = CandidateProfile(**profile_data)
            
            logger.info(f"[AnalysisService] 成功解析画像数据")
            return profile
            
        except json.JSONDecodeError as e:
            logger.error(f"[AnalysisService] JSON 解析失败: {e}")
            logger.error(f"[AnalysisService] 响应内容前500字符: {response_text[:500] if 'response_text' in locals() else 'N/A'}")
            return self._get_default_profile()
        except Exception as e:
            logger.error(f"[AnalysisService] 分析执行失败: {e}", exc_info=True)
            return self._get_default_profile()
    
    def _build_analysis_prompt(self, context: AnalysisContext) -> str:
        """构建分析 Prompt"""
        
        # 格式化问答历史
        qa_text = "\n\n".join([
            f"Q{i+1}: {qa['question']}\nA{i+1}: {qa['answer']}"
            for i, qa in enumerate(context.qa_history)
        ])
        
        # 增量分析提示
        previous_hint = ""
        if context.previous_profile:
            previous_hint = f"""
【上一轮分析结果】：
- 技术深度: {context.previous_profile.technical_depth.score}/10
- 知识广度: {context.previous_profile.technical_breadth.score}/10
- 沟通能力: {context.previous_profile.communication.score}/10
请在此基础上进行增量更新。
"""
        
        prompt = f"""你是一位资深的技术面试官和人才评估专家。请对候选人进行全面、客观的多维度能力分析。

【简历信息】：
{context.resume[:1500]}

【岗位要求】：
{context.job_description}

【公司背景】：
{context.company_info}

【面试问答记录】（共 {len(context.qa_history)} 轮）：
{qa_text}

{previous_hint}

【分析要求】：
请从以下维度对候选人进行评分和分析：

1. **技术深度 (technical_depth)**：
   - 对核心技术的理解是否深入？能否讲清楚底层原理？
   - 评分 0-10，需提供证据。

2. **知识广度 (technical_breadth)**：
   - 技术栈是否全面？是否了解相关领域的最佳实践？
   - 评分 0-10，需提供证据。

3. **沟通表达能力 (communication)**：
   - 回答是否清晰、有条理？能否准确理解问题？
   - 评分 0-10，需提供证据。

4. **问题解决思路 (problem_solving)**：
   - 面对问题时的思考方式？是否有系统性的解决方案？
   - 评分 0-10，需提供证据。

5. **简历真实性 (resume_authenticity)**：
   - 回答是否与简历描述一致？是否存在夸大或虚假成分？
   - 评分 0-10（10分表示完全真实匹配），需提供证据。

【输出格式】：
请**直接输出纯 JSON 格式**，不要用 markdown 代码块包裹。JSON 结构如下：

{{
  "technical_depth": {{
    "score": 7.5,
    "evidence": "候选人能够解释清楚XXX的底层原理..."
  }},
  "technical_breadth": {{
    "score": 8.0,
    "evidence": "候选人涉猎广泛，提到了XXX、YYY等技术..."
  }},
  "communication": {{
    "score": 6.5,
    "evidence": "回答较为清晰，但有时表述不够简洁..."
  }},
  "problem_solving": {{
    "score": 7.0,
    "evidence": "能够提出系统性的解决方案，但..."
  }},
  "resume_authenticity": {{
    "score": 8.5,
    "evidence": "回答与简历描述基本一致..."
  }},
  "key_strengths": [
    "技术栈全面，覆盖XXX",
    "有实际项目经验",
    "学习能力强"
  ],
  "key_weaknesses": [
    "某些底层原理理解不够深入",
    "表达可以更简洁"
  ],
  "recommendation": "maybe",
  "confidence": 0.75,
  "summary": "候选人整体表现中等偏上...",
  "last_updated": "{datetime.now().isoformat()}"
}}

请客观、公正地进行评估，避免主观臆断。直接输出 JSON，不要包含任何其他文字。"""

        return prompt
    
    def _get_default_profile(self) -> CandidateProfile:
        """返回默认画像（分析失败时使用）"""
        return CandidateProfile(
            technical_depth=DimensionScore(score=5.0, evidence="分析中..."),
            technical_breadth=DimensionScore(score=5.0, evidence="分析中..."),
            communication=DimensionScore(score=5.0, evidence="分析中..."),
            problem_solving=DimensionScore(score=5.0, evidence="分析中..."),
            resume_authenticity=DimensionScore(score=5.0, evidence="分析中..."),
            last_updated=datetime.now().isoformat()
        )
    
    async def get_cached_profile(self, session_id: str) -> Optional[CandidateProfile]:
        """获取画像（缓存 -> 数据库）"""
        # 1. 查缓存
        if session_id in self._profile_cache:
            return self._profile_cache[session_id]
            
        # 2. 查数据库
        profile_data = await self.session_service.get_profile(session_id)
        if profile_data:
            try:
                profile = CandidateProfile(**profile_data)
                self._profile_cache[session_id] = profile
                return profile
            except Exception as e:
                logger.error(f"反序列化画像失败: {e}")
                return None
                
        return None
    
    def clear_cache(self, session_id: str):
        """清除缓存"""
        if session_id in self._profile_cache:
            del self._profile_cache[session_id]


# 全局单例
_analysis_service = None

def get_analysis_service() -> CandidateAnalysisService:
    """获取分析服务单例"""
    global _analysis_service
    if _analysis_service is None:
        _analysis_service = CandidateAnalysisService()
    return _analysis_service
