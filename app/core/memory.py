"""
面试系统记忆模块
负责管理面试过程中的状态持久化
"""

from langgraph.checkpoint.memory import MemorySaver
# 如果需要持久化到数据库，可以使用 SqliteSaver
# from langgraph.checkpoint.sqlite import SqliteSaver
# import sqlite3

def get_memory_saver():
    """
    获取内存检查点保存器
    
    目前使用内存存储 (MemorySaver)，这意味着重启应用后状态会丢失。
    如果需要持久化存储，可以切换到 SqliteSaver。
    
    Returns:
        MemorySaver: 检查点保存器实例
    """
    return MemorySaver()

# 示例：如何使用 SqliteSaver
# def get_sqlite_saver(db_path: str = "checkpoints.sqlite"):
#     conn = sqlite3.connect(db_path, check_same_thread=False)
#     return SqliteSaver(conn)
