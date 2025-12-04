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
    sessions: SessionListItem[];
    onDeleteSession: (sessionId: string) => void;
    onEditSession?: (sessionId: string, newTitle: string) => void;
    onTogglePin?: (sessionId: string, pinned: boolean) => void;
    loading?: boolean;
}

export function SessionSidebar({
    isOpen,
    onClose,
    onSessionSelect,
    onNewSession,
    currentSessionId,
    sessions,
    onDeleteSession,
    onEditSession,
    onTogglePin,
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

                    {/* 会话列表区域 */}
                    <div className="flex-1 overflow-hidden px-4 py-2">
                        <SessionList
                            sessions={sessions}
                            onSessionSelect={onSessionSelect}
                            onDeleteSession={onDeleteSession}
                            onEditSession={onEditSession}
                            onTogglePin={onTogglePin}
                            currentSessionId={currentSessionId}
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
