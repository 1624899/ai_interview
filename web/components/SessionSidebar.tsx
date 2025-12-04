import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, Plus, Settings, User, Bot, Award } from 'lucide-react';
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
    onShowAbilityProfile?: () => void; // 新增：显示能力画像的回调
    onOpenSettings?: () => void; // 新增：打开设置的回调
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
    onShowAbilityProfile,
    onOpenSettings,
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
                    <div className="flex flex-col">
                        {/* 1. 顶部图标和关闭按钮 */}
                        <div className="px-4 pt-6 pb-4 flex items-center justify-between">
                            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="h-10 w-10 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                            >
                                <PanelLeftClose className="w-6 h-6" />
                            </Button>
                        </div>

                        {/* 2. 新建按钮 */}
                        <div className="px-4 pb-4">
                            <Button
                                onClick={onNewSession}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-11 rounded-xl bg-[#E0F2F1] hover:bg-[#B2DFDB]",
                                    "text-teal-700 hover:text-teal-900",
                                    "transition-all px-4"
                                )}
                            >
                                <Plus className="w-5 h-5 text-teal-600" strokeWidth={2.5} />
                                <span className="text-[15px] font-semibold tracking-wide">新建模拟面试</span>
                            </Button>
                        </div>

                        {/* 3. 分隔线 */}
                        <div className="h-[1px] bg-gray-200 mx-4 mb-2" />
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

                    {/* 底部能力评分按钮 */}
                    {onShowAbilityProfile && (
                        <div className="p-4 border-t border-gray-100 bg-[#F9F9F9]">
                            <Button
                                onClick={onShowAbilityProfile}
                                variant="ghost"
                                className={cn(
                                    "w-full justify-start gap-3 h-11 rounded-xl",
                                    "bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100",
                                    "hover:from-gray-200 hover:via-gray-300 hover:to-gray-200",
                                    "text-gray-700 hover:text-gray-900",
                                    "border border-gray-300/50",
                                    "shadow-sm hover:shadow-md",
                                    "transition-all px-4"
                                )}
                            >
                                <Award className="w-5 h-5 text-amber-500" strokeWidth={2.5} />
                                <span className="text-[15px] font-semibold tracking-wide">能力评分</span>
                            </Button>
                        </div>
                    )}

                    {/* 底部用户信息与设置区域 */}
                    <div className="p-4 border-t border-gray-100 bg-[#F9F9F9]">
                        <div
                            onClick={onOpenSettings}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white hover:shadow-sm cursor-pointer transition-all group border border-transparent hover:border-gray-100"
                        >
                            <Avatar className="h-9 w-9 border border-gray-200">
                                <AvatarFallback className="bg-teal-50 text-teal-600">
                                    <User className="w-5 h-5" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">设置</p>
                                <p className="text-xs text-gray-500 truncate">配置 API Key</p>
                            </div>
                            <Settings className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
