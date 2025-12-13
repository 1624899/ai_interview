import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeftClose, Plus, Settings, User, Bot, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionList } from './SessionList';
import { ResumeHistoryList } from './ResumeHistoryList';
import { GeneratedResumeList } from './GeneratedResumeList';
import { ResumePreviewDialog } from './ResumePreviewDialog';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useInterviewStore } from '@/store/useInterviewStore';
import { updateGeneratedResume } from '@/lib/api/resume';

interface SessionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
    currentView: 'interview' | 'resume';
    onViewChange: (view: 'interview' | 'resume') => void;
}

export function SessionSidebar({
    isOpen,
    onClose,
    onOpenSettings,
    currentView,
    onViewChange
}: SessionSidebarProps) {
    const {
        // Interview Sessions
        sessions,
        currentSession,
        sessionLoading,
        selectSession,
        createNewSession,
        deleteSession,
        updateSessionTitle,
        togglePinSession,

        // Resume History
        resumeResults,
        currentResumeResult,
        resumeResultLoading,
        fetchResumeResults,
        selectResumeResult,
        deleteResumeResult,
        clearResumeResult,

        // Generated Resumes
        generatedResumes,
        generatedResumesLoading,
        fetchGeneratedResumes,
        selectGeneratedResume,
        deleteGeneratedResume,
        currentGeneratedResume,

        // Common
        setShowAbilityProfile
    } = useInterviewStore();

    const [resumeSubTab, setResumeSubTab] = useState<'analysis' | 'generated'>('analysis');
    const [showPreview, setShowPreview] = useState(false);

    // 当切换到简历模式时，加载历史记录
    useEffect(() => {
        if (currentView === 'resume') {
            if (resumeResults.length === 0) fetchResumeResults();
            if (generatedResumes.length === 0) fetchGeneratedResumes();
        }
    }, [currentView, fetchResumeResults, fetchGeneratedResumes, resumeResults.length, generatedResumes.length]);

    const handleSessionSelect = (sessionId: string) => {
        selectSession(sessionId);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    const handleResumeSelect = (resultId: number) => {
        selectResumeResult(resultId);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    const handleGeneratedResumeSelect = async (id: number) => {
        await selectGeneratedResume(id);
        setShowPreview(true);
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    const handleNewSession = () => {
        if (currentView === 'interview') {
            createNewSession();
        } else {
            // 简历模式下，新建 = 清空当前选中的结果，回到输入界面
            clearResumeResult();
        }
        if (window.innerWidth < 768) {
            onClose();
        }
    };

    return (
        <>
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
                            <div className="px-4 pt-6 pb-2 flex items-center justify-between">
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

                            {/* 2. 模式切换 Tabs */}
                            <div className="px-4 pb-4">
                                <Tabs value={currentView} onValueChange={(v) => onViewChange(v as 'interview' | 'resume')} className="w-full">
                                    <TabsList className="w-full grid grid-cols-2 bg-gray-200/50 p-1 rounded-lg">
                                        <TabsTrigger
                                            value="interview"
                                            className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all gap-1.5"
                                        >
                                            <MessageCircle size={14} />
                                            模拟面试
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="resume"
                                            className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md transition-all gap-1.5"
                                        >
                                            <FileText size={14} />
                                            简历工具
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            {/* 3. 新建按钮 */}
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
                                    <span className="text-[15px] font-semibold tracking-wide">
                                        {currentView === 'interview' ? '新建模拟面试' : '新建简历分析'}
                                    </span>
                                </Button>
                            </div>

                            {/* 4. 分隔线 */}
                            <div className="h-[1px] bg-gray-200 mx-4 mb-2" />
                        </div>

                        {/* 列表区域 */}
                        <div className="flex-1 overflow-hidden px-4 py-2">
                            {currentView === 'interview' ? (
                                <SessionList
                                    sessions={sessions}
                                    onSessionSelect={handleSessionSelect}
                                    onDeleteSession={deleteSession}
                                    onEditSession={updateSessionTitle}
                                    onTogglePin={togglePinSession}
                                    currentSessionId={currentSession?.session_id}
                                    loading={sessionLoading}
                                />
                            ) : (
                                <div className="h-full flex flex-col">
                                    <div className="px-2 mb-2">
                                        <div className="flex p-1 bg-gray-100 rounded-lg">
                                            <button
                                                onClick={() => setResumeSubTab('analysis')}
                                                className={cn(
                                                    "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                                    resumeSubTab === 'analysis' ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                )}
                                            >
                                                分析记录
                                            </button>
                                            <button
                                                onClick={() => setResumeSubTab('generated')}
                                                className={cn(
                                                    "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                                    resumeSubTab === 'generated' ? "bg-white text-teal-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                                )}
                                            >
                                                我的简历
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        {resumeSubTab === 'analysis' ? (
                                            <ResumeHistoryList
                                                results={resumeResults}
                                                onSelect={handleResumeSelect}
                                                onDelete={deleteResumeResult}
                                                currentResultId={currentResumeResult?.id}
                                                loading={resumeResultLoading}
                                            />
                                        ) : (
                                            <GeneratedResumeList
                                                results={generatedResumes}
                                                onSelect={handleGeneratedResumeSelect}
                                                onDelete={deleteGeneratedResume}
                                                currentResultId={currentGeneratedResume?.id}
                                                loading={generatedResumesLoading}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 底部设置区域 */}
                        <div className="p-4 border-t border-gray-200 space-y-2">
                            {/* 能力画像入口 (仅面试模式显示) */}
                            {currentView === 'interview' && (
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
                            )}

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


            <ResumePreviewDialog
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                title={currentGeneratedResume?.title || '简历预览'}
                content={currentGeneratedResume?.content || ''}
                onContentChange={async (newContent) => {
                    if (currentGeneratedResume?.id) {
                        await updateGeneratedResume(currentGeneratedResume.id, newContent);
                        fetchGeneratedResumes();
                    }
                }}
            />
        </>
    );
}

function Award(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="8" r="7" />
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
    )
}
