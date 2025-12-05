"""
PostgreSQL 数据库操作基类
"""

import asyncpg
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from .config import POSTGRES_CONFIG

logger = logging.getLogger(__name__)


class DatabaseManager:
    """PostgreSQL 数据库管理器"""
    
    def __init__(self):
        """初始化数据库管理器"""
        self._pool: Optional[asyncpg.Pool] = None
        logger.info(f"数据库管理器初始化: {POSTGRES_CONFIG['host']}:{POSTGRES_CONFIG['port']}")
    
    async def connect(self):
        """建立 PostgreSQL 连接池"""
        if not self._pool:
            self._pool = await asyncpg.create_pool(
                host=POSTGRES_CONFIG["host"],
                port=POSTGRES_CONFIG["port"],
                user=POSTGRES_CONFIG["user"],
                password=POSTGRES_CONFIG["password"],
                database=POSTGRES_CONFIG["database"],
                min_size=2,
                max_size=10
            )
            logger.info(f"PostgreSQL 连接池已建立")

    async def disconnect(self):
        """关闭连接池"""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("数据库连接已关闭")

    @asynccontextmanager
    async def get_connection(self):
        """
        获取数据库连接（上下文管理器）
        
        Usage:
            async with db_manager.get_connection() as conn:
                await conn.execute("INSERT INTO ...")
                result = await conn.fetch("SELECT * FROM ...")
        """
        if not self._pool:
            await self.connect()
        async with self._pool.acquire() as conn:
            yield conn
    
    async def execute_query(self, sql: str, params: tuple = None) -> List[Dict[str, Any]]:
        """执行查询并返回结果列表"""
        async with self.get_connection() as conn:
            rows = await conn.fetch(sql, *(params or ()))
            return [dict(row) for row in rows]
    
    async def execute_one(self, sql: str, params: tuple = None) -> Optional[Dict[str, Any]]:
        """执行查询并返回单个结果"""
        async with self.get_connection() as conn:
            row = await conn.fetchrow(sql, *(params or ()))
            return dict(row) if row else None
    
    async def execute_update(self, sql: str, params: tuple = None) -> int:
        """执行更新/插入/删除操作"""
        async with self.get_connection() as conn:
            result = await conn.execute(sql, *(params or ()))
            # 解析返回的 "INSERT 0 1" 或 "UPDATE 1" 格式
            parts = result.split()
            return int(parts[-1]) if parts else 0


class TransactionManager:
    """事务管理器"""
    
    def __init__(self):
        self.conn = None
        self.transaction = None
    
    async def __aenter__(self):
        """进入事务"""
        self.conn = await asyncpg.connect(**POSTGRES_CONFIG)
        self.transaction = self.conn.transaction()
        await self.transaction.start()
        return self.conn
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """退出事务"""
        if exc_type is None:
            await self.transaction.commit()
        else:
            await self.transaction.rollback()
            logger.error(f"事务回滚: {exc_val}")
        
        await self.conn.close()
        return False


# 创建全局数据库管理器实例
db_manager = DatabaseManager()
