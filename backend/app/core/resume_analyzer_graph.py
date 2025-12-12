"""
简历竞争力分析 Graph
直接多维度分析，无反思机制
"""

import json
import logging
from typing import List, Optional, TypedDict, Dict, Any
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from app.core import llms
from app.database.session_service import SessionService

logger = logging.getLogger(__name__)


# ============================================================================
# 数据结构定义
# ============================================================================

class ResumeAnalyzerState(TypedDict):
    """简历分析状态"""
    # 输入
    resume_content: str
    job_description: Optional[str]
    session_ids: List[str]
    api_config: Optional[dict]
    user_id: str
    
    # 中间数据
    interview_conversations: List[dict]  # 面试对话内容
    overall_profile: Optional[dict]  # 综合能力画像
    
    # 输出
    analysis_result: Optional[dict]


class DimensionScoreOutput(BaseModel):
    """维度评分输出"""
    score: float = Field(description="评分 (0-100)")
    comment: str = Field(description="评价说明")


class ResumeAnalysisOutput(BaseModel):
    """简历分析输出"""
    overall_score: float = Field(description="综合评分 (0-100)")
    dimension_scores: Dict[str, DimensionScoreOutput] = Field(description="各维度评分")
    strengths: List[str] = Field(description="优势")
    weaknesses: List[str] = Field(description="不足")
    priority_improvements: List[str] = Field(description="优先改进建议")
    interview_insights: Optional[str] = Field(default=None, description="基于面试的洞察")


# ============================================================================
# 节点函数
# ============================================================================

async def node_prepare(state: ResumeAnalyzerState) -> dict:
    """
    准备节点：加载面试对话数据
    """
    session_ids = state.get("session_ids", [])
    user_id = state.get("user_id", "default_user")
    
    interview_conversations = []
    overall_profile = None
    
    if session_ids:
        service = SessionService()
        
        # 获取每个 session 的对话内容
        for session_id in session_ids[:3]:  # 最多3个
            conversations = await service.get_session_conversations(session_id, user_id)
            if conversations:
                interview_conversations.extend(conversations)
        
        logger.info(f"加载了 {len(interview_conversations)} 个面试 QA 对")
        
        # 尝试获取综合能力画像
        try:
            profile_data = await service.get_user_profile(user_id)
            if profile_data:
                overall_profile = profile_data.get("profile")
        except Exception as e:
            logger.warning(f"获取综合能力画像失败: {e}")
    
    return {
        "interview_conversations": interview_conversations,
        "overall_profile": overall_profile
    }


async def node_analyze(state: ResumeAnalyzerState) -> dict:
    """
    分析节点：多维度分析简历
    """
    resume_content = state.get("resume_content", "")
    job_description = state.get("job_description", "")
    interview_conversations = state.get("interview_conversations", [])
    overall_profile = state.get("overall_profile")
    api_config = state.get("api_config")
    
    # 构建面试洞察部分
    interview_section = ""
    if interview_conversations:
        # 取最多5个典型的 QA 对
        sample_qa = interview_conversations[:5]
        qa_text = "\n".join([
            f"Q: {qa['question']}\nA: {qa['answer'][:200]}..." 
            if len(qa['answer']) > 200 else f"Q: {qa['question']}\nA: {qa['answer']}"
            for qa in sample_qa
        ])
        interview_section = f"""

【面试对话参考】（共 {len(interview_conversations)} 轮）：
{qa_text}
"""
    
    # 构建能力画像部分
    profile_section = ""
    if overall_profile:
        profile_section = f"""

【综合能力画像】：
{json.dumps(overall_profile, ensure_ascii=False, indent=2)[:500]}...
"""
    
    # 构建 JD 部分
    jd_section = ""
    if job_description:
        jd_section = f"""

【目标职位描述】：
{job_description}
"""
    
    prompt = f"""你是一位资深的简历评估专家和职业顾问。请对以下简历进行全面的竞争力分析。

【简历内容】：
{resume_content}
{jd_section}{interview_section}{profile_section}

请从以下 6 个维度进行评估，每个维度给出 0-100 精准的客观评分和评价（允许90以上高分也允许60以下低分，不要给出模棱两可的评分）：

1. **结构规范性 (structure)**：简历格式是否清晰、专业、易读
2. **内容完整度 (completeness)**：教育背景、工作经历、项目经验、技能等是否完整
3. **量化程度 (quantification)**：成果描述是否有具体数据和指标
4. **表达清晰度 (clarity)**：描述是否简洁、重点突出、无歧义
5. **亮点突出度 (highlights)**：核心竞争力和成就是否被有效展示
6. **JD匹配度 (job_match)**：{"与目标职位的匹配程度" if job_description else "通用适配性"}

{"基于面试对话，请特别指出简历中与面试表现不一致的地方，或面试中展现但简历未体现的能力。" if interview_conversations else ""}

**重要：请严格按照以下 JSON 格式输出，所有字符串必须使用英文双引号 \" 而非中文引号，确保所有括号正确闭合，不要使用 markdown 代码块：**

{{
    "overall_score": 75,
    "dimension_scores": {{
        "structure": {{"score": 80, "comment": "结构清晰专业，模块划分合理"}},
        "completeness": {{"score": 70, "comment": "教育和工作经历完整，缺少项目详情"}},
        "quantification": {{"score": 60, "comment": "部分成果有数据支撑，可进一步量化"}},
        "clarity": {{"score": 75, "comment": "表达清晰，重点突出"}},
        "highlights": {{"score": 65, "comment": "技术亮点明确，可更突出核心竞争力"}},
        "job_match": {{"score": 80, "comment": "技术栈与职位要求匹配度高"}}
    }},
    "strengths": ["优势1（简洁描述）", "优势2"],
    "weaknesses": ["不足1（简洁描述）", "不足2"],
    "priority_improvements": ["第一优先：具体改进建议", "第二优先：具体改进建议"],
    "interview_insights": null
}}

**注意**：如果没有提供面试对话参考，interview_insights 字段必须为 null（不是字符串 "null"，而是 JSON 的 null 值）。
"""
    
    # 获取 LLM
    llm = llms.get_llm_for_request(api_config, channel="general")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content.strip()
        
        # 打印原始响应长度用于调试
        logger.info(f"LLM 响应长度: {len(content)} 字符")
        
        # 清理 markdown 标记
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        
        content = content.strip()
        
        # 预处理：修复常见的 LLM 输出问题
        # 1. 替换中文引号为英文引号
        content = content.replace('"', '"').replace('"', '"')
        content = content.replace(''', "'").replace(''', "'")
        
        # 尝试解析 JSON
        try:
            analysis_result = json.loads(content)
        except json.JSONDecodeError as e:
            # 尝试修复常见的 JSON 格式问题
            logger.warning(f"JSON 解析失败，尝试修复: {e}")
            
            # 如果 JSON 被截断，尝试补全
            if not content.endswith("}"):
                # 尝试找到最后一个完整的对象
                last_brace = content.rfind("}")
                if last_brace > 0:
                    content = content[:last_brace + 1]
                    # 确保括号匹配
                    open_braces = content.count("{")
                    close_braces = content.count("}")
                    content = content + "}" * (open_braces - close_braces)
            
            # 再次尝试解析
            try:
                analysis_result = json.loads(content)
                logger.info("JSON 修复成功")
            except json.JSONDecodeError:
                # 如果仍然失败，打印完整内容
                logger.error(f"JSON 修复失败，完整内容:\n{content}")
                raise
        
        logger.info(f"简历分析完成，综合评分: {analysis_result.get('overall_score', 0)}")
        
        # 清理 interview_insights 字段：确保 "null" 字符串被转为 None
        insights = analysis_result.get("interview_insights")
        if insights is None or (isinstance(insights, str) and insights.lower() in ("null", "")):
            analysis_result["interview_insights"] = None
        
        return {"analysis_result": analysis_result}
        
    except json.JSONDecodeError as e:
        logger.error(f"JSON 解析失败: {e}")
        raise
    except Exception as e:
        logger.error(f"简历分析失败: {e}")
        raise


# ============================================================================
# 主函数
# ============================================================================

async def analyze_resume(
    resume_content: str,
    job_description: Optional[str] = None,
    session_ids: List[str] = [],
    user_id: str = "default_user",
    api_config: Optional[dict] = None
) -> dict:
    """
    执行简历竞争力分析
    
    Args:
        resume_content: 简历内容
        job_description: 目标职位描述（可选）
        session_ids: 关联的面试 session_id 列表
        user_id: 用户ID
        api_config: API 配置
        
    Returns:
        分析结果
    """
    # 初始化状态
    state: ResumeAnalyzerState = {
        "resume_content": resume_content,
        "job_description": job_description,
        "session_ids": session_ids[:3],  # 限制最多3个
        "user_id": user_id,
        "api_config": api_config,
        "interview_conversations": [],
        "overall_profile": None,
        "analysis_result": None
    }
    
    # 执行节点
    logger.info("开始简历竞争力分析")
    
    # 1. 准备阶段
    prepare_result = await node_prepare(state)
    state.update(prepare_result)
    
    # 2. 分析阶段
    analyze_result = await node_analyze(state)
    state.update(analyze_result)
    
    logger.info("简历竞争力分析完成")
    return state["analysis_result"]
