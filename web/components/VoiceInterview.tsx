import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Disc, Play, Pause, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { toast } from 'sonner';
import { useInterviewStore } from '@/store/useInterviewStore';
import { getUserId } from '@/hooks/useUserIdentity';
import { saveAudioLocally, getAudioUrl } from '@/lib/audioStorage';
import { cn } from '@/lib/utils';
import { PreparingInterview } from './interview/PreparingInterview';

interface VoiceInterviewProps {
    sessionId: string;
    onEnd: () => void;
}

export function VoiceInterview({ sessionId, onEnd }: VoiceInterviewProps) {
    const [status, setStatus] = useState<'initializing' | 'listening' | 'speaking' | 'processing' | 'idle'>('initializing');
    const [isMuted, setIsMuted] = useState(false);

    // 使用 Zustand store 管理语音面试状态
    const voiceHistory = useInterviewStore(state => state.voiceHistory);
    const voiceSystemPrompt = useInterviewStore(state => state.voiceSystemPrompt);
    const setVoiceHistory = useInterviewStore(state => state.setVoiceHistory);
    const appendVoiceMessage = useInterviewStore(state => state.appendVoiceMessage);
    const updateLastVoiceMessage = useInterviewStore(state => state.updateLastVoiceMessage);
    const setVoiceSystemPrompt = useInterviewStore(state => state.setVoiceSystemPrompt);
    const setInitializing = useInterviewStore((state) => state.setInitializing);
    const fetchSessions = useInterviewStore((state) => state.fetchSessions);

    // 追踪是否在等待播放完成后启动录音
    const waitingForPlaybackRef = useRef(false);
    // 新增：追踪面试是否即将结束（等待播放完）
    const isInterviewEndPendingRef = useRef(false);
    // 用于中断正在进行的网络请求 (SSE)
    const abortControllerRef = useRef<AbortController | null>(null);

    // 1. Hook
    const {
        isRecording,
        audioLevel,
        startRecording,
        stopRecording,
        playAudio,
        playPcmData,
        resetPcmState,
        setStreamEnded
    } = useVoiceChat({
        onAudioInput: handleUserAudio,
        isProcessing: status === 'processing',
        isMuted: isMuted,
        onVADStatusChange: (vadStatus) => {
            // 使用函数式更新来避免闭包陷阱，确保获取最新状态
            setStatus(prevStatus => {
                // 如果是初始化状态，只允许切换到 listening (播放结束) 或 idle
                if (prevStatus === 'initializing') {
                    if (vadStatus === 'listening' || vadStatus === 'idle') {
                        return vadStatus;
                    }
                    return prevStatus;
                }

                // 如果面试即将结束，锁定状态，不让其变为 listening
                if (isInterviewEndPendingRef.current) {
                    return prevStatus; // 保持当前状态（通常是 idle 或 processing）
                }

                return vadStatus;
            });
        },
        onPlaybackComplete: () => {
            // 当音频播放完成时，检查是否需要启动录音
            if (waitingForPlaybackRef.current) {
                console.log('[VoiceInterview] 音频播放完成，现在启动录音');
                waitingForPlaybackRef.current = false;
                startRecording();
                setStatus('listening');
            }

            // 新增：检查是否需要结束面试
            if (isInterviewEndPendingRef.current) {
                console.log('[VoiceInterview] 结束语播放完成，跳转回顾界面');
                handleHangUp();
            }
        }
    });

    // 2. 初始化：规划面试
    const hasInitialized = useRef(false);

    // 挂断并同步数据
    const handleHangUp = async () => {
        try {
            // 只停止录音和音频播放，不中断 SSE 流，让数据继续接收完成
            stopRecording();
            // 在退出前强制同步一次会话详情，确保回顾界面有最新消息
            await useInterviewStore.getState().selectSession(sessionId);
        } catch (error) {
            console.error('[VoiceInterview] 同步会话失败:', error);
        } finally {
            onEnd();
        }
    };

    useEffect(() => {
        const initSession = async () => {
            if (hasInitialized.current) return;
            hasInitialized.current = true;

            // 初始化 AbortController
            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();
            const signal = abortControllerRef.current.signal;

            try {
                const apiConfig = useInterviewStore.getState().getApiConfigForRequest(); // 获取配置
                if (!apiConfig || !apiConfig.voice) {
                    toast.error('请先在设置中配置语音模型 (Voice)');
                    onEnd();
                    return;
                }

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/voice/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': getUserId()
                    },
                    signal, // 绑定 signal
                    body: JSON.stringify({
                        thread_id: sessionId,
                        mode: 'mock',  // 必填字段
                        api_config: apiConfig,
                        // 传入面试上下文，支持独立启动
                        resume_content: useInterviewStore.getState().resume?.content,
                        resume_filename: useInterviewStore.getState().resume?.filename,
                        job_description: useInterviewStore.getState().jobDescription,
                        company_info: useInterviewStore.getState().companyInfo,
                        max_questions: useInterviewStore.getState().maxQuestions
                    })
                });

                if (signal.aborted) return; // 检查是否已中断
                if (!response.ok) throw new Error('初始化失败');

                const data = await response.json();
                if (signal.aborted) return;

                // 如果后端返回了新的 Session ID (克隆/切换场景)，同步更新 store
                if (data.session_id && data.session_id !== sessionId) {
                    console.info(`[VoiceInterview] 检测到 Session 变更 (文字->语音切换): ${sessionId} -> ${data.session_id}`);
                    // 使用 useInterviewStore.setState 直接更新，并更新对应的 currentSession
                    useInterviewStore.setState({ threadId: data.session_id });
                    // 重新选择会话以确保 metadata 等信息同步
                    await useInterviewStore.getState().selectSession(data.session_id);
                }
                if (signal.aborted) return;

                // 恢复进度
                if (data.question_count !== undefined) {
                    useInterviewStore.getState().setInterviewProgress({
                        current: data.question_count + 1, // 后端存的是索引(0-based)，前端展示需要 1-based
                        total: data.max_questions || useInterviewStore.getState().maxQuestions
                    });
                }

                // 恢复历史记录
                const hasExistingHistory = data.history && Array.isArray(data.history) && data.history.length > 0;
                if (hasExistingHistory) {
                    console.log(`[VoiceInterview] 恢复历史消息: ${data.history.length} 条`);
                    setVoiceHistory(data.history);
                }

                // 初始化完成，关闭全局加载状态（在开始生成开场白之前就切换界面）
                setInitializing(false);

                // 刷新侧边栏会话列表，让新创建的会话立即显示
                fetchSessions();

                // 判断是否是"继续面试"场景
                // 如果已有历史记录，说明用户是从回顾界面点击"继续面试"，不需要再生成开场白
                if (hasExistingHistory) {
                    console.log('[VoiceInterview] 检测到已有历史记录，跳过开场白，直接进入录音状态');
                    startRecording();
                    setStatus('listening');
                    return; // 早退
                }

                if (signal.aborted) return;

                // 使用流式方式生成开场白音频
                console.log('[VoiceInterview] 初始化完成，开始流式生成开场白...');
                if (data.greeting_text) {
                    // 设置标志，等待音频播放完成后再启动录音
                    waitingForPlaybackRef.current = true;
                    // 调用 sendToOmni 来流式生成开场白
                    await sendToOmniForGreeting(apiConfig, data.system_prompt, data.greeting_text);
                    console.log('[VoiceInterview] 开场白 SSE 流结束，等待音频播放完成...');
                } else {
                    // 没有开场白时直接启动录音
                    startRecording();
                    setStatus('listening');
                }

            } catch (error: any) {
                if (error.name === 'AbortError') return;
                console.error(error);
                toast.error('无法启动语音面试');
                hasInitialized.current = false;
                setInitializing(false); // 发生错误也要重置状态
                handleHangUp();
            }
        };

        if (status === 'initializing') {
            initSession();
        }

        // 清理函数：组件卸载时中断所有进行中的网络请求
        return () => {
            console.log('[VoiceInterview] 组件卸载，清理资源...');
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            // 重置标志位，确保下次挂载时可以正确初始化
            hasInitialized.current = false;
            waitingForPlaybackRef.current = false;
            isInterviewEndPendingRef.current = false;
        };
    }, [sessionId]);


    // 3. 发送音频/文本给 Omni (SSE 流式接收)
    async function sendToOmni(
        apiConfig: any,
        prompt: string,
        chatHistory: any[],
        audioBlob: Blob | null,
        textMessage: string | null = null
    ) {
        console.log('[VoiceInterview] sendToOmni 被调用, chatHistory长度:', chatHistory.length, 'transcript:', textMessage);
        setStatus('processing');
        resetPcmState(); // 重置 PCM 播放状态

        try {
            let audioBase64 = null;
            let audioId: string | null = null;

            if (audioBlob) {
                // 将音频保存到浏览器 IndexedDB
                try {
                    audioId = await saveAudioLocally(sessionId, audioBlob);
                    console.log(`[VoiceInterview] 音频已保存到本地: ${audioId}`);
                } catch (e) {
                    console.warn('[VoiceInterview] 本地音频保存失败:', e);
                }

                // 转换为 base64 发送给后端（用于 Omni 理解）
                audioBase64 = await blobToBase64(audioBlob);
            }

            // 先更新 store 历史记录（添加用户消息和 AI 占位）
            // 显示转录文本，如果没有转录则显示 [语音]
            const userDisplayContent = textMessage || '[语音]';
            const newHistory = [...chatHistory];
            if (audioBlob || textMessage) {
                newHistory.push({
                    role: 'user',
                    content: userDisplayContent,
                    timestamp: new Date().toISOString(),
                    audio_url: audioId || undefined  // 关联本地音频 ID
                });
            }
            newHistory.push({ role: 'assistant', content: '', timestamp: new Date().toISOString() }); // AI 占位
            setVoiceHistory(newHistory);

            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/voice/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    session_id: sessionId,
                    api_config: apiConfig,
                    system_prompt: prompt,
                    history: chatHistory,  // 只发送之前的历史，当前用户输入通过 audio/message 参数发送
                    audio: audioBase64,
                    message: textMessage,  // 浏览器语音识别的文本
                    audio_id: audioId  // 本地音频 ID，后端只存储引用
                })
            });

            if (!response.ok) {
                throw new Error('请求失败');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            if (!reader) {
                throw new Error('无法读取响应流');
            }

            console.log('[VoiceInterview] 开始读取流...');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const textChunk = decoder.decode(value, { stream: true });
                buffer += textChunk;

                // 处理完整的 SSE 消息 (以 \n\n 分隔)
                while (true) {
                    const newlineIndex = buffer.indexOf('\n\n');
                    if (newlineIndex === -1) break;

                    const messageBlock = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 2); // 跳过 \n\n

                    const lines = messageBlock.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6);
                                const data = JSON.parse(jsonStr);

                                if (data.type === 'text') {
                                    // 流式更新文本（累积到最后一条 assistant 消息）
                                    fullText += data.content;
                                    updateLastVoiceMessage(fullText);
                                } else if (data.type === 'audio') {
                                    // 播放 PCM 音频分片
                                    playPcmData(data.content);
                                    // 状态保持 idle，直到播放结束（由 setStreamEnded 触发）
                                    setStatus(prev => prev !== 'idle' ? 'idle' : prev);
                                } else if (data.type === 'progress') {
                                    // 更新全局进度状态
                                    const state = useInterviewStore.getState();
                                    useInterviewStore.getState().setInterviewProgress({
                                        current: data.current,
                                        total: state.interviewProgress?.total || state.maxQuestions
                                    });
                                } else if (data.type === 'complete') {
                                    // 面试官表示面试已结束
                                    console.log('[VoiceInterview] 面试已完成，等待语音播放结束...');
                                    toast.success('面试已顺利结束');
                                    isInterviewEndPendingRef.current = true;

                                    // 安全兜底：如果15秒后还没跳转，强制跳转
                                    setTimeout(() => {
                                        if (isInterviewEndPendingRef.current) {
                                            console.warn('[VoiceInterview] 播放结束回调超时，强制跳转');
                                            handleHangUp();
                                        }
                                    }, 15000);
                                } else if (data.type === 'done') {
                                    console.log('[VoiceInterview] 响应完成, text:', fullText.length);
                                    setStreamEnded();
                                } else if (data.type === 'error') {
                                    console.error('[VoiceInterview] Server Error:', data.message);
                                    toast.error(data.message || 'AI 响应失败');
                                    setStatus('listening');
                                }
                            } catch (parseError) {
                                console.warn('解析 SSE 数据失败:', parseError);
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error(error);
            toast.error('发送失败，请重试');
            setStatus('listening');
        }
    }

    // 专门用于开场白的流式生成（在初始化时调用）
    async function sendToOmniForGreeting(
        apiConfig: any,
        prompt: string,
        greetingText: string
    ) {
        setStatus('processing');
        resetPcmState();

        try {
            // 获取当前已恢复的历史记录（不要重置它！）
            const currentHistory = useInterviewStore.getState().voiceHistory;
            const newHistory = [...currentHistory, { role: 'assistant' as const, content: '', timestamp: new Date().toISOString() }];
            setVoiceHistory(newHistory);

            if (abortControllerRef.current) abortControllerRef.current.abort();
            abortControllerRef.current = new AbortController();

            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/voice/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortControllerRef.current.signal,
                body: JSON.stringify({
                    session_id: sessionId,
                    api_config: apiConfig,
                    system_prompt: prompt,
                    history: [],  // 开场白没有历史记录
                    audio: null,
                    message: greetingText,  // 使用开场白文本作为输入
                    is_greeting: true  // 告诉后端这是开场白模式，直接 TTS
                })
            });

            if (!response.ok) {
                throw new Error('开场白生成失败');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';

            if (!reader) {
                throw new Error('无法读取响应流');
            }

            console.log('[VoiceInterview] 开始流式生成开场白...');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const textChunk = decoder.decode(value, { stream: true });
                buffer += textChunk;

                // 处理完整的 SSE 消息
                while (true) {
                    const newlineIndex = buffer.indexOf('\n\n');
                    if (newlineIndex === -1) break;

                    const messageBlock = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 2);

                    const lines = messageBlock.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const jsonStr = line.slice(6);
                                const data = JSON.parse(jsonStr);

                                if (data.type === 'text') {
                                    fullText += data.content;
                                    setVoiceHistory([{ role: 'assistant', content: fullText, timestamp: new Date().toISOString() }]);
                                } else if (data.type === 'audio') {
                                    playPcmData(data.content);
                                    setStatus(prev => prev !== 'idle' ? 'idle' : prev);
                                } else if (data.type === 'done') {
                                    console.log('[VoiceInterview] 开场白生成完成, text:', fullText.length);
                                    setStreamEnded();
                                } else if (data.type === 'error') {
                                    console.error('[VoiceInterview] 开场白生成错误:', data.message);
                                    toast.error(data.message || '开场白生成失败');
                                    setStatus('listening');
                                }
                            } catch (parseError) {
                                console.warn('解析 SSE 数据失败:', parseError);
                            }
                        }
                    }
                }
            }

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            console.error(error);
            toast.error('开场白生成失败');
            setStatus('listening');
        }
    }

    // 处理用户语音输入
    async function handleUserAudio(audioBlob: Blob, transcript?: string) {
        if (isMuted) return;

        const apiConfig = useInterviewStore.getState().getApiConfigForRequest();
        if (!apiConfig) return;

        // 使用 getState() 获取最新值，避免闭包问题
        const latestHistory = useInterviewStore.getState().voiceHistory;
        const latestPrompt = useInterviewStore.getState().voiceSystemPrompt;

        console.log(`[VoiceInterview] Audio captured. Transcript: "${transcript || ''}"`);

        await sendToOmni(apiConfig, latestPrompt, latestHistory, audioBlob, transcript);
    }

    // Helper
    function blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // UI 渲染（保持不变）
    const statusText: Record<string, string> = {
        'initializing': '正在连接面试官...',
        'listening': isMuted ? '已静音' : '面试官正在听...',
        'speaking': '你正在说话...',
        'processing': '面试官正在思考...',
        'idle': '...'
    };

    // 控制哪些用户语音消息显示文字记录
    const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());
    const toggleMessageExpansion = (idx: number) => {
        setExpandedMessages(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    // 音频播放相关
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);
    const userAudioRef = useRef<HTMLAudioElement | null>(null);

    const handlePlayUserAudio = async (e: React.MouseEvent, audioId?: string) => {
        e.stopPropagation();
        if (!audioId) return;

        if (playingAudioId === audioId && userAudioRef.current) {
            userAudioRef.current.pause();
            setPlayingAudioId(null);
            return;
        }

        setIsLoadingAudio(true);
        try {
            const url = await getAudioUrl(audioId);
            if (!url) {
                toast.error('找不到音频文件');
                setIsLoadingAudio(false);
                return;
            }

            if (userAudioRef.current) {
                userAudioRef.current.pause();
            }

            const audio = new Audio(url);
            userAudioRef.current = audio;
            setPlayingAudioId(audioId);

            audio.onplay = () => setIsLoadingAudio(false);
            audio.onended = () => {
                setPlayingAudioId(null);
                URL.revokeObjectURL(url);
            };
            audio.onerror = () => {
                setPlayingAudioId(null);
                setIsLoadingAudio(false);
                toast.error('播放失败');
            };

            await audio.play();
        } catch (err) {
            console.error('播放用户音频失败:', err);
            setIsLoadingAudio(false);
            setPlayingAudioId(null);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [voiceHistory]);


    // 获取面试进度
    const interviewProgress = useInterviewStore(state => state.interviewProgress);
    const maxQuestions = useInterviewStore(state => state.maxQuestions);

    // 计算显示用的当前索引和总数
    const currentQ = interviewProgress?.current || 1;
    const totalQ = interviewProgress?.total || maxQuestions;
    const progressPercent = Math.min(100, Math.max(0, (currentQ / totalQ) * 100));

    return (
        <div className="flex h-full w-full bg-[#0a0c10] text-white relative overflow-hidden font-sans">
            {/* 动态背景：深蓝色和紫色渐变的光晕 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-indigo-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }}></div>
            </div>

            {/* 顶部导航/状态栏 */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-50">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                            "w-2 h-2 rounded-full",
                            status === 'listening' ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                                status === 'processing' ? "bg-amber-500 animate-pulse" : "bg-blue-500"
                        )}></div>
                        <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
                            Interview Session
                        </span>
                    </div>
                    <h2 className="text-lg font-medium text-white/90">AI 语音面试官</h2>
                </div>

                {/* 进度提示 */}
                {interviewProgress && (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl flex items-center gap-4 transition-all duration-500">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">面试进度</span>
                            <span className="text-sm font-mono font-bold text-indigo-300">
                                {currentQ} / {totalQ}
                            </span>
                        </div>
                        <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-1000 ease-out"
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* 中央核心区域：语音球 */}
            <div className="flex-1 flex flex-col items-center justify-center relative z-20 px-6 pb-40">

                {/* 语音球容器 - 略微上移以给文字留空间 */}
                <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center -mt-12">

                    {/* 背景光波纹 */}
                    {(status === 'speaking' || status === 'listening' || status === 'processing') && (
                        <>
                            {/* 面试官说话时的圆形波纹动效 (仅在 listening 且有内容时更明显) */}
                            {status === 'listening' && (
                                <>
                                    <div className="absolute inset-[-20%] rounded-full bg-indigo-500/10 animate-ripple"></div>
                                    <div className="absolute inset-[-40%] rounded-full bg-indigo-500/5 animate-ripple" style={{ animationDelay: '1s' }}></div>
                                    <div className="absolute inset-[-60%] rounded-full bg-indigo-500/5 animate-ripple" style={{ animationDelay: '2s' }}></div>
                                </>
                            )}

                            <div className={cn(
                                "absolute inset-0 rounded-full bg-indigo-500/10 animate-ping-slow",
                                status === 'speaking' && "bg-green-500/10"
                            )}></div>
                            <div className={cn(
                                "absolute inset-[-10%] rounded-full bg-purple-500/5 animate-pulse-slow",
                                status === 'processing' && "bg-amber-500/5"
                            )} style={{ animationDelay: '1s' }}></div>
                        </>
                    )}

                    {/* 主语音球 */}
                    <div className={cn(
                        "relative w-40 h-40 md:w-52 md:h-52 rounded-full flex items-center justify-center transition-all duration-700 shadow-[0_0_50px_rgba(79,70,229,0.3)]",
                        status === 'initializing' ? "scale-90 opacity-50" : "scale-100 opacity-100",
                        status === 'listening' ? "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600" :
                            status === 'speaking' ? "bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600" :
                                status === 'processing' ? "bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600" :
                                    "bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
                    )}>

                        {/* 中心图标/波纹 */}
                        <div className="relative z-10">
                            {status === 'processing' ? (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-6 bg-white/80 rounded-full animate-wave" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-10 bg-white/80 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></div>
                                    <div className="w-1.5 h-14 bg-white/80 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-1.5 h-10 bg-white/80 rounded-full animate-wave" style={{ animationDelay: '0.3s' }}></div>
                                    <div className="w-1.5 h-6 bg-white/80 rounded-full animate-wave" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            ) : status === 'speaking' ? (
                                <div className="flex items-center gap-1.5">
                                    {[...Array(5)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-1.5 bg-white/90 rounded-full transition-all duration-100"
                                            style={{ height: `${Math.max(8, (audioLevel / 100) * 60 * (1 - Math.abs(2 - i) * 0.2))}px` }}
                                        ></div>
                                    ))}
                                </div>
                            ) : status === 'initializing' ? (
                                <Loader2 className="w-12 h-12 text-white/40 animate-spin" />
                            ) : (
                                <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
                                    <div className="w-4 h-4 rounded-full bg-white/80 animate-pulse"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 状态文本 */}
                <div className="mt-6 text-center px-6 max-w-2xl">
                    <p className="text-white/40 text-[10px] font-bold tracking-[0.2em] uppercase mb-4 animate-pulse">
                        {statusText[status]}
                    </p>

                    {/* 电影感字幕：最后一句话 */}
                    <div className="min-h-[100px] flex items-start justify-center overflow-y-auto max-h-[30vh] custom-scrollbar">
                        {status === 'initializing' ? (
                            <div className="animate-in fade-in duration-700">
                                <PreparingInterview variant="dark" />
                            </div>
                        ) : (
                            <p className={cn(
                                "text-base md:text-lg font-normal leading-loose text-white/90 tracking-wide transition-all duration-500 drop-shadow-sm",
                                status === 'processing' ? "opacity-30 blur-[0.5px]" : "opacity-100 blur-0"
                            )}>
                                {voiceHistory.length > 0 && voiceHistory[voiceHistory.length - 1].role === 'assistant'
                                    ? voiceHistory[voiceHistory.length - 1].content
                                    : voiceHistory.length > 1 && voiceHistory[voiceHistory.length - 2].role === 'assistant'
                                        ? voiceHistory[voiceHistory.length - 2].content
                                        : "准备好开始面试了吗？"}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* 底部控制栏 */}
            <div className="absolute bottom-0 left-0 w-full p-8 flex flex-col items-center z-50">
                <div className="bg-white/5 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[32px] flex items-center gap-8 shadow-2xl">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={cn(
                            "group flex flex-col items-center gap-1.5 transition-all outline-none",
                            isMuted ? "text-red-400" : "text-white/60 hover:text-white"
                        )}
                    >
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                            isMuted ? "bg-red-500/10" : "group-hover:bg-white/5"
                        )}>
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-tighter">
                            {isMuted ? '取消静音' : '静音'}
                        </span>
                    </button>

                    <button
                        onClick={handleHangUp}
                        className="group flex flex-col items-center gap-1.5 transition-all outline-none"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95 transition-all">
                            <PhoneOff className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-[10px] text-white/60 uppercase font-bold tracking-tighter">
                            结束面试
                        </span>
                    </button>

                    <button
                        className="group flex flex-col items-center gap-1.5 text-white/20 hover:text-white transition-all outline-none"
                        onClick={() => {
                            // 快捷查看对话记录 (逻辑可后续增强)
                            toast.info("正在录制您的面试过程...");
                        }}
                    >
                        <div className="w-12 h-12 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-all">
                            <Disc className={cn("w-5 h-5", status === 'processing' && "animate-spin-slow")} />
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-tighter">
                            录制中
                        </span>
                    </button>
                </div>

                {/* 底部微小装饰器 - 匹配用户图片中的 ... */}
                <div className="mt-8 flex gap-1.5 opacity-40">
                    <div className="w-1.5 h-1 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1 bg-white rounded-full"></div>
                    <div className="w-1.5 h-1 bg-white rounded-full"></div>
                </div>
            </div>

            <style jsx>{`
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 0; }
                    20% { opacity: 0.5; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .animate-ripple { animation: ripple 4s cubic-bezier(0, 0, 0.2, 1) infinite; }

                @keyframes wave {
                    0%, 100% { height: 8px; transform: scaleY(1); opacity: 0.5; }
                    50% { height: 32px; transform: scaleY(1.2); opacity: 1; }
                }
                .animate-wave { animation: wave 1s ease-in-out infinite; }
                
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1); opacity: 0.1; }
                    50% { transform: scale(1.1); opacity: 0.2; }
                }
                .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }

                @keyframes ping-slow {
                    0% { transform: scale(1); opacity: 0.4; }
                    70%, 100% { transform: scale(1.5); opacity: 0; }
                }
                .animate-ping-slow { animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow { animation: spin-slow 12s linear infinite; }
                
                .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
            `}</style>
        </div>
    );
}
