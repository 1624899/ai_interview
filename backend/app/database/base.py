"""
数据库操作基类
提供通用的数据库连接和操作方法
"""

import aiosqlite
import sqlite3
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import logging

from .config import DB_PATH

logger = logging.getLogger(__name__)


class DatabaseManager:
    """数据库管理器基类"""
    
    def __init__(self, db_path: str = None):
        """
        初始化数据库管理器
        
        Args:
            db_path: 数据库文件路径，默认使用配置的路径
        """
        self.db_path = db_path or DB_PATH
        self._conn = None
    
    async def connect(self):
        """建立持久化数据库连接"""
        if not self._conn:
            self._conn = await aiosqlite.connect(self.db_path)
            self._conn.row_factory = aiosqlite.Row
            # 开启 WAL 模式以提高并发性能
            await self._conn.execute("PRAGMA journal_mode=WAL;")
            await self._conn.commit()
            logger.info(f"数据库连接已建立 (WAL模式): {self.db_path}")

    async def disconnect(self):
        """关闭持久化数据库连接"""
        if self._conn:
            await self._conn.close()
            self._conn = None
            logger.info("数据库连接已关闭")

    @asynccontextmanager
    async def get_connection(self):
        """
        获取异步数据库连接（上下文管理器）
        如果已建立持久连接，则复用；否则创建临时连接。
        
        Usage:
            async with db_manager.get_connection() as conn:
                cursor = await conn.execute("SELECT * FROM table")
        """
        if self._conn:
            # 复用持久连接
            yield self._conn
        else:
            # 创建临时连接（用于脚本或未初始化的情况）
            conn = await aiosqlite.connect(self.db_path)
            conn.row_factory = aiosqlite.Row
            try:
                yield conn
            finally:
                await conn.close()
    
    async def execute_query(
        self,
        sql: str,
        params: tuple = None
    ) -> List[Dict[str, Any]]:
        """
        执行查询并返回结果列表
        
        Args:
            sql: SQL查询语句
            params: 查询参数
            
        Returns:
            List[Dict]: 查询结果列表
        """
        async with self.get_connection() as conn:
            async with conn.execute(sql, params or ()) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
    
    async def execute_one(
        self,
        sql: str,
        params: tuple = None
    ) -> Optional[Dict[str, Any]]:
        """
        执行查询并返回单个结果
        
        Args:
            sql: SQL查询语句
            params: 查询参数
            
        Returns:
            Optional[Dict]: 查询结果，如果没有结果则返回None
        """
        async with self.get_connection() as conn:
            async with conn.execute(sql, params or ()) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None
    
    async def execute_update(
        self,
        sql: str,
        params: tuple = None
    ) -> int:
        """
        执行更新/插入/删除操作
        
        Args:
            sql: SQL语句
            params: 参数
            
        Returns:
            int: 受影响的行数
        """
        async with self.get_connection() as conn:
            cursor = await conn.execute(sql, params or ())
            await conn.commit()
            return cursor.rowcount
    
    async def execute_many(
        self,
        sql: str,
        params_list: List[tuple]
    ) -> int:
        """
        批量执行更新/插入操作
        
        Args:
            sql: SQL语句
            params_list: 参数列表
            
        Returns:
            int: 受影响的行数
        """
        async with self.get_connection() as conn:
            await conn.executemany(sql, params_list)
            await conn.commit()
            return len(params_list)
    
    def execute_sync(
        self,
        sql: str,
        params: tuple = None
    ) -> Any:
        """
        同步执行SQL（仅用于初始化等特殊场景）
        
        Args:
            sql: SQL语句
            params: 参数
            
        Returns:
            Any: 执行结果
        """
        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute(sql, params or ())
            conn.commit()
            return cursor
        finally:
            conn.close()


class TransactionManager:
    """事务管理器"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self.conn = None
    
    async def __aenter__(self):
        """进入事务"""
        self.conn = await aiosqlite.connect(self.db_path)
        self.conn.row_factory = aiosqlite.Row
        await self.conn.execute("BEGIN")
        return self.conn
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """退出事务"""
        if exc_type is None:
            # 没有异常，提交事务
            await self.conn.commit()
        else:
            # 有异常，回滚事务
            await self.conn.rollback()
            logger.error(f"事务回滚: {exc_val}")
        
        await self.conn.close()
        return False  # 不抑制异常


# 创建全局数据库管理器实例
db_manager = DatabaseManager()
