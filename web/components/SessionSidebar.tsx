import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, Plus, Settings, User, Bot, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SessionList } from './SessionList';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInterviewStore } from '@/store/useInterviewStore';

interface SessionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
}

export function SessionSidebar({
    isOpen,
    onClose,
    onOpenSettings
}: SessionSidebarProps) {
    const {
        sessions,
        currentSession,
        sessionLoading,
        selectSession,
        createNewSession,
        deleteSession,
        updateSessionTitle,
        togglePinSession,
        setShowAbilityProfile
    } = useInterviewStore();

    const handleSessionSelect = (sessionId: string) => {
        selectSession(sessionId);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    const handleNewSession = () => {
        createNewSession();
        if (window.innerWidth < 768) {
            onClose();
        }
    };

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
                                onClick={handleNewSession}
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
                            onSessionSelect={handleSessionSelect}
                            onDeleteSession={deleteSession}
                            onEditSession={updateSessionTitle}
                            onTogglePin={togglePinSession}
                            currentSessionId={currentSession?.session_id}
                            loading={sessionLoading}
                        />
                    </div>

                    {/* 底部设置区域 */}
                    <div className="p-4 border-t border-gray-200 space-y-2">
                        {/* 能力画像入口 */}
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-gray-100 to-gray-300 border border-gray-200 text-gray-700 hover:from-gray-50 hover:to-gray-400 hover:text-gray-900 shadow-sm transition-all"
                            onClick={() => {
                                setShowAbilityProfile(true);
                                if (window.innerWidth < 768) onClose();
                            }}
                        >
                            <Award className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium">综合能力画像</span>
                        </Button>

                        {/* 设置入口 */}
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 h-10 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                            onClick={onOpenSettings}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-sm font-medium">设置</span>
                        </Button>

                        {/* 用户信息 */}
                        <div className="flex items-center gap-3 px-2 py-2">
                            <Avatar className="h-8 w-8 bg-teal-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-teal-700" />
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">面试候选人</p>
                                <p className="text-xs text-gray-500 truncate">Pro Plan</p>
                            </div>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
}
