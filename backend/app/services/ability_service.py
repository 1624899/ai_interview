"""
能力画像聚合服务
负责分析用户最近的面试表现，生成综合能力雷达图和技能标签
"""

import logging
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.core.llms import get_smart_llm
from app.database.session_service import SessionService
from app.models.candidate_profile import CandidateProfile, DimensionScore

logger = logging.getLogger(__name__)

class AbilityAnalysisService:
    """能力画像聚合服务 - 基于数据库存储"""
    
    def __init__(self):
        self.smart_llm = get_smart_llm()
        self.session_service = SessionService()
        self._generate_lock = asyncio.Lock()
        self._last_generate_time = {}  # user_id -> timestamp
        self._cooldown_seconds = 60    # 60秒冷却时间
        
    async def get_overall_profile(self, user_id: str = "default_user") -> Optional[Dict[str, Any]]:
        """
        获取用户综合能力画像（从数据库读取）
        
        Returns:
            Optional[Dict]: 包含 profile 和 generated_at 的字典，如果不存在则返回 None
        """
        try:
            result = await self.session_service.get_user_profile(user_id)
            return result  # 返回 {"profile": {...}, "updated_at": "..."}
        except Exception as e:
            logger.error(f"获取综合能力画像失败: {str(e)}", exc_info=True)
            return None
    
    async def generate_overall_profile(self, user_id: str = "default_user", api_config: Optional[Dict] = None) -> Dict[str, Any]:
        """
        生成用户综合能力画像（基于最近5次面试，带时间权重）
        生成后存入数据库
        
        Args:
            user_id: 用户ID
            api_config: 用户API配置
        
        Returns:
            Dict: 包含 profile 和 warning (可选)
        """
        # 1. 检查并发锁
        if self._generate_lock.locked():
            raise ValueError("正在生成中，请稍候...")
            
        async with self._generate_lock:
            # 2. 检查冷却时间
            now = datetime.now().timestamp()
            last_time = self._last_generate_time.get(user_id, 0)
            if now - last_time < self._cooldown_seconds:
                remaining = int(self._cooldown_seconds - (now - last_time))
                raise ValueError(f"生成过于频繁，请等待 {remaining} 秒后再试")
                
            try:
                # 3. 获取最近5次画像（只获取当前用户的）
                recent_profiles = await self.session_service.get_recent_profiles(limit=5, user_id=user_id)
                
                if not recent_profiles:
                    logger.warning("无历史面试记录，无法生成综合画像")
                    return {"profile": self._get_empty_profile()}
                
                logger.info(f"开始聚合分析，共 {len(recent_profiles)} 次面试记录")
                    
                # 4. 调用 LLM 进行时间加权聚合分析
                profile = await self._aggregate_profiles_with_weights(recent_profiles, api_config)
                
                # 5. 保存到数据库
                await self.session_service.save_user_profile(profile.model_dump(), user_id)
                
                # 更新最后生成时间
                self._last_generate_time[user_id] = now
                
                logger.info(f"综合能力画像已生成并保存")
                
                result = {"profile": profile}
                
                # 添加警告信息（如果样本太少）
                if len(recent_profiles) < 3:
                    result["warning"] = f"当前仅基于 {len(recent_profiles)} 次面试记录，建议完成更多面试以获得更准确的评估。"
                    
                return result
                
            except Exception as e:
                logger.error(f"生成综合能力画像失败: {str(e)}", exc_info=True)
                # 降级方案：返回最近一次的画像
                fallback_profile = await self._fallback_to_latest(recent_profiles)
                return {
                    "profile": fallback_profile,
                    "warning": "生成失败，已显示最近一次面试结果。请稍后重试。"
                }
    
    async def _aggregate_profiles_with_weights(self, profiles: List[Dict[str, Any]], api_config: Optional[Dict] = None) -> CandidateProfile:
        """
        使用时间权重聚合分析多个画像
        
        策略：最近的面试权重更高
        - 第1次（最新）：权重 1.0
        - 第2次：权重 0.85
        - 第3次：权重 0.70
        - 第4次：权重 0.55
        - 第5次：权重 0.40
        """
        from app.core.llms import get_llm_for_request
        
        # 获取 LLM (优先使用用户配置)
        llm = get_llm_for_request(api_config, channel="smart")
        
        # 为每个画像添加权重信息
        weighted_profiles = []
        for i, profile in enumerate(profiles):
            weight = 1.0 - (i * 0.15)
            weighted_profiles.append({
                "index": i + 1,
                "weight": round(weight, 2),
                "profile": profile
            })
        
        # 构建带权重的上下文
        profiles_context = json.dumps(weighted_profiles, ensure_ascii=False, indent=2)
        
        prompt = f"""你是一位资深的人才评估专家。请根据用户最近 {len(profiles)} 次的面试评估记录，生成一份综合的能力画像。

【历史评估记录】（按时间倒序，最新在前）：
{profiles_context}

【分析策略】：
1. **时间加权**：每条记录都已标注权重（weight），权重越高表示越新，应给予更多考虑
2. **趋势分析**：关注候选人的成长轨迹，是在进步还是退步
3. **稳定性评估**：如果某些维度表现稳定，说明该能力比较可靠
4. **综合平衡**：避免被单次异常表现影响，取加权平均值

【评分维度】（0-10分）：
1. **专业能力 (professional_competence)**：核心技术栈掌握程度
2. **执行与结果导向 (execution_results)**：目标感和克服困难的能力
3. **逻辑与问题解决 (logic_problem_solving)**：复杂问题拆解和逻辑思维
4. **沟通表达力 (communication)**：清晰、准确、有条理的表达
5. **成长潜力 (growth_potential)**：学习能力和对新技术的敏感度
6. **协作能力 (collaboration)**：团队合作意识和换位思考

【技能标签】：
请提取用户最突出、最稳定的技能标签（如：Java, System Design, React 等），限制在 5-10 个。

【输出格式】：
请**直接输出纯 JSON 格式**，不要用 markdown 代码块包裹。

{{
  "professional_competence": {{ "score": 7.5, "evidence": "综合多次表现，候选人在XXX技术栈表现稳定..." }},
  "execution_results": {{ "score": 8.0, "evidence": "..." }},
  "logic_problem_solving": {{ "score": 7.0, "evidence": "..." }},
  "communication": {{ "score": 6.5, "evidence": "..." }},
  "growth_potential": {{ "score": 8.5, "evidence": "最近几次面试中表现出明显的进步趋势..." }},
  "collaboration": {{ "score": 7.5, "evidence": "..." }},
  "skill_tags": ["Java", "Spring Boot", "MySQL", "Redis", "System Design"],
  "overall_assessment": "候选人整体表现为中高水平，近期呈现上升趋势...",
  "key_strengths": ["技术栈扎实", "学习能力强"],
  "key_weaknesses": ["表达可以更简洁"],
  "recommendation": "hire",
  "confidence": 0.8,
  "last_updated": "{datetime.now().isoformat()}"
}}

请客观、公正地进行评估，重点关注加权平均后的稳定表现。"""
        
        try:
            response = await llm.ainvoke(prompt)
            content = response.content.strip()
            
            # 清理 markdown 标记
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            data = json.loads(content.strip())
            profile = CandidateProfile(**data)
            
            logger.info("LLM 聚合分析成功")
            return profile
            
        except json.JSONDecodeError as e:
            logger.error(f"LLM 返回的 JSON 格式错误: {e}")
            logger.error(f"原始内容: {content[:500] if 'content' in locals() else 'N/A'}")
            raise
        except Exception as e:
            logger.error(f"LLM 聚合分析失败: {e}")
            raise

    async def _fallback_to_latest(self, profiles: List[Dict[str, Any]]) -> CandidateProfile:
        """降级方案：返回最近一次的画像"""
        if not profiles:
            return self._get_empty_profile()
        
        try:
            latest_profile = profiles[0]
            logger.warning("使用降级方案：返回最近一次的面试画像")
            return CandidateProfile(**latest_profile)
        except Exception as e:
            logger.error(f"降级方案也失败: {e}")
            return self._get_empty_profile()

    def _get_empty_profile(self) -> CandidateProfile:
        """返回空白画像（用于无数据场景）"""
        return CandidateProfile(
            professional_competence=DimensionScore(score=0, evidence="暂无数据"),
            execution_results=DimensionScore(score=0, evidence="暂无数据"),
            logic_problem_solving=DimensionScore(score=0, evidence="暂无数据"),
            communication=DimensionScore(score=0, evidence="暂无数据"),
            growth_potential=DimensionScore(score=0, evidence="暂无数据"),
            collaboration=DimensionScore(score=0, evidence="暂无数据"),
            skill_tags=[],
            overall_assessment="暂无面试记录，请先进行模拟面试。",
            last_updated=datetime.now().isoformat()
        )


# 全局单例
_ability_service = None

def get_ability_service() -> AbilityAnalysisService:
    global _ability_service
    if _ability_service is None:
        _ability_service = AbilityAnalysisService()
    return _ability_service
