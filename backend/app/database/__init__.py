"""
数据库模块
统一管理 ai_interview.db 数据库的配置、初始化和操作
"""

from .config import DB_PATH, DB_NAME, get_db_path
from .init_db import init_database, get_database_info
from .base import DatabaseManager, TransactionManager, db_manager

__all__ = [
    'DB_PATH',
    'DB_NAME',
    'get_db_path',
    'init_database',
    'get_database_info',
    'DatabaseManager',
    'TransactionManager',
    'db_manager',
]
