"""
数据库配置和初始化模块
统一管理 ai_interview.db 数据库
"""

import os
import logging

logger = logging.getLogger(__name__)

# 数据库配置
def get_db_path() -> str:
    """
    获取统一的数据库文件路径
    
    Returns:
        str: 数据库文件的绝对路径
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.dirname(os.path.dirname(current_dir))
    data_dir = os.path.join(backend_root, "data")
    
    # 确保 data 目录存在
    os.makedirs(data_dir, exist_ok=True)
    
    # 数据库文件路径
    db_path = os.path.join(data_dir, "ai_interview.db")
    
    return db_path


# 数据库名称常量
DB_NAME = "ai_interview.db"
DB_PATH = get_db_path()

logger.info(f"数据库路径: {DB_PATH}")
