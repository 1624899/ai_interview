import logging
from typing import Optional
from datetime import datetime
from app.models.session import InterviewSession, MessageItem
from app.database.base import db_manager
from .base import BaseService
from .session_mgmt import SessionManagementService

logger = logging.getLogger(__name__)

class MessageService(BaseService):
    """消息管理服务：负责消息的增删及对话内容提取"""

    def __init__(self, mgmt_service: SessionManagementService):
        self.mgmt = mgmt_service

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        question_index: int = 0,
        audio_url: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        """向会话添加消息"""
        async with db_manager.get_connection() as conn:
            if not await self._check_session_access(conn, session_id, user_id):
                return None
            
            timestamp = datetime.now()
            await conn.execute('''
                INSERT INTO messages (session_id, role, content, timestamp, question_index, audio_url)
                VALUES ($1, $2, $3, $4, $5, $6)
            ''', session_id, role, content, timestamp, question_index, audio_url)
            
            # 更新会话的 updated_at
            await conn.execute('''
                UPDATE sessions SET updated_at = $1 WHERE session_id = $2
            ''', timestamp, session_id)
            
            return await self.mgmt.get_session(session_id)

    async def get_session_conversations(
        self,
        session_id: str,
        user_id: Optional[str] = None
    ) -> list:
        """获取并解析会话的 QA 对"""
        async with db_manager.get_connection() as conn:
            if not await self._check_session_access(conn, session_id, user_id):
                return []
            
            rows = await conn.fetch('''
                SELECT role, content
                FROM messages
                WHERE session_id = $1
                ORDER BY timestamp ASC
            ''', session_id)
            
            qa_pairs = []
            for i in range(len(rows) - 1):
                msg = rows[i]
                next_msg = rows[i + 1]
                if msg['role'] == "assistant" and next_msg['role'] == 'user':
                    question = msg['content'].strip()
                    answer = next_msg['content'].strip()
                    if question and answer:
                        qa_pairs.append({"question": question, "answer": answer})
            
            return qa_pairs
