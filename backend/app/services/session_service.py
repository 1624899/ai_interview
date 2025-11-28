"""
会话管理服务 - 异步SQLite版本
负责面试会话的持久化存储和管理
使用统一的 ai_interview.db 数据库
"""

import logging
import aiosqlite
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.session import (
    InterviewSession, 
    SessionListItem, 
    SessionMetadata,
    MessageItem
)
from app.database import DB_PATH

logger = logging.getLogger(__name__)


class SessionService:
    """会话管理服务类 - 使用异步SQLite数据库"""
    
    def __init__(self, db_path: str = None):
        """
        初始化会话服务
        
        Args:
            db_path: 数据库文件路径（默认使用统一的数据库）
        """
        self.db_path = db_path or DB_PATH
        logger.info(f"SessionService 使用数据库: {self.db_path}")
    
    async def create_session(
        self,
        session_id: str,
        mode: str,
        title: Optional[str] = None,
        resume_filename: Optional[str] = None,
        job_description: Optional[str] = None,
        max_questions: int = 5
    ) -> InterviewSession:
        """
        创建新会话（异步）
        
        Args:
            session_id: 会话ID
            mode: 面试模式
            title: 会话标题
            resume_filename: 简历文件名
            job_description: 岗位描述
            max_questions: 最大问题数
            
        Returns:
            InterviewSession: 创建的会话对象
        """
        # 生成默认标题
        if title is None:
            mode_text = "辅导模式" if mode == "coach" else "模拟面试"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            title = f"{mode_text} - {timestamp}"
        
        now = datetime.now().isoformat()
        
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute('''
                    INSERT INTO sessions (
                        session_id, title, created_at, updated_at, mode,
                        resume_filename, job_description, question_count, max_questions, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session_id, title, now, now, mode,
                    resume_filename, job_description, 0, max_questions, 'active'
                ))
                await db.commit()
                
                logger.info(f"创建新会话: {session_id}")
                return await self.get_session(session_id)
                
            except aiosqlite.IntegrityError as e:
                logger.error(f"会话已存在: {session_id}")
                raise ValueError(f"会话 {session_id} 已存在")
    
    async def get_session(self, session_id: str) -> Optional[InterviewSession]:
        """
        获取会话详情（异步）
        
        Args:
            session_id: 会话ID
            
        Returns:
            InterviewSession: 会话对象，不存在则返回None
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            
            # 获取会话基本信息
            async with db.execute('SELECT * FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                row = await cursor.fetchone()
                
                if row is None:
                    return None
            
            # 获取消息列表
            async with db.execute('''
                SELECT role, content, timestamp 
                FROM messages 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            ''', (session_id,)) as cursor:
                message_rows = await cursor.fetchall()
                messages = [
                    MessageItem(
                        role=msg['role'],
                        content=msg['content'],
                        timestamp=msg['timestamp']
                    )
                    for msg in message_rows
                ]
            
            # 构建会话对象
            metadata = SessionMetadata(
                mode=row['mode'],
                resume_filename=row['resume_filename'],
                job_description=row['job_description'],
                question_count=row['question_count'],
                max_questions=row['max_questions'],
                status=row['status']
            )
            
            session = InterviewSession(
                session_id=row['session_id'],
                title=row['title'],
                created_at=row['created_at'],
                updated_at=row['updated_at'],
                metadata=metadata,
                messages=messages
            )
            
            return session
    
    async def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        status: Optional[str] = None,
        metadata_updates: Optional[Dict[str, Any]] = None
    ) -> Optional[InterviewSession]:
        """
        更新会话信息（异步）
        
        Args:
            session_id: 会话ID
            title: 新标题
            status: 新状态
            metadata_updates: 元数据更新
            
        Returns:
            InterviewSession: 更新后的会话对象
        """
        async with aiosqlite.connect(self.db_path) as db:
            # 检查会话是否存在
            async with db.execute('SELECT session_id FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                if await cursor.fetchone() is None:
                    return None
            
            # 构建更新语句
            updates = []
            params = []
            
            if title is not None:
                updates.append('title = ?')
                params.append(title)
            
            if status is not None:
                updates.append('status = ?')
                params.append(status)
            
            if metadata_updates:
                for key, value in metadata_updates.items():
                    if key in ['question_count', 'max_questions', 'resume_filename', 'job_description']:
                        updates.append(f'{key} = ?')
                        params.append(value)
            
            # 总是更新 updated_at
            updates.append('updated_at = ?')
            params.append(datetime.now().isoformat())
            
            params.append(session_id)
            
            if updates:
                sql = f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ?"
                await db.execute(sql, params)
                await db.commit()
                
                logger.info(f"更新会话: {session_id}")
            
            return await self.get_session(session_id)
    
    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str
    ) -> Optional[InterviewSession]:
        """
        向会话添加消息（异步）
        
        Args:
            session_id: 会话ID
            role: 消息角色
            content: 消息内容
            
        Returns:
            InterviewSession: 更新后的会话对象
        """
        async with aiosqlite.connect(self.db_path) as db:
            # 检查会话是否存在
            async with db.execute('SELECT session_id FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                if await cursor.fetchone() is None:
                    logger.warning(f"会话不存在: {session_id}")
                    return None
            
            # 添加消息
            timestamp = datetime.now().isoformat()
            await db.execute('''
                INSERT INTO messages (session_id, role, content, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (session_id, role, content, timestamp))
            
            # 更新会话的 updated_at
            await db.execute('''
                UPDATE sessions SET updated_at = ? WHERE session_id = ?
            ''', (timestamp, session_id))
            
            await db.commit()
            
            return await self.get_session(session_id)
    
    async def list_sessions(
        self,
        status: Optional[str] = None,
        mode: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[SessionListItem]:
        """
        获取会话列表（异步）
        
        Args:
            status: 筛选状态
            mode: 筛选模式
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            List[SessionListItem]: 会话列表
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            
            # 构建查询条件
            conditions = []
            params = []
            
            if status:
                conditions.append('status = ?')
                params.append(status)
            
            if mode:
                conditions.append('mode = ?')
                params.append(mode)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            
            # 查询会话列表
            sql = f'''
                SELECT 
                    s.session_id, s.title, s.created_at, s.updated_at,
                    s.mode, s.status, s.question_count,
                    COUNT(m.id) as message_count
                FROM sessions s
                LEFT JOIN messages m ON s.session_id = m.session_id
                {where_clause}
                GROUP BY s.session_id
                ORDER BY s.updated_at DESC
                LIMIT ? OFFSET ?
            '''
            
            params.extend([limit or 50, offset])
            
            async with db.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
                sessions = []
                for row in rows:
                    sessions.append(SessionListItem(
                        session_id=row['session_id'],
                        title=row['title'],
                        created_at=row['created_at'],
                        updated_at=row['updated_at'],
                        mode=row['mode'],
                        status=row['status'],
                        message_count=row['message_count'],
                        question_count=row['question_count']
                    ))
                
                return sessions
    
    async def delete_session(self, session_id: str) -> bool:
        """
        删除会话（异步）
        
        Args:
            session_id: 会话ID
            
        Returns:
            bool: 是否成功删除
        """
        async with aiosqlite.connect(self.db_path) as db:
            # 删除消息（由于外键约束，会自动级联删除）
            await db.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
            
            # 删除会话
            cursor = await db.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
            
            deleted = cursor.rowcount > 0
            await db.commit()
            
            if deleted:
                logger.info(f"删除会话: {session_id}")
            
            return deleted
    
    async def get_session_count(self, status: Optional[str] = None) -> int:
        """
        获取会话总数（异步）
        
        Args:
            status: 筛选状态
            
        Returns:
            int: 会话数量
        """
        async with aiosqlite.connect(self.db_path) as db:
            if status:
                async with db.execute('SELECT COUNT(*) as count FROM sessions WHERE status = ?', (status,)) as cursor:
                    result = await cursor.fetchone()
            else:
                async with db.execute('SELECT COUNT(*) as count FROM sessions') as cursor:
                    result = await cursor.fetchone()
            
            return result[0] if result else 0

    async def rollback_session(self, session_id: str, index: int) -> bool:
        """
        回退会话到指定索引（删除该索引及之后的所有消息）
        
        Args:
            session_id: 会话ID
            index: 消息索引（0-based）
            
        Returns:
            bool: 是否成功
        """
        async with aiosqlite.connect(self.db_path) as db:
            # 1. 获取目标消息的时间戳
            async with db.execute('''
                SELECT timestamp FROM messages 
                WHERE session_id = ? 
                ORDER BY timestamp ASC 
                LIMIT 1 OFFSET ?
            ''', (session_id, index)) as cursor:
                row = await cursor.fetchone()
                
            if not row:
                logger.warning(f"回退失败：找不到索引 {index} 的消息")
                return False
                
            target_timestamp = row[0]
            
            # 2. 删除该时间戳及之后的消息
            await db.execute('''
                DELETE FROM messages 
                WHERE session_id = ? AND timestamp >= ?
            ''', (session_id, target_timestamp))
            
            # 3. 更新会话的 updated_at
            await db.execute('''
                UPDATE sessions SET updated_at = ? WHERE session_id = ?
            ''', (datetime.now().isoformat(), session_id))
            
            await db.commit()
            logger.info(f"会话 {session_id} 已回退至索引 {index}")
            return True
