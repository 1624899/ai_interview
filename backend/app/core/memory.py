"""
LangGraph 记忆模块

使用 MemorySaver（内存存储）作为设计选择：
- 会话数据（消息、画像、面试计划）已通过 SessionService 持久化到 PostgreSQL
- 会话恢复时从数据库重建 InterviewState
- 支持自定义的 rollback 逻辑（按消息索引）
"""

import logging
from langgraph.checkpoint.memory import MemorySaver

logger = logging.getLogger(__name__)

# 全局单例 checkpointer 实例
_global_checkpointer = None


async def get_checkpointer():
    """
    获取检查点保存器（单例模式）
    
    当前使用 MemorySaver（内存存储）。
    主要数据已通过 SessionService 持久化到 PostgreSQL。
    
    Returns:
        MemorySaver: 内存检查点保存器实例
    """
    global _global_checkpointer
    
    if _global_checkpointer is None:
        _global_checkpointer = MemorySaver()
        logger.info("✓ LangGraph MemorySaver 初始化成功")
        print("✓ LangGraph 使用 MemorySaver（会话数据已通过 PostgreSQL 持久化）")
    
    return _global_checkpointer


# 向后兼容的别名
async def get_async_sqlite_saver(db_path: str = None):
    """向后兼容的别名"""
    return await get_checkpointer()


async def close_checkpointer():
    """关闭全局 checkpointer"""
    global _global_checkpointer
    _global_checkpointer = None
    logger.info("✓ Checkpointer 已关闭")


def reset_checkpointer():
    """重置全局 checkpointer（用于测试）"""
    global _global_checkpointer
    _global_checkpointer = None
    logger.info("✓ Checkpointer 已重置")
