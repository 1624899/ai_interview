"""
简历生成服务
管理生成的简历的存储和内存中的会话状态
"""

import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field

from app.database.base import db_manager

logger = logging.getLogger(__name__)


# ============================================================================
# 内存中的会话状态管理
# ============================================================================

@dataclass
class GenerationSession:
    """生成会话状态（内存中暂存）"""
    session_id: str
    user_id: str
    resume_content: str
    job_description: str
    optimization_result: dict
    template_style: str = "professional"
    
    # 中间状态
    questions: List[str] = field(default_factory=list)
    user_answers: Dict[str, str] = field(default_factory=dict)
    review_result: Optional[dict] = None
    iteration_count: int = 0
    
    # 产出
    draft_content: str = ""
    final_markdown: str = ""
    
    # 状态
    status: str = "pending"  # pending / awaiting_input / generating / completed / failed
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class SessionStore:
    """内存会话存储"""
    
    def __init__(self, ttl_minutes: int = 30):
        self._sessions: Dict[str, GenerationSession] = {}
        self._ttl = timedelta(minutes=ttl_minutes)
    
    def create(self, session_id: str, **kwargs) -> GenerationSession:
        """创建新会话"""
        session = GenerationSession(session_id=session_id, **kwargs)
        self._sessions[session_id] = session
        self._cleanup_expired()
        return session
    
    def get(self, session_id: str) -> Optional[GenerationSession]:
        """获取会话"""
        session = self._sessions.get(session_id)
        if session and datetime.now() - session.updated_at > self._ttl:
            del self._sessions[session_id]
            return None
        return session
    
    def update(self, session_id: str, **kwargs) -> Optional[GenerationSession]:
        """更新会话"""
        session = self.get(session_id)
        if session:
            for key, value in kwargs.items():
                if hasattr(session, key):
                    setattr(session, key, value)
            session.updated_at = datetime.now()
        return session
    
    def delete(self, session_id: str) -> bool:
        """删除会话"""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False
    
    def _cleanup_expired(self):
        """清理过期会话"""
        now = datetime.now()
        expired = [
            sid for sid, session in self._sessions.items()
            if now - session.updated_at > self._ttl
        ]
        for sid in expired:
            del self._sessions[sid]


# 全局会话存储实例
session_store = SessionStore()


# ============================================================================
# 数据库持久化服务
# ============================================================================

class ResumeGenerationService:
    """简历生成服务 - 管理生成的简历持久化"""
    
    def __init__(self):
        logger.info("ResumeGenerationService 初始化")
    
    async def save_generated_resume(
        self,
        user_id: str,
        title: str,
        content: str,
        job_description: Optional[str] = None,
        optimization_result_id: Optional[int] = None
    ) -> int:
        """
        保存生成的简历
        
        Returns:
            int: 简历 ID
        """
        async with db_manager.get_connection() as conn:
            try:
                resume_id = await conn.fetchval('''
                    INSERT INTO generated_resumes (
                        user_id, title, optimization_result_id, 
                        job_description, content, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                ''',
                    user_id,
                    title,
                    optimization_result_id,
                    job_description,
                    content,
                    datetime.now()
                )
                
                logger.info(f"保存生成的简历: ID={resume_id}, title={title}")
                return resume_id
                
            except Exception as e:
                logger.error(f"保存生成的简历失败: {e}")
                raise
    
    async def get_generated_resume(self, resume_id: int, user_id: str) -> Optional[Dict[str, Any]]:
        """获取单个生成的简历"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('''
                SELECT id, user_id, title, optimization_result_id, 
                       job_description, content, created_at
                FROM generated_resumes
                WHERE id = $1 AND user_id = $2
            ''', resume_id, user_id)
            
            if not row:
                return None
            
            return self._row_to_dict(row)
    
    async def list_generated_resumes(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """获取用户生成的简历列表"""
        async with db_manager.get_connection() as conn:
            rows = await conn.fetch('''
                SELECT id, user_id, title, optimization_result_id, 
                       job_description, content, created_at
                FROM generated_resumes
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            ''', user_id, limit)
            
            return [self._row_to_dict(row) for row in rows]
    
    async def delete_generated_resume(self, resume_id: int, user_id: str) -> bool:
        """删除生成的简历"""
        async with db_manager.get_connection() as conn:
            try:
                result = await conn.execute('''
                    DELETE FROM generated_resumes
                    WHERE id = $1 AND user_id = $2
                ''', resume_id, user_id)
                
                deleted = result.split()[-1] != '0'
                if deleted:
                    logger.info(f"删除生成的简历: ID={resume_id}")
                return deleted
                
            except Exception as e:
                logger.error(f"删除生成的简历失败: {e}")
                return False
    
    async def update_generated_resume(
        self,
        resume_id: int,
        user_id: str,
        content: Optional[str] = None,
        title: Optional[str] = None
    ) -> bool:
        """更新生成的简历"""
        if not content and not title:
            return False
            
        async with db_manager.get_connection() as conn:
            try:
                # 构建 SQL
                updates = []
                values = []
                idx = 1
                
                if content is not None:
                    updates.append(f"content = ${idx}")
                    values.append(content)
                    idx += 1
                    
                if title is not None:
                    updates.append(f"title = ${idx}")
                    values.append(title)
                    idx += 1
                
                # 添加 ID 和 用户ID 作为条件
                values.append(resume_id)
                values.append(user_id)
                
                sql = f'''
                    UPDATE generated_resumes
                    SET {", ".join(updates)}
                    WHERE id = ${idx} AND user_id = ${idx+1}
                '''
                
                result = await conn.execute(sql, *values)
                
                updated = result.split()[-1] != '0'
                if updated:
                    logger.info(f"更新生成的简历: ID={resume_id}")
                return updated
                
            except Exception as e:
                logger.error(f"更新生成的简历失败: {e}")
                return False

    def _row_to_dict(self, row) -> Dict[str, Any]:
        """将数据库行转换为字典"""
        created_at = row['created_at']
        return {
            'id': row['id'],
            'user_id': row['user_id'],
            'title': row['title'],
            'optimization_result_id': row['optimization_result_id'],
            'job_description': row['job_description'],
            'content': row['content'],
            'created_at': created_at.isoformat() if isinstance(created_at, datetime) else created_at
        }


# 全局单例
_generation_service = None


def get_generation_service() -> ResumeGenerationService:
    """获取 ResumeGenerationService 单例"""
    global _generation_service
    if _generation_service is None:
        _generation_service = ResumeGenerationService()
    return _generation_service
