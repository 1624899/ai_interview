/**
 * Interview Slice - 面试流程管理
 * 
 * 负责面试的核心流程：开始面试、发送消息、流式响应处理等
 */

import { v4 as uuidv4 } from 'uuid';
import { getUserId } from '@/hooks/useUserIdentity';
import type { Message, ResumeInfo, InterviewProgress, InterviewSession } from '../types';
import { API_BASE_URL } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

export interface InterviewFlowState {
    messages: Message[];
    isStreaming: boolean;
    isLoading: boolean;
    threadId: string;
    resume: ResumeInfo | null;
    jobDescription: string;
    companyInfo: string;
    interviewProgress: InterviewProgress | null;
    maxQuestions: number;
    showAbilityProfile: boolean;
    apiError: string | null;
    isVoiceMode: boolean;
    _abortController: AbortController | null;
    // 语音面试相关状态
    voiceHistory: Message[];
    voiceSystemPrompt: string;
    voiceSessionId: string | null;
    isInitializing: boolean;
}

export interface InterviewFlowActions {
    setJobDescription: (jobDescription: string) => void;
    setCompanyInfo: (companyInfo: string) => void;
    setMaxQuestions: (maxQuestions: number) => void;
    uploadResume: (file: File) => Promise<void>;
    startInterview: (mode?: 'mock' | 'voice') => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    stopStreaming: () => void;
    rollbackChat: (toIndex: number) => Promise<void>;
    clearMessages: () => void;
    restoreMessages: (messages: Message[]) => void;
    setInterviewProgress: (progress: InterviewProgress | null) => void;
    setShowAbilityProfile: (show: boolean) => void;
    setApiError: (error: string | null) => void;
    clearApiError: () => void;
    setVoiceMode: (isVoiceMode: boolean) => void;
    // 语音面试 actions
    setVoiceHistory: (history: Message[]) => void;
    appendVoiceMessage: (message: Message) => void;
    updateLastVoiceMessage: (content: string) => void;
    setVoiceSystemPrompt: (prompt: string) => void;
    setVoiceSessionId: (sessionId: string | null) => void;
    clearVoiceState: () => void;
    setInitializing: (isInitializing: boolean) => void;
}

export type InterviewFlowSlice = InterviewFlowState & InterviewFlowActions;

// ============================================================================
// Slice 工厂函数
// ============================================================================

type SetState = (partial: Partial<InterviewFlowSlice> | ((state: InterviewFlowSlice) => Partial<InterviewFlowSlice>)) => void;
type GetState = () => InterviewFlowSlice & {
    currentSession: InterviewSession | null;
    fetchSessions: (status?: 'active' | 'completed' | 'archived', mode?: 'mock' | 'voice') => Promise<void>;
    getApiConfigForRequest: () => { smart: { api_key: string; base_url: string; model: string }; fast: { api_key: string; base_url: string; model: string } } | null;
};

export const createInterviewSlice = (set: SetState, get: GetState): InterviewFlowSlice => ({
    // ===== 初始状态 =====
    messages: [],
    isStreaming: false,
    isLoading: false,
    threadId: uuidv4(),
    resume: null,
    jobDescription: '',
    companyInfo: '',
    interviewProgress: null,
    maxQuestions: 5,
    showAbilityProfile: false,
    apiError: null,
    isVoiceMode: false,
    _abortController: null,
    isInitializing: false,
    // 语音面试初始状态
    voiceHistory: [],
    voiceSystemPrompt: '',
    voiceSessionId: null,

    // ===== Actions =====

    setJobDescription: (jobDescription: string) => set({ jobDescription }),
    setCompanyInfo: (companyInfo: string) => set({ companyInfo }),
    setMaxQuestions: (maxQuestions: number) => set({ maxQuestions }),

    uploadResume: async (file: File) => {
        set({ isLoading: true });
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload/resume`, {
                method: 'POST',
                headers: { 'X-User-ID': getUserId() },
                body: formData,
            });

            if (!response.ok) throw new Error('上传简历失败');

            const data = await response.json();
            set({
                resume: {
                    filename: data.filename,
                    original_name: data.filename,
                    content: data.text_content,
                },
            });
        } catch (error) {
            console.error('上传简历错误:', error);
            throw error;
        } finally {
            set({ isLoading: false });
        }
    },

    startInterview: async (mode: 'mock' | 'voice' = 'mock') => {
        const { resume, jobDescription, companyInfo, maxQuestions, getApiConfigForRequest } = get();

        if (!resume) {
            throw new Error('请先上传简历');
        }

        const apiConfig = getApiConfigForRequest();
        if (!apiConfig) {
            throw new Error('请先配置 API');
        }

        // 立即设置初始化状态、清除旧数据
        set({
            isLoading: true,
            isInitializing: true, // 新增：显式标记正在初始化
            messages: [],
            voiceHistory: [],
            voiceSystemPrompt: '',
            voiceSessionId: null
        });

        const newThreadId = uuidv4();
        const now = new Date().toISOString();

        // 构建临时的 currentSession 占位，防止页面因找不到 Session 而回滚到 landing
        const sessionPlaceholder: InterviewSession = {
            session_id: newThreadId,
            title: '新模拟面试',
            created_at: now,
            updated_at: now,
            metadata: {
                mode: mode,
                question_count: 0,
                max_questions: maxQuestions,
                status: 'active',
            },
            messages: [],
        };

        // 原子性更新所有视图相关状态
        (set as (partial: Record<string, unknown>) => void)({
            threadId: newThreadId,
            interviewProgress: { current: 0, total: maxQuestions },
            currentSession: sessionPlaceholder,
        });

        // 如果是语音模式，仅到此为止，不调用文字版的 start 接口
        // 之后的逻辑将由语音组件调用 /api/voice/start 完成
        if (mode === 'voice') {
            set({
                isLoading: false,
                // 注意：保持 isInitializing: true，由 VoiceInterview 组件在初始化完成后负责关闭
                isVoiceMode: true
            });
            return;
        }

        const abortController = new AbortController();
        set({ _abortController: abortController });

        const requestBody = {
            thread_id: newThreadId,
            resume_context: resume.content,
            resume_filename: resume.filename,
            job_description: jobDescription,
            company_info: companyInfo || '未知',
            mode: 'mock',
            max_questions: maxQuestions,
            api_config: apiConfig,
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': getUserId()
                },
                body: JSON.stringify(requestBody),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('启动面试失败:', response.status, errorText);
                throw new Error(`启动面试失败: ${response.status} - ${errorText}`);
            }

            set({ isStreaming: true, isLoading: false });

            // 处理流式响应
            const reader = response.body?.getReader();
            if (!reader) {
                console.error('无法获取响应流 reader');
                throw new Error('无法读取响应流');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let currentAiMessage = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    // 处理 buffer 中剩余的数据
                    if (buffer.trim()) {
                        try {
                            const data = JSON.parse(buffer);
                            if (data.first_question) {
                                set({
                                    messages: [{
                                        role: 'assistant',
                                        content: data.first_question,
                                        timestamp: new Date().toISOString(),
                                    }],
                                    isStreaming: false,
                                    isLoading: false,
                                });
                            }
                        } catch {
                            if (buffer.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(buffer.slice(6));
                                    if (data.type === 'token' || data.type === 'content') {
                                        currentAiMessage += data.content || '';
                                        set(state => {
                                            const messages = [...state.messages];
                                            const lastMsg = messages[messages.length - 1];
                                            if (lastMsg && lastMsg.role === 'assistant') {
                                                lastMsg.content = currentAiMessage;
                                            } else {
                                                messages.push({
                                                    role: 'assistant',
                                                    content: currentAiMessage,
                                                    timestamp: new Date().toISOString(),
                                                });
                                            }
                                            return { messages };
                                        });
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            }
                        }
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'token' || data.type === 'content') {
                                currentAiMessage += data.content || '';
                                set(state => {
                                    const messages = [...state.messages];
                                    const lastMsg = messages[messages.length - 1];
                                    if (lastMsg && lastMsg.role === 'assistant') {
                                        lastMsg.content = currentAiMessage;
                                    } else {
                                        messages.push({
                                            role: 'assistant',
                                            content: currentAiMessage,
                                            timestamp: new Date().toISOString(),
                                        });
                                    }
                                    return { messages };
                                });
                            } else if (data.type === 'state_update') {
                                try {
                                    const stateData = JSON.parse(data.content);
                                    if (stateData.question_count !== undefined) {
                                        set({
                                            interviewProgress: {
                                                current: stateData.question_count,
                                                total: stateData.max_questions || get().maxQuestions,
                                            },
                                        });
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            } else if (data.type === 'error') {
                                console.error('收到 SSE 错误:', data.content);
                                let errorMessage = data.content || 'AI 响应失败';
                                if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
                                    errorMessage = 'API Key 无效，请检查配置';
                                } else if (errorMessage.includes('404')) {
                                    errorMessage = '模型不存在或 API 地址错误';
                                }
                                set({ apiError: errorMessage });
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // 刷新会话列表
            // 刷新会话列表，保持与页面初始化一致的过滤条件（获取所有状态的 mock/voice 会话）
            await get().fetchSessions(undefined);

        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('启动面试错误:', error);
                let errorMessage = '启动面试失败，请重试';
                const errorStr = (error as Error).message || '';

                try {
                    const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const errorJson = JSON.parse(jsonMatch[0]);
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        }
                    }
                } catch {
                    // Ignore parse errors
                }

                set({ apiError: errorMessage });
                throw error;
            }
        } finally {
            set({ isStreaming: false, isLoading: false, isInitializing: false, _abortController: null });
        }
    },

    sendMessage: async (content: string) => {
        const { threadId, jobDescription, companyInfo, getApiConfigForRequest, messages, resume, maxQuestions } = get();

        const apiConfig = getApiConfigForRequest();
        if (!apiConfig) {
            throw new Error('请先配置 API');
        }

        // 添加用户消息
        const userMessage: Message = {
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
        };
        set({ messages: [...messages, userMessage] });

        const abortController = new AbortController();
        set({ _abortController: abortController, isStreaming: true });

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': getUserId()
                },
                body: JSON.stringify({
                    thread_id: threadId,
                    message: content,
                    mode: 'mock',
                    resume_context: resume?.content || '',
                    job_description: jobDescription,
                    company_info: companyInfo || '未知',
                    max_questions: maxQuestions,
                    api_config: apiConfig,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) throw new Error('发送消息失败');

            // 处理流式响应
            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');

            const decoder = new TextDecoder();
            let buffer = '';
            let currentAiMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'token' || data.type === 'content') {
                                currentAiMessage += data.content || '';
                                set(state => {
                                    const messages = [...state.messages];
                                    const lastMsg = messages[messages.length - 1];
                                    if (lastMsg && lastMsg.role === 'assistant') {
                                        lastMsg.content = currentAiMessage;
                                    } else {
                                        messages.push({
                                            role: 'assistant',
                                            content: currentAiMessage,
                                            timestamp: new Date().toISOString(),
                                        });
                                    }
                                    return { messages };
                                });
                            } else if (data.type === 'state_update') {
                                try {
                                    const stateData = JSON.parse(data.content);
                                    if (stateData.question_count !== undefined) {
                                        const questionCount = stateData.question_count;
                                        const maxQs = stateData.max_questions || get().maxQuestions;
                                        const currentSession = get().currentSession;

                                        // 使用类型断言处理跨 slice 状态更新
                                        (set as (partial: Record<string, unknown>) => void)({
                                            interviewProgress: {
                                                current: questionCount,
                                                total: maxQs,
                                            },
                                            currentSession: currentSession && questionCount >= maxQs
                                                ? {
                                                    ...currentSession,
                                                    metadata: {
                                                        ...currentSession.metadata,
                                                        status: 'completed',
                                                        question_count: questionCount,
                                                    },
                                                }
                                                : currentSession,
                                        });
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            } else if (data.type === 'error') {
                                console.error('收到 SSE 错误:', data.content);
                                let errorMessage = data.content || 'AI 响应失败';
                                if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
                                    errorMessage = 'API Key 无效，请检查配置';
                                } else if (errorMessage.includes('404')) {
                                    errorMessage = '模型不存在或 API 地址错误';
                                }
                                set({ apiError: errorMessage });
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }

        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('发送消息错误:', error);
                let errorMessage = '发送消息失败，请重试';
                const errorStr = (error as Error).message || '';

                try {
                    const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const errorJson = JSON.parse(jsonMatch[0]);
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        }
                    }
                } catch {
                    // Ignore parse errors
                }

                set({ apiError: errorMessage });
                throw error;
            }
        } finally {
            set({ isStreaming: false, _abortController: null });
        }
    },

    stopStreaming: () => {
        const { _abortController } = get();
        if (_abortController) {
            _abortController.abort();
            set({ isStreaming: false, _abortController: null });
        }
    },

    rollbackChat: async (toIndex: number) => {
        const { threadId, messages } = get();

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/rollback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': getUserId()
                },
                body: JSON.stringify({
                    thread_id: threadId,
                    index: toIndex,
                }),
            });

            if (!response.ok) throw new Error('回退失败');

            // 截断本地消息，并重置会话状态为 active
            const currentSession = get().currentSession;
            // 使用类型断言处理跨 slice 状态更新
            (set as (partial: Record<string, unknown>) => void)({
                messages: messages.slice(0, toIndex),
                currentSession: currentSession
                    ? {
                        ...currentSession,
                        metadata: {
                            ...currentSession.metadata,
                            status: 'active',
                        },
                    }
                    : null,
            });
        } catch (error) {
            console.error('回退错误:', error);
            throw error;
        }
    },

    // ===== 消息管理 =====

    clearMessages: () => set({ messages: [] }),

    restoreMessages: (messages: Message[]) => set({ messages }),

    setInterviewProgress: (progress: InterviewProgress | null) => set({ interviewProgress: progress }),

    // ===== UI 状态 =====

    setShowAbilityProfile: (show: boolean) => set({ showAbilityProfile: show }),

    // ===== 错误处理 =====

    setApiError: (error: string | null) => set({ apiError: error }),
    clearApiError: () => set({ apiError: null }),
    setVoiceMode: (isVoiceMode: boolean) => set({ isVoiceMode }),

    // ===== 语音面试 Actions =====

    setVoiceHistory: (history: Message[]) => set({ voiceHistory: history }),

    appendVoiceMessage: (message: Message) => {
        set(state => ({
            voiceHistory: [...state.voiceHistory, message]
        }));
    },

    updateLastVoiceMessage: (content: string) => {
        set(state => {
            const history = [...state.voiceHistory];
            if (history.length > 0 && history[history.length - 1].role === 'assistant') {
                history[history.length - 1] = {
                    ...history[history.length - 1],
                    content
                };
            }
            return { voiceHistory: history };
        });
    },

    setVoiceSystemPrompt: (prompt: string) => set({ voiceSystemPrompt: prompt }),

    setVoiceSessionId: (sessionId: string | null) => set({ voiceSessionId: sessionId }),

    clearVoiceState: () => set({
        voiceHistory: [],
        voiceSystemPrompt: '',
        voiceSessionId: null,
    }),

    setInitializing: (isInitializing: boolean) => set({ isInitializing }),
});
