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
import { v4 as uuidv4 } from 'uuid';
import { getUserId } from '@/hooks/useUserIdentity';

// ============================================================================
// 类型定义
// ============================================================================

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
    pinned?: boolean;
    round_index?: number;
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
    pinned?: boolean;
    round_index?: number;
    round_type?: string;
}

export interface ResumeInfo {
    filename: string;
    original_name: string;
    content: string;
}

export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    createdAt: string;
}

export interface ApiConfig {
    models: ModelConfig[];
    smartModelId: string;
    fastModelId: string;
}

export interface InterviewProgress {
    current: number;
    total: number;
}

// API 提供商配置 (2025年最新模型)
export const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4o-mini', 'gpt-4o'] },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKeyUrl: 'https://platform.deepseek.com/api_keys', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: ['glm-4.6', 'glm-4.5', 'glm-4-flash', 'glm-4-air'] },
    { id: 'aliyun', name: '阿里云百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b', 'qwen3-30b'] },
    { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys', models: ['kimi-k2-thinking', 'kimi-k2-turbo-preview', 'kimi-k2'] },
    { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak', models: ['deepseek-ai/DeepSeek-V3.2', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen3-235B', 'THUDM/glm-4.5', 'moonshot-ai/Kimi-K2'] },
    { id: 'iflow', name: '心流开放平台（免费）', baseUrl: 'https://apis.iflow.cn/v1', apiKeyUrl: 'https://platform.iflow.cn/profile?tab=apiKey', models: ['qwen3-max', 'qwen3-coder-plus', 'glm-4.6', 'kimi-k2', 'qwen3-235b-a22b-instruct', 'deepseek-v3.2'] },
    { id: 'modelscope', name: 'ModelScope（免费）', baseUrl: 'https://api-inference.modelscope.cn/v1', apiKeyUrl: 'https://www.modelscope.cn/my/myaccesstoken', models: ['deepseek-ai/DeepSeek-V3.2', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'Qwen/Qwen3-235B-A22B-Instruct-2507'] },
    { id: 'custom', name: '自定义', baseUrl: '', apiKeyUrl: '', models: [] },
];

const DEFAULT_API_CONFIG: ApiConfig = {
    models: [],
    smartModelId: '',
    fastModelId: '',
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// Store 接口定义
// ============================================================================

interface InterviewState {
    // ===== 会话状态 =====
    sessions: SessionListItem[];
    currentSession: InterviewSession | null;
    sessionLoading: boolean;

    // ===== 聊天状态 =====
    messages: Message[];
    isStreaming: boolean;
    isLoading: boolean;
    threadId: string;

    // ===== 面试上下文 =====
    resume: ResumeInfo | null;
    jobDescription: string;
    companyInfo: string;
    interviewProgress: InterviewProgress | null;
    maxQuestions: number;

    // ===== API 配置 =====
    apiConfig: ApiConfig;

    // ===== UI 状态 =====
    showAbilityProfile: boolean;

    // ===== 错误状态 =====
    apiError: string | null;

    // ===== 内部状态 =====
    _abortController: AbortController | null;
}

interface InterviewActions {
    // ===== 会话管理 =====
    fetchSessions: (status?: 'active' | 'completed' | 'archived', mode?: 'coach' | 'mock') => Promise<void>;
    selectSession: (sessionId: string) => Promise<void>;
    createNewSession: () => void;
    deleteSession: (sessionId: string) => Promise<boolean>;
    updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
    togglePinSession: (sessionId: string, pinned: boolean) => Promise<void>;

    // ===== 面试流程 =====
    setJobDescription: (jobDescription: string) => void;
    setCompanyInfo: (companyInfo: string) => void;
    setMaxQuestions: (maxQuestions: number) => void;
    uploadResume: (file: File) => Promise<void>;
    startInterview: () => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    stopStreaming: () => void;
    rollbackChat: (toIndex: number) => Promise<void>;

    // ===== 消息管理 =====
    clearMessages: () => void;
    restoreMessages: (messages: Message[]) => void;
    setInterviewProgress: (progress: InterviewProgress | null) => void;

    // ===== API 配置 =====
    addModel: (model: Omit<ModelConfig, 'id' | 'createdAt'>) => ModelConfig | null;
    updateModel: (id: string, updates: Partial<ModelConfig>) => boolean;
    deleteModel: (id: string) => boolean;
    setSmartModel: (id: string) => boolean;
    setFastModel: (id: string) => boolean;
    getSmartModel: () => ModelConfig | null;
    getFastModel: () => ModelConfig | null;
    isConfigured: () => boolean;
    getApiConfigForRequest: () => { smart: { api_key: string; base_url: string; model: string }; fast: { api_key: string; base_url: string; model: string } } | null;

    // ===== UI 状态 =====
    setShowAbilityProfile: (show: boolean) => void;

    // ===== 错误处理 =====
    setApiError: (error: string | null) => void;
    clearApiError: () => void;
}

type InterviewStore = InterviewState & InterviewActions;

// ============================================================================
// 辅助函数
// ============================================================================

function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

// ============================================================================
// Store 实现
// ============================================================================

export const useInterviewStore = create<InterviewStore>()(
    persist(
        (set, get) => ({
            // ===== 初始状态 =====
            sessions: [],
            currentSession: null,
            sessionLoading: false,
            messages: [],
            isStreaming: false,
            isLoading: false,
            threadId: uuidv4(),
            resume: null,
            jobDescription: '',
            companyInfo: '',
            interviewProgress: null,
            maxQuestions: 5,
            apiConfig: DEFAULT_API_CONFIG,
            showAbilityProfile: false,
            apiError: null,
            _abortController: null,

            // ===== 会话管理 Actions =====

            fetchSessions: async (status, mode) => {
                set({ sessionLoading: true });
                try {
                    const params = new URLSearchParams();
                    if (status) params.append('status', status);
                    if (mode) params.append('mode', mode);
                    params.append('limit', '50');

                    const response = await fetch(`${API_BASE_URL}/api/sessions/?${params}`, {
                        headers: { 'X-User-ID': getUserId() }
                    });
                    if (!response.ok) throw new Error('获取会话列表失败');

                    const data = await response.json();
                    set({ sessions: data.sessions });
                } catch (error) {
                    console.error('获取会话列表错误:', error);
                } finally {
                    set({ sessionLoading: false });
                }
            },

            selectSession: async (sessionId: string) => {
                set({ sessionLoading: true });
                try {
                    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
                        headers: { 'X-User-ID': getUserId() }
                    });
                    if (!response.ok) throw new Error('获取会话详情失败');

                    const data = await response.json();
                    const session = data.session as InterviewSession;

                    set({
                        currentSession: session,
                        threadId: session.session_id,
                        messages: session.messages || [],
                        jobDescription: session.metadata.job_description || '',
                        interviewProgress: {
                            current: session.metadata.question_count,
                            total: session.metadata.max_questions
                        },
                        maxQuestions: session.metadata.max_questions,
                        showAbilityProfile: false, // 选择会话时关闭能力画像
                    });
                } catch (error) {
                    console.error('获取会话详情错误:', error);
                } finally {
                    set({ sessionLoading: false });
                }
            },

            createNewSession: () => {
                set({
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
                    const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
                        method: 'DELETE',
                        headers: { 'X-User-ID': getUserId() }
                    });
                    if (!response.ok) throw new Error('删除会话失败');

                    const { currentSession, sessions } = get();
                    const isCurrentSession = currentSession?.session_id === sessionId;

                    // 更新会话列表
                    set({
                        sessions: sessions.filter(s => s.session_id !== sessionId),
                    });

                    // 如果删除的是当前会话，跳转到新建界面
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
                    const { sessions, currentSession } = get();

                    set({
                        sessions: sessions.map(s =>
                            s.session_id === sessionId ? { ...s, title, updated_at: data.session.updated_at } : s
                        ),
                        currentSession: currentSession?.session_id === sessionId
                            ? { ...currentSession, title, updated_at: data.session.updated_at }
                            : currentSession,
                    });
                } catch (error) {
                    console.error('更新标题错误:', error);
                }
            },

            togglePinSession: async (sessionId: string, pinned: boolean) => {
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

            // ===== 面试流程 Actions =====

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
                            original_name: data.filename, // 后端返回的是 filename，不是 original_name
                            content: data.text_content,  // 后端返回的是 text_content，不是 content
                        },
                    });
                } catch (error) {
                    console.error('上传简历错误:', error);
                    throw error;
                } finally {
                    set({ isLoading: false });
                }
            },

            startInterview: async () => {
                const { resume, jobDescription, companyInfo, threadId, maxQuestions, getApiConfigForRequest } = get();

                if (!resume) {
                    throw new Error('请先上传简历');
                }

                const apiConfig = getApiConfigForRequest();
                if (!apiConfig) {
                    throw new Error('请先配置 API');
                }

                set({ isLoading: true, messages: [] });

                // 1. 立即设置进度和当前会话（解决状态同步问题）
                const newThreadId = uuidv4();
                set({
                    threadId: newThreadId,
                    interviewProgress: { current: 0, total: maxQuestions },
                    currentSession: {
                        session_id: newThreadId,
                        title: '新模拟面试',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        metadata: {
                            mode: 'mock',
                            question_count: 0,
                            max_questions: maxQuestions,
                            status: 'active',
                        },
                        messages: [],
                    },
                });

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
                    let chunkCount = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        chunkCount++;

                        if (done) {
                            // 处理 buffer 中剩余的数据
                            if (buffer.trim()) {
                                // 尝试直接解析为 JSON（后端当前实现）
                                try {
                                    const data = JSON.parse(buffer);
                                    if (data.first_question) {
                                        // 处理启动面试的响应
                                        set({
                                            messages: [{
                                                role: 'ai',
                                                content: data.first_question,
                                                timestamp: new Date().toISOString(),
                                            }],
                                            isStreaming: false,
                                            isLoading: false,
                                        });

                                    }
                                } catch (jsonError) {
                                    // 如果不是 JSON，尝试作为 SSE 格式处理
                                    if (buffer.startsWith('data: ')) {
                                        try {
                                            const data = JSON.parse(buffer.slice(6));

                                            if (data.type === 'token' || data.type === 'content') {
                                                currentAiMessage += data.content || '';
                                                set(state => {
                                                    const messages = [...state.messages];
                                                    const lastMsg = messages[messages.length - 1];
                                                    if (lastMsg && lastMsg.role === 'ai') {
                                                        lastMsg.content = currentAiMessage;
                                                    } else {
                                                        messages.push({
                                                            role: 'ai',
                                                            content: currentAiMessage,
                                                            timestamp: new Date().toISOString(),
                                                        });
                                                    }
                                                    return { messages };
                                                });
                                            }
                                        } catch (e) {
                                        }
                                    } else {
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
                                            if (lastMsg && lastMsg.role === 'ai') {
                                                lastMsg.content = currentAiMessage;
                                            } else {
                                                messages.push({
                                                    role: 'ai',
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
                                        } catch (e) {
                                        }
                                    } else if (data.type === 'error') {
                                        // 处理 SSE error 事件
                                        console.error('收到 SSE 错误:', data.content);
                                        let errorMessage = data.content || 'AI 响应失败';
                                        if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
                                            errorMessage = 'API Key 无效，请检查配置';
                                        } else if (errorMessage.includes('404')) {
                                            errorMessage = '模型不存在或 API 地址错误';
                                        }
                                        set({ apiError: errorMessage });
                                    } else {

                                    }
                                } catch (e) {

                                }
                            } else if (line.trim()) {

                            }
                        }
                    }

                    // 刷新会话列表
                    await get().fetchSessions('active', 'mock');

                } catch (error) {
                    if ((error as Error).name !== 'AbortError') {
                        console.error('启动面试错误:', error);
                        // 解析错误信息并反馈给用户
                        let errorMessage = '启动面试失败，请重试';
                        const errorStr = (error as Error).message || '';

                        // 尝试解析后端返回的 JSON 错误
                        try {
                            const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const errorJson = JSON.parse(jsonMatch[0]);
                                if (errorJson.message) {
                                    errorMessage = errorJson.message;
                                }
                            }
                        } catch {
                        }

                        set({ apiError: errorMessage });
                        throw error;
                    }
                } finally {
                    set({ isStreaming: false, isLoading: false, _abortController: null });
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
                                            if (lastMsg && lastMsg.role === 'ai') {
                                                lastMsg.content = currentAiMessage;
                                            } else {
                                                messages.push({
                                                    role: 'ai',
                                                    content: currentAiMessage,
                                                    timestamp: new Date().toISOString(),
                                                });
                                            }
                                            return { messages };
                                        });
                                    } else if (data.type === 'state_update') {
                                        // 后端发送的是 state_update，内容是 JSON 字符串
                                        try {
                                            const stateData = JSON.parse(data.content);
                                            if (stateData.question_count !== undefined) {
                                                const questionCount = stateData.question_count;
                                                const maxQs = stateData.max_questions || get().maxQuestions;

                                                set((state) => ({
                                                    interviewProgress: {
                                                        current: questionCount,
                                                        total: maxQs,
                                                    },
                                                    // 当问题数达到最大值时，更新会话状态为 completed
                                                    currentSession: state.currentSession && questionCount >= maxQs
                                                        ? {
                                                            ...state.currentSession,
                                                            metadata: {
                                                                ...state.currentSession.metadata,
                                                                status: 'completed',
                                                                question_count: questionCount,
                                                            },
                                                        }
                                                        : state.currentSession,
                                                }));
                                            }
                                        } catch (e) {
                                        }
                                    } else if (data.type === 'error') {
                                        // 处理 SSE error 事件
                                        console.error('收到 SSE 错误:', data.content);
                                        let errorMessage = data.content || 'AI 响应失败';
                                        if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized')) {
                                            errorMessage = 'API Key 无效，请检查配置';
                                        } else if (errorMessage.includes('404')) {
                                            errorMessage = '模型不存在或 API 地址错误';
                                        }
                                        set({ apiError: errorMessage });
                                    }
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            }
                        }
                    }

                } catch (error) {
                    if ((error as Error).name !== 'AbortError') {
                        console.error('发送消息错误:', error);
                        let errorMessage = '发送消息失败，请重试';
                        const errorStr = (error as Error).message || '';

                        // 尝试解析后端返回的 JSON 错误
                        try {
                            const jsonMatch = errorStr.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const errorJson = JSON.parse(jsonMatch[0]);
                                if (errorJson.message) {
                                    errorMessage = errorJson.message;
                                }
                            }
                        } catch {
                            // 解析失败，使用通用提示
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
                    set((state) => ({
                        messages: messages.slice(0, toIndex),
                        currentSession: state.currentSession
                            ? {
                                ...state.currentSession,
                                metadata: {
                                    ...state.currentSession.metadata,
                                    status: 'active',
                                },
                            }
                            : null,
                    }));
                } catch (error) {
                    console.error('回退错误:', error);
                    throw error;
                }
            },

            // ===== 消息管理 Actions =====

            clearMessages: () => set({ messages: [] }),

            restoreMessages: (messages: Message[]) => set({ messages }),

            setInterviewProgress: (progress: InterviewProgress | null) => set({ interviewProgress: progress }),

            // ===== API 配置 Actions =====

            addModel: (modelData) => {
                const { apiConfig } = get();
                const newModel: ModelConfig = {
                    ...modelData,
                    id: uuidv4(),
                    createdAt: new Date().toISOString(),
                };

                const newConfig = {
                    ...apiConfig,
                    models: [...apiConfig.models, newModel],
                };

                // 如果是第一个模型，自动设为 Smart 和 Fast
                if (apiConfig.models.length === 0) {
                    newConfig.smartModelId = newModel.id;
                    newConfig.fastModelId = newModel.id;
                }

                set({ apiConfig: newConfig });
                return newModel;
            },

            updateModel: (id, updates) => {
                const { apiConfig } = get();
                const modelIndex = apiConfig.models.findIndex(m => m.id === id);
                if (modelIndex === -1) return false;

                const updatedModels = [...apiConfig.models];
                updatedModels[modelIndex] = { ...updatedModels[modelIndex], ...updates };

                set({ apiConfig: { ...apiConfig, models: updatedModels } });
                return true;
            },

            deleteModel: (id) => {
                const { apiConfig } = get();
                const newConfig = {
                    ...apiConfig,
                    models: apiConfig.models.filter(m => m.id !== id),
                    smartModelId: apiConfig.smartModelId === id ? '' : apiConfig.smartModelId,
                    fastModelId: apiConfig.fastModelId === id ? '' : apiConfig.fastModelId,
                };

                set({ apiConfig: newConfig });
                return true;
            },

            setSmartModel: (id) => {
                const { apiConfig } = get();
                if (!apiConfig.models.find(m => m.id === id)) return false;
                set({ apiConfig: { ...apiConfig, smartModelId: id } });
                return true;
            },

            setFastModel: (id) => {
                const { apiConfig } = get();
                if (!apiConfig.models.find(m => m.id === id)) return false;
                set({ apiConfig: { ...apiConfig, fastModelId: id } });
                return true;
            },

            getSmartModel: () => {
                const { apiConfig } = get();
                return apiConfig.models.find(m => m.id === apiConfig.smartModelId) || null;
            },

            getFastModel: () => {
                const { apiConfig } = get();
                return apiConfig.models.find(m => m.id === apiConfig.fastModelId) || null;
            },

            isConfigured: () => {
                const { apiConfig } = get();
                const smartModel = apiConfig.models.find(m => m.id === apiConfig.smartModelId);
                const fastModel = apiConfig.models.find(m => m.id === apiConfig.fastModelId);
                return !!(smartModel?.apiKey && fastModel?.apiKey);
            },

            getApiConfigForRequest: () => {
                const smartModel = get().getSmartModel();
                const fastModel = get().getFastModel();

                if (!smartModel || !fastModel) return null;

                return {
                    smart: {
                        api_key: smartModel.apiKey,
                        base_url: smartModel.baseUrl,
                        model: smartModel.model,
                    },
                    fast: {
                        api_key: fastModel.apiKey,
                        base_url: fastModel.baseUrl,
                        model: fastModel.model,
                    },
                };
            },

            // ===== UI 状态 Actions =====

            setShowAbilityProfile: (show: boolean) => set({ showAbilityProfile: show }),

            // ===== 错误处理 Actions =====

            setApiError: (error: string | null) => set({ apiError: error }),
            clearApiError: () => set({ apiError: null }),
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

// ============================================================================
// 导出辅助函数
// ============================================================================

export { maskApiKey };
