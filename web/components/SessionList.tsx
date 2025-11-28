"use client";

import { useEffect, useMemo } from 'react';
import { Trash2, MoreHorizontal, GraduationCap, Timer } from 'lucide-react';
import { useSessionManagement, SessionListItem } from '@/hooks/useSessionManagement';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SessionListProps {
    sessions: SessionListItem[];
    onSessionSelect: (sessionId: string) => void;
    onDeleteSession: (sessionId: string) => void;
    currentSessionId?: string;
    mode?: 'coach' | 'mock';
    loading?: boolean;
}

export function SessionList({
    sessions,
    onSessionSelect,
    onDeleteSession,
    currentSessionId,
    mode,
    loading
}: SessionListProps) {

    const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('确定要删除这个会话吗？')) {
            await onDeleteSession(sessionId);
        }
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
                                        onDelete={(e) => handleDelete(session.session_id, e)}
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
    onDelete: (e: React.MouseEvent) => void;
}

function SessionItem({ session, isActive, onSelect, onDelete }: SessionItemProps) {
    const isCoach = session.mode === 'coach';
    // 移除可能存在的"职位名称："前缀，保持整洁
    const displayTitle = (session.title || (isCoach ? "辅导会话" : "模拟面试")).replace('职位名称：', '').replace('职位名称:', '');

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
                    <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={onDelete}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            删除会话
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
