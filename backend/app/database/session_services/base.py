from typing import Optional, List, Dict, Any
import logging
from app.database.base import db_manager

logger = logging.getLogger(__name__)

class BaseService:
    """基础服务类，提供通用数据库操作"""
    
    async def _check_session_access(
        self, 
        conn, 
        session_id: str, 
        user_id: Optional[str] = None
    ) -> bool:
        """检查用户是否有权访问指定会话"""
        sql = 'SELECT 1 FROM sessions WHERE session_id = $1'
        params = [session_id]
        
        if user_id:
            sql += ' AND user_id = $2'
            params.append(user_id)
            
        result = await conn.fetchrow(sql, *params)
        return result is not None
