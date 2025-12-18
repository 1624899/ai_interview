from langchain_openai import ChatOpenAI
from typing import Optional


# ============================================================================
# 动态 LLM 创建（支持用户自定义配置）
# ============================================================================

def create_llm_from_config(
    api_key: str,
    base_url: str,
    model: str,
    temperature: float = 0.7,
    max_tokens: int = 8000
) -> ChatOpenAI:
    """
    根据用户提供的配置创建 LLM 实例
    
    Args:
        api_key: API Key
        base_url: API Base URL
        model: 模型名称
        temperature: 温度参数
        max_tokens: 最大 token 数
        
    Returns:
        ChatOpenAI: LLM 实例
    """
    return ChatOpenAI(
        temperature=temperature,
        max_tokens=max_tokens,
        model_name=model,
        api_key=api_key,
        base_url=base_url
    )


def get_llm_for_request(api_config: Optional[dict] = None, channel: str = "smart") -> ChatOpenAI:
    """
    获取用于处理请求的 LLM 实例
    
    **强制要求用户配置 API**，不再使用服务器默认配置
    支持双通道独立配置：smart 和 fast 可以使用不同的 API 提供商
    
    Args:
        api_config: 用户的 API 配置，结构为 { smart: {...}, fast: {...} }
        channel: 使用的通道，"fast" 或 "smart"
        
    Returns:
        ChatOpenAI: LLM 实例
        
    Raises:
        ValueError: 如果用户未提供 API 配置
    """
    # 检查是否提供了用户配置
    if not api_config:
        raise ValueError(
            "未检测到 API 配置。请在设置中配置您的大模型 API 后再使用本功能。"
        )
    
    # 调试：打印接收到的配置
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[LLM] 请求通道: {channel}")
    
    # 获取对应通道的配置
    channel_config = api_config.get(channel)
    if not channel_config or not channel_config.get("api_key"):
        logger.error(f"[LLM] 通道 {channel} 配置缺失或无效: {channel_config}")
        raise ValueError(
            f"未检测到 {channel.upper()} 通道的 API 配置。请在设置中完整配置 Smart 和 Fast 模型。"
        )
    
    logger.info(f"使用用户自定义 API 配置 ({channel}): {channel_config.get('model')}, max_tokens=8000")
    return create_llm_from_config(
        api_key=channel_config["api_key"],
        base_url=channel_config["base_url"],
        model=channel_config["model"],
        max_tokens=8000
    )


def get_async_omni_client(voice_config: dict):
    """
    根据前端传入的配置创建 异步 OpenAI 客户端 (用于流式语音模型)
    
    使用 AsyncOpenAI 实现真正的流式输出，避免阻塞事件循环
    """
    from openai import AsyncOpenAI
    
    if not voice_config or not voice_config.get("api_key"):
        raise ValueError("未检测到语音模型 API 配置")
        
    return AsyncOpenAI(
        api_key=voice_config["api_key"],
        base_url=voice_config["base_url"],
    )
