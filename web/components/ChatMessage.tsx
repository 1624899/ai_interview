import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// 聊天消息组件属性接口
interface ChatMessageProps {
    role: 'user' | 'ai' | 'system'; // 消息角色：用户、AI或系统
    content: string; // 消息内容
    timestamp?: string; // 消息时间戳
    isStreaming?: boolean; // 是否正在流式传输
    onEdit?: (content: string) => void;
    onCancelEdit?: () => void;
    onRegenerate?: () => void; // AI消息重新生成回调
}

import { motion } from "framer-motion";

import { User, Bot, Copy, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export function ChatMessage({ role, content, timestamp, isStreaming, onEdit, onCancelEdit, onRegenerate }: ChatMessageProps) {
    const isUser = role === 'user';
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleStartEdit = () => {
        setEditedContent(content);
        setIsEditing(true);
    };

    const handleConfirmEdit = () => {
        if (editedContent.trim()) {
            onEdit?.(editedContent.trim());
            setIsEditing(false);
        }
    };

    const handleCancelEdit = () => {
        setEditedContent(content);
        setIsEditing(false);
        onCancelEdit?.();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "flex w-full gap-3 p-4",
                isUser ? "flex-row-reverse" : "flex-row"
            )}
        >
            {/* AI头像 (仅AI显示) */}
            {!isUser && (
                <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border border-gray-200 bg-white text-teal-600 shadow-sm mt-1">
                    <Bot className="h-5 w-5" />
                </div>
            )}

            {/* 消息主体容器 */}
            <div className={cn("flex flex-col max-w-[85%] group", isUser ? "items-end" : "items-start")}>
                {isEditing ? (
                    // 编辑模式
                    <div className="w-full space-y-2">
                        <Textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="min-h-[120px] w-full resize-none text-base leading-relaxed bg-white border-teal-200 focus:border-teal-500 focus:ring-teal-100"
                            autoFocus
                        />
                        <div className="flex items-center gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="text-gray-600 hover:text-gray-900"
                            >
                                <X className="h-4 w-4 mr-1" />
                                取消
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirmEdit}
                                className="bg-teal-600 hover:bg-teal-700 text-white"
                                disabled={!editedContent.trim()}
                            >
                                <Check className="h-4 w-4 mr-1" />
                                确定
                            </Button>
                        </div>
                    </div>
                ) : (
                    // 正常显示模式
                    <>
                        <div className={cn(
                            "relative rounded-2xl px-5 py-3.5 leading-relaxed",
                            isUser
                                ? "bg-[#E0F2F1] text-teal-900 text-base font-medium" // 用户：加深青色背景，无头像，字号加大
                                : "bg-transparent text-gray-900 px-0 py-0 text-base" // AI：无背景，字号加大 (text-base = 16px)
                        )}>
                            {/* 渲染Markdown内容 */}
                            {role === 'ai' ? (
                                <div className="prose prose-base dark:prose-invert break-words max-w-none text-base leading-7">
                                    <ReactMarkdown
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        rehypePlugins={[rehypeHighlight as any]}
                                        components={{
                                            // 自定义 pre 标签（代码块容器）
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            pre({ children, ...props }: any) {
                                                return (
                                                    <pre className="bg-zinc-950 p-3 rounded-md my-2 overflow-x-auto text-xs text-white" {...props}>
                                                        {children}
                                                    </pre>
                                                );
                                            },
                                            // 自定义 code 标签
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            code({ node, inline, className, children, ...props }: any) {
                                                // 内联代码
                                                if (inline) {
                                                    return (
                                                        <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs" {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                }
                                                // 代码块（已经在 pre 标签内）
                                                return (
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                );
                                            }
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap">{content}</p>
                            )}

                            {/* 光标动画：仅在流式传输时显示 */}
                            {isStreaming && (
                                <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle" />
                            )}
                        </div>

                        {/* 用户消息操作按钮 (悬停显示) */}
                        {isUser && (
                            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                                    onClick={handleCopy}
                                    title="复制"
                                >
                                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                                    onClick={handleStartEdit}
                                    title="编辑"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}

                        {/* AI消息操作按钮 (悬停显示) */}
                        {role === 'ai' && !isStreaming && (
                            <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                                    onClick={handleCopy}
                                    title="复制"
                                >
                                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-teal-600 hover:bg-teal-50"
                                    onClick={onRegenerate}
                                    title="重新生成"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}
