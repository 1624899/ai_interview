import logging
import json
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.session import InterviewSession
from app.database.base import db_manager
from .base import BaseService
from .session_mgmt import SessionManagementService

logger = logging.getLogger(__name__)

class SessionAdvancedService(BaseService):
    """高级会话服务：负责克隆、下一轮面试、回退等"""

    def __init__(self, mgmt_service: SessionManagementService):
        self.mgmt = mgmt_service

    async def create_next_round(
        self,
        parent_session_id: str,
        max_questions: int = 5,
        user_id: Optional[str] = None
    ) -> InterviewSession:
        """从已完成的面试创建下一轮面试"""
        parent = await self.mgmt.get_session(parent_session_id, include_resume_content=True, user_id=user_id)
        
        if not parent:
            raise ValueError(f"父会话不存在: {parent_session_id}")
        
        if parent.metadata.status != "completed":
            raise ValueError(f"只能从已完成的面试创建下一轮（当前状态: {parent.metadata.status}）")
        
        new_round_index = parent.metadata.round_index + 1
        round_type_map = {1: "tech_initial", 2: "tech_deep", 3: "hr_comprehensive"}
        new_round_type = round_type_map.get(new_round_index, "hr_comprehensive")
        
        series_id = parent.metadata.series_id
        if not series_id:
            series_id = str(uuid.uuid4())
            async with db_manager.get_connection() as conn:
                await conn.execute('UPDATE sessions SET series_id = $1 WHERE session_id = $2', series_id, parent_session_id)
        
        new_session_id = str(uuid.uuid4())
        jd = parent.metadata.job_description or ""
        jd_summary = jd[:15] + "..." if len(jd) > 15 else jd
        title = f"{jd_summary} - 第{new_round_index}轮"
        
        now = datetime.now()
        async with db_manager.get_connection() as conn:
            await conn.execute('''
                INSERT INTO sessions (
                    session_id, user_id, title, created_at, updated_at, mode,
                    resume_filename, resume_content, job_description, company_info,
                    question_count, max_questions, status, pinned,
                    series_id, round_index, round_type, parent_session_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            ''',
                new_session_id, user_id or "default_user", title, now, now,
                parent.metadata.mode, parent.metadata.resume_filename, parent.metadata.resume_content,
                parent.metadata.job_description, parent.metadata.company_info,
                0, max_questions, 'active', False, series_id, new_round_index, new_round_type, parent_session_id
            )
        
        logger.info(f"创建下一轮面试: {new_session_id} (第{new_round_index}轮, 类型: {new_round_type})")
        return await self.mgmt.get_session(new_session_id)

    async def clone_session_for_voice(
        self,
        source_session_id: str,
        user_id: Optional[str] = None,
        max_questions: Optional[int] = None
    ) -> InterviewSession:
        """克隆会话用于语音面试"""
        source = await self.mgmt.get_session(source_session_id, include_resume_content=True, user_id=user_id)
        if not source:
            raise ValueError(f"源会话不存在: {source_session_id}")
            
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('SELECT interview_plan FROM sessions WHERE session_id = $1', source_session_id)
            plan = row['interview_plan'] if row else None
        
        new_session_id = str(uuid.uuid4())
        title = f"{source.title} (语音版)"
        now = datetime.now()
        
        async with db_manager.get_connection() as conn:
            # 克隆元数据
            await conn.execute('''
                INSERT INTO sessions (
                    session_id, user_id, title, created_at, updated_at, mode,
                    resume_filename, resume_content, job_description, company_info,
                    question_count, max_questions, status, pinned,
                    series_id, round_index, round_type, parent_session_id, interview_plan
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ''',
                new_session_id, user_id or "default_user", title, now, now, 'voice',
                source.metadata.resume_filename, source.metadata.resume_content,
                source.metadata.job_description, source.metadata.company_info,
                source.metadata.question_count, max_questions or source.metadata.max_questions, 'active', False,
                source.metadata.series_id, source.metadata.round_index, source.metadata.round_type,
                source_session_id, plan
            )
            
            # 克隆历史消息
            messages = await conn.fetch('''
                SELECT role, content, timestamp, question_index, audio_url
                FROM messages WHERE session_id = $1 ORDER BY timestamp ASC
            ''', source_session_id)
            
            for msg in messages:
                await conn.execute('''
                    INSERT INTO messages (session_id, role, content, timestamp, question_index, audio_url)
                    VALUES ($1, $2, $3, $4, $5, $6)
                ''', new_session_id, msg['role'], msg['content'], msg['timestamp'], msg['question_index'], msg['audio_url'])
            
        logger.info(f"克隆语音会话(含消息): {source_session_id} -> {new_session_id}, 共 {len(messages)} 条消息")
            
        logger.info(f"克隆语音会话: {source_session_id} -> {new_session_id}")
        return await self.mgmt.get_session(new_session_id)

    async def rollback_session(self, session_id: str, index: int, user_id: Optional[str] = None) -> bool:
        """回退会话到指定索引"""
        async with db_manager.get_connection() as conn:
            try:
                if not await self._check_session_access(conn, session_id, user_id):
                    return False
                
                if index == 0:
                    await conn.execute('DELETE FROM messages WHERE session_id = $1', session_id)
                    await conn.execute('UPDATE sessions SET question_count = 0, updated_at = $1 WHERE session_id = $2', datetime.now(), session_id)
                else:
                    target_row = await conn.fetchrow('''
                        SELECT timestamp FROM messages 
                        WHERE session_id = $1 
                        ORDER BY timestamp ASC 
                        LIMIT 1 OFFSET $2
                    ''', session_id, index)
                    
                    if not target_row:
                        return False
                    
                    target_timestamp = target_row['timestamp']
                    await conn.execute('DELETE FROM messages WHERE session_id = $1 AND timestamp >= $2', session_id, target_timestamp)
                    await conn.execute('UPDATE sessions SET updated_at = $1 WHERE session_id = $2', datetime.now(), session_id)
                    
                    new_count = await conn.fetchval('SELECT COUNT(*) FROM messages WHERE session_id = $1 AND role = \'user\'', session_id)
                    await conn.execute('UPDATE sessions SET question_count = $1 WHERE session_id = $2', new_count, session_id)
                
                try:
                    await conn.execute('DELETE FROM checkpoints WHERE thread_id = $1', session_id)
                    await conn.execute('DELETE FROM writes WHERE thread_id = $1', session_id)
                except:
                    pass
                
                return True
            except Exception as e:
                logger.error(f"回退会话失败: {e}")
                return False
