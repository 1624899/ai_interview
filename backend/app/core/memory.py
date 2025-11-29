"""
面试系统记忆模块
负责管理面试过程中的状态持久化
所有数据存储在统一的 ai_interview.db 数据库中
"""

import aiosqlite
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.database import DB_PATH

# 全局变量用于跟踪 SQLite 连接
_tracked_connections = []

def track_connection(conn):
    """跟踪 SQLite 连接以便后续清理"""
    _tracked_connections.append(conn)
    return conn

def get_tracked_connections():
    """获取所有被跟踪的连接"""
    return _tracked_connections

def clear_tracked_connections():
    """清空被跟踪的连接列表"""
    _tracked_connections.clear()

async def get_async_sqlite_saver(db_path: str = None):
    """
    获取异步 SQLite 检查点保存器
    使用统一的 ai_interview.db 数据库
    
    Args:
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
        
    Returns:
        AsyncSqliteSaver: 异步 SQLite 检查点保存器实例
    """
    db_path = db_path or DB_PATH
    
    try:
        # 创建异步数据库连接
        conn = await aiosqlite.connect(db_path)
        # 跟踪连接以便后续清理
        track_connection(conn)
        # 使用连接创建AsyncSqliteSaver
        saver = AsyncSqliteSaver(conn)
        print(f"✓ LangGraph async checkpoints 将保存到: {db_path}")
        return saver
    except Exception as e:
        print(f"✗ AsyncSqliteSaver 初始化失败: {e}")
        print(f"  回退到 MemorySaver（数据不会持久化）")
        return MemorySaver()

