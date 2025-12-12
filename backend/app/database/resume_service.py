"""
简历工具持久化服务
负责简历优化/分析结果的存储和管理
"""

import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database.base import db_manager

logger = logging.getLogger(__name__)


class ResumeService:
    """简历工具服务类 - 管理简历优化/分析结果"""
    
    def __init__(self):
        """初始化简历服务"""
        logger.info("ResumeService 初始化")
    
    async def save_result(
        self,
        user_id: str,
        result_type: str,
        resume_content: str,
        result_data: dict,
        job_description: Optional[str] = None,
        session_ids: List[str] = [],
        include_profile: bool = False
    ) -> int:
        """
        保存优化/分析结果
        
        Args:
            user_id: 用户ID
            result_type: 结果类型 ('optimize' 或 'analyze')
            resume_content: 简历内容
            result_data: 结果数据
            job_description: 职位描述（可选）
            session_ids: 关联的面试 session_id 列表
            include_profile: 是否包含综合画像
            
        Returns:
            int: 结果 ID
        """
        async with db_manager.get_connection() as conn:
            try:
                result_id = await conn.fetchval('''
                    INSERT INTO resume_results (
                        user_id, result_type, resume_content, job_description,
                        session_ids, include_profile, result_data, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                ''',
                    user_id,
                    result_type,
                    resume_content,
                    job_description,
                    json.dumps(session_ids) if session_ids else None,
                    include_profile,
                    json.dumps(result_data, ensure_ascii=False),
                    datetime.now()
                )
                
                logger.info(f"保存简历{result_type}结果: ID={result_id}, user={user_id}")
                return result_id
                
            except Exception as e:
                logger.error(f"保存简历结果失败: {e}")
                raise
    
    async def get_result(self, result_id: int, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取单个结果
        
        Args:
            result_id: 结果ID
            user_id: 用户ID（用于权限校验）
            
        Returns:
            结果数据字典，如果不存在或无权限则返回 None
        """
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('''
                SELECT id, user_id, result_type, resume_content, job_description,
                       session_ids, include_profile, result_data, created_at
                FROM resume_results
                WHERE id = $1 AND user_id = $2
            ''', result_id, user_id)
            
            if not row:
                return None
            
            return self._row_to_dict(row)
    
    async def list_results(
        self,
        user_id: str,
        result_type: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        获取用户的历史结果列表
        
        Args:
            user_id: 用户ID
            result_type: 结果类型过滤（可选）
            limit: 最大返回数量
            
        Returns:
            结果列表
        """
        async with db_manager.get_connection() as conn:
            if result_type:
                rows = await conn.fetch('''
                    SELECT id, user_id, result_type, resume_content, job_description,
                           session_ids, include_profile, result_data, created_at
                    FROM resume_results
                    WHERE user_id = $1 AND result_type = $2
                    ORDER BY created_at DESC
                    LIMIT $3
                ''', user_id, result_type, limit)
            else:
                rows = await conn.fetch('''
                    SELECT id, user_id, result_type, resume_content, job_description,
                           session_ids, include_profile, result_data, created_at
                    FROM resume_results
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2
                ''', user_id, limit)
            
            return [self._row_to_dict(row) for row in rows]
    
    async def delete_result(self, result_id: int, user_id: str) -> bool:
        """
        删除结果
        
        Args:
            result_id: 结果ID
            user_id: 用户ID（用于权限校验）
            
        Returns:
            是否删除成功
        """
        async with db_manager.get_connection() as conn:
            try:
                result = await conn.execute('''
                    DELETE FROM resume_results
                    WHERE id = $1 AND user_id = $2
                ''', result_id, user_id)
                
                # 检查是否真的删除了记录
                deleted = result.split()[-1] != '0'
                if deleted:
                    logger.info(f"删除简历结果: ID={result_id}")
                return deleted
                
            except Exception as e:
                logger.error(f"删除简历结果失败: {e}")
                return False
    
    def _row_to_dict(self, row) -> Dict[str, Any]:
        """将数据库行转换为字典"""
        result_data = row['result_data']
        session_ids = row['session_ids']
        created_at = row['created_at']
        
        return {
            'id': row['id'],
            'user_id': row['user_id'],
            'result_type': row['result_type'],
            'resume_content': row['resume_content'],
            'job_description': row['job_description'],
            'session_ids': json.loads(session_ids) if isinstance(session_ids, str) else (session_ids or []),
            'include_profile': row['include_profile'],
            'result_data': json.loads(result_data) if isinstance(result_data, str) else result_data,
            'created_at': created_at.isoformat() if isinstance(created_at, datetime) else created_at
        }


# 全局单例
_resume_service = None


def get_resume_service() -> ResumeService:
    """获取 ResumeService 单例"""
    global _resume_service
    if _resume_service is None:
        _resume_service = ResumeService()
    return _resume_service
