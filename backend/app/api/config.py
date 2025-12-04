"""
API 配置相关端点
用于验证用户的 API 配置是否有效
"""

import logging
from fastapi import APIRouter, HTTPException
from langchain_openai import ChatOpenAI

from app.models.schemas import ApiConfigValidateRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/config", tags=["配置"])


@router.post("/validate")
async def validate_api_config(request: ApiConfigValidateRequest):
    """
    验证用户的 API 配置是否有效
    
    通过发送一个简单的测试请求来验证配置
    
    Args:
        request: API 配置验证请求
        
    Returns:
        dict: 验证结果
    """
    try:
        # 创建临时 LLM 实例
        llm = ChatOpenAI(
            temperature=0,
            max_tokens=10,
            model_name=request.model,
            api_key=request.api_key,
            base_url=request.base_url,
            timeout=10  # 10秒超时
        )
        
        # 发送测试请求
        response = await llm.ainvoke("Say 'OK' in one word.")
        
        logger.info(f"API 配置验证成功: {request.model}")
        
        return {
            "success": True,
            "message": f"连接成功！模型 {request.model} 可用。"
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.warning(f"API 配置验证失败: {error_msg}")
        
        # 友好的错误提示
        if "401" in error_msg or "Unauthorized" in error_msg:
            message = "API Key 无效，请检查是否正确"
        elif "404" in error_msg or "Not Found" in error_msg:
            message = "模型不存在或 API 地址错误"
        elif "timeout" in error_msg.lower():
            message = "连接超时，请检查网络或 API 地址"
        elif "Connection" in error_msg:
            message = "无法连接到 API 服务器，请检查 Base URL"
        else:
            message = f"验证失败: {error_msg[:100]}"
        
        return {
            "success": False,
            "message": message
        }
