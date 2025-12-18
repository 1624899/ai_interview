"""
会话管理服务 - 门面模式 (Facade)
通过组合多个子服务来实现完整的会话管理逻辑
"""

import logging
from typing import List, Optional, Dict, Any

from app.models.session import (
    InterviewSession, 
    SessionListItem
)
from .session_services.session_mgmt import SessionManagementService
from .session_services.session_advanced import SessionAdvancedService
from .session_services.message_mgmt import MessageService
from .session_services.profile_mgmt import ProfileService
from .session_services.interview_plan import InterviewPlanService

logger = logging.getLogger(__name__)

class SessionService:
    """
    会话管理门面类
    将请求转发到具体的子服务处理
    """
    
    def __init__(self):
        self.mgmt = SessionManagementService()
        self.advanced = SessionAdvancedService(self.mgmt)
        self.message = MessageService(self.mgmt)
        self.profile = ProfileService()
        self.plan = InterviewPlanService()
        logger.info("SessionService (Facade) 初始化完成")

    # --- 会话基础管理 (SessionManagementService) ---
    
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
        return await self.mgmt.create_session(
            session_id=session_id,
            mode=mode,
            title=title,
            resume_filename=resume_filename,
            resume_content=resume_content,
            job_description=job_description,
            company_info=company_info,
            max_questions=max_questions,
            user_id=user_id
        )

    async def get_session(self, session_id: str, include_resume_content: bool = False, user_id: Optional[str] = None) -> Optional[InterviewSession]:
        return await self.mgmt.get_session(session_id, include_resume_content, user_id)

    async def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        status: Optional[str] = None,
        metadata_updates: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        return await self.mgmt.update_session(
            session_id=session_id,
            title=title,
            status=status,
            metadata_updates=metadata_updates,
            user_id=user_id
        )

    async def list_sessions(
        self,
        status: Optional[str] = None,
        mode: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None
    ) -> List[SessionListItem]:
        return await self.mgmt.list_sessions(
            status=status,
            mode=mode,
            limit=limit,
            offset=offset,
            user_id=user_id
        )

    async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        return await self.mgmt.delete_session(session_id, user_id)

    async def get_session_count(self, status: Optional[str] = None, user_id: Optional[str] = None) -> int:
        return await self.mgmt.get_session_count(status, user_id)

    # --- 会话高级操作 (SessionAdvancedService) ---

    async def create_next_round(
        self,
        parent_session_id: str,
        max_questions: int = 5,
        user_id: Optional[str] = None
    ) -> InterviewSession:
        return await self.advanced.create_next_round(
            parent_session_id=parent_session_id,
            max_questions=max_questions,
            user_id=user_id
        )

    async def clone_session_for_voice(
        self,
        source_session_id: str,
        user_id: Optional[str] = None,
        max_questions: Optional[int] = None
    ) -> InterviewSession:
        return await self.advanced.clone_session_for_voice(
            source_session_id=source_session_id,
            user_id=user_id,
            max_questions=max_questions
        )

    async def rollback_session(self, session_id: str, index: int, user_id: Optional[str] = None) -> bool:
        return await self.advanced.rollback_session(session_id, index, user_id)

    # --- 消息管理 (MessageService) ---

    async def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        question_index: int = 0,
        audio_url: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Optional[InterviewSession]:
        return await self.message.add_message(
            session_id=session_id,
            role=role,
            content=content,
            question_index=question_index,
            audio_url=audio_url,
            user_id=user_id
        )

    async def get_session_conversations(self, session_id: str, user_id: Optional[str] = None) -> List[Dict[str, str]]:
        return await self.message.get_session_conversations(session_id, user_id)

    # --- 画像管理 (ProfileService) ---

    async def save_profile(self, session_id: str, profile_data: Dict[str, Any]) -> bool:
        return await self.profile.save_profile(session_id, profile_data)

    async def get_profile(self, session_id: str) -> Optional[Dict[str, Any]]:
        return await self.profile.get_profile(session_id)

    async def get_recent_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.profile.get_recent_profiles(limit, user_id)

    async def get_series_final_profiles(self, limit: int = 5, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return await self.profile.get_series_final_profiles(limit, user_id)

    async def save_user_profile(self, profile_data: Dict[str, Any], user_id: str = "default_user") -> bool:
        return await self.profile.save_user_profile(profile_data, user_id)

    async def get_user_profile(self, user_id: str = "default_user") -> Optional[Dict[str, Any]]:
        return await self.profile.get_user_profile(user_id)

    # --- 面试计划与进度 (InterviewPlanService) ---

    async def get_interview_plan(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        return await self.plan.get_interview_plan(session_id)

    async def save_interview_plan(self, session_id: str, plan: List[Dict[str, Any]]) -> bool:
        return await self.plan.save_interview_plan(session_id, plan)

    async def update_session_question_count(self, session_id: str, count: int) -> bool:
        return await self.plan.update_session_question_count(session_id, count)

    async def get_completed_sessions_for_resume(self, user_id: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        return await self.plan.get_completed_sessions_for_resume(user_id, limit)

# 创建全局实例
session_service = SessionService()
