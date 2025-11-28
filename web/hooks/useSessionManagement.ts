"use client";

import { useState, useCallback } from 'react';

// 类型定义
export interface Message {
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: string;
}

export interface SessionMetadata {
    mode: 'coach' | 'mock';
    resume_filename?: string;
    job_description?: string;
    question_count: number;
    max_questions: number;
    status: 'active' | 'completed' | 'archived';
}

export interface InterviewSession {
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
    mode: 'coach' | 'mock';
    status: 'active' | 'completed' | 'archived';
    message_count: number;
    question_count: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useSessionManagement() {
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [currentSession, setCurrentSession] = useState<InterviewSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 创建新会话
    const createSession = useCallback(async (
        mode: 'coach' | 'mock',
        resumeFilename?: string,
        jobDescription?: string,
        maxQuestions: number = 5
    ): Promise<InterviewSession | null> => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/sessions/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mode,
                    resume_filename: resumeFilename,
                    job_description: jobDescription,
                    max_questions: maxQuestions,
                }),
            });

            if (!response.ok) {
                throw new Error('创建会话失败');
            }

            const data = await response.json();
            const session = data.session;

            setCurrentSession(session);
            return session;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '创建会话失败';
            setError(errorMessage);
            console.error('创建会话错误:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // 获取会话列表
    const fetchSessions = useCallback(async (
        status?: 'active' | 'completed' | 'archived',
        mode?: 'coach' | 'mock',
        limit: number = 50,
        offset: number = 0
    ) => {
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (mode) params.append('mode', mode);
            params.append('limit', limit.toString());
            params.append('offset', offset.toString());

            const response = await fetch(`${API_BASE_URL}/api/sessions/?${params}`);

            if (!response.ok) {
                throw new Error('获取会话列表失败');
            }

            const data = await response.json();
            setSessions(data.sessions);
            return data;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取会话列表失败';
            setError(errorMessage);
            console.error('获取会话列表错误:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // 获取会话详情
    const fetchSession = useCallback(async (sessionId: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`);

            if (!response.ok) {
                throw new Error('获取会话详情失败');
            }

            const data = await response.json();
            setCurrentSession(data.session);
            return data.session;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '获取会话详情失败';
            setError(errorMessage);
            console.error('获取会话详情错误:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // 更新会话
    const updateSession = useCallback(async (
        sessionId: string,
        updates: {
            title?: string;
            status?: 'active' | 'completed' | 'archived';
            metadata?: Partial<SessionMetadata>;
        }
    ) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error('更新会话失败');
            }

            const data = await response.json();
            setCurrentSession(data.session);

            // 更新列表中的会话
            setSessions(prev =>
                prev.map(s => s.session_id === sessionId
                    ? { ...s, ...updates, updated_at: data.session.updated_at }
                    : s
                )
            );

            return data.session;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '更新会话失败';
            setError(errorMessage);
            console.error('更新会话错误:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // 删除会话
    const deleteSession = useCallback(async (sessionId: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('删除会话失败');
            }

            // 从列表中移除
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));

            // 如果是当前会话，清空
            if (currentSession?.session_id === sessionId) {
                setCurrentSession(null);
            }

            return true;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '删除会话失败';
            setError(errorMessage);
            console.error('删除会话错误:', err);
            return false;
        } finally {
            setLoading(false);
        }
    }, [currentSession]);

    // 清空当前会话
    const clearCurrentSession = useCallback(() => {
        setCurrentSession(null);
    }, []);

    return {
        // 状态
        sessions,
        currentSession,
        loading,
        error,

        // 方法
        createSession,
        fetchSessions,
        fetchSession,
        updateSession,
        deleteSession,
        clearCurrentSession,
    };
}
