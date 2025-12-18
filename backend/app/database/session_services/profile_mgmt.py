import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.database.base import db_manager
from .base import BaseService

logger = logging.getLogger(__name__)

class ProfileService(BaseService):
    """画像管理服务：负责单个面试画像和用户综合画像"""

    async def save_profile(self, session_id: str, profile_data: Dict[str, Any]) -> bool:
        """保存候选人画像到会话"""
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    UPDATE sessions SET candidate_profile = $1, updated_at = $2 WHERE session_id = $3
                ''', json.dumps(profile_data, ensure_ascii=False), datetime.now(), session_id)
                return True
            except Exception as e:
                logger.error(f"保存画像失败: {e}")
                return False

    async def get_profile(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取单个会话的候选人画像"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('SELECT candidate_profile FROM sessions WHERE session_id = $1', session_id)
            if row and row['candidate_profile']:
                profile = row['candidate_profile']
                return json.loads(profile) if isinstance(profile, str) else profile
            return None

    async def get_recent_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取最近的画像列表"""
        async with db_manager.get_connection() as conn:
            sql = 'SELECT candidate_profile FROM sessions WHERE candidate_profile IS NOT NULL'
            params = []
            param_idx = 1
            if user_id:
                sql += f' AND user_id = ${param_idx}'
                params.append(user_id)
                param_idx += 1
            sql += f' ORDER BY updated_at DESC LIMIT ${param_idx}'
            params.append(limit)
            
            rows = await conn.fetch(sql, *params)
            return [json.loads(r['candidate_profile']) if isinstance(r['candidate_profile'], str) else r['candidate_profile'] for r in rows if r['candidate_profile']]

    async def get_series_final_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取路径终点（叶子节点）的画像"""
        async with db_manager.get_connection() as conn:
            sql = '''
                SELECT s.candidate_profile
                FROM sessions s
                WHERE s.candidate_profile IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM sessions child WHERE child.parent_session_id = s.session_id)
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
            return [json.loads(r['candidate_profile']) if isinstance(r['candidate_profile'], str) else r['candidate_profile'] for r in rows if r['candidate_profile']]

    async def save_user_profile(self, profile_data: Dict[str, Any], user_id: str = "default_user") -> bool:
        """保存用户综合能力画像"""
        async with db_manager.get_connection() as conn:
            try:
                now = datetime.now()
                profile_json = json.dumps(profile_data, ensure_ascii=False)
                await conn.execute('''
                    INSERT INTO user_profile (user_id, profile_data, created_at, updated_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id) DO UPDATE SET profile_data = $2, updated_at = $4
                ''', user_id, profile_json, now, now)
                return True
            except Exception as e:
                logger.error(f"保存用户综合能力画像失败: {e}")
                return False

    async def get_user_profile(self, user_id: str = "default_user") -> Optional[Dict[str, Any]]:
        """获取用户综合能力画像"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('SELECT profile_data, updated_at FROM user_profile WHERE user_id = $1', user_id)
            if row and row['profile_data']:
                profile = row['profile_data']
                return {
                    "profile": json.loads(profile) if isinstance(profile, str) else profile,
                    "updated_at": row['updated_at'].isoformat()
                }
            return None
