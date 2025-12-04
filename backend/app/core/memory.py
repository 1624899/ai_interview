"""
面试系统记忆模块
负责管理面试过程中的状态持久化
所有数据存储在统一的 ai_interview.db 数据库中
"""

import logging
import aiosqlite
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.database import DB_PATH

logger = logging.getLogger(__name__)

# 全局单例 checkpointer 实例
_global_checkpointer = None
_global_connection = None

async def get_async_sqlite_saver(db_path: str = None):
    """
    获取异步 SQLite 检查点保存器（单例模式）
    使用统一的 ai_interview.db 数据库
    
    重要：整个应用共享同一个 checkpointer 实例，确保状态能正确持久化和恢复
    
    Args:
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
        
    Returns:
        AsyncSqliteSaver: 异步 SQLite 检查点保存器实例
    """
    global _global_checkpointer, _global_connection
    
    # 如果已经初始化，直接返回全局实例
    if _global_checkpointer is not None:
        logger.debug("✓ 返回已存在的 checkpointer 实例")
        return _global_checkpointer
    
    db_path = db_path or DB_PATH
    
    try:
        # 创建异步数据库连接
        _global_connection = await aiosqlite.connect(db_path)
        
        # 使用连接创建 AsyncSqliteSaver
        _global_checkpointer = AsyncSqliteSaver(_global_connection)
        
        # 重要：初始化表结构（创建 checkpoints 和 writes 两个表）
        await _global_checkpointer.setup()
        
        logger.info(f"✓ LangGraph async checkpointer 初始化成功: {db_path}")
        print(f"✓ LangGraph async checkpoints 将保存到: {db_path}")
        
        return _global_checkpointer
        
    except Exception as e:
        logger.error(f"✗ AsyncSqliteSaver 初始化失败: {e}")
        print(f"✗ AsyncSqliteSaver 初始化失败: {e}")
        print(f"  回退到 MemorySaver（数据不会持久化）")
        _global_checkpointer = MemorySaver()
        return _global_checkpointer


async def close_checkpointer():
    """
    关闭全局 checkpointer 和数据库连接
    用于应用关闭时的清理
    """
    global _global_checkpointer, _global_connection
    
    if _global_connection is not None:
        try:
            await _global_connection.close()
            logger.info("✓ Checkpointer 数据库连接已关闭")
        except Exception as e:
            logger.error(f"✗ 关闭 checkpointer 连接失败: {e}")
    
    _global_checkpointer = None
    _global_connection = None


def reset_checkpointer():
    """
    重置全局 checkpointer（用于测试）
    """
    global _global_checkpointer, _global_connection
    _global_checkpointer = None
    _global_connection = None
    logger.info("✓ Checkpointer 已重置")

