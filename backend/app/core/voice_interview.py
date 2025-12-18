"""
语音面试核心业务逻辑
采用类似 graph.py 的架构设计：状态定义 + 节点函数 + 路由逻辑
支持 SSE 流式输出
"""

import logging
import base64
import json
import struct
import asyncio
from typing import Optional, List, Dict, Any, Literal, TypedDict, AsyncGenerator

from app.core import llms
from app.core.llms import get_async_omni_client
from app.database.session_service import SessionService

logger = logging.getLogger(__name__)


# ============================================================================
# 数据结构定义
# ============================================================================

class VoiceInterviewState(TypedDict):
    """
    语音面试状态定义 - 统一的状态结构
    """
    # 基础信息
    session_id: str
    api_config: Dict[str, Any]
    
    # 面试规划
    interview_plan: List[Dict[str, str]]
    system_prompt: str
    
    # 对话历史
    history: List[Dict[str, Any]]
    
    # 当前阶段
    current_phase: Literal["planning", "greeting", "conversation", "complete"]
    current_q_idx: int  # 当前计划中的题目索引
    follow_up_count: int  # 对当前题目的追问次数
    
    # 当前输入（用于对话阶段）
    audio_base64: Optional[str]
    text_message: Optional[str]
    audio_id: Optional[str]  # 浏览器端 IndexedDB 存储的音频 ID


# ============================================================================
# 工具函数
# ============================================================================

def pcm_to_wav(pcm_data: bytes, sample_rate=24000, num_channels=1, bits_per_sample=16) -> bytes:
    """将原始 PCM 数据转换为 WAV 格式"""
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = len(pcm_data)
    
    wav_header = struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF',
        36 + data_size,
        b'WAVE',
        b'fmt ',
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b'data',
        data_size
    )
    return wav_header + pcm_data


async def save_message_async(session_id: str, role: str, content: str, question_index: int = 0, audio_url: Optional[str] = None):
    """异步保存消息到数据库"""
    if not content and not audio_url:
        return
        
    try:
        service = SessionService()
        await service.add_message(session_id, role, content or "", question_index=question_index, audio_url=audio_url)
        logger.info(f"[Voice] 消息已保存: {session_id} - {role} (q={question_index})")
    except Exception as e:
        logger.error(f"[Voice] 保存消息失败: {e}")


def _get_omni_client(api_config: Dict[str, Any]):
    """获取 Omni 客户端（内部工具函数）"""
    voice_config = api_config.get("voice")
    if not voice_config:
        voice_config = api_config.get("fast")
    return get_async_omni_client(voice_config)


# ============================================================================
# 面试规划节点
# ============================================================================


async def node_planner(
    resume: str,
    job_description: str,
    company_info: str,
    max_questions: int,
    api_config: Dict[str, Any],
    session_id: Optional[str] = None  # 新增：用于多轮面试支持
) -> Dict[str, Any]:
    """
    规划节点：生成面试计划
    使用统一的 interview_planner 模块，支持多轮面试
    
    Args:
        resume: 简历内容
        job_description: 岗位描述
        company_info: 公司信息
        max_questions: 最大问题数
        api_config: API 配置
        session_id: 会话 ID（用于获取轮次信息）
        
    Returns:
        包含 interview_plan 和 system_prompt 的状态更新
    """
    from . import interview_planner
    
    # 获取轮次信息（多轮面试支持）
    round_index = 1
    round_type = "voice_default"  # 语音面试默认策略
    previous_profile = None
    previous_questions = []
    
    if session_id:
        try:
            service = SessionService()
            session = await service.get_session(session_id)
            if session and session.metadata:
                # 获取轮次信息
                round_index = getattr(session.metadata, 'round_index', 1) or 1
                stored_round_type = getattr(session.metadata, 'round_type', None)
                
                # 语音面试使用特定的轮次策略映射
                if stored_round_type:
                    voice_round_type_map = {
                        "tech_initial": "voice_default",
                        "tech_deep": "tech_deep",  # 深度追问保持原策略
                        "hr_comprehensive": "hr_comprehensive",  # HR 综合面试保持原策略
                    }
                    round_type = voice_round_type_map.get(stored_round_type, "voice_default")
                
                # 获取上一轮画像和问题（如果是第二轮及以后）
                parent_session_id = getattr(session.metadata, 'parent_session_id', None)
                if round_index > 1 and parent_session_id:
                    previous_profile = await service.get_profile(parent_session_id)
                    parent_plan = await service.get_interview_plan(parent_session_id)
                    if parent_plan:
                        previous_questions = [q.get("content", q.get("topic", "")) for q in parent_plan]
                    logger.info(f"[Voice] 多轮面试第 {round_index} 轮，上一轮问题数: {len(previous_questions)}")
                        
        except Exception as e:
            logger.error(f"[Voice] 获取轮次信息失败: {e}")
    
    # 使用统一的规划模块
    interview_plan = await interview_planner.generate_interview_plan(
        resume=resume,
        job_description=job_description,
        company_info=company_info,
        max_questions=max_questions,
        api_config=api_config,
        round_type=round_type,
        round_index=round_index,
        previous_profile=previous_profile,
        previous_questions=previous_questions,
        output_format="simple",  # 语音面试使用简单格式：只有 topic 和 content
        session_id=session_id,
        save_to_db=True if session_id else False  # 如果有 session_id 则保存到数据库
    )
    
    # 构建 system_prompt
    system_prompt = _build_system_prompt(interview_plan)
    
    # 获取开场白文本（根据轮次调整）
    first_question = interview_plan[0].get("content") if interview_plan else None
    opening_message = _get_opening_message(first_question, round_index)
    
    return {
        "interview_plan": interview_plan,
        "system_prompt": system_prompt,
        "opening_message": opening_message,
        "current_phase": "greeting",
        "round_index": round_index,
        "round_type": round_type
    }


def calculate_interview_progress(history: List[Dict[str, Any]], plan: List[Dict[str, Any]], initial_q_idx: int = 0) -> Dict[str, Any]:
    """
    通过分析历史对话，推断当前的面试进度。
    """
    current_q_idx = initial_q_idx
    follow_up_count = 0
    last_q_text = ""
    last_planned_q_found = False

    if not plan:
        return {"current_q_idx": 0, "follow_up_count": 0, "last_q_text": "", "is_complete": False}

    import re

    def is_match(ai_content: str, q_topic: str, q_content: str, q_idx: int) -> bool:
        """多维度匹配逻辑"""
        # 预处理 AI 内容：去除标点符号和空格，统一匹配口径
        clean_ai = re.sub(r'[^\w\u4e00-\u9fa5]', '', ai_content)
        
        # 1. 题号匹配 (如 "第一个问题", "第二题", "1.", "2)", 支持中文数字)
        chinese_nums = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
        num_patterns = [
            f"第{q_idx+1}[个题问话]", 
            f"第{q_idx+1}阶段",
            f"^({q_idx+1}[.、])",
            f"({q_idx+1}[.、])"
        ]
        # 添加中文数字匹配 (如 "第一题")
        if q_idx < len(chinese_nums):
            num_patterns.append(f"第{chinese_nums[q_idx]}[个题问话]")
            num_patterns.append(f"第{chinese_nums[q_idx]}阶段")
        
        # 增加对“最后一题”的识别
        if q_idx == len(plan) - 1:
            num_patterns.append("最后一题")
            num_patterns.append("最后一个问题")
            num_patterns.append("结束面试")
            
        if any(re.search(p, ai_content) for p in num_patterns):
            return True

        # 2. Topic 模糊匹配
        if q_topic:
            clean_topic = re.sub(r'[^\w\u4e00-\u9fa5]', '', q_topic)
            # 强化匹配要求：少于4个字的 Topic 必须完全包含且不是被包含在更长的词中，或者要求 AI 明确提及
            if len(clean_topic) >= 2:
                # 排除极其常见的干扰词（如"项目", "经验"等，除非它们是 Topic 的核心）
                common_filters = ["项目", "经验", "技术", "基础", "了解", "面试", "问题"]
                if clean_topic in clean_ai:
                    # 如果 Topic 只有 2 个字且是常见词，要求周围有更明确的提示词，或者不仅是包含
                    if len(clean_topic) <= 2 and clean_topic in common_filters:
                        # 检查是否有“第X个”或“关于”等前序词
                        if re.search(f"第[一二三四五六七八九十\d][个环节题问话].*{clean_topic}", ai_content) or f"关于{clean_topic}" in ai_content:
                            return True
                    else:
                        return True

        # 3. Content 核心成分匹配 (滑动窗口匹配)
        core_text = re.sub(r'[^\w\u4e00-\u9fa5]', '', q_content[:40])
        if len(core_text) >= 12:
            # 增加匹配长度要求到 10 个连续字符，减少误判
            for j in range(len(core_text) - 9):
                if core_text[j:j+10] in clean_ai:
                    return True
        elif core_text and len(core_text) > 4 and core_text in clean_ai:
            return True

        return False

    # 遍历历史记录
    # 策略：我们只需要看助手的每句话，看它是否引导到了新的一题
    for msg in history:
        if msg.get("role") == "assistant":
            content = msg.get("content", "").strip()
            if not content: continue
            
            # 1. 尝试匹配下一题 (current_q_idx + 1)
            # 只有当匹配到下一题或更后的题目时，才推进索引
            found_next = False
            for i in range(current_q_idx + 1, len(plan)):
                p = plan[i]
                if is_match(content, p.get("topic", ""), p.get("content", ""), i):
                    current_q_idx = i
                    follow_up_count = 0
                    last_q_text = p.get("content", "")
                    last_planned_q_found = True
                    found_next = True
                    logger.debug(f"[Progress] 匹配到新题目索引: {i}")
                    break
            
            if not found_next:
                # 2. 如果没匹配到下一题，检查是否是在说当前题
                curr_p = plan[current_q_idx]
                if is_match(content, curr_p.get("topic", ""), curr_p.get("content", ""), current_q_idx):
                    if not last_planned_q_found:
                        # 第一次明确匹配到当前题
                        last_planned_q_found = True
                        last_q_text = curr_p.get("content", "")
                    else:
                        # 已经在这一题了，现在的对话算追问
                        follow_up_count += 1
                        last_q_text = content
                elif last_planned_q_found:
                    # 既不是下一题，也不是当前题的关键词匹配，但 AI 在说话，通常是自然语言追问
                    # 如果不是非常短的句子（如“好的”），计为追问
                    if len(content) > 10:
                        follow_up_count += 1
                        last_q_text = content

    # 计算是否完成面试
    is_complete = False
    last_ai_msg = ""
    for msg in reversed(history):
        if msg.get("role") == "assistant":
            last_ai_msg = msg.get("content", "").lower()
            break
    
    # 检查是否到达计划末尾
    if current_q_idx >= len(plan) - 1:
        closing_keywords = ["面试结束", "再见", "谢谢你的参加", "祝你生活愉快", "今天的面试就到这里", "辛苦了", "拜拜", "期待你的加入"]
        if any(kw in last_ai_msg for kw in closing_keywords):
            is_complete = True
        elif follow_up_count >= 3:
            is_complete = True

    return {
        "current_q_idx": current_q_idx,
        "follow_up_count": follow_up_count,
        "last_q_text": last_q_text,
        "is_complete": is_complete
    }


def _build_system_prompt(
    interview_plan: List[Dict[str, Any]], 
    current_q_idx: int = 0, 
    follow_up_count: int = 0,
    last_q_text: str = ""
) -> str:
    """
    根据面试计划和当前状态构建 Omni 的 System Prompt
    """
    questions_text = "\n".join([
        f"{i+1}. [{q.get('topic')}] {q.get('content')}" 
        for i, q in enumerate(interview_plan)
    ])
    
    current_plan_q = interview_plan[current_q_idx].get('content') if current_q_idx < len(interview_plan) else "面试结束"
    next_plan_q = interview_plan[current_q_idx + 1].get('content') if current_q_idx + 1 < len(interview_plan) else "面试结束"
    
    # 动态建议 - 追问限制 2 次
    MAX_FOLLOW_UP = 2
    follow_up_advice = ""
    is_last_question = current_q_idx >= len(interview_plan) - 1
    
    if follow_up_count >= MAX_FOLLOW_UP:
        if is_last_question:
            follow_up_advice = """【🎯 面试结项指令】：
1. 你已完成所有考察。请进行简短一句话真实评价，并友好地告别。
2. 必须包含关键词：'面试结束'。"""
        else:
            follow_up_advice = f"""【⏭️ 强制切换话题】：当前话题追问次数已达上限，请立即切换到下一题。
**规则**：你必须在回复中明确提到“下一题”或“第 {current_q_idx + 2} 个问题”，并念出题目内容。
下一题："{next_plan_q}"
过渡示例："好的。接下来我们进入第 {current_q_idx + 2} 个问题，我想了解一下..." + 下一题内容"""
    elif is_last_question:
        follow_up_advice = """【💡 最后一题】：这是最后一个环节。
- 如果候选人回答已覆盖核心要点，无需追问，请直接结束面试（必须包含"面试结束"）。
- 仅在回答极度不完整时，才进行最多 1 次补充追问。"""
    elif follow_up_count > 0:
        follow_up_advice = "【📝 当前进度】：已进行过追问。如果候选人现在的补充已经清晰，**严禁再次追问**，请立即切换到下一题。"
    else:
        follow_up_advice = f"【📝 当前进度】：这是第 {current_q_idx + 1} 题的首次提问。如果候选人回答得不错，请**不要追问**，直接进入下一题。仅在回答比较笼统时才进行 1 次启发式提问。"

    return f"""你是一位专业、耐心、善于引导的技术面试官。
你正在通过语音与候选人进行一对一面试。

【面试计划】：
{questions_text}

【当前状态】：
- 当前步骤：第 {current_q_idx + 1} 题 —— "{current_plan_q}"
- 已追问次数：{follow_up_count} / {MAX_FOLLOW_UP}
- 下一步骤："{next_plan_q}"

{follow_up_advice}

【核心行为准则】：

1. **识别无效/简短回答**：
   - 候选人只说"你好"、"好的"、"嗯"等不是有效回答。
   - 此时要友好引导，例如："你好！那我们正式开始，请先介绍一下你最近做过的一个项目吧。"
   
2. **追问策略**：
   - 保持高效率。如果候选人回答已达到考察目的，**严禁无意义的追问**。
   - 只有在回答确实由于干扰或简略导致无法评估时，才进行 1 次精准追问。
   
3. **自然切题**：
   - 优先向下推进面试计划。一旦得到有效回答，立即进入下一题。
   - 切换时请清晰说出“下一题”或“第 X 题”。

4. **语音对话规范**：
   - 用口语化、平易近人的语气。
   - 禁止使用 Markdown 符号（如 #, *, -, >）、括号注释或特殊格式。
   - 给出正面反馈后立即提问/追问。

全程使用中文对话。"""


def _get_opening_message(first_question: str = None, round_index: int = 1) -> str:
    """
    获取面试开场白（内部函数）
    
    Args:
        first_question: 第一个问题的内容
        round_index: 当前轮次（用于生成不同的开场白）
    """
    # 根据轮次生成不同的开场白
    if round_index == 1:
        greeting = "你好，我是你的面试官。"
    elif round_index == 2:
        greeting = "欢迎来到第二轮面试，我是本轮的面试官。"
    else:
        greeting = f"欢迎来到第 {round_index} 轮面试，我将继续担任你的面试官。"
    
    if first_question:
        return f"{greeting}\n\n{first_question}"
    else:
        return f"{greeting} 请先做一个简短的自我介绍。"


# ============================================================================
# 开场白节点 (SSE 流式输出)
# ============================================================================

async def node_greeting(state: VoiceInterviewState) -> AsyncGenerator[str, None]:
    """
    开场白节点：生成开场白的音频（SSE 流式输出）
    
    Args:
        state: 当前状态
        
    Yields:
        SSE 格式的事件数据
    """
    session_id = state.get("session_id")
    text_message = state.get("text_message")  # 开场白文本
    api_config = state.get("api_config", {})
    
    try:
        logger.info(f"[Voice] 开场白节点开始: session={session_id}, text={text_message[:50] if text_message else 'None'}...")
        
        client = _get_omni_client(api_config)
        
        # TTS 专用消息 - 只做语音合成
        messages = [
            {
                "role": "system",
                "content": "你是一个语音合成系统。你的唯一任务是将用户提供的文字转换成语音。请原封不动地朗读用户输入的文字，不要添加、删除或修改任何内容，不要进行回复或对话，只需要朗读。"
            },
            {
                "role": "user",
                "content": f"请朗读以下内容：\n\n{text_message}"
            }
        ]
        
        # 调用 Omni 模型
        completion = await client.chat.completions.create(
            model="qwen3-omni-flash-2025-12-01",
            messages=messages,
            modalities=["text", "audio"],
            audio={"voice": "Cherry", "format": "wav"},
            stream=True,
            stream_options={"include_usage": True},
        )
        
        # 处理流式响应
        text_response = ""
        audio_chunks = []
        
        async for chunk in completion:
            if chunk.choices:
                delta = chunk.choices[0].delta
                
                # 流式输出文本
                if hasattr(delta, 'content') and delta.content:
                    text_response += delta.content
                    yield f"data: {json.dumps({'type': 'text', 'content': delta.content}, ensure_ascii=False)}\n\n"
                
                # 流式输出音频
                if hasattr(delta, 'audio') and delta.audio:
                    audio_data = None
                    if isinstance(delta.audio, dict):
                        audio_data = delta.audio.get("data")
                    elif hasattr(delta.audio, 'data'):
                        audio_data = delta.audio.data
                    
                    if audio_data:
                        yield f"data: {json.dumps({'type': 'audio', 'content': audio_data}, ensure_ascii=False)}\n\n"
                        audio_chunks.append(audio_data)
        
        logger.info(f"[Voice] 开场白节点完成: text={len(text_response)}字符, audio_chunks={len(audio_chunks)}")
        
        # 发送完成信号
        yield f"data: {json.dumps({'type': 'done', 'text': text_response}, ensure_ascii=False)}\n\n"
        
        # 异步保存开场白消息
        asyncio.create_task(save_message_async(session_id, "assistant", text_response))
        
    except Exception as e:
        logger.error(f"[Voice] 开场白节点失败: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


# ============================================================================
# 对话节点 (SSE 流式输出)
# ============================================================================

async def node_responder(state: VoiceInterviewState) -> AsyncGenerator[str, None]:
    """
    对话节点：处理用户输入并生成 AI 回复（SSE 流式输出）
    
    Args:
        state: 当前状态
        
    Yields:
        SSE 格式的事件数据
    """
    session_id = state.get("session_id")
    history = state.get("history", [])
    audio_base64 = state.get("audio_base64")
    text_message = state.get("text_message")
    audio_id = state.get("audio_id")
    api_config = state.get("api_config", {})
    
    try:
        # 1. 获取面试计划和进度
        service = SessionService()
        session = await service.get_session(session_id)
        
        # 从数据库获取面试计划
        interview_plan = await service.get_interview_plan(session_id) or []
        # 获取上次保存的进度作为起点 (question_count 存储的是 0-based 题目索引)
        initial_q_idx = getattr(session.metadata, 'question_count', 0) if hasattr(session, 'metadata') else 0
        if not isinstance(initial_q_idx, int):
            initial_q_idx = 0

        # 1. 计算对话后的新进度
        progress = calculate_interview_progress(history, interview_plan, initial_q_idx)
        current_q_idx = progress["current_q_idx"]
        follow_up_count = progress["follow_up_count"]
        last_q_text = progress["last_q_text"]
        
        # 【持久化用户消息】使用准确的当前题目索引
        user_content = text_message if text_message else "[语音]"
        await save_message_async(session_id, "user", user_content, question_index=current_q_idx, audio_url=audio_id)

        # 2. 重新生成针对当前进度的 System Prompt
        system_prompt = _build_system_prompt(
            interview_plan, 
            current_q_idx, 
            follow_up_count,
            last_q_text
        )

        logger.info(f"[Voice] 对话节点开始: session={session_id}, 进度=题{current_q_idx+1}/追问{follow_up_count}")
        
        client = _get_omni_client(api_config)
        
        # 构建消息列表
        messages = []
        
        # System Prompt
        if system_prompt:
            messages.append({
                "role": "system",
                "content": system_prompt
            })
        
        # 历史消息 (最近 15 条)
        for msg in history[-15:]:
            messages.append(msg)
        
        # 当前用户输入
        if audio_base64:
            audio_data_url = f"data:audio/wav;base64,{audio_base64}"
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_data_url,
                            "format": "wav"
                        }
                    }
                ]
            })
        elif text_message:
            messages.append({
                "role": "user",
                "content": text_message
            })
        
        logger.info(f"[Voice] 发送 Omni 请求: session={session_id}, msgs_len={len(messages)}")
        
        # 调用 Omni 模型
        completion = await client.chat.completions.create(
            model="qwen3-omni-flash-2025-12-01",
            messages=messages,
            modalities=["text", "audio"],
            audio={"voice": "Cherry", "format": "wav"},
            stream=True,
            stream_options={"include_usage": True},
        )
        
        # 处理流式响应
        text_response = ""
        audio_chunks = []
        chunk_count = 0
        
        async for chunk in completion:
            chunk_count += 1
            if chunk.choices:
                delta = chunk.choices[0].delta
                
                # 流式输出文本
                if hasattr(delta, 'content') and delta.content:
                    text_response += delta.content
                    yield f"data: {json.dumps({'type': 'text', 'content': delta.content}, ensure_ascii=False)}\n\n"
                
                # 流式输出音频
                if hasattr(delta, 'audio') and delta.audio:
                    audio_data = None
                    if isinstance(delta.audio, dict):
                        audio_data = delta.audio.get("data")
                    elif hasattr(delta.audio, 'data'):
                        audio_data = delta.audio.data
                    
                    if audio_data:
                        yield f"data: {json.dumps({'type': 'audio', 'content': audio_data}, ensure_ascii=False)}\n\n"
                        audio_chunks.append(audio_data)
        
        logger.info(f"[Voice] 对话节点完成: chunks={chunk_count}, text={len(text_response)}字符, audio_chunks={len(audio_chunks)}")
        
        # 再次计算进度，以包含 AI 刚刚给出的回复（判断 AI 是否已经进入了下一题）
        user_content = text_message if text_message else "[语音]"
        new_history = history + [
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": text_response}
        ]
        new_progress = calculate_interview_progress(new_history, interview_plan, initial_q_idx=current_q_idx)
        new_q_idx = new_progress["current_q_idx"]
        is_complete = new_progress.get("is_complete", False)
        
        # 1. 发送进度更新
        yield f"data: {json.dumps({'type': 'progress', 'current': new_q_idx + 1}, ensure_ascii=False)}\n\n"
        
        # 如果面试已完成，发送对应标志并更新状态（画像分析在总结节点或手动调用时统一触发）
        if is_complete:
            from . import interview_analysis
            yield f"data: {json.dumps({'type': 'complete'}, ensure_ascii=False)}\n\n"
            # 只更新状态，不触发画像分析（避免重复触发，由总结接口统一处理）
            asyncio.create_task(interview_analysis.handle_interview_complete(
                session_id=session_id,
                api_config=api_config,
                trigger_analysis=False  # 画像分析由 /api/voice/summary 统一触发
            ))

        # 2. 发送完成信号
        yield f"data: {json.dumps({'type': 'done', 'text': text_response}, ensure_ascii=False)}\n\n"
        
        # 3. 同步持久化进度（question_count 存储 0-based 索引，用于标识当前进展题号）
        await service.update_session_question_count(session_id, new_q_idx)
        # 注意：user 消息已经在开头存过了，这里只存 assistant
        await save_message_async(session_id, "assistant", text_response, question_index=new_q_idx)
        
    except Exception as e:
        logger.error(f"[Voice] 对话节点失败: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def node_summary(state: VoiceInterviewState) -> AsyncGenerator[str, None]:
    """
    总结节点：在面试结束后生成面试反馈总结（SSE 流式输出）
    """
    from . import interview_analysis
    
    session_id = state.get("session_id")
    api_config = state.get("api_config", {})
    history = state.get("history", [])
    
    try:
        logger.info(f"[Voice] 总结节点开始: session={session_id}")
        
        # 使用统一处理流程
        summary = await interview_analysis.process_interview_summary(
            session_id=session_id,
            messages=history,
            mode="mock",
            api_config=api_config,
            trigger_analysis=True
        )
        
        # 流式输出总结（模拟逐字输出效果）
        chunk_size = 20
        for i in range(0, len(summary), chunk_size):
            chunk = summary[i:i+chunk_size]
            yield f"data: {json.dumps({'type': 'summary_text', 'content': chunk}, ensure_ascii=False)}\n\n"
        
        # 发送完成信号
        yield f"data: {json.dumps({'type': 'summary_done', 'text': summary}, ensure_ascii=False)}\n\n"
        
        # 保存总结到对话记录
        await save_message_async(session_id, "assistant", f"【面试总结】\n\n{summary}")
        
        logger.info(f"[Voice] 总结节点完成: session={session_id}")
        
    except Exception as e:
        logger.error(f"[Voice] 总结节点失败: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def generate_voice_summary(
    session_id: str,
    api_config: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    """
    生成语音面试总结（对外接口，SSE 流式输出）
    """
    from . import interview_analysis
    
    try:
        logger.info(f"[Voice] 开始生成面试总结: session={session_id}")
        
        # 获取会话历史
        service = SessionService()
        session = await service.get_session(session_id)
        
        if not session:
            yield f"data: {json.dumps({'type': 'error', 'message': '会话不存在'})}\n\n"
            return
        
        # 构建消息列表
        history = []
        if session.messages:
            for msg in session.messages:
                if msg.role != "system" and msg.content:
                    history.append({"role": msg.role, "content": msg.content})
        
        # 使用统一处理流程
        summary = await interview_analysis.process_interview_summary(
            session_id=session_id,
            messages=history,
            mode="mock",
            api_config=api_config,
            trigger_analysis=True
        )
        
        # 流式输出总结
        chunk_size = 20
        for i in range(0, len(summary), chunk_size):
            chunk = summary[i:i+chunk_size]
            yield f"data: {json.dumps({'type': 'summary_text', 'content': chunk}, ensure_ascii=False)}\n\n"
        
        # 发送完成信号
        yield f"data: {json.dumps({'type': 'summary_done', 'text': summary}, ensure_ascii=False)}\n\n"
        
        # 保存
        await save_message_async(session_id, "assistant", f"【面试总结】\n\n{summary}")
        
    except Exception as e:
        logger.error(f"[Voice] 生成面试总结失败: {e}", exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


# ============================================================================
# 路由逻辑
# ============================================================================

def route_voice_entry(state: VoiceInterviewState) -> str:
    """
    入口路由：根据当前状态决定进入哪个节点
    
    Args:
        state: 当前状态
        
    Returns:
        节点名称: "planner", "greeting", "responder"
    """
    current_phase = state.get("current_phase", "planning")
    interview_plan = state.get("interview_plan", [])
    
    # 如果没有面试计划，进入规划节点
    if not interview_plan:
        return "planner"
    
    # 如果是开场白阶段
    if current_phase == "greeting":
        return "greeting"
    
    # 如果面试已完成
    if current_phase == "complete":
        return "summary"
    
    # 默认进入对话节点
    return "responder"


# ============================================================================
# 统一入口函数 (兼容现有 API)
# ============================================================================

async def generate_interview_plan(
    resume: str,
    job_description: str,
    company_info: str,
    max_questions: int,
    api_config: Dict[str, Any],
    session_id: Optional[str] = None  # 新增：用于多轮面试支持
) -> List[Dict[str, str]]:
    """
    生成面试计划（对外接口，兼容现有调用）
    
    Args:
        resume: 简历内容
        job_description: 岗位描述
        company_info: 公司信息
        max_questions: 最大问题数
        api_config: API 配置
        session_id: 会话 ID（用于多轮面试的轮次信息获取）
        
    Returns:
        面试问题列表
    """
    result = await node_planner(resume, job_description, company_info, max_questions, api_config, session_id)
    return result.get("interview_plan", [])


def build_system_prompt(interview_plan: List[Dict[str, str]]) -> str:
    """
    根据面试计划构建 System Prompt（对外接口，兼容现有调用）
    """
    return _build_system_prompt(interview_plan)


def get_opening_message(first_question: str = None, round_index: int = 1) -> str:
    """
    获取面试开场白（对外接口，兼容现有调用）
    
    Args:
        first_question: 第一个问题的内容
        round_index: 当前轮次（用于生成不同的开场白）
    """
    return _get_opening_message(first_question, round_index)


async def generate_greeting_audio(text: str, api_config: Dict[str, Any]) -> tuple[Optional[str], str]:
    """
    使用 Omni 生成开场白的音频（对外接口，兼容现有调用）
    
    Args:
        text: 开场白文本
        api_config: API 配置
        
    Returns:
        元组 (音频 Base64 字符串, TTS 生成的文本)
    """
    try:
        client = _get_omni_client(api_config)
        
        messages = [
            {
                "role": "system",
                "content": "你是一个语音合成系统。你的唯一任务是将用户提供的文字转换成语音。请原封不动地朗读用户输入的文字，不要添加、删除或修改任何内容，不要进行回复或对话，只需要朗读。"
            },
            {
                "role": "user",
                "content": f"请朗读以下内容：\n\n{text}"
            }
        ]
        
        # 使用异步客户端
        completion = await client.chat.completions.create(
            model="qwen3-omni-flash-2025-12-01",
            messages=messages,
            modalities=["text", "audio"],
            audio={"voice": "", "format": "wav"},
            stream=True,
            stream_options={"include_usage": True},
        )
        
        audio_chunks = []
        text_chunks = []
        
        async for chunk in completion:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    text_chunks.append(delta.content)
                if hasattr(delta, 'audio') and delta.audio:
                    audio_data = None
                    if isinstance(delta.audio, dict):
                        audio_data = delta.audio.get("data")
                    elif hasattr(delta.audio, 'data'):
                        audio_data = delta.audio.data
                    if audio_data:
                        audio_chunks.append(audio_data)
        
        generated_text = "".join(text_chunks)
        
        if not audio_chunks:
            return None, generated_text or text
        
        combined_base64 = "".join(audio_chunks)
        try:
            pcm_data = base64.b64decode(combined_base64)
            wav_data = pcm_to_wav(pcm_data)
            result = base64.b64encode(wav_data).decode('utf-8')
            return result, generated_text or text
        except Exception as conv_err:
            logger.warning(f"[Voice] PCM 转 WAV 失败: {conv_err}")
            return combined_base64, generated_text or text
             
    except Exception as e:
        logger.error(f"[Voice] 生成开场白音频失败: {e}")
        return None, text


async def process_voice_chat(
    session_id: str,
    system_prompt: str,
    history: List[Dict[str, Any]],
    audio_base64: Optional[str],
    text_message: Optional[str],
    api_config: Dict[str, Any],
    is_greeting: bool = False,
    audio_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    处理语音对话请求（对外接口，兼容现有调用）
    
    内部使用路由逻辑分发到对应的节点函数
    
    Args:
        session_id: 会话 ID
        system_prompt: 系统提示词
        history: 历史消息
        audio_base64: 用户音频 (base64)
        text_message: 用户文本消息
        api_config: API 配置
        is_greeting: 是否为开场白模式
        audio_id: 浏览器端音频 ID
        
    Yields:
        SSE 格式的事件数据
    """
    # 构建状态
    state: VoiceInterviewState = {
        "session_id": session_id,
        "api_config": api_config,
        "interview_plan": [],  # 在这个入口不使用
        "system_prompt": system_prompt,
        "history": history or [],
        "current_phase": "greeting" if is_greeting else "conversation",
        "audio_base64": audio_base64,
        "text_message": text_message,
        "audio_id": audio_id
    }
    
    # 兼容处理：仅在确定为启动阶段且无历史记录时，自动识别开场白模式
    if not is_greeting:
        # 如果既没有历史记录，也没有语音输入，但有文本输入（通常是首回合的 greetingText）
        if not history and not audio_base64 and text_message:
            logger.info("[Voice] 自动识别为首回合开场白模式 (TTS)")
            state["current_phase"] = "greeting"
            is_greeting = True
    
    logger.info(f"[Voice] process_voice_chat: session={session_id}, phase={state['current_phase']}, is_greeting={is_greeting}")
    
    # 路由到对应节点
    node_name = route_voice_entry(state)
    logger.info(f"[Voice] 路由结果: {node_name}")
    
    if node_name == "greeting" or is_greeting:
        async for event in node_greeting(state):
            yield event
    elif node_name == "summary":
        async for event in node_summary(state):
            yield event
    else:
        async for event in node_responder(state):
            yield event
