import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

// 消息角色类型
export type Role = 'user' | 'ai' | 'system';

// 消息接口
export interface Message {
    role: Role;
    content: string;
    isStreaming?: boolean;
}

// 简历信息接口
export interface ResumeInfo {
    filename: string;
    original_name: string;
    content: string;
}

// 面试模式类型
export type InterviewMode = 'mock' | 'coach';

// 面试聊天钩子属性接口
interface UseInterviewChatProps {
    initialMode?: InterviewMode;
}

// API基础URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useInterviewChat({ initialMode = 'coach' }: UseInterviewChatProps = {}) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [mode, setMode] = useState<InterviewMode>(initialMode);
    const [resume, setResume] = useState<ResumeInfo | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [threadId, setThreadId] = useState<string>("");

    // 初始化线程ID
    React.useEffect(() => {
        if (!threadId) {
            setThreadId(uuidv4());
        }
    }, [threadId]);

    const startInterview = useCallback(async (
        jobDescription: string,
        currentResume: ResumeInfo | null = resume,
        currentMode: InterviewMode = mode,
        currentThreadId: string = threadId
    ) => {
        if (!currentResume) return;

        setIsLoading(true);
        setMessages([]); // 新面试时清空消息

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread_id: currentThreadId,
                    resume_context: currentResume.content,
                    job_description: jobDescription,
                    mode: currentMode,
                    max_questions: 5
                })
            });

            if (!response.ok) throw new Error('启动面试失败');

            // 获取后端生成的标题（如果有返回）
            const data = await response.json();

            // 发送隐藏消息触发AI第一个问题
            await sendMessage("请根据我的简历和岗位描述开始面试，提出第一个问题。", true, currentThreadId, jobDescription);

        } catch (error) {
            console.error('启动面试时出错:', error);
            setMessages(prev => [...prev, { role: 'system', content: '启动面试会话失败。' }]);
        } finally {
            setIsLoading(false);
        }
    }, [resume, mode, threadId]);

    const sendMessage = useCallback(async (
        content: string,
        hidden: boolean = false,
        currentThreadId: string = threadId,
        currentJobDescription: string = ""
    ) => {
        if (isStreaming) return;

        if (!hidden) {
            setMessages(prev => [...prev, { role: 'user', content }]);
        }

        setIsStreaming(true);

        try {
            // 确保会话存在 - 先调用 /api/chat/start (如果需要确保状态)
            // 注意：通常startInterview已经调用过start，这里再次调用可能会重置状态？
            // 实际上 /api/chat/start 是幂等的吗？如果是"开始新会话"，可能不是。
            // 但这里我们假设 sendMessage 是在会话建立后调用的。
            // 为了安全，我们只调用 stream。如果后端需要状态，它应该从 thread_id 恢复。

            const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread_id: currentThreadId,
                    message: content,
                    resume_context: resume?.content || "",
                    job_description: currentJobDescription || "通用软件工程师",
                    mode: mode,
                    max_questions: 5
                })
            });

            if (!response.ok) throw new Error('发送消息失败');
            if (!response.body) throw new Error('无响应体');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiMessageContent = "";

            // 为AI消息添加占位符
            setMessages(prev => [...prev, { role: 'ai', content: '', isStreaming: true }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6);
                        if (dataStr === '[DONE]') continue;

                        try {
                            const data = JSON.parse(dataStr);
                            if (data.type === 'token') {
                                aiMessageContent += data.content;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMsg = newMessages[newMessages.length - 1];
                                    if (lastMsg.role === 'ai') {
                                        lastMsg.content = aiMessageContent;
                                    }
                                    return newMessages;
                                });
                            } else if (data.type === 'error') {
                                console.error('流错误:', data.content);
                            }
                        } catch (e) {
                            console.error('解析SSE数据时出错:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('发送消息时出错:', error);
            setMessages(prev => [...prev, { role: 'system', content: '发送消息失败，请重试。' }]);
        } finally {
            setIsStreaming(false);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                if (lastMsg.role === 'ai') {
                    lastMsg.isStreaming = false;
                }
                return newMessages;
            });
        }
    }, [resume, mode, threadId, isStreaming]);

    const uploadResume = useCallback(async (file: File) => {
        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/upload/resume`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('上传失败');

            const data = await response.json();
            const newResume = {
                filename: data.filename,
                original_name: file.name,
                content: data.text_content
            };
            setResume(newResume);

            // 移除系统提示消息
            // setMessages(prev => [...prev, { role: 'system', content: `简历"${file.name}"上传成功。您现在可以开始面试了。` }]);

        } catch (error) {
            console.error('上传简历时出错:', error);
            setMessages(prev => [...prev, { role: 'system', content: '上传简历失败。' }]);
        } finally {
            setIsLoading(false);
        }
    }, [mode]); // 移除startInterview依赖以避免循环依赖（如果我们不在这里调用它）

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    // 恢复消息历史
    const restoreMessages = useCallback((sessionMessages: any[]) => {
        const restoredMessages = sessionMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            isStreaming: false
        }));
        setMessages(restoredMessages);
    }, []);

    // 添加消息到当前会话
    const addMessage = useCallback((message: Message) => {
        setMessages(prev => [...prev, message]);
    }, []);

    const rollbackChat = useCallback(async (index: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/rollback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thread_id: threadId,
                    index: index
                })
            });

            if (!response.ok) throw new Error('回退失败');

            // 更新本地消息状态：删除index及之后的消息
            setMessages(prev => prev.slice(0, index));

        } catch (error) {
            console.error('回退会话时出错:', error);
        }
    }, [threadId]);

    return {
        messages,
        mode,
        setMode,
        resume,
        isStreaming,
        isLoading,
        sendMessage,
        uploadResume,
        startInterview,
        clearMessages,
        restoreMessages,
        addMessage,
        threadId,
        setThreadId,
        rollbackChat
    };
}
