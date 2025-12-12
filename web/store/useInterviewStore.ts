/**
 * Interview Store - Zustand 状态管理
 * 
 * 统一管理面试应用的所有状态，包括：
 * - 会话管理 (sessions, currentSession)
 * - 聊天状态 (messages, streaming)
 * - 面试上下文 (resume, jobDescription, progress)
 * - API 配置 (apiConfig)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 导入类型和常量
export * from './types';

// 导入 slices
import { createSessionSlice, type SessionSlice } from './slices/sessionSlice';
import { createInterviewSlice, type InterviewFlowSlice } from './slices/interviewSlice';
import { createApiConfigSlice, type ApiConfigSlice } from './slices/apiConfigSlice';
import { createResumeSlice, type ResumeSlice } from './slices/resumeSlice';

// ============================================================================
// Store 类型定义
// ============================================================================

// 组合所有 slice 类型
export type InterviewStore = SessionSlice & InterviewFlowSlice & ApiConfigSlice & ResumeSlice;

// ============================================================================
// Store 实现
// ============================================================================

export const useInterviewStore = create<InterviewStore>()(
    persist(
        (set, get) => ({
            // 组合所有 slices
            ...createSessionSlice(
                set as Parameters<typeof createSessionSlice>[0],
                get as Parameters<typeof createSessionSlice>[1]
            ),
            ...createInterviewSlice(
                set as Parameters<typeof createInterviewSlice>[0],
                get as Parameters<typeof createInterviewSlice>[1]
            ),
            ...createApiConfigSlice(
                set as Parameters<typeof createApiConfigSlice>[0],
                get as Parameters<typeof createApiConfigSlice>[1]
            ),
            ...createResumeSlice(
                set as Parameters<typeof createResumeSlice>[0],
                get as Parameters<typeof createResumeSlice>[1]
            ),
        }),
        {
            name: 'interview-store',
            storage: createJSONStorage(() => localStorage),
            // 只持久化 API 配置
            partialize: (state) => ({
                apiConfig: state.apiConfig,
            }),
        }
    )
);
