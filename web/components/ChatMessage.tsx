import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { User, Bot, Copy, Pencil, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// 聊天消息组件属性接口
interface ChatMessageProps {
    role: 'user' | 'ai' | 'system'; // 消息角色
    content: string; // 消息内容
    isStreaming?: boolean; // 是否正在流式传输
    onEdit?: (newContent: string) => void; // 编辑回调
}

export function ChatMessage({ role, content, isStreaming, onEdit }: ChatMessageProps) {
    const isUser = role === 'user';
    const [isCopied, setIsCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(content);

    // 同步内容更新
    useEffect(() => {
        setEditContent(content);
    }, [content]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleSave = () => {
        if (editContent.trim() !== content) {
            onEdit?.(editContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(content);
        setIsEditing(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "flex w-full gap-3 p-4 group",
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
            <div className={cn("flex flex-col max-w-[85%]", isUser ? "items-end" : "items-start")}>

                {isEditing ? (
                    /* 编辑模式 UI */
                    <div className="w-full min-w-[300px] bg-white rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="min-h-[100px] resize-none border-gray-200 focus-visible:ring-teal-500/20 text-base"
                            placeholder="输入新的内容..."
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancel}
                                className="h-8 text-gray-500 hover:text-gray-700"
                            >
                                取消
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                className="h-8 bg-teal-600 hover:bg-teal-700 text-white"
                            >
                                确定
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* 展示模式 UI */
                    <div className={cn(
                        "relative rounded-2xl px-5 py-3.5 leading-relaxed",
                        isUser
                            ? "bg-[#E0F2F1] text-teal-900 text-base font-medium"
                            : "bg-transparent text-gray-900 px-0 py-0 text-base"
                    )}>
                        {/* Markdown 渲染 */}
                        {role === 'ai' ? (
                            <div className="prose prose-base dark:prose-invert break-words max-w-none text-base leading-7">
                                <ReactMarkdown
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    rehypePlugins={[rehypeHighlight as any]}
                                    components={{
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        code({ node, inline, className, children, ...props }: any) {
                                            return !inline ? (
                                                <div className={cn("bg-zinc-950 p-3 rounded-md my-2 overflow-x-auto text-xs text-white", className)}>
                                                    <code className={className} {...props}>
                                                        {children}
                                                    </code>
                                                </div>
                                            ) : (
                                                <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs" {...props}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{content}</p>
                        )}

                        {/* 流式光标 */}
                        {isStreaming && (
                            <span className="inline-block w-1.5 h-4 ml-1 bg-current animate-pulse align-middle" />
                        )}
                    </div>
                )}

                {/* 操作按钮 (仅用户消息 & 非编辑模式) */}
                {isUser && !isEditing && (
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
                            onClick={() => setIsEditing(true)}
                            title="编辑"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
