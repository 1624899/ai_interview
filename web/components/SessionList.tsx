"use client";

import { useEffect, useMemo, useState } from 'react';
import { Trash2, MoreHorizontal, GraduationCap, Timer, Edit2, Pin, PinOff } from 'lucide-react';
import { useSessionManagement, SessionListItem } from '@/hooks/useSessionManagement';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SessionListProps {
    sessions: SessionListItem[];
    onSessionSelect: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    onEditSession?: (sessionId: string, newTitle: string) => void;
    onTogglePin?: (sessionId: string, pinned: boolean) => void;
    currentSessionId?: string;
    mode?: 'coach' | 'mock';
    loading?: boolean;
}

export function SessionList({
    sessions,
    onSessionSelect,
    onDeleteSession,
    onEditSession,
    onTogglePin,
    currentSessionId,
    mode,
    loading
}: SessionListProps) {

    const handleDelete = async (sessionId: string) => {
        await onDeleteSession(sessionId);
    };

    // 会话分组逻辑
    const groupedSessions = useMemo(() => {
        const groups: { [key: string]: SessionListItem[] } = {
            '今天': [],
            '昨天': [],
            '过去7天': [],
            '更早': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const lastWeek = today - 86400000 * 7;

        sessions.forEach(session => {
            const date = new Date(session.updated_at).getTime();
            if (date >= today) {
                groups['今天'].push(session);
            } else if (date >= yesterday) {
                groups['昨天'].push(session);
            } else if (date >= lastWeek) {
                groups['过去7天'].push(session);
            } else {
                groups['更早'].push(session);
            }
        });

        return groups;
    }, [sessions]);

    if (loading && sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 space-y-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                <div className="text-xs text-gray-400">加载中...</div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
                <p className="text-xs text-gray-400">暂无历史会话</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-4">
                {Object.entries(groupedSessions).map(([group, groupSessions]) => (
                    groupSessions.length > 0 && (
                        <div key={group}>
                            <h4 className="px-3 mb-1 text-[11px] font-medium text-gray-400">
                                {group}
                            </h4>
                            <div className="space-y-0.5">
                                {groupSessions.map((session) => (
                                    <SessionItem
                                        key={session.session_id}
                                        session={session}
                                        isActive={session.session_id === currentSessionId}
                                        onSelect={() => onSessionSelect(session.session_id)}
                                        onDelete={() => handleDelete(session.session_id)}
                                        onEdit={onEditSession}
                                        onTogglePin={onTogglePin}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </ScrollArea>
    );
}

interface SessionItemProps {
    session: SessionListItem;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onEdit?: (sessionId: string, newTitle: string) => void;
    onTogglePin?: (sessionId: string, pinned: boolean) => void;
}

function SessionItem({ session, isActive, onSelect, onDelete, onEdit, onTogglePin }: SessionItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editTitle, setEditTitle] = useState(session.title);
    const isCoach = session.mode === 'coach';
    // 移除可能存在的"职位名称："前缀，保持整洁
    const displayTitle = (session.title || (isCoach ? "辅导会话" : "模拟面试")).replace('职位名称：', '').replace('职位名称:', '');

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditTitle(displayTitle);
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        if (editTitle.trim() && onEdit) {
            onEdit(session.session_id, editTitle.trim());
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditTitle(displayTitle);
        setIsEditing(false);
    };

    const handleTogglePin = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onTogglePin) {
            onTogglePin(session.session_id, !session.pinned);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        onDelete();
        setIsDeleteDialogOpen(false);
    };

    return (
        <div
            onClick={onSelect}
            className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm w-[226px]",
                isActive
                    ? "bg-gray-200/60 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
        >

            {/* 置顶标识 */}
            {session.pinned && (
                <Pin className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" fill="currentColor" />
            )}

            {/* 标题 */}
            <div className="flex-1 min-w-0">
                <div className="truncate leading-none font-medium" title={displayTitle}>
                    {displayTitle}
                </div>
            </div>

            {/* 更多操作 (悬停显示) */}
            <div className={cn(
                "flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                isActive && "opacity-100" // 选中时如果需要也可以一直显示，或者保持hover显示
            )}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-gray-200 rounded-md"
                        >
                            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                            onClick={handleEdit}
                        >
                            <Edit2 className="w-3.5 h-3.5 mr-2" />
                            编辑标题
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={handleTogglePin}
                        >
                            {session.pinned ? (
                                <>
                                    <PinOff className="w-3.5 h-3.5 mr-2" />
                                    取消置顶
                                </>
                            ) : (
                                <>
                                    <Pin className="w-3.5 h-3.5 mr-2" />
                                    置顶
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={handleDeleteClick}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2 text-red-600" />
                            删除会话
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 编辑对话框 */}
            {isEditing && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={handleCancelEdit}
                >
                    <div
                        className="bg-white rounded-xl p-6 w-96 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-4">编辑会话标题</h3>
                        <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                            }}
                        />
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                onClick={handleCancelEdit}
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                className="bg-teal-600 hover:bg-teal-700"
                            >
                                确认
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 删除确认对话框 */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除此会话？</AlertDialogTitle>
                        <AlertDialogDescription>
                            这条会话将被永久删除，不可恢复及撤销
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete();
                            }}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
