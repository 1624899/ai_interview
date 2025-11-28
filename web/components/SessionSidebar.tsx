import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, Plus, Settings, User, GraduationCap, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionList } from './SessionList';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SessionListItem } from '@/hooks/useSessionManagement';

interface SessionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSessionSelect: (sessionId: string) => void;
    onNewSession: () => void;
    currentSessionId?: string;
    mode?: 'coach' | 'mock';
    onModeChange: (mode: 'coach' | 'mock') => void;
    sessions: SessionListItem[];
    onDeleteSession: (sessionId: string) => void;
    loading?: boolean;
}

export function SessionSidebar({
    isOpen,
    onClose,
    onSessionSelect,
    onNewSession,
    currentSessionId,
    mode,
    onModeChange,
    sessions,
    onDeleteSession,
    loading
}: SessionSidebarProps) {
    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.aside
                    initial={{ width: 0, opacity: 0 }}
                    animate={{
                        width: 260,
                        opacity: 1,
                        transition: {
                            width: { duration: 0.2, ease: "easeInOut" },
                            opacity: { duration: 0.2 }
                        }
                    }}
                    exit={{
                        width: 0,
                        opacity: 0,
                        transition: {
                            width: { duration: 0.2, ease: "easeInOut" },
                            opacity: { duration: 0.1 }
                        }
                    }}
                    className="flex-shrink-0 h-full relative z-40 bg-[#F9F9F9] border-r border-gray-200 flex flex-col"
                >
                    <div className="p-4 pb-2 flex items-center justify-between gap-2">
                        <Button
                            onClick={onNewSession}
                            variant="ghost"
                            className={cn(
                                "flex-1 justify-start gap-3 h-11 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]",
                                "text-teal-700 hover:text-teal-900",
                                "transition-all px-4"
                            )}
                        >
                            <Plus className="w-5 h-5 text-teal-600" strokeWidth={2.5} />
                            <span className="text-[15px] font-semibold tracking-wide">新建对话</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="h-10 w-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <PanelLeftClose className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* 模式切换按钮 */}
                    <div className="px-4 pb-2">
                        <div className="flex p-1 bg-gray-200/50 rounded-xl">
                            <button
                                onClick={() => onModeChange('coach')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                                    mode === 'coach'
                                        ? "bg-white text-teal-700 shadow-sm ring-1 ring-black/5"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                )}
                            >
                                <GraduationCap className={cn("w-4 h-4", mode === 'coach' ? "text-teal-600" : "text-gray-400")} />
                                辅导
                            </button>
                            <button
                                onClick={() => onModeChange('mock')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                                    mode === 'mock'
                                        ? "bg-white text-emerald-700 shadow-sm ring-1 ring-black/5"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                )}
                            >
                                <Timer className={cn("w-4 h-4", mode === 'mock' ? "text-emerald-600" : "text-gray-400")} />
                                模拟
                            </button>
                        </div>
                    </div>

                    {/* 会话列表区域 */}
                    <div className="flex-1 overflow-hidden px-4 py-2">
                        <SessionList
                            sessions={sessions}
                            onSessionSelect={onSessionSelect}
                            onDeleteSession={onDeleteSession}
                            currentSessionId={currentSessionId}
                            mode={mode}
                            loading={loading}
                        />
                    </div>

                    {/* 底部用户信息区域 */}
                    <div className="p-4 border-t border-gray-100 bg-[#F9F9F9]">
                        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm cursor-pointer transition-all group border border-transparent hover:border-gray-100">
                            <Avatar className="h-9 w-9 border border-gray-200">
                                <AvatarImage src="/user-avatar.png" />
                                <AvatarFallback className="bg-teal-50 text-teal-600">
                                    <User className="w-5 h-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">面试候选人</p>
                                <p className="text-xs text-gray-500 truncate">Pro 版</p>
                            </div>
                            <Settings className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
