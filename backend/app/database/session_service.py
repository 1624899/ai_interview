"""
会话管理服务 - PostgreSQL 版本
负责面试会话的持久化存储和管理
"""

import json
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.models.session import (
    InterviewSession, 
    SessionListItem, 
    SessionMetadata,
    MessageItem
)
from app.database.base import db_manager

logger = logging.getLogger(__name__)


class SessionService:
    """会话管理服务类 - 使用 PostgreSQL 数据库"""
    
    def __init__(self):
        """初始化会话服务"""
        logger.info("SessionService 初始化 (PostgreSQL)")
    
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
        # 生成默认标题
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
            # 构建查询
            columns = [
                "session_id", "title", "created_at", "updated_at", "mode",
                "resume_filename", "job_description", "company_info",
                "question_count", "max_questions", "status", "pinned"
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
            
            # 获取消息列表
            messages_rows = await conn.fetch('''
                SELECT role, content, timestamp, question_index
                FROM messages 
                WHERE session_id = $1 
                ORDER BY timestamp ASC
            ''', session_id)
            
            messages = [
                MessageItem(
                    role=msg['role'],
                    content=msg['content'],
                    timestamp=msg['timestamp'].isoformat() if isinstance(msg['timestamp'], datetime) else msg['timestamp'],
                    question_index=msg['question_index'] or 0
                )
                for msg in messages_rows
            ]
            
            # 构建会话对象
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
                pinned=bool(row['pinned'])
            )
            
            created_at = row['created_at']
            updated_at = row['updated_at']
            
            session = InterviewSession(
                session_id=row['session_id'],
                title=row['title'],
                created_at=created_at.isoformat() if isinstance(created_at, datetime) else created_at,
                updated_at=updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
                metadata=metadata,
                messages=messages
            )
            
            return session
    
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
            # 检查会话是否存在
            if not await self._check_session_access(conn, session_id, user_id):
                return None
            
            # 构建更新语句
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
            
            # 更新 updated_at
            updates.append(f'updated_at = ${param_idx}')
            params.append(datetime.now())
            param_idx += 1
            
            params.append(session_id)
            
            if updates:
                sql = f"UPDATE sessions SET {', '.join(updates)} WHERE session_id = ${param_idx}"
                await conn.execute(sql, *params)
                logger.info(f"更新会话: {session_id}")
            
            return await self.get_session(session_id)
    
    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        question_index: int = 0,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        """向会话添加消息"""
        async with db_manager.get_connection() as conn:
            # 检查会话是否存在
            if not await self._check_session_access(conn, session_id, user_id):
                return None
            
            timestamp = datetime.now()
            
            await conn.execute('''
                INSERT INTO messages (session_id, role, content, timestamp, question_index)
                VALUES ($1, $2, $3, $4, $5)
            ''', session_id, role, content, timestamp, question_index)
            
            # 更新会话的 updated_at
            await conn.execute('''
                UPDATE sessions SET updated_at = $1 WHERE session_id = $2
            ''', timestamp, session_id)
            
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
                    s.question_count, s.pinned,
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
                    pinned=bool(row['pinned'])
                ))
            
            return sessions
    
    async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """删除会话"""
        async with db_manager.get_connection() as conn:
            # 检查会话是否存在
            if not await self._check_session_access(conn, session_id, user_id):
                return False
            
            try:
                # 删除消息（外键级联会自动删除，但显式删除更清晰）
                await conn.execute('DELETE FROM messages WHERE session_id = $1', session_id)
                
                # 删除会话
                await conn.execute('DELETE FROM sessions WHERE session_id = $1', session_id)
                
                # 删除 LangGraph checkpoints
                try:
                    await conn.execute('DELETE FROM checkpoints WHERE thread_id = $1', session_id)
                    await conn.execute('DELETE FROM writes WHERE thread_id = $1', session_id)
                except:
                    pass  # 表可能不存在
                
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

    async def rollback_session(self, session_id: str, index: int, user_id: Optional[str] = None) -> bool:
        """回退会话到指定索引"""
        async with db_manager.get_connection() as conn:
            try:
                # 权限校验
                if not await self._check_session_access(conn, session_id, user_id):
                    logger.warning(f"回退失败：会话 {session_id} 不存在或无权访问")
                    return False
                
                if index == 0:
                    # 完全重置
                    await conn.execute('DELETE FROM messages WHERE session_id = $1', session_id)
                    await conn.execute('''
                        UPDATE sessions SET question_count = 0, updated_at = $1 WHERE session_id = $2
                    ''', datetime.now(), session_id)
                    logger.info(f"会话 {session_id} 消息已清空，进度已重置")
                else:
                    # 部分回退 - 获取目标消息的时间戳
                    target_row = await conn.fetchrow('''
                        SELECT timestamp FROM messages 
                        WHERE session_id = $1 
                        ORDER BY timestamp ASC 
                        LIMIT 1 OFFSET $2
                    ''', session_id, index)
                    
                    if not target_row:
                        logger.warning(f"回退失败：找不到索引 {index} 的消息")
                        return False
                    
                    target_timestamp = target_row['timestamp']
                    
                    # 删除该时间戳及之后的消息
                    await conn.execute('''
                        DELETE FROM messages 
                        WHERE session_id = $1 AND timestamp >= $2
                    ''', session_id, target_timestamp)
                    
                    await conn.execute('''
                        UPDATE sessions SET updated_at = $1 WHERE session_id = $2
                    ''', datetime.now(), session_id)
                    
                    # 重新计算 question_count
                    new_count = await conn.fetchval('''
                        SELECT COUNT(*) FROM messages WHERE session_id = $1 AND role = 'user'
                    ''', session_id)
                    
                    await conn.execute('''
                        UPDATE sessions SET question_count = $1 WHERE session_id = $2
                    ''', new_count, session_id)
                    logger.info(f"会话 {session_id} 进度已重置为: {new_count}")
                
                # 清除 LangGraph Checkpoints
                try:
                    await conn.execute('DELETE FROM checkpoints WHERE thread_id = $1', session_id)
                    await conn.execute('DELETE FROM writes WHERE thread_id = $1', session_id)
                    logger.info(f"会话 {session_id} 的 LangGraph Checkpoints 已清除")
                except:
                    pass
                
                return True
                
            except Exception as e:
                logger.error(f"回退会话失败: {e}")
                return False

    async def save_profile(self, session_id: str, profile_data: Dict[str, Any]) -> bool:
        """保存候选人画像到会话"""
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    UPDATE sessions SET candidate_profile = $1, updated_at = $2 WHERE session_id = $3
                ''', json.dumps(profile_data, ensure_ascii=False), datetime.now(), session_id)
                logger.info(f"保存单场面试画像: {session_id}")
                return True
            except Exception as e:
                logger.error(f"保存画像失败: {e}")
                return False

    async def get_profile(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取单个会话的候选人画像"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('''
                SELECT candidate_profile FROM sessions WHERE session_id = $1
            ''', session_id)
            
            if row and row['candidate_profile']:
                profile = row['candidate_profile']
                if isinstance(profile, str):
                    return json.loads(profile)
                return profile
            return None

    async def get_interview_plan(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取面试题目清单"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('''
                SELECT interview_plan FROM sessions WHERE session_id = $1
            ''', session_id)
            
            if row and row['interview_plan']:
                plan = row['interview_plan']
                # PostgreSQL JSONB 自动解析
                if isinstance(plan, str):
                    return json.loads(plan)
                return plan
            return None

    async def save_interview_plan(self, session_id: str, plan: List[Dict[str, Any]]) -> bool:
        """保存面试题目清单"""
        async with db_manager.get_connection() as conn:
            try:
                await conn.execute('''
                    UPDATE sessions SET interview_plan = $1, updated_at = $2 WHERE session_id = $3
                ''', json.dumps(plan, ensure_ascii=False), datetime.now(), session_id)
                logger.info(f"保存面试计划: {session_id}, 共 {len(plan)} 道题")
                return True
            except Exception as e:
                logger.error(f"保存面试计划失败: {e}")
                return False

    async def get_recent_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取最近的有画像的会话画像列表"""
        async with db_manager.get_connection() as conn:
            sql = '''
                SELECT candidate_profile 
                FROM sessions 
                WHERE candidate_profile IS NOT NULL 
            '''
            params = []
            param_idx = 1
            
            if user_id:
                sql += f' AND user_id = ${param_idx}'
                params.append(user_id)
                param_idx += 1
                
            sql += f' ORDER BY updated_at DESC LIMIT ${param_idx}'
            params.append(limit)
            
            rows = await conn.fetch(sql, *params)
            
            profiles = []
            for row in rows:
                if row['candidate_profile']:
                    profile = row['candidate_profile']
                    if isinstance(profile, str):
                        profiles.append(json.loads(profile))
                    else:
                        profiles.append(profile)
            return profiles

    async def save_user_profile(self, profile_data: Dict[str, Any], user_id: str = "default_user") -> bool:
        """保存用户综合能力画像"""
        async with db_manager.get_connection() as conn:
            try:
                now = datetime.now()
                profile_json = json.dumps(profile_data, ensure_ascii=False)
                
                # UPSERT
                await conn.execute('''
                    INSERT INTO user_profile (user_id, profile_data, created_at, updated_at)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (user_id) 
                    DO UPDATE SET profile_data = $2, updated_at = $4
                ''', user_id, profile_json, now, now)
                
                logger.info(f"保存用户综合能力画像: {user_id}")
                return True
                
            except Exception as e:
                logger.error(f"保存用户综合能力画像失败: {e}")
                return False

    async def get_user_profile(self, user_id: str = "default_user") -> Optional[Dict[str, Any]]:
        """获取用户综合能力画像"""
        async with db_manager.get_connection() as conn:
            row = await conn.fetchrow('''
                SELECT profile_data, updated_at 
                FROM user_profile 
                WHERE user_id = $1
            ''', user_id)
            
            if row and row['profile_data']:
                profile = row['profile_data']
                updated_at = row['updated_at']
                
                return {
                    "profile": json.loads(profile) if isinstance(profile, str) else profile,
                    "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at
                }
            return None


# 创建全局实例
session_service = SessionService()
