import logging
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.session import (
    InterviewSession, 
    SessionListItem, 
    SessionMetadata,
    MessageItem
)
from app.database.base import db_manager
from .base import BaseService

logger = logging.getLogger(__name__)

class SessionManagementService(BaseService):
    """会话管理服务：负责创建、删除、获取和更新会话"""

    async def create_session(
        self,
        session_id: str,
        mode: str,
        title: Optional[str] = None,
        resume_filename: Optional[str] = None,
        resume_content: Optional[str] = None,
        job_description: Optional[str] = None,
        company_info: Optional[str] = None,
        max_questions: int = 5,
        user_id: str = "default_user"
    ) -> InterviewSession:
        """创建新会话"""
        if title is None:
            mode_text = "辅导模式" if mode == "coach" else "模拟面试"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            title = f"{mode_text} - {timestamp}"
        
        now = datetime.now()
        
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    INSERT INTO sessions (
                        session_id, user_id, title, created_at, updated_at, mode,
                        resume_filename, resume_content, job_description, company_info,
                        question_count, max_questions, status, pinned
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ''', session_id, user_id, title, now, now, mode,
                    resume_filename, resume_content, job_description, company_info,
                    0, max_questions, 'active', False
                )
                
                logger.info(f"创建新会话: {session_id}")
                return await self.get_session(session_id)
                
            except Exception as e:
                if 'duplicate key' in str(e).lower():
                    logger.error(f"会话已存在: {session_id}")
                    raise ValueError(f"会话 {session_id} 已存在")
                raise

    async def get_session(
        self, 
        session_id: str, 
        include_resume_content: bool = False, 
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        """获取会话详情"""
        async with db_manager.get_connection() as conn:
            columns = [
                "session_id", "title", "created_at", "updated_at", "mode",
                "resume_filename", "job_description", "company_info",
                "question_count", "max_questions", "status", "pinned",
                "series_id", "round_index", "round_type", "parent_session_id",
                "interview_plan"
            ]
            if include_resume_content:
                columns.append("resume_content")
            
            select_clause = ", ".join(columns)
            sql = f'SELECT {select_clause} FROM sessions WHERE session_id = $1'
            params = [session_id]
            
            if user_id:
                sql += ' AND user_id = $2'
                params.append(user_id)
                
            row = await conn.fetchrow(sql, *params)
            if row is None:
                return None
            
            messages_rows = await conn.fetch('''
                SELECT role, content, timestamp, question_index, audio_url
                FROM messages 
                WHERE session_id = $1 
                ORDER BY timestamp ASC, id ASC
            ''', session_id)
            
            messages = [
                MessageItem(
                    role=msg['role'],
                    content=msg['content'],
                    timestamp=msg['timestamp'].isoformat() if isinstance(msg['timestamp'], datetime) else msg['timestamp'],
                    question_index=msg['question_index'] or 0,
                    audio_url=msg['audio_url']
                )
                for msg in messages_rows
            ]
            
            resume_content = None
            if include_resume_content and 'resume_content' in row.keys():
                resume_content = row['resume_content']

            metadata = SessionMetadata(
                mode=row['mode'],
                resume_filename=row['resume_filename'],
                resume_content=resume_content,
                job_description=row['job_description'],
                company_info=row['company_info'] if row['company_info'] else None,
                question_count=row['question_count'],
                max_questions=row['max_questions'],
                status=row['status'],
                pinned=bool(row['pinned']),
                series_id=row['series_id'],
                round_index=row['round_index'] or 1,
                round_type=row['round_type'],
                parent_session_id=row['parent_session_id'],
                interview_plan=json.loads(row['interview_plan']) if row['interview_plan'] else []
            )
            
            created_at = row['created_at']
            updated_at = row['updated_at']
            
            return InterviewSession(
                session_id=row['session_id'],
                title=row['title'],
                created_at=created_at.isoformat() if isinstance(created_at, datetime) else created_at,
                updated_at=updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
                metadata=metadata,
                messages=messages
            )

    async def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        status: Optional[str] = None,
        metadata_updates: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        """更新会话信息"""
        async with db_manager.get_connection() as conn:
            if not await self._check_session_access(conn, session_id, user_id):
                return None
            
            updates = []
            params = []
            param_idx = 1
            
            if title is not None:
                updates.append(f'title = ${param_idx}')
                params.append(title)
                param_idx += 1
            
            if status is not None:
                updates.append(f'status = ${param_idx}')
                params.append(status)
                param_idx += 1
            
            if metadata_updates:
                for key, value in metadata_updates.items():
                    if key in ['question_count', 'max_questions', 'resume_filename', 'job_description', 'pinned']:
                        updates.append(f'{key} = ${param_idx}')
                        params.append(bool(value) if key == 'pinned' else value)
                        param_idx += 1
            
            updates.append(f'updated_at = ${param_idx}')
            params.append(datetime.now())
            param_idx += 1
            
            params.append(session_id)
            
            if updates:
                sql = f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ${param_idx}"
                await conn.execute(sql, *params)
                logger.info(f"更新会话: {session_id}")
            
            return await self.get_session(session_id)

    async def list_sessions(
        self,
        status: Optional[str] = None,
        mode: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None
    ) -> List[SessionListItem]:
        """获取会话列表"""
        async with db_manager.get_connection() as conn:
            sql = '''
                SELECT 
                    s.session_id, s.title, s.created_at, s.updated_at, s.mode, s.status,
                    s.question_count, s.pinned, s.round_index, s.round_type,
                    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.session_id) as message_count
                FROM sessions s
                WHERE 1=1
            '''
            params = []
            param_idx = 1
            
            if status:
                sql += f' AND s.status = ${param_idx}'
                params.append(status)
                param_idx += 1
            
            if mode:
                sql += f' AND s.mode = ${param_idx}'
                params.append(mode)
                param_idx += 1
            
            if user_id:
                sql += f' AND s.user_id = ${param_idx}'
                params.append(user_id)
                param_idx += 1
            
            sql += f' ORDER BY s.pinned DESC, s.updated_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}'
            params.extend([limit, offset])
            
            rows = await conn.fetch(sql, *params)
            
            sessions = []
            for row in rows:
                created_at = row['created_at']
                updated_at = row['updated_at']
                
                sessions.append(SessionListItem(
                    session_id=row['session_id'],
                    title=row['title'],
                    created_at=created_at.isoformat() if isinstance(created_at, datetime) else created_at,
                    updated_at=updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
                    mode=row['mode'],
                    status=row['status'],
                    message_count=row['message_count'],
                    question_count=row['question_count'],
                    pinned=bool(row['pinned']),
                    round_index=row['round_index'] or 1,
                    round_type=row['round_type'] or 'tech_initial'
                ))
            
            return sessions

    async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """删除会话"""
        async with db_manager.get_connection() as conn:
            if not await self._check_session_access(conn, session_id, user_id):
                return False
            
            try:
                await conn.execute('UPDATE sessions SET parent_session_id = NULL WHERE parent_session_id = $1', session_id)
                await conn.execute('DELETE FROM messages WHERE session_id = $1', session_id)
                await conn.execute('DELETE FROM sessions WHERE session_id = $1', session_id)
                
                try:
                    await conn.execute('DELETE FROM checkpoints WHERE thread_id = $1', session_id)
                    await conn.execute('DELETE FROM writes WHERE thread_id = $1', session_id)
                except:
                    pass
                
                logger.info(f"✓ 成功删除会话及所有关联数据: {session_id}")
                return True
            except Exception as e:
                logger.error(f"✗ 删除会话失败: {session_id}, 错误: {e}")
                return False

    async def get_session_count(self, status: Optional[str] = None, user_id: Optional[str] = None) -> int:
        """获取会话总数"""
        async with db_manager.get_connection() as conn:
            sql = 'SELECT COUNT(*) FROM sessions WHERE 1=1'
            params = []
            param_idx = 1
            
            if status:
                sql += f' AND status = ${param_idx}'
                params.append(status)
                param_idx += 1
                
            if user_id:
                sql += f' AND user_id = ${param_idx}'
                params.append(user_id)
                
            return await conn.fetchval(sql, *params)
