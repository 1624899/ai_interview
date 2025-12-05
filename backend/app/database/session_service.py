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
from app.database import DB_PATH, db_manager

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
    
    async def _check_session_access(
        self, 
        db, 
        session_id: str, 
        user_id: Optional[str] = None
    ) -> bool:
        """
        检查用户是否有权访问指定会话
        
        Args:
            db: 数据库连接
            session_id: 会话ID
            user_id: 用户ID（可选，如果提供则校验归属）
            
        Returns:
            bool: 是否有权限访问
        """
        sql = 'SELECT 1 FROM sessions WHERE session_id = ?'
        params = [session_id]
        
        if user_id:
            sql += ' AND user_id = ?'
            params.append(user_id)
            
        async with db.execute(sql, params) as cursor:
            return await cursor.fetchone() is not None
    
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
        """
        创建新会话（异步）
        
        Args:
            session_id: 会话ID
            mode: 面试模式
            title: 会话标题
            resume_filename: 简历文件名
            resume_content: 简历全文内容
            job_description: 岗位描述
            company_info: 公司信息
            max_questions: 最大问题数
            user_id: 用户ID
            
        Returns:
            InterviewSession: 创建的会话对象
        """
        # 生成默认标题
        if title is None:
            mode_text = "辅导模式" if mode == "coach" else "模拟面试"
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            title = f"{mode_text} - {timestamp}"
        
        now = datetime.now().isoformat()
        
        async with db_manager.get_connection() as db:
            try:
                await db.execute('''
                    INSERT INTO sessions (
                        session_id, user_id, title, created_at, updated_at, mode,
                        resume_filename, resume_content, job_description, company_info,
                        question_count, max_questions, status, pinned
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session_id, user_id, title, now, now, mode,
                    resume_filename, resume_content, job_description, company_info,
                    0, max_questions, 'active', 0
                ))
                await db.commit()
                
                logger.info(f"创建新会话: {session_id}")
                return await self.get_session(session_id)
                
            except aiosqlite.IntegrityError as e:
                logger.error(f"会话已存在: {session_id}")
                raise ValueError(f"会话 {session_id} 已存在")
    
    async def get_session(self, session_id: str, include_resume_content: bool = False, user_id: Optional[str] = None) -> Optional[InterviewSession]:
        """
        获取会话详情（异步）
        
        Args:
            session_id: 会话ID
            session_id: 会话ID
            include_resume_content: 是否包含简历全文（默认False，优化性能）
            user_id: 用户ID（可选，用于权限校验）
            
        Returns:
            InterviewSession: 会话对象，不存在则返回None
        """
        async with db_manager.get_connection() as db:
            
            # 构建查询列
            columns = [
                "session_id", "title", "created_at", "updated_at", "mode",
                "resume_filename", "job_description", "company_info",
                "question_count", "max_questions", "status", "pinned"
            ]
            if include_resume_content:
                columns.append("resume_content")
            
            select_clause = ", ".join(columns)
            
            # 获取会话基本信息
            sql = f'SELECT {select_clause} FROM sessions WHERE session_id = ?'
            params = [session_id]
            
            if user_id:
                sql += ' AND user_id = ?'
                params.append(user_id)
                
            async with db.execute(sql, params) as cursor:
                row = await cursor.fetchone()
                
                if row is None:
                    return None
            
            # 获取消息列表
            async with db.execute('''
                SELECT role, content, timestamp, question_index
                FROM messages 
                WHERE session_id = ? 
                ORDER BY timestamp ASC
            ''', (session_id,)) as cursor:
                message_rows = await cursor.fetchall()
                messages = [
                    MessageItem(
                        role=msg['role'],
                        content=msg['content'],
                        timestamp=msg['timestamp'],
                        question_index=msg['question_index'] if 'question_index' in msg.keys() else 0
                    )
                    for msg in message_rows
                ]
            
            # 安全获取 resume_content
            resume_content = None
            if include_resume_content and 'resume_content' in row.keys():
                resume_content = row['resume_content']

            # 构建会话对象
            metadata = SessionMetadata(
                mode=row['mode'],
                resume_filename=row['resume_filename'],
                resume_content=resume_content,
                job_description=row['job_description'],
                company_info=row['company_info'] if row['company_info'] else None,
                question_count=row['question_count'],
                max_questions=row['max_questions'],
                status=row['status'],
                pinned=bool(row['pinned'] if row['pinned'] is not None else 0)
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
        metadata_updates: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
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
        async with db_manager.get_connection() as db:
            # 检查会话是否存在 (并校验 user_id)
            check_sql = 'SELECT session_id FROM sessions WHERE session_id = ?'
            check_params = [session_id]
            
            if user_id:
                check_sql += ' AND user_id = ?'
                check_params.append(user_id)
                
            async with db.execute(check_sql, check_params) as cursor:
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
                    if key in ['question_count', 'max_questions', 'resume_filename', 'job_description', 'pinned']:
                        updates.append(f'{key} = ?')
                        # SQLite 使用 INTEGER 存储布尔值
                        params.append(1 if value else 0) if key == 'pinned' else params.append(value)
            
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
        content: str,
        question_index: int = 0,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        """
        向会话添加消息（异步）
        
        Args:
            session_id: 会话ID
            role: 消息角色
            content: 消息内容
            question_index: 对应的问题序号
            
        Returns:
            InterviewSession: 更新后的会话对象
        """
        async with db_manager.get_connection() as db:
            # 检查会话是否存在 (并校验 user_id)
            check_sql = 'SELECT session_id FROM sessions WHERE session_id = ?'
            check_params = [session_id]
            
            if user_id:
                check_sql += ' AND user_id = ?'
                check_params.append(user_id)
                
            async with db.execute(check_sql, check_params) as cursor:
                if await cursor.fetchone() is None:
                    logger.warning(f"会话不存在: {session_id}")
                    return None
            
            # 添加消息
            timestamp = datetime.now().isoformat()
            await db.execute('''
                INSERT INTO messages (session_id, role, content, timestamp, question_index)
                VALUES (?, ?, ?, ?, ?)
            ''', (session_id, role, content, timestamp, question_index))
            
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
        offset: int = 0,
        user_id: Optional[str] = None
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
        async with db_manager.get_connection() as db:
            
            # 构建查询条件
            conditions = []
            params = []
            
            if status:
                conditions.append('status = ?')
                params.append(status)
            
            if mode:
                conditions.append('mode = ?')
                params.append(mode)
            
            if user_id:
                conditions.append('user_id = ?')
                params.append(user_id)
            
            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            
            # 查询会话列表（置顶的会话排在前面）
            sql = f'''
                SELECT 
                    s.session_id, s.title, s.created_at, s.updated_at,
                    s.mode, s.status, s.question_count, s.pinned,
                    COUNT(m.id) as message_count
                FROM sessions s
                LEFT JOIN messages m ON s.session_id = m.session_id
                {where_clause}
                GROUP BY s.session_id
                ORDER BY s.pinned DESC, s.updated_at DESC
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
                        question_count=row['question_count'],
                        pinned=bool(row['pinned'] if row['pinned'] is not None else 0)
                    ))
                
                return sessions
    
    async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """
        删除会话（异步）
        
        使用事务确保数据一致性：
        - 删除 messages
        - 删除 LangGraph checkpoints 数据
        - 删除 session
        
        如果任何步骤失败，整个事务会回滚
        
        Args:
            session_id: 会话ID
            
        Returns:
            bool: 是否成功删除
        """
        async with db_manager.get_connection() as db:
            try:
                # 检查会话是否存在 (并校验 user_id)
                check_sql = 'SELECT session_id FROM sessions WHERE session_id = ?'
                check_params = [session_id]
                
                if user_id:
                    check_sql += ' AND user_id = ?'
                    check_params.append(user_id)
                
                async with db.execute(check_sql, check_params) as cursor:
                    if await cursor.fetchone() is None:
                        logger.warning(f"会话不存在: {session_id}")
                        return False
                
                # 1. 删除消息（由于外键约束会自动级联删除，但为了保险显式删除）
                await db.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
                
                # 2. 删除 LangGraph Checkpoints 相关数据
                # LangGraph 使用 thread_id 标识会话，这里 thread_id = session_id
                # 注意：AsyncSqliteSaver 创建 checkpoints 和 writes 两个表
                try:
                    await db.execute('DELETE FROM checkpoints WHERE thread_id = ?', (session_id,))
                    await db.execute('DELETE FROM writes WHERE thread_id = ?', (session_id,))
                except Exception as e:
                    # 如果表不存在（例如从未运行过 Graph），忽略错误但记录警告
                    logger.warning(f"清理 LangGraph 检查点数据时出错（可能表不存在）: {e}")
                
                # 3. 删除会话记录
                await db.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
                
                # 提交事务
                await db.commit()
                logger.info(f"✓ 成功删除会话及所有关联数据: {session_id}")
                return True
                
            except Exception as e:
                # 发生错误时回滚事务
                await db.rollback()
                logger.error(f"✗ 删除会话失败，已回滚事务: {session_id}, 错误: {e}")
                return False
    
    async def get_session_count(self, status: Optional[str] = None, user_id: Optional[str] = None) -> int:
        """
        获取会话总数（异步）
        
        Args:
            status: 筛选状态
            
        Returns:
            int: 会话数量
        """
        async with db_manager.get_connection() as db:
            sql = 'SELECT COUNT(*) as count FROM sessions'
            conditions = []
            params = []
            
            if status:
                conditions.append('status = ?')
                params.append(status)
                
            if user_id:
                conditions.append('user_id = ?')
                params.append(user_id)
                
            if conditions:
                sql += f" WHERE {' AND '.join(conditions)}"
                
            async with db.execute(sql, params) as cursor:
                result = await cursor.fetchone()
            
            return result[0] if result else 0

    async def rollback_session(self, session_id: str, index: int, user_id: Optional[str] = None) -> bool:
        """
        回退会话到指定索引
        
        策略：
        1. 数据库层面：删除指定位置之后的消息
        2. LangGraph层面：清除所有 Checkpoints（因为状态已不一致）
        3. 恢复策略：下次对话时，通过 inputs 将数据库中的 Context（简历、JD、Plan）重新注入 Graph
        
        Args:
            session_id: 会话ID
            index: 消息索引（0-based）
            user_id: 用户ID（可选，用于权限校验）
            
        Returns:
            bool: 是否成功
        """
        async with db_manager.get_connection() as db:
            try:
                # 权限校验
                if not await self._check_session_access(db, session_id, user_id):
                    logger.warning(f"回退失败：会话 {session_id} 不存在或无权访问")
                    return False
                
                # 1. 数据库层面处理
                if index == 0:
                    # 情况A: 完全重置（用户点击重新生成第一条消息，或清空会话）
                    await db.execute('DELETE FROM messages WHERE session_id = ?', (session_id,))
                    # 重置进度计数
                    await db.execute('UPDATE sessions SET question_count = 0, updated_at = ? WHERE session_id = ?', 
                                   (datetime.now().isoformat(), session_id))
                    logger.info(f"会话 {session_id} 消息已清空，进度已重置")
                else:
                    # 情况B: 部分回退
                    # 获取目标消息的时间戳
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
                    
                    # 删除该时间戳及之后的消息
                    await db.execute('''
                        DELETE FROM messages 
                        WHERE session_id = ? AND timestamp >= ?
                    ''', (session_id, target_timestamp))
                    
                    # 更新会话时间
                    await db.execute('UPDATE sessions SET updated_at = ? WHERE session_id = ?', 
                                   (datetime.now().isoformat(), session_id))
                                   
                    # 重新计算 question_count (基于剩余的用户消息数量)
                    async with db.execute('SELECT COUNT(*) FROM messages WHERE session_id = ? AND role = "user"', (session_id,)) as cursor:
                        row = await cursor.fetchone()
                        new_count = row[0] if row else 0
                    
                    await db.execute('UPDATE sessions SET question_count = ? WHERE session_id = ?', 
                                   (new_count, session_id))
                    logger.info(f"会话 {session_id} 进度已重置为: {new_count}")
                
                # 2. LangGraph 层面处理：总是清除 Checkpoints
                # 因为我们修改了历史，旧的 Checkpoint 已经失效（包含被删除的消息和旧状态）
                # 我们选择清除它，并在下次请求时通过 inputs "注水" 恢复状态
                try:
                    await db.execute('DELETE FROM checkpoints WHERE thread_id = ?', (session_id,))
                    await db.execute('DELETE FROM writes WHERE thread_id = ?', (session_id,))
                    logger.info(f"会话 {session_id} 的 LangGraph Checkpoints 已清除")
                except Exception as e:
                    # 如果表不存在（例如从未运行过 Graph），忽略错误
                    logger.warning(f"清理 LangGraph 数据时出错 (可能表不存在): {e}")
                
                await db.commit()
                return True
                
            except Exception as e:
                await db.rollback()
                logger.error(f"回退会话失败: {e}")
                return False

    async def save_profile(self, session_id: str, profile_data: Dict[str, Any]) -> bool:
        """
        保存候选人画像（异步）
        
        Args:
            session_id: 会话ID
            profile_data: 画像数据（字典）
            
        Returns:
            bool: 是否成功
        """
        import json
        async with db_manager.get_connection() as db:
            try:
                # 检查会话是否存在
                async with db.execute('SELECT session_id FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                    if await cursor.fetchone() is None:
                        return False
                
                profile_json = json.dumps(profile_data, ensure_ascii=False)
                
                await db.execute('''
                    UPDATE sessions 
                    SET candidate_profile = ?, updated_at = ? 
                    WHERE session_id = ?
                ''', (profile_json, datetime.now().isoformat(), session_id))
                
                await db.commit()
                logger.info(f"保存候选人画像: {session_id}")
                return True
                
            except Exception as e:
                logger.error(f"保存候选人画像失败: {e}")
                return False

    async def get_profile(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        获取候选人画像（异步）
        
        Args:
            session_id: 会话ID
            
        Returns:
            Optional[Dict[str, Any]]: 画像数据
        """
        import json
        async with db_manager.get_connection() as db:
            async with db.execute('SELECT candidate_profile FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                row = await cursor.fetchone()
                
                if row and row[0]:
                    try:
                        return json.loads(row[0])
                    except json.JSONDecodeError:
                        logger.error(f"解析候选人画像失败: {session_id}")
                        return None
                return None

    async def save_interview_plan(self, session_id: str, interview_plan: List[Dict[str, Any]]) -> bool:
        """
        保存面试题目清单（异步）
        
        Args:
            session_id: 会话ID
            interview_plan: 题目清单（列表）
            
        Returns:
            bool: 是否成功
        """
        import json
        async with db_manager.get_connection() as db:
            try:
                # 检查会话是否存在
                async with db.execute('SELECT session_id FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                    if await cursor.fetchone() is None:
                        return False
                
                plan_json = json.dumps(interview_plan, ensure_ascii=False)
                
                await db.execute('''
                    UPDATE sessions 
                    SET interview_plan = ?, updated_at = ? 
                    WHERE session_id = ?
                ''', (plan_json, datetime.now().isoformat(), session_id))
                
                await db.commit()
                logger.info(f"保存面试题目清单: {session_id}, 共 {len(interview_plan)} 道题")
                return True
                
            except Exception as e:
                logger.error(f"保存面试题目清单失败: {e}")
                return False

    async def get_interview_plan(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """
        获取面试题目清单（异步）
        
        Args:
            session_id: 会话ID
            
        Returns:
            Optional[List[Dict[str, Any]]]: 题目清单
        """
        import json
        async with db_manager.get_connection() as db:
            async with db.execute('SELECT interview_plan FROM sessions WHERE session_id = ?', (session_id,)) as cursor:
                row = await cursor.fetchone()
                
                if row and row[0]:
                    try:
                        return json.loads(row[0])
                    except json.JSONDecodeError:
                        logger.error(f"解析面试题目清单失败: {session_id}")
                        return None
                return None
    async def get_recent_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        获取最近的有画像的会话画像列表（异步）
        
        Args:
            limit: 数量限制
            user_id: 用户ID（如果提供则只返回该用户的画像）
            
        Returns:
            List[Dict[str, Any]]: 画像列表
        """
        import json
        async with db_manager.get_connection() as db:
            sql = '''
                SELECT candidate_profile 
                FROM sessions 
                WHERE candidate_profile IS NOT NULL 
            '''
            params = []
            
            if user_id:
                sql += ' AND user_id = ?'
                params.append(user_id)
                
            sql += ' ORDER BY updated_at DESC LIMIT ?'
            params.append(limit)
            
            async with db.execute(sql, params) as cursor:
                rows = await cursor.fetchall()
                
                profiles = []
                for row in rows:
                    if row[0]:
                        try:
                            profiles.append(json.loads(row[0]))
                        except json.JSONDecodeError:
                            continue
                return profiles

    async def save_user_profile(self, profile_data: Dict[str, Any], user_id: str = "default_user") -> bool:
        """
        保存用户综合能力画像（异步）
        
        Args:
            profile_data: 画像数据（字典）
            user_id: 用户ID（默认为 default_user）
            
        Returns:
            bool: 是否成功
        """
        import json
        async with db_manager.get_connection() as db:
            try:
                profile_json = json.dumps(profile_data, ensure_ascii=False)
                now = datetime.now().isoformat()
                
                # 使用 UPSERT 语法（INSERT OR REPLACE）
                await db.execute('''
                    INSERT INTO user_profile (user_id, profile_data, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                        profile_data = excluded.profile_data,
                        updated_at = excluded.updated_at
                ''', (user_id, profile_json, now, now))
                
                await db.commit()
                logger.info(f"保存用户综合能力画像: {user_id}")
                return True
                
            except Exception as e:
                logger.error(f"保存用户综合能力画像失败: {e}")
                return False

    async def get_user_profile(self, user_id: str = "default_user") -> Optional[Dict[str, Any]]:
        """
        获取用户综合能力画像（异步）
        
        Args:
            user_id: 用户ID（默认为 default_user）
            
        Returns:
            Optional[Dict[str, Any]]: 画像数据，包含 profile 和 updated_at
        """
        import json
        async with db_manager.get_connection() as db:
            async with db.execute('''
                SELECT profile_data, updated_at 
                FROM user_profile 
                WHERE user_id = ?
            ''', (user_id,)) as cursor:
                row = await cursor.fetchone()
                
                if row and row[0]:
                    try:
                        return {
                            "profile": json.loads(row[0]),
                            "updated_at": row[1]
                        }
                    except json.JSONDecodeError:
                        logger.error(f"解析用户综合能力画像失败: {user_id}")
                        return None
                return None
