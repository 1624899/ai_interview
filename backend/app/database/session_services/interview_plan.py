import logging
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.database.base import db_manager
from .base import BaseService

logger = logging.getLogger(__name__)

class InterviewPlanService(BaseService):
    """面试计划管理服务"""

    async def get_interview_plan(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取面试题目清单"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('SELECT interview_plan FROM sessions WHERE session_id = $1', session_id)
            if row and row['interview_plan']:
                plan = row['interview_plan']
                return json.loads(plan) if isinstance(plan, str) else plan
            return None

    async def save_interview_plan(self, session_id: str, plan: List[Dict[str, Any]]) -> bool:
        """保存面试题目清单"""
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    UPDATE sessions SET interview_plan = $1, updated_at = $2 WHERE session_id = $3
                ''', json.dumps(plan, ensure_ascii=False), datetime.now(), session_id)
                return True
            except Exception as e:
                logger.error(f"保存面试计划失败: {e}")
                return False

    async def update_session_question_count(self, session_id: str, count: int) -> bool:
        """更新会话的问题计数"""
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    UPDATE sessions SET question_count = $1, updated_at = $2 WHERE session_id = $3
                ''', count, datetime.now(), session_id)
                return True
            except Exception as e:
                logger.error(f"更新问题计数失败: {e}")
                return False

    async def get_completed_sessions_for_resume(
        self,
        user_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """获取可用于简历优化的已完成会话列表"""
        async with db_manager.get_connection() as conn:
            sql = '''
                SELECT 
                    s.session_id, s.title, s.updated_at, s.round_index, s.round_type,
                    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.session_id) as message_count
                FROM sessions s
                WHERE s.status = 'completed'
            '''
            params = []
            param_idx = 1
            if user_id:
                sql += f' AND s.user_id = ${param_idx}'
                params.append(user_id)
                param_idx += 1
            sql += f' ORDER BY s.updated_at DESC LIMIT ${param_idx}'
            params.append(limit)
            
            rows = await conn.fetch(sql, *params)
            sessions = []
            for row in rows:
                updated_at = row['updated_at']
                sessions.append({
                    'session_id': row['session_id'],
                    'title': row['title'],
                    'updated_at': updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
                    'round_index': row['round_index'] or 1,
                    'round_type': row['round_type'] or 'tech_initial',
                    'message_count': row['message_count']
                })
            return sessions
