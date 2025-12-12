/**
 * Session Slice - 会话管理
 * 
 * 负责会话的 CRUD 操作和状态管理
 */

import { v4 as uuidv4 } from 'uuid';
import {
    fetchSessionList,
    getSessionDetail,
    deleteSession as deleteSessionApi,
    updateSessionTitle as updateSessionTitleApi,
    togglePinSession as togglePinSessionApi,
} from '@/lib/api/sessions';
import type { SessionListItem, InterviewSession, Message, InterviewProgress } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

export interface SessionState {
    sessions: SessionListItem[];
    currentSession: InterviewSession | null;
    sessionLoading: boolean;
}

export interface SessionActions {
    fetchSessions: (status?: 'active' | 'completed' | 'archived', mode?: 'coach' | 'mock') => Promise<void>;
    selectSession: (sessionId: string) => Promise<void>;
    createNewSession: () => void;
    deleteSession: (sessionId: string) => Promise<boolean>;
    updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
    togglePinSession: (sessionId: string, pinned: boolean) => Promise<void>;
}

export type SessionSlice = SessionState & SessionActions;

// ============================================================================
// Slice 工厂函数
// ============================================================================

type SetState = (partial: Partial<SessionSlice> | ((state: SessionSlice) => Partial<SessionSlice>)) => void;
type GetState = () => SessionSlice & {
    messages: Message[];
    jobDescription: string;
    companyInfo: string;
    resume: { filename: string; original_name: string; content: string } | null;
    interviewProgress: InterviewProgress | null;
    maxQuestions: number;
    showAbilityProfile: boolean;
    threadId: string;
};

export const createSessionSlice = (set: SetState, get: GetState): SessionSlice => ({
    // ===== 初始状态 =====
    sessions: [],
    currentSession: null,
    sessionLoading: false,

    // ===== Actions =====

    fetchSessions: async (status, mode) => {
        set({ sessionLoading: true });
        try {
            const sessions = await fetchSessionList(status, mode);
            set({ sessions });
        } catch (error) {
            console.error('获取会话列表错误:', error);
        } finally {
            set({ sessionLoading: false });
        }
    },

    selectSession: async (sessionId: string) => {
        set({ sessionLoading: true });
        try {
            const session = await getSessionDetail(sessionId);
            if (!session) throw new Error('获取会话详情失败');

            // 使用类型断言处理跨 slice 状态更新
            (set as (partial: Record<string, unknown>) => void)({
                currentSession: session,
                threadId: session.session_id,
                messages: session.messages || [],
                jobDescription: session.metadata.job_description || '',
                interviewProgress: {
                    current: session.metadata.question_count,
                    total: session.metadata.max_questions
                },
                maxQuestions: session.metadata.max_questions,
                showAbilityProfile: false,
            });
        } catch (error) {
            console.error('获取会话详情错误:', error);
        } finally {
            set({ sessionLoading: false });
        }
    },

    createNewSession: () => {
        // 使用类型断言处理跨 slice 状态更新
        (set as (partial: Record<string, unknown>) => void)({
            currentSession: null,
            threadId: uuidv4(),
            messages: [],
            jobDescription: '',
            companyInfo: '',
            resume: null,
            interviewProgress: null,
            maxQuestions: 5,
            showAbilityProfile: false,
        });
    },

    deleteSession: async (sessionId: string) => {
        try {
            const success = await deleteSessionApi(sessionId);
            if (!success) throw new Error('删除会话失败');

            const { currentSession, sessions } = get();
            const isCurrentSession = currentSession?.session_id === sessionId;

            set({
                sessions: sessions.filter(s => s.session_id !== sessionId),
            });

            if (isCurrentSession) {
                get().createNewSession();
            }

            return true;
        } catch (error) {
            console.error('删除会话错误:', error);
            return false;
        }
    },

    updateSessionTitle: async (sessionId: string, title: string) => {
        try {
            const result = await updateSessionTitleApi(sessionId, title);
            if (!result.success) throw new Error('更新标题失败');

            const { sessions, currentSession } = get();

            set({
                sessions: sessions.map(s =>
                    s.session_id === sessionId ? { ...s, title, updated_at: result.updated_at || s.updated_at } : s
                ),
                currentSession: currentSession?.session_id === sessionId
                    ? { ...currentSession, title, updated_at: result.updated_at || currentSession.updated_at }
                    : currentSession,
            });
        } catch (error) {
            console.error('更新标题错误:', error);
        }
    },

    togglePinSession: async (sessionId: string, pinned: boolean) => {
        try {
            const success = await togglePinSessionApi(sessionId, pinned);
            if (!success) throw new Error('更新置顶状态失败');

            const { sessions } = get();
            set({
                sessions: sessions
                    .map(s => s.session_id === sessionId ? { ...s, pinned } : s)
                    .sort((a, b) => {
                        if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                    }),
            });
        } catch (error) {
            console.error('更新置顶状态错误:', error);
        }
    },
});
