"""
面试系统记忆模块
负责管理面试过程中的状态持久化
"""

import os
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

def get_memory_saver(use_persistence: bool = True, db_path: str = None, async_mode: bool = True):
    """
    获取检查点保存器
    
    Args:
        use_persistence (bool): 是否使用持久化存储，默认为 True
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
        async_mode (bool): 是否使用异步模式，默认为 True
    
    Returns:
        MemorySaver、SqliteSaver 或 AsyncSqliteSaver: 检查点保存器实例
    """
    # 为了避免异步问题，暂时使用 MemorySaver
    # TODO: 后续可以配置使用 AsyncSqliteSaver
    if use_persistence and not async_mode:
        return get_sqlite_saver(db_path)
    else:
        return MemorySaver()

def get_sqlite_saver(db_path: str = None):
    """
    获取 SQLite 检查点保存器
    
    Args:
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
        
    Returns:
        SqliteSaver: SQLite 检查点保存器实例
    """
    if db_path is None:
        # 在 backend/data 目录下存储数据库
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_root = os.path.dirname(os.path.dirname(current_dir))
        data_dir = os.path.join(backend_root, "data")
        
        # 确保 data 目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        # 数据库文件路径
        db_path = os.path.join(data_dir, "interview_checkpoints.sqlite")
    
    # 在 LangGraph 1.0.2 中，直接使用 SqliteSaver 构造函数
    try:
        return SqliteSaver(db_path)
    except Exception as e:
        print(f"SqliteSaver 初始化失败，尝试使用 MemorySaver: {e}")
        # 如果 SqliteSaver 失败，回退到 MemorySaver
        return MemorySaver()

def get_async_sqlite_saver(db_path: str = None):
    """
    获取异步 SQLite 检查点保存器
    
    Args:
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
        
    Returns:
        AsyncSqliteSaver: 异步 SQLite 检查点保存器实例
    """
    if db_path is None:
        # 在 backend/data 目录下存储数据库
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_root = os.path.dirname(os.path.dirname(current_dir))
        data_dir = os.path.join(backend_root, "data")
        
        # 确保 data 目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        # 数据库文件路径
        db_path = os.path.join(data_dir, "interview_checkpoints.sqlite")
    
    # 使用异步 SQLite 检查点保存器
    try:
        return AsyncSqliteSaver(db_path)
    except Exception as e:
        print(f"AsyncSqliteSaver 初始化失败，尝试使用 MemorySaver: {e}")
        # 如果 AsyncSqliteSaver 失败，回退到 MemorySaver
        return MemorySaver()

def get_memory_saver_legacy():
    """
    获取内存检查点保存器（向后兼容）
    
    Returns:
        MemorySaver: 检查点保存器实例
    """
    return MemorySaver()
