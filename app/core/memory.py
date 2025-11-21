"""
面试系统记忆模块
负责管理面试过程中的状态持久化
"""

import os
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

def get_memory_saver(use_persistence: bool = True, db_path: str = None):
    """
    获取检查点保存器
    
    Args:
        use_persistence (bool): 是否使用持久化存储，默认为 True
        db_path (str): 数据库文件路径，如果为 None 则使用默认路径
    
    Returns:
        MemorySaver 或 SqliteSaver: 检查点保存器实例
    """
    if use_persistence:
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
        # 在项目根目录下创建 data 文件夹存储数据库
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(os.path.dirname(current_dir))
        data_dir = os.path.join(project_root, "data")
        
        # 确保 data 目录存在
        os.makedirs(data_dir, exist_ok=True)
        
        # 数据库文件路径
        db_path = os.path.join(data_dir, "interview_checkpoints.sqlite")
    
    # 使用 SqliteSaver.from_conn_string 方法创建检查点保存器
    # 这是 LangGraph 推荐的方式，不需要手动管理 SQLite 连接
    return SqliteSaver.from_conn_string(db_path)

def get_memory_saver_legacy():
    """
    获取内存检查点保存器（向后兼容）
    
    Returns:
        MemorySaver: 检查点保存器实例
    """
    return MemorySaver()
