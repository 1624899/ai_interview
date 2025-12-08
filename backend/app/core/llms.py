import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from typing import Optional

# 获取项目根目录路径 (现在是 backend 的上级目录)
current_file_path = os.path.abspath(__file__)  # .../backend/app/core/llms.py
app_dir = os.path.dirname(current_file_path)  # .../backend/app/core
backend_app_dir = os.path.dirname(app_dir)  # .../backend/app
backend_dir = os.path.dirname(backend_app_dir)  # .../backend
project_root = os.path.dirname(backend_dir)  # .../ (项目根目录)
env_path = os.path.join(project_root, ".env")

# 尝试加载环境变量（可选，生产环境可能没有 .env 文件）
load_dotenv(env_path, override=False)


# ============================================================================
# 动态 LLM 创建（支持用户自定义配置）- 生产环境主要使用这些函数
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
    
    # 获取对应通道的配置
    channel_config = api_config.get(channel)
    if not channel_config or not channel_config.get("api_key"):
        raise ValueError(
            f"未检测到 {channel.upper()} 通道的 API 配置。请在设置中完整配置 Smart 和 Fast 模型。"
        )
    
    print(f"使用用户自定义 API 配置 ({channel}): {channel_config.get('model')}")
    return create_llm_from_config(
        api_key=channel_config["api_key"],
        base_url=channel_config["base_url"],
        model=channel_config["model"]
    )


# ============================================================================
# 以下为本地开发用的 Legacy LLM 配置（可选，生产环境不需要）
# ============================================================================

class LLMChannel:
    """LLM通道配置类"""
    
    def __init__(self, api_key: str, base_url: str, model_name: str, temperature: float = 0.7):
        self.api_key = api_key
        self.base_url = base_url
        self.model_name = model_name
        self.temperature = temperature
        self._llm_instance: Optional[ChatOpenAI] = None
    
    def get_llm(self) -> ChatOpenAI:
        """获取LLM实例（懒加载）"""
        if self._llm_instance is None:
            self._llm_instance = ChatOpenAI(
                temperature=self.temperature,
                max_tokens=8000,
                model_name=self.model_name,
                api_key=self.api_key,
                base_url=self.base_url
            )
        return self._llm_instance


class LLMFactory:
    """
    LLM工厂类，管理双通道配置（懒加载）
    
    注意：此类只在本地开发时使用，生产环境应使用 get_llm_for_request()
    """
    
    _instance: Optional["LLMFactory"] = None
    
    def __init__(self):
        self._fast_channel: Optional[LLMChannel] = None
        self._smart_channel: Optional[LLMChannel] = None
        self._legacy_llm: Optional[ChatOpenAI] = None
        self._initialized = False
    
    @classmethod
    def get_instance(cls) -> "LLMFactory":
        """获取单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _ensure_initialized(self):
        """确保工厂已初始化（懒加载）"""
        if self._initialized:
            return
        
        self._initialized = True
        
        # Fast Channel - 用于意图识别、简单分类
        fast_api_key = os.getenv("FAST_LLM_API_KEY")
        fast_base_url = os.getenv("FAST_LLM_BASE_URL")
        fast_model = os.getenv("FAST_LLM_MODEL")
        
        if fast_api_key and fast_base_url and fast_model:
            self._fast_channel = LLMChannel(
                api_key=fast_api_key,
                base_url=fast_base_url,
                model_name=fast_model,
                temperature=0.7  
            )
            print("✅ Fast Channel 初始化成功")
        
        # Smart Channel - 用于生成复杂的面试官回复、点评和总结
        smart_api_key = os.getenv("SMART_LLM_API_KEY")
        smart_base_url = os.getenv("SMART_LLM_BASE_URL")
        smart_model = os.getenv("SMART_LLM_MODEL")
        
        if smart_api_key and smart_base_url and smart_model:
            self._smart_channel = LLMChannel(
                api_key=smart_api_key,
                base_url=smart_base_url,
                model_name=smart_model,
                temperature=0.7
            )
            print("✅ Smart Channel 初始化成功")
        
        # Legacy LLM 作为后备（可选）
        legacy_api_key = os.getenv("XINLIU_API_KEY")
        legacy_base_url = os.getenv("XINLIU_API_BASE")
        legacy_model = os.getenv("XINLIU_API_MODEL")
        
        if legacy_api_key and legacy_base_url and legacy_model:
            self._legacy_llm = ChatOpenAI(
                temperature=0.7,
                max_tokens=8000,
                model_name=legacy_model,
                api_key=legacy_api_key,
                base_url=legacy_base_url
            )
            print("✅ Legacy LLM 初始化成功")
        else:
            print("⚠️ Legacy LLM 未配置（生产环境中这是正常的，用户需要在前端提供 API 配置）")
    
    def get_fast_llm(self) -> Optional[ChatOpenAI]:
        """获取Fast Channel的LLM实例"""
        self._ensure_initialized()
        if self._fast_channel:
            return self._fast_channel.get_llm()
        return self._legacy_llm
    
    def get_smart_llm(self) -> Optional[ChatOpenAI]:
        """获取Smart Channel的LLM实例"""
        self._ensure_initialized()
        if self._smart_channel:
            return self._smart_channel.get_llm()
        return self._legacy_llm
    
    def get_legacy_llm(self) -> Optional[ChatOpenAI]:
        """获取传统LLM实例（向后兼容）"""
        self._ensure_initialized()
        return self._legacy_llm


# ============================================================================
# 向后兼容的接口（仅本地开发使用）
# ============================================================================

def get_llm() -> Optional[ChatOpenAI]:
    """获取默认LLM实例（向后兼容，仅本地开发）"""
    return LLMFactory.get_instance().get_legacy_llm()

def get_fast_llm() -> Optional[ChatOpenAI]:
    """获取Fast Channel LLM实例（仅本地开发）"""
    return LLMFactory.get_instance().get_fast_llm()

def get_smart_llm() -> Optional[ChatOpenAI]:
    """获取Smart Channel LLM实例（仅本地开发）"""
    return LLMFactory.get_instance().get_smart_llm()


# ============================================================================
# 测试代码
# ============================================================================

if __name__ == "__main__":
    import asyncio
    
    async def main():
        try:
            # 测试用户配置的 LLM
            test_config = {
                "smart": {
                    "api_key": os.getenv("XINLIU_API_KEY", "test-key"),
                    "base_url": os.getenv("XINLIU_API_BASE", "https://api.openai.com/v1"),
                    "model": os.getenv("XINLIU_API_MODEL", "gpt-3.5-turbo")
                },
                "fast": {
                    "api_key": os.getenv("XINLIU_API_KEY", "test-key"),
                    "base_url": os.getenv("XINLIU_API_BASE", "https://api.openai.com/v1"),
                    "model": os.getenv("XINLIU_API_MODEL", "gpt-3.5-turbo")
                }
            }
            
            llm = get_llm_for_request(test_config, "smart")
            response = await llm.ainvoke("你好，请回复：LLM配置成功！")
            print("LLM响应:", response.content)
            
        except Exception as e:
            print(f"LLM 配置失败: {e}")

    asyncio.run(main())
