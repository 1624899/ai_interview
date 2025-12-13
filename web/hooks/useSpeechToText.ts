import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechToTextProps {
    onTranscript: (text: string) => void;
    lang?: string;
}

export function useSpeechToText({ onTranscript, lang = 'zh-CN' }: UseSpeechToTextProps) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef(false);

    const onTranscriptRef = useRef(onTranscript);

    // 更新 ref，确保回调总是最新的
    useEffect(() => {
        onTranscriptRef.current = onTranscript;
    }, [onTranscript]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = lang;

                recognitionRef.current.onstart = () => {
                    setIsListening(true);
                    isListeningRef.current = true;
                    setError(null);
                };

                recognitionRef.current.onend = () => {
                    // 如果用户还想继续录音（通过 ref 判断），自动重启
                    if (isListeningRef.current) {
                        try {
                            recognitionRef.current?.start();
                        } catch (e) {
                            // 如果重启失败，则停止录音
                            setIsListening(false);
                            isListeningRef.current = false;
                        }
                    } else {
                        setIsListening(false);
                    }
                };

                recognitionRef.current.onerror = (event: any) => {
                    // 忽略 no-speech 错误（用户暂时没说话）
                    if (event.error === 'no-speech') {
                        // 静默处理，不显示错误
                        return;
                    }

                    // 忽略 aborted 错误（用户主动停止）
                    if (event.error === 'aborted') {
                        return;
                    }

                    console.error('Speech recognition error', event.error);
                    setError(event.error);
                    setIsListening(false);
                    isListeningRef.current = false;
                };

                recognitionRef.current.onresult = (event: any) => {
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        }
                    }
                    if (finalTranscript) {
                        onTranscriptRef.current(finalTranscript);
                    }
                };
            } else {
                setError('Browser does not support speech recognition.');
            }
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                isListeningRef.current = false;
            }
        };
    }, [lang]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            isListeningRef.current = true;
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Error starting speech recognition:", e);
                isListeningRef.current = false;
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            isListeningRef.current = false;
            recognitionRef.current.stop();
        }
    }, [isListening]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    return {
        isListening,
        error,
        startListening,
        stopListening,
        toggleListening,
        isSupported: typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    };
}
