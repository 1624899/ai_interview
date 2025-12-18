'use client';

import { useState, useRef, useCallback } from 'react';
import { Play, Pause, Volume2, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAudioUrl } from '@/lib/audioStorage';

interface DialogueMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
    audio_url?: string;  // 音频 URL 或本地 ID
}

interface DialogueReviewProps {
    messages: DialogueMessage[];
    className?: string;
}

/**
 * 对话回放组件
 * 显示语音面试的对话历史，支持回放用户录音
 */
export function DialogueReview({ messages, className }: DialogueReviewProps) {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // 播放/暂停音频
    const handlePlayAudio = useCallback(async (audioUrl: string) => {
        // 如果正在播放同一个音频，则暂停
        if (playingId === audioUrl && audioRef.current) {
            audioRef.current.pause();
            setPlayingId(null);
            return;
        }

        // 停止之前的音频
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        try {
            // 从 IndexedDB 或远程获取音频 URL
            const url = await getAudioUrl(audioUrl);
            if (!url) {
                console.warn(`[DialogueReview] 找不到音频: ${audioUrl}`);
                return;
            }

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                setPlayingId(null);
                // 释放 Object URL
                if (url.startsWith('blob:')) {
                    URL.revokeObjectURL(url);
                }
            };

            audio.onerror = () => {
                console.error('[DialogueReview] 音频播放失败');
                setPlayingId(null);
            };

            setPlayingId(audioUrl);
            await audio.play();
        } catch (error) {
            console.error('[DialogueReview] 播放音频出错:', error);
            setPlayingId(null);
        }
    }, [playingId]);

    // 格式化时间戳
    const formatTime = (timestamp?: string) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    return (
        <div className={cn('space-y-4', className)}>
            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={cn(
                        'flex gap-3 p-4 rounded-lg',
                        msg.role === 'user'
                            ? 'bg-blue-50 dark:bg-blue-950/30'
                            : 'bg-gray-50 dark:bg-gray-800/50'
                    )}
                >
                    {/* 头像 */}
                    <div
                        className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                            msg.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-emerald-500 text-white'
                        )}
                    >
                        {msg.role === 'user' ? (
                            <User className="w-4 h-4" />
                        ) : (
                            <Bot className="w-4 h-4" />
                        )}
                    </div>

                    {/* 内容区域 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {msg.role === 'user' ? '你' : 'AI 面试官'}
                            </span>
                            {msg.timestamp && (
                                <span className="text-xs text-gray-400">
                                    {formatTime(msg.timestamp)}
                                </span>
                            )}
                        </div>

                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {msg.content}
                        </p>

                        {/* 音频播放按钮 */}
                        {msg.role === 'user' && msg.audio_url && (
                            <div className="mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePlayAudio(msg.audio_url!)}
                                    className="gap-2"
                                >
                                    {playingId === msg.audio_url ? (
                                        <>
                                            <Pause className="w-4 h-4" />
                                            暂停
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4" />
                                            播放录音
                                        </>
                                    )}
                                    <Volume2 className="w-3 h-3 text-gray-400" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {messages.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    暂无对话记录
                </div>
            )}
        </div>
    );
}
