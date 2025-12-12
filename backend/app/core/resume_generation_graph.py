"""
简历生成 Graph - 交互式简历生成与包装
流程: 需求分析 -> (可选问询) -> 初稿生成 -> 初稿优化 -> 包装适度性核查 -> 润色审查 -> (循环优化) -> 输出
"""

import json
import logging
import asyncio
import uuid
from typing import List, Optional, Dict, Any, TypedDict
from langchain_core.messages import HumanMessage

from app.core import llms
from app.database.resume_generation_service import session_store, get_generation_service

logger = logging.getLogger(__name__)


# ============================================================================
# 状态定义
# ============================================================================

class ResumeGenerationState(TypedDict):
    """简历生成状态"""
    # 输入
    resume_content: str
    job_description: str
    optimization_result: dict
    template_style: str
    api_config: Optional[dict]
    user_id: str
    
    # 中间状态
    missing_info_analysis: Optional[dict]
    questions: List[str]
    user_answers: Dict[str, str]
    draft_content: str
    optimized_draft: str  # 新增：优化后的初稿
    optimization_notes: Optional[dict]  # 新增：优化说明
    fact_check_result: Optional[dict]
    review_result: Optional[dict]
    iteration_count: int
    
    # 输出
    final_markdown: str
    title: str


# ============================================================================
# 节点实现
# ============================================================================

async def node_analyze_needs(state: ResumeGenerationState) -> dict:
    """
    需求分析节点：分析优化结果，识别需要用户确认的信息
    """
    resume_content = state.get("resume_content", "")
    job_description = state.get("job_description", "")
    optimization_result = state.get("optimization_result", {})
    api_config = state.get("api_config")
    
    prompt = f"""你是一位「简历信息核查专家」。请分析以下信息，找出生成完整简历前需要用户确认或补充的关键信息。

【原始简历】：
{resume_content}

【目标职位】：
{job_description}

【优化建议要点】：
{json.dumps(optimization_result.get('key_improvements', [])[:5], ensure_ascii=False)}

请检查以下方面是否有缺失或需要确认：
1. 量化数据（如业绩数字、用户规模、提升比例）- 仅在原文提到但未给出具体数字时询问
2. 具体技术栈或工具 - 仅在JD要求但简历未明确提及且可能具备时询问
3. 项目中的个人贡献和角色 - 仅在描述模糊时询问
4. 与目标岗位高度相关的项目经历 - 仅在项目经历描述模糊时询问

请输出 JSON 格式（不要使用 markdown 代码块）：
{{
    "has_gaps": true/false,
    "questions": [
        "您在项目A中带来的用户增长大约是多少？（如：增长50%）",
        ...
    ]
}}

**重要提示**：

**什么时候应该提问（has_gaps: true）**：
- 原简历中明确提到了某项成果但缺少具体数字（如"用户增长明显"但没说多少）
- JD 中有明确的硬性要求，但简历中完全没提及（需确认是否具备）
- 关键项目的个人角色/贡献描述非常模糊，无法判断

**什么时候不应该提问（has_gaps: false）**：
- 信息已经足够生成一份完整的简历
- 缺失的信息可以通过合理推断或适度包装来弥补
- 问题太琐碎或对简历质量影响不大

**提问原则**：
- 最多只问 1-3 个最关键的问题
- 问题必须具体、容易回答（给出示例格式）
- 优先问能带来量化数据的问题
- 对于项目经历缺失，请引导用户采用 STAR 法则补充（如：背景、任务、行动、结果）
"""
    
    llm = llms.get_llm_for_request(api_config, channel="general")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = _clean_json_response(response.content)
        analysis = json.loads(content)
        
        questions = analysis.get("questions", [])[:3]
        has_gaps = analysis.get("has_gaps", False) and len(questions) > 0
        
        logger.info(f"需求分析完成: has_gaps={has_gaps}, questions={len(questions)}")
        
        return {
            "missing_info_analysis": {"has_gaps": has_gaps},
            "questions": questions
        }
    except Exception as e:
        logger.error(f"需求分析节点失败: {e}")
        return {
            "missing_info_analysis": {"has_gaps": False, "error": str(e)},
            "questions": []
        }


async def node_generate_draft(state: ResumeGenerationState) -> dict:
    """
    初稿生成节点：根据所有信息生成简历初稿
    允许适度包装（Enhancement），但不能进行恶意造假
    """
    resume_content = state.get("resume_content", "")
    job_description = state.get("job_description", "")
    optimization_result = state.get("optimization_result", {})
    user_answers = state.get("user_answers", {})
    review_result = state.get("review_result")
    template_style = state.get("template_style", "professional")
    api_config = state.get("api_config")
    
    # 构建用户补充信息
    user_info_section = ""
    if user_answers:
        answers_text = "\n".join([f"- {q}: {a}" for q, a in user_answers.items()])
        user_info_section = f"\n\n【用户补充信息】：\n{answers_text}"
    
    # 如果有审查反馈，加入改进指导
    review_guidance = ""
    if review_result and not review_result.get("passed", True):
        issues = review_result.get("issues", [])
        factual_notes = [i['detail'] for i in issues if i.get('type') == 'excessive_fabrication']
        if factual_notes:
            review_guidance = f"\n\n【重要修正要求】上次生成存在过度包装或逻辑漏洞，请修正：\n" + "\n".join(factual_notes)
    
    style_guide = {
        "professional": "专业简洁，突出真实成就和数据，适合企业应聘",
        "academic": "学术风格，强调研究成果和发表，适合学术岗位",
        "creative": "创意设计，可以有个性化表达，适合创意行业"
    }
    
    # 提取关键词分析
    keyword_analysis = optimization_result.get('keyword_analysis', {})
    jd_keywords = keyword_analysis.get('jd_keywords', [])
    missing_keywords = keyword_analysis.get('missing', [])
    keyword_recommendations = keyword_analysis.get('recommendations', [])
    
    # 构建关键词指导
    keyword_section = ""
    if jd_keywords or missing_keywords or keyword_recommendations:
        keyword_section = f"""

【关键词分析 - 重点执行】：
- JD核心关键词：{json.dumps(jd_keywords[:10], ensure_ascii=False)}
- 简历中缺失的关键词：{json.dumps(missing_keywords[:8], ensure_ascii=False)}
- 建议添加的关键词：{json.dumps(keyword_recommendations[:8], ensure_ascii=False)}

请务必在简历中自然地融入上述关键词，特别是缺失的关键词！
"""

    prompt = f"""你是一位「资深简历包装专家」。请根据以下信息，为候选人打造一份**内容丰富、具有竞争力**的简历。

**核心原则**：
1. **内容要丰富饱满**：不要写得太简洁！每段经历至少3-6个要点，每个要点要有实质内容。
2. **允许适度包装**：将平淡描述升级为专业表达，补充合理的细节和成果。
3. **严禁恶意造假**：不能编造不存在的公司、职位或完全不具备的硬技能。

【包装技巧】：
- 语言升维："修了bug" → "修复核心模块内存泄漏问题，提升系统稳定性"
- 合理推断：开发了后台 → "设计并实现企业级后台管理系统，支撑业务部门高效运营"
- 估算数据：用"约"、"超"、"近"等修饰词，如"用户增长约20%"（如果这在行业标准范围内）

---

【原始简历】：
{resume_content}

{user_info_section}

【目标职位】：
{job_description}

【关键改进点 - 重点执行】：
{json.dumps(optimization_result.get('key_improvements', [])[:5], ensure_ascii=False, indent=2)}

上述改进点是专家分析后给出的建议，请务必在简历中体现！
{keyword_section}
{review_guidance}

---

【风格要求】：{style_guide.get(template_style, style_guide['professional'])}
【语言要求】：必须使用中文（简体）撰写。

## 输出结构（请严格按照以下格式，内容要丰富）：

# [姓名]
> [联系方式]
[求职意向] | [期望薪资] | [期望城市]

## 个人简介
（3-5句话，分点描述，突出核心竞争力与目标职位的匹配度，要有说服力，可以适度包装）

## 工作经历
### [公司名称] | [职位] | [时间段]
- **工作职责**：详细描述核心职责（不要一笔带过）
- **项目参与**：参与的重要项目及角色
- **核心成果**：使用STAR法则，量化描述成果
- **技术应用**：使用的技术栈和工具
（每段工作经历至少4-6个要点，内容要饱满）

## 项目经历
### [项目名称] | [角色] | [时间段]
- **项目背景**：项目的业务背景和目标
- **技术架构**：使用的技术栈
- **个人职责**：具体负责的模块和任务
- **核心成果**：量化的项目成果
（每个项目至少4个要点）

## 专业技能
### 核心技能
- **[技能类别1]**：具体技能列表，标注熟练程度（精通/熟练/掌握）
- **[技能类别2]**：...

### 工具与框架
- **开发工具**：IDE、版本控制、协作工具等
- **技术框架**：使用过的框架和库

### 软技能
- 项目管理、团队协作、沟通能力等

（技能模块要体现：专业深度 + 技术广度 + 与JD的匹配度）

## 教育背景
### [学校名称] | [专业] | [学历] | [时间段]
- 相关课程、GPA、荣誉奖项等

---

**输出规范**：
1. 直接输出 Markdown 内容，不要用代码块包裹，禁止使用emoji表情
2. 内容要丰富，不要写得太简洁！每个模块都要有实质内容
3. 专业技能要详细，体现深度和与岗位的匹配
"""
    
    llm = llms.get_llm_for_request(api_config, channel="content_writer")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        draft = response.content.strip()
        
        # 清理可能的代码块包裹
        draft = _clean_markdown_response(draft)
        
        logger.info(f"初稿生成完成 (含适度包装): {len(draft)} 字符")
        return {"draft_content": draft}
    except Exception as e:
        logger.error(f"初稿生成节点失败: {e}")
        return {"draft_content": f"生成失败: {str(e)}"}


async def node_optimize_draft(state: ResumeGenerationState) -> dict:
    """
    初稿优化节点（新增）：检查信息遗漏并按多维度优化
    """
    resume_content = state.get("resume_content", "")
    draft_content = state.get("draft_content", "")
    job_description = state.get("job_description", "")
    user_answers = state.get("user_answers", {})
    api_config = state.get("api_config")
    
    user_inputs = json.dumps(user_answers, ensure_ascii=False) if user_answers else "无"

    # 获取优化建议
    optimization_result = state.get("optimization_result", {})
    key_improvements = optimization_result.get('key_improvements', [])
    keyword_analysis = optimization_result.get('keyword_analysis', {})
    jd_keywords = keyword_analysis.get('jd_keywords', [])
    missing_keywords = keyword_analysis.get('missing', [])

    prompt = f"""你是一位「简历质量优化专家」。请对比【原始资料】和【初稿】，进行深度优化。

## 输入信息

【原始简历】：
{resume_content}

【用户补充信息】：
{user_inputs}

【目标职位】：
{job_description}

【当前初稿】：
{draft_content}

---

## 必须执行的优化建议

【关键改进点】（来自专家分析，必须落实）：
{json.dumps(key_improvements[:5], ensure_ascii=False, indent=2)}

【关键词要求】：
- JD核心关键词：{json.dumps(jd_keywords[:10], ensure_ascii=False)}
- 缺失的关键词（必须补充）：{json.dumps(missing_keywords[:8], ensure_ascii=False)}

---

## 优化任务

### 1. 信息遗漏检查（严格执行）
对比【原始简历】和【当前初稿】：
- 是否有工作经历被遗漏或过度简化？→ 必须补充完整
- 是否有项目经历被遗漏？→ 必须补充
- 技能清单是否完整？→ 必须展开详细描述
- 教育背景是否完整？→ 必须保留

### 2. 内容丰富度检查（重点！）
**简历不能太简洁！** 每个模块都要有足够的内容：
- 每段工作经历：至少4-6个要点，每个要点要有实质描述
- 每个项目经历：至少4个要点（背景、职责、技术、成果）
- 专业技能：必须分类详细展开，体现深度

### 3. 专业技能模块优化（重要）
技能模块必须做到：
- **分类清晰**：按类别组织（如：编程语言、框架工具、专业技能、软技能）
- **体现深度**：标注熟练程度（精通/熟练/掌握），说明使用场景
- **匹配JD**：突出与目标职位匹配的技能
- **不能过于简略**：每个类别至少3-5项具体技能

### 4. 关键词融入
检查【缺失的关键词】是否已自然地融入简历中：
- 在工作职责、项目描述、技能列表中体现
- 确保关键词覆盖率达到80%以上

### 5. 量化与成果
- 每段经历是否都有量化成果？
- 数据是否合理（使用"约"、"超"等修饰词）？

### 6. 关键改进点落实检查
逐条检查【关键改进点】是否已在简历中体现，未体现的必须补充。

---

## 输出要求

请输出 JSON 格式（不要使用 markdown 代码块，所有字符串使用英文双引号）：
{{
    "optimized_content": "优化后的完整 Markdown 简历（内容要丰富饱满）...",
    "optimization_summary": {{
        "missing_info_fixed": ["补充了XX项目经历", "补全了技能清单..."],
        "content_enriched": ["丰富了工作经历描述", "扩展了项目细节..."],
        "skills_enhanced": ["技能分类更清晰", "增加了XX技能深度描述..."],
        "keywords_added": ["融入了关键词XX", "补充了技能关键词XX..."],
        "improvements_applied": ["落实了改进点1", "落实了改进点2..."]
    }},
    "quality_scores": {{
        "completeness": 85,
        "content_richness": 80,
        "skill_depth": 85,
        "keyword_coverage": 90,
        "jd_match": 82
    }}
}}

重要提醒：
- optimized_content 必须是完整的 Markdown 简历，禁止使用emoji表情
- **内容必须丰富**，不能比初稿更简洁
- **专业技能必须详细展开**，体现专业深度
- **关键词和改进点必须落实**
"""
    
    llm = llms.get_llm_for_request(api_config, channel="content_writer")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = _clean_json_response(response.content)
        result = json.loads(content)
        
        optimized_draft = result.get("optimized_content", draft_content)
        optimized_draft = _clean_markdown_response(optimized_draft)
        
        optimization_summary = result.get("optimization_summary", {})
        quality_scores = result.get("quality_scores", {})
        
        logger.info(f"初稿优化完成: 补充了 {len(optimization_summary.get('missing_info_fixed', []))} 项遗漏, 长度 {len(optimized_draft)} 字符, 质量评分 completeness={quality_scores.get('completeness', 'N/A')}")
        
        return {
            "optimized_draft": optimized_draft,
            "optimization_notes": {
                "summary": optimization_summary,
                "scores": quality_scores
            }
        }
    except Exception as e:
        logger.error(f"初稿优化节点失败: {e}")
        # 失败时使用原初稿
        return {
            "optimized_draft": draft_content,
            "optimization_notes": {"error": str(e)}
        }


async def node_fact_check(state: ResumeGenerationState) -> dict:
    """
    包装适度性核查节点：区分"适度包装"和"过度造假"
    """
    resume_content = state.get("resume_content", "")
    # 使用优化后的初稿进行核查
    draft_content = state.get("optimized_draft", "") or state.get("draft_content", "")
    user_answers = state.get("user_answers", {})
    api_config = state.get("api_config")
    
    user_inputs = json.dumps(user_answers, ensure_ascii=False) if user_answers else "无"

    prompt = f"""你是一位「简历风控专家」。请对比【原始资料】和【生成简历】，检查是否存在**过度包装或恶意造假**。

【判定标准】：
- 🟢 **安全（适度包装）**：语言润色、合理的推断、基于行业标准估算的数据、突显亮点。 -> **无需报告**
- 🔴 **危险（恶意造假）**：
    1. 编造不存在的公司或已确认不存在的职位。
    2. 编造候选人显然不具备的核心硬技能（如文员编造会写操作系统内核）。
    3. 数据极度夸张、违反常理（如实习生独立带来上亿营收）。

【原始资料】：
{resume_content}
用户补充: {user_inputs}

【生成简历】：
{draft_content}

---

请只报告🔴**危险**级别的造假。如果只是🟢适度包装（包括基于经验的合理推断、语言上的专业化润色），请务必**放行**（is_excessive=false）。

**只有在确实出现"无中生有"的核心硬技能或经历时，才标记为过度造假。**

请输出 JSON 格式（不要使用 markdown 代码块、emoji表情）：
{{
    "is_excessive": true/false,  // 是否过度造假
    "risk_details": [
        {{
            "type": "excessive_fabrication",
            "description": "检测到严重造假：生成简历中..."
        }}
    ]
}}
"""
    
    llm = llms.get_llm_for_request(api_config, channel="general")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = _clean_json_response(response.content)
        result = json.loads(content)
        
        is_excessive = result.get("is_excessive", False)
        logger.info(f"风控核查完成: is_excessive={is_excessive}")
        return {"fact_check_result": result}
    except Exception as e:
        logger.error(f"风控核查节点失败: {e}")
        return {"fact_check_result": {"is_excessive": False, "risk_details": []}}


async def node_finalize_and_review(state: ResumeGenerationState) -> dict:
    """
    润色与审查节点：基于适度包装原则进行最终确认
    """
    # 使用优化后的初稿
    draft_content = state.get("optimized_draft", "") or state.get("draft_content", "")
    fact_check_result = state.get("fact_check_result", {})
    optimization_result = state.get("optimization_result", {})
    api_config = state.get("api_config")
    
    # 获取 JD 关键词
    jd_keywords = optimization_result.get("keyword_analysis", {}).get("jd_keywords", [])[:10]
    
    # 构建警告
    warning = ""
    if fact_check_result.get("is_excessive"):
        details = fact_check_result.get("risk_details", [])
        warning = f"""
**风控警告：检测到过度造假，必须修正**：
{json.dumps(details, ensure_ascii=False, indent=2)}

请对相关内容进行**修正或弱化表述**，使其符合客观事实，**但不要删除整段经历，也不要大幅缩减简历篇幅**。
修正原则：将"过于夸张的数据"修改为"合理估算的数据"，将"无中生有"的技能修改为"了解/熟悉"或删除该具体技能点（保留其他真实技能）。
"""

    prompt = f"""你是一位「简历终审专家」。请对以下简历进行最终润色。

【简历草稿】：
{draft_content}

【目标职位关键词】：
{json.dumps(jd_keywords, ensure_ascii=False)}

{warning}

请执行以下任务：
1. **修正过度造假**：如果有风控警告，必须修正。
2. **润色语言**：让措辞更加专业、自信（允许适度包装）。
3. **格式检查**：确保 Markdown 格式标准、美观。
4. **长度保持**：**严禁大幅删减内容！** 修正后的简历长度应与草稿基本保持一致（允许+/- 10%波动）。如果不涉及造假的部分，请原样保留或仅做润色。
5. **最终打磨**：确保简历读起来流畅、专业。

请输出 JSON 格式：
{{
    "final_content": "最终修订后的完整 Markdown 简历...",
    "review_passed": true/false,
    "modification_notes": ["修正了严重夸大的数据", "优化了项目描述..."],
    "title": "姓名-目标职位"
}}
注意：
- optimized_content 必须是完整的 Markdown 简历，禁止使用emoji表情
- 内容要丰富，不要写得太简洁！每个模块都要有实质内容
- 专业技能要详细，体现深度和与岗位的匹配
- 禁止使用emoji表情
"""
    
    llm = llms.get_llm_for_request(api_config, channel="hr_reviewer")
    
    try:
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = _clean_json_response(response.content)
        result = json.loads(content)
        
        final_markdown = result.get("final_content", draft_content)
        passed = result.get("review_passed", True)
        title = result.get("title", "新简历")
        
        final_markdown = _clean_markdown_response(final_markdown)
        
        logger.info(f"润色审查完成: passed={passed}")
        
        return {
            "final_markdown": final_markdown,
            "review_result": {
                "passed": passed, 
                "issues": fact_check_result.get("risk_details", [])
            },
            "title": title
        }
    except Exception as e:
        logger.error(f"润色审查节点失败: {e}")
        return {
            "final_markdown": draft_content,
            "review_result": {"passed": True, "error": str(e)},
            "title": "新简历"
        }


# ============================================================================
# 辅助函数
# ============================================================================

def _clean_json_response(content: str) -> str:
    """清理 LLM 响应中的 markdown 标记"""
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()

def _clean_markdown_response(content: str) -> str:
    """清理 Markdown 响应中的代码块包裹"""
    content = content.strip()
    if content.startswith("```markdown"):
        content = content[11:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


# ============================================================================
# 主流程函数
# ============================================================================

async def init_generation_session(
    resume_content: str,
    job_description: str,
    optimization_result: dict,
    user_id: str,
    template_style: str = "professional",
    api_config: Optional[dict] = None
) -> Dict[str, Any]:
    """
    初始化简历生成会话
    """
    session_id = str(uuid.uuid4())
    
    # 创建内存会话
    session = session_store.create(
        session_id=session_id,
        user_id=user_id,
        resume_content=resume_content,
        job_description=job_description,
        optimization_result=optimization_result,
        template_style=template_style
    )
    
    # 初始化状态
    state: ResumeGenerationState = {
        "resume_content": resume_content,
        "job_description": job_description,
        "optimization_result": optimization_result,
        "template_style": template_style,
        "api_config": api_config,
        "user_id": user_id,
        "missing_info_analysis": None,
        "questions": [],
        "user_answers": {},
        "draft_content": "",
        "optimized_draft": "",
        "optimization_notes": None,
        "fact_check_result": None,
        "review_result": None,
        "iteration_count": 0,
        "final_markdown": "",
        "title": ""
    }
    
    # 执行需求分析
    logger.info(f"开始生成会话: {session_id}")
    analysis_result = await node_analyze_needs(state)
    state.update(analysis_result)
    
    questions = state.get("questions", [])
    has_gaps = state.get("missing_info_analysis", {}).get("has_gaps", False)
    
    if has_gaps and questions:
        # 需要用户输入
        session_store.update(
            session_id,
            status="awaiting_input",
            questions=questions
        )
        return {
            "session_id": session_id,
            "needs_input": True,
            "questions": questions
        }
    else:
        # 直接生成
        result = await _complete_generation(session_id, state, api_config)
        return {
            "session_id": session_id,
            "needs_input": False,
            "result": result
        }


async def submit_user_answers(
    session_id: str,
    answers: Dict[str, str],
    api_config: Optional[dict] = None
) -> Dict[str, Any]:
    """
    提交用户回答并继续生成
    """
    session = session_store.get(session_id)
    if not session:
        raise ValueError(f"会话不存在或已过期: {session_id}")
    
    # 更新会话
    session_store.update(
        session_id,
        user_answers=answers,
        status="generating"
    )
    
    # 重建状态
    state: ResumeGenerationState = {
        "resume_content": session.resume_content,
        "job_description": session.job_description,
        "optimization_result": session.optimization_result,
        "template_style": session.template_style,
        "api_config": api_config,
        "user_id": session.user_id,
        "missing_info_analysis": None,
        "questions": session.questions,
        "user_answers": answers,
        "draft_content": "",
        "optimized_draft": "",
        "optimization_notes": None,
        "fact_check_result": None,
        "review_result": None,
        "iteration_count": 0,
        "final_markdown": "",
        "title": ""
    }
    
    result = await _complete_generation(session_id, state, api_config)
    return result



async def _complete_generation(
    session_id: str,
    state: ResumeGenerationState,
    api_config: Optional[dict]
) -> Dict[str, Any]:
    """
    完成生成流程（内部函数）
    流程：初稿生成 -> 初稿优化 -> 风控核查 -> 润色审查
    """
    session_store.update(session_id, status="generating")
    
    max_iterations = 2
    
    while state["iteration_count"] < max_iterations:
        state["iteration_count"] += 1
        current_iter = state["iteration_count"]
        
        logger.info(f"开始生成循环: iteration={current_iter}")
        
        # 1. 生成初稿（含适度包装）
        draft_result = await node_generate_draft(state)
        state.update(draft_result)
        
        # 2. 初稿优化（检查遗漏、多维度优化）【新增】
        optimize_result = await node_optimize_draft(state)
        state.update(optimize_result)
        
        # 3. 风控核查（只查严重造假）
        check_result = await node_fact_check(state)
        state.update(check_result)
        
        # 4. 润色与终审
        finalize_result = await node_finalize_and_review(state)
        state.update(finalize_result)
        
        # 检查是否通过
        if state.get("review_result", {}).get("passed", False):
            logger.info("审查通过，生成结束")
            break
        else:
            logger.info("审查未完全通过，尝试下一轮优化（如有）")
    
    if not state.get("final_markdown"):
        logger.warning("达到最大迭代次数仍未通过审查，使用最后一次草稿")
        state["final_markdown"] = state.get("optimized_draft", "") or state.get("draft_content", "") or "# 生成失败\n请稍后重试"
        state["title"] = "新简历"
    
    # 保存到数据库
    service = get_generation_service()
    session = session_store.get(session_id)
    
    resume_id = await service.save_generated_resume(
        user_id=session.user_id if session else state["user_id"],
        title=state["title"],
        content=state["final_markdown"],
        job_description=state.get("job_description")
    )
    
    # 更新会话状态
    session_store.update(
        session_id,
        status="completed",
        final_markdown=state["final_markdown"]
    )
    
    logger.info(f"生成流程全部完成: resume_id={resume_id}, title={state['title']}")
    
    return {
        "resume_id": resume_id,
        "title": state["title"],
        "content": state["final_markdown"],
        "review_result": state.get("review_result"),
        "optimization_notes": state.get("optimization_notes")  # 返回优化信息
    }


async def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    """
    获取会话状态
    """
    session = session_store.get(session_id)
    if not session:
        return None
    
    return {
        "session_id": session_id,
        "status": session.status,
        "questions": session.questions if session.status == "awaiting_input" else [],
        "user_answers": session.user_answers,
        "final_markdown": session.final_markdown if session.status == "completed" else None
    }
