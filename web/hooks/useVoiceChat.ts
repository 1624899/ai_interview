import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface UseVoiceChatProps {
    onAudioInput?: (audioBlob: Blob, transcript?: string) => void;
    onVADStatusChange?: (status: 'listening' | 'speaking' | 'processing' | 'idle') => void;
    onPlaybackComplete?: () => void;  // 当所有音频播放完成时触发
    isProcessing?: boolean;
    isMuted?: boolean;
}

export function useVoiceChat({ onAudioInput, onVADStatusChange, onPlaybackComplete, isProcessing = false, isMuted = false }: UseVoiceChatProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0); // 0-100

    // 使用 Refs 来避免 event handler 中的 stale closure
    const onAudioInputRef = useRef(onAudioInput);
    const onVADStatusChangeRef = useRef(onVADStatusChange);
    const onPlaybackCompleteRef = useRef(onPlaybackComplete);
    const isMutedRef = useRef(isMuted);
    const internalProcessingRef = useRef(isProcessing);

    useEffect(() => { onAudioInputRef.current = onAudioInput; }, [onAudioInput]);
    useEffect(() => { onVADStatusChangeRef.current = onVADStatusChange; }, [onVADStatusChange]);
    useEffect(() => { onPlaybackCompleteRef.current = onPlaybackComplete; }, [onPlaybackComplete]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { internalProcessingRef.current = isProcessing; }, [isProcessing]);

    // Refs for Audio Context & Processor
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

    // Speech Recognition Refs
    const recognitionRef = useRef<any>(null);
    const transcriptBufferRef = useRef<string>('');  // 累积的 final transcript
    const interimTranscriptRef = useRef<string>(''); // 当前的 interim transcript（尚未确认）

    // VAD Refs
    const silenceStartRef = useRef<number | null>(null);
    const hasSpeechRef = useRef(false);
    const audioChunksRef = useRef<Float32Array[]>([]);

    // Audio Player Refs
    const audioQueueRef = useRef<string[]>([]);
    const isPlayingRef = useRef(false);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const isStoppingRef = useRef(false);

    // PCM Stream Refs
    const pcmNextStartTimeRef = useRef<number>(0);
    const pcmActiveCountRef = useRef<number>(0);
    const streamEndedRef = useRef(false);

    // 卸载时清理所有资源
    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, []);

    // Constants
    const VAD_THRESHOLD = 0.02;
    const SILENCE_DURATION = 1500;

    // 初始化音频环境
    const startRecording = useCallback(async () => {
        isStoppingRef.current = false; // 重置停止标志
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // AudioContext Setup
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(audioContext.destination);

            // Speech Recognition Setup
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'zh-CN'; // Default to Chinese

                recognition.onresult = (event: any) => {
                    // 如果静音，忽略识别结果
                    if (isMutedRef.current) return;

                    let currentInterim = '';

                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        const result = event.results[i];
                        const transcript = result[0].transcript;

                        if (result.isFinal) {
                            // Final 结果：追加到缓冲区
                            transcriptBufferRef.current += transcript;
                        } else {
                            // Interim 结果：保存最新的临时转录
                            currentInterim += transcript;
                        }
                    }

                    // 更新 interim ref（这是当前正在说的、还没确认的部分）
                    interimTranscriptRef.current = currentInterim;
                };

                // Handle errors or stops
                recognition.onerror = (event: any) => {
                    // console.warn('Speech recognition error', event.error);
                };

                recognition.onend = () => {
                    if (isRecording && !isStoppingRef.current) {
                        try { recognition.start(); } catch (e) { }
                    }
                };

                transcriptBufferRef.current = '';
                interimTranscriptRef.current = '';  // 重置 interim transcript
                recognition.start();
                recognitionRef.current = recognition;
            }

            processor.onaudioprocess = (e) => {
                // 如果在静音状态，清空音量显示，不处理 VAD
                if (isMutedRef.current) {
                    setAudioLevel(0);
                    // 如果之前正在说话，由于切换到静音，强制结束当前说话片段
                    if (hasSpeechRef.current) {
                        hasSpeechRef.current = false;
                        audioChunksRef.current = [];
                        onVADStatusChangeRef.current?.('listening');
                    }
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                setAudioLevel(Math.min(100, rms * 1000));

                if (isPlayingRef.current || internalProcessingRef.current) return;

                if (rms > VAD_THRESHOLD) {
                    if (!hasSpeechRef.current) {
                        hasSpeechRef.current = true;
                        onVADStatusChangeRef.current?.('speaking');
                        audioChunksRef.current = [];
                    }
                    silenceStartRef.current = null;
                } else {
                    if (hasSpeechRef.current) {
                        if (silenceStartRef.current === null) {
                            silenceStartRef.current = Date.now();
                        } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
                            stopRecordingAndSend();
                            return;
                        }
                    }
                }

                if (hasSpeechRef.current) {
                    audioChunksRef.current.push(new Float32Array(inputData));
                }
            };

            setIsRecording(true);
            onVADStatusChangeRef.current?.('listening');

        } catch (error) {
            console.error('无法启动录音:', error);
            toast.error('无法访问麦克风，请检查权限');
        }
    }, [isRecording]); // 移除 onVADStatusChange 依赖，改用 ref

    const stopRecordingAndSend = useCallback(async () => {
        // 静音防御：再次确认
        if (isMutedRef.current) {
            hasSpeechRef.current = false;
            audioChunksRef.current = [];
            return;
        }

        hasSpeechRef.current = false;
        silenceStartRef.current = null;
        internalProcessingRef.current = true;
        onVADStatusChangeRef.current?.('processing');

        // 合并 final transcript 和当前的 interim transcript
        // interim 是用户最后说的但还没被浏览器标记为 final 的部分
        const finalPart = transcriptBufferRef.current;
        const interimPart = interimTranscriptRef.current;
        const transcript = (finalPart + interimPart).trim();

        // 重置缓冲区
        transcriptBufferRef.current = '';
        interimTranscriptRef.current = '';

        console.log('[useVoiceChat] 发送 transcript:', { finalPart, interimPart, combined: transcript });

        if (audioChunksRef.current.length > 0) {
            const wavBlob = exportWAV(audioChunksRef.current, audioContextRef.current?.sampleRate || 44100);
            onAudioInputRef.current?.(wavBlob, transcript);
        }
        audioChunksRef.current = [];
    }, []);

    const stopRecording = useCallback(() => {
        // 立即标记正在停止，防止 VAD 或播放回调重新触发逻辑
        isStoppingRef.current = true;

        console.log('[useVoiceChat] 正在停止录音并清理资源...');

        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.src = '';
            currentAudioRef.current = null;
        }

        // 重置播放状态
        isPlayingRef.current = false;
        audioQueueRef.current = [];
        pcmActiveCountRef.current = 0;
        pcmNextStartTimeRef.current = 0;
        streamEndedRef.current = false;

        // 断开 Web Audio 节点
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (analyserRef.current) {
            analyserRef.current.disconnect();
            analyserRef.current = null;
        }

        // 停止麦克风采集轨道
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`[useVoiceChat] 已停止轨道: ${track.label}`);
            });
            mediaStreamRef.current = null;
        }

        // 关闭 AudioContext
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(err => {
                console.warn('[useVoiceChat] 关闭 AudioContext 失败:', err);
            });
            audioContextRef.current = null;
        }

        // 强制停止语音识别 (abort 比 stop 更彻底)
        if (recognitionRef.current) {
            try {
                recognitionRef.current.abort();
            } catch (e) {
                console.warn('[useVoiceChat] 终止语音识别失败:', e);
            }
            recognitionRef.current = null;
        }

        // 重置 VAD 和状态变量
        hasSpeechRef.current = false;
        silenceStartRef.current = null;
        audioChunksRef.current = [];
        transcriptBufferRef.current = '';
        interimTranscriptRef.current = '';
        internalProcessingRef.current = false;

        setIsRecording(false);
        onVADStatusChangeRef.current?.('idle');
    }, []);

    // WAV Audio Player
    const playAudio = useCallback((base64Audio: string) => {
        if (isStoppingRef.current) return;
        audioQueueRef.current.push(base64Audio);
        processQueue();
    }, []);

    const processQueue = useCallback(() => {
        if (isStoppingRef.current) return;
        if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

        const nextAudio = audioQueueRef.current.shift();
        if (!nextAudio) return;

        isPlayingRef.current = true;
        const audio = new Audio(`data:audio/wav;base64,${nextAudio}`);
        currentAudioRef.current = audio;

        audio.onended = () => {
            isPlayingRef.current = false;
            currentAudioRef.current = null;
            processQueue();
            if (audioQueueRef.current.length === 0 && isRecording) {
                onVADStatusChangeRef.current?.('listening');
            }
        };

        audio.onerror = (e) => {
            if (!isStoppingRef.current) console.error('Audio error:', e);
            isPlayingRef.current = false;
            currentAudioRef.current = null;
            if (!isStoppingRef.current) processQueue();
        };

        audio.play().catch(() => {
            isPlayingRef.current = false;
            processQueue();
        });
    }, [isRecording]);

    // PCM Chunk Player
    const playPcmData = useCallback((base64Chunk: string) => {
        if (isStoppingRef.current) {
            console.log('[useVoiceChat] isStoppingRef 为 true，跳过播放');
            return;
        }

        // 如果没有 AudioContext，创建一个专门用于播放的
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContextClass();
            console.log('[useVoiceChat] 为播放创建了新的 AudioContext');
        }

        const ctx = audioContextRef.current;

        // 确保 AudioContext 是运行状态（解决浏览器自动播放限制导致第一句没声音的问题）
        if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
                console.log('[useVoiceChat] AudioContext 已从 suspended 恢复');
            });
        }

        internalProcessingRef.current = true;
        isPlayingRef.current = true;

        try {
            const binaryString = window.atob(base64Chunk);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const int16View = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16View.length);
            for (let i = 0; i < int16View.length; i++) {
                float32Data[i] = int16View[i] / 32768.0;
            }

            const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000); // 24k samplerate from Omni
            audioBuffer.copyToChannel(float32Data, 0);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            const currentTime = ctx.currentTime;
            if (pcmNextStartTimeRef.current < currentTime) {
                pcmNextStartTimeRef.current = currentTime + 0.1;
            }

            source.start(pcmNextStartTimeRef.current);
            pcmNextStartTimeRef.current += audioBuffer.duration;

            pcmActiveCountRef.current++;

            source.onended = () => {
                pcmActiveCountRef.current--;
                if (pcmActiveCountRef.current === 0 && streamEndedRef.current) {
                    // 播放完毕且流已结束
                    isPlayingRef.current = false;
                    internalProcessingRef.current = false;  // 重置处理状态，让 VAD 生效

                    // AI 播放完毕，恢复语音识别
                    if (recognitionRef.current) {
                        try {
                            recognitionRef.current.start();
                        } catch (e) { /* ignore - may already be running */ }
                    }

                    onVADStatusChangeRef.current?.('listening');
                    onPlaybackCompleteRef.current?.();  // 通知外部音频播放已完成
                }
            };

        } catch (e) {
            console.error("PCM Playback failed:", e);
        }
    }, []);

    const resetPcmState = useCallback(() => {
        pcmNextStartTimeRef.current = 0;
        pcmActiveCountRef.current = 0;
        streamEndedRef.current = false;

        // 当准备接收新一轮对话时，重置停止标志，确保新音频可以播放
        isStoppingRef.current = false;

        // AI 即将开始播放，暂停语音识别并清空缓冲区
        // 防止把 AI 的语音误识别为用户输入
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) { /* ignore */ }
        }
        transcriptBufferRef.current = '';
        interimTranscriptRef.current = '';
    }, []);

    const setStreamEnded = useCallback(() => {
        streamEndedRef.current = true;
        // 如果当前没有正在播放的 chunk，直接结束
        if (pcmActiveCountRef.current === 0) {
            isPlayingRef.current = false;
            internalProcessingRef.current = false;  // 重置处理状态，让 VAD 生效

            // AI 播放完毕，恢复语音识别
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) { /* ignore - may already be running */ }
            }

            onVADStatusChangeRef.current?.('listening');
            onPlaybackCompleteRef.current?.();  // 通知外部音频播放已完成
        }
    }, []);

    // WAV Helper functions
    function exportWAV(audioData: Float32Array[], sampleRate: number) {
        const buffer = mergeBuffers(audioData);
        const dataview = encodeWAV(buffer, sampleRate);
        return new Blob([dataview], { type: 'audio/wav' });
    }
    function mergeBuffers(audioData: Float32Array[]) {
        let length = 0;
        audioData.forEach(chunk => length += chunk.length);
        const result = new Float32Array(length);
        let offset = 0;
        audioData.forEach(chunk => {
            result.set(chunk, offset);
            offset += chunk.length;
        });
        return result;
    }
    function encodeWAV(samples: Float32Array, sampleRate: number) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);
        floatTo16BitPCM(view, 44, samples);
        return view;
    }
    function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }
    function writeString(view: DataView, offset: number, string: string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    return {
        isRecording,
        audioLevel,
        startRecording,
        stopRecording,
        playAudio,
        playPcmData,
        resetPcmState,
        setStreamEnded
    };
}
