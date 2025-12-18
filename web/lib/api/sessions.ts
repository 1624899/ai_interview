/**
 * 会话 API 模块
 * 统一管理会话相关的 API 调用
 */

import { apiRequest, API_BASE_URL, getUserId } from './config';

// ============================================================================
// 类型定义
// ============================================================================

export interface SessionMetadata {
    mode: 'mock' | 'voice';
    resume_filename?: string;
    job_description?: string;
    question_count: number;
    max_questions: number;
    status: 'active' | 'completed' | 'archived';
    pinned?: boolean;
    round_index?: number;
}

export interface Message {
    role: 'user' | "assistant" | 'system';
    content: string;
    timestamp: string;
}

export interface SessionDetail {
    session_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    metadata: SessionMetadata;
    messages: Message[];
}

export interface SessionListItem {
    session_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    mode: 'mock' | 'voice';
    status: 'active' | 'completed' | 'archived';
    message_count: number;
    question_count: number;
    pinned?: boolean;
    round_index?: number;
    round_type?: string;
}

// ============================================================================
// API 函数
// ============================================================================

/**
 * 获取用户的会话列表
 */
export async function fetchSessionList(
    status?: 'active' | 'completed' | 'archived',
    mode?: 'mock' | 'voice',
    limit: number = 50
): Promise<SessionListItem[]> {
    try {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (mode) params.append('mode', mode);
        params.append('limit', String(limit));

        const response = await fetch(`${API_BASE_URL}/api/sessions/?${params}`, {
            headers: { 'X-User-ID': getUserId() }
        });

        if (!response.ok) throw new Error('获取会话列表失败');

        const data = await response.json();
        return data.sessions || [];
    } catch (error) {
        console.error('获取会话列表失败:', error);
        return [];
    }
}

/**
 * 获取会话详情
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
            headers: { 'X-User-ID': getUserId() }
        });

        if (!response.ok) throw new Error('获取会话详情失败');

        const data = await response.json();
        return data.session as SessionDetail;
    } catch (error) {
        console.error('获取会话详情失败:', error);
        return null;
    }
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: { 'X-User-ID': getUserId() }
        });

        if (!response.ok) throw new Error('删除会话失败');
        return true;
    } catch (error) {
        console.error('删除会话失败:', error);
        return false;
    }
}

/**
 * 更新会话标题
 */
export async function updateSessionTitle(
    sessionId: string,
    title: string
): Promise<{ success: boolean; updated_at?: string }> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': getUserId()
            },
            body: JSON.stringify({ title }),
        });

        if (!response.ok) throw new Error('更新标题失败');

        const data = await response.json();
        return { success: true, updated_at: data.session?.updated_at };
    } catch (error) {
        console.error('更新标题失败:', error);
        return { success: false };
    }
}

/**
 * 切换会话置顶状态
 */
export async function togglePinSession(
    sessionId: string,
    pinned: boolean
): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': getUserId()
            },
            body: JSON.stringify({ metadata: { pinned } }),
        });

        if (!response.ok) throw new Error('更新置顶状态失败');
        return true;
    } catch (error) {
        console.error('更新置顶状态失败:', error);
        return false;
    }
}

/**
 * 获取已完成的会话列表（用于简历工具）
 */
export async function getCompletedSessionsForResume(limit: number = 10): Promise<SessionListItem[]> {
    try {
        const response = await apiRequest<{
            success: boolean;
            sessions: SessionListItem[];
        }>(`/api/resume/sessions?limit=${limit}`);

        if (response.success) {
            return response.sessions;
        }
        return [];
    } catch (error) {
        console.error('获取已完成会话列表失败:', error);
        return [];
    }
}

/**
 * 创建下一轮面试
 */
export async function createNextRound(
    sessionId: string,
    maxQuestions: number = 5
): Promise<SessionDetail | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}/next-round`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': getUserId()
            },
            body: JSON.stringify({ max_questions: maxQuestions }),
        });

        if (!response.ok) throw new Error('创建下一轮失败');

        const data = await response.json();
        return data.session as SessionDetail;
    } catch (error) {
        console.error('创建下一轮失败:', error);
        return null;
    }
}

