"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, PanelLeft, Bot, Sparkles, GraduationCap, Timer, Maximize2, Square, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ChatMessage";
import { Textarea } from "@/components/ui/textarea";
import { SessionSidebar } from "@/components/SessionSidebar";
import { useInterviewChat } from "@/hooks/useInterviewChat";
import { useSessionManagement } from "@/hooks/useSessionManagement";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from 'uuid';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InterviewPage() {
  const [showSidebar, setShowSidebar] = useState(true);
  const [input, setInput] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [companyInfo, setCompanyInfo] = useState(""); // 新增：公司信息
  const [interviewProgress, setInterviewProgress] = useState<{ current: number; total: number } | null>(null); // 新增：面试进度
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [tempJobDescription, setTempJobDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const {
    messages,
    sendMessage,
    isStreaming,
    isLoading,
    resume,
    uploadResume,
    mode,
    setMode,
    startInterview,
    threadId,
    setThreadId,
    clearMessages,
    restoreMessages,
    rollbackChat,
    stopStreaming,
    interviewProgress: hookInterviewProgress,
    setInterviewProgress: setHookInterviewProgress
  } = useInterviewChat();

  const {
    sessions,
    currentSession,
    createSession,
    fetchSession,
    clearCurrentSession,
    fetchSessions,
    deleteSession,
    togglePinSession,
    updateSessionTitle,
    loading: sessionLoading
  } = useSessionManagement();

  // 加载会话列表
  useEffect(() => {
    fetchSessions('active', mode);
  }, [mode, fetchSessions]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const content = input;
    setInput("");

    // 发送消息时强制滚动到底部
    setAutoScrollEnabled(true);
    setShowScrollButton(false);
    // 使用 setTimeout 确保在 UI 更新后滚动
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    await sendMessage(content, threadId, jobDescription, companyInfo);
  };

  // 处理滚动事件
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // 距离底部 100px 以内视为在底部
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isAtBottom) {
      setShowScrollButton(false);
      setAutoScrollEnabled(true);
    } else {
      setShowScrollButton(true);
      // 如果用户主动向上滚动，暂停自动滚动
      if (autoScrollEnabled && scrollHeight - scrollTop - clientHeight > 100) {
        setAutoScrollEnabled(false);
      }
    }
  };

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
    setAutoScrollEnabled(true);
  };

  // 自动滚动效果
  useEffect(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScrollEnabled]);

  const handleEditMessage = async (index: number, newContent: string) => {
    if (isStreaming) return;

    // 回退到该消息之前的状态
    await rollbackChat(index);

    // 直接发送编辑后的消息
    await sendMessage(newContent, threadId, jobDescription, companyInfo);
  };

  const handleRegenerateMessage = async (aiMessageIndex: number) => {
    if (isStreaming) return;

    // 特殊处理：如果是第一条消息（AI开场白），则重新开始面试流程
    // 因为第一条消息没有前置的用户消息（是由空消息触发的）
    if (aiMessageIndex === 0) {
      await rollbackChat(0);
      await sendMessage("", threadId, jobDescription, companyInfo);
      return;
    }

    // 找到对应的用户消息（AI消息的前一条应该是用户消息）
    const userMessageIndex = aiMessageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') {
      console.error('无法找到对应的用户消息');
      return;
    }

    const userMessage = messages[userMessageIndex];

    // 回退到用户消息之前的状态（删除用户消息和AI回复）
    await rollbackChat(userMessageIndex);

    // 重新发送原有的用户消息
    await sendMessage(userMessage.content, threadId, jobDescription, companyInfo);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadResume(e.target.files[0]);
    }
  };

  const handleStartInterview = async () => {
    if (resume && jobDescription.trim()) {
      // 生成新的 thread_id
      const newThreadId = uuidv4();
      setThreadId(newThreadId);

      // 启动面试流程（后端会自动创建会话并保存完整信息）
      try {
        await startInterview(jobDescription.trim(), resume, mode, newThreadId, companyInfo.trim());

        // 刷新会话列表以获取后端生成的最新会话
        await fetchSessions('active', mode);
      } catch (error) {
        console.error('启动面试时出错:', error);
      }
    }
  };

  // 处理会话选择
  const handleSessionSelect = async (sessionId: string) => {
    const session = await fetchSession(sessionId);
    if (session) {
      setThreadId(session.session_id);
      setMode(session.metadata.mode);
      if (session.metadata.job_description) {
        setJobDescription(session.metadata.job_description);
      }

      clearMessages();
      restoreMessages(session.messages);
      // 如果是移动端，选择后自动关闭侧边栏
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      }
    }
  };

  // 处理新建会话
  const handleNewSession = () => {
    clearCurrentSession();
    clearMessages();
    setThreadId(uuidv4());
    setJobDescription(""); // 重置岗位描述
  };

  // 处理编辑会话标题
  const handleEditSession = async (sessionId: string, newTitle: string) => {
    await updateSessionTitle(sessionId, newTitle);
  };

  // 处理置顶会话
  const handleTogglePin = async (sessionId: string, pinned: boolean) => {
    await togglePinSession(sessionId, pinned);
  };

  // 判断是否显示欢迎页（没有消息且没有当前会话）
  const showWelcome = messages.length === 0 && !currentSession;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1d1d1f] font-sans antialiased">

      {/* 左侧历史会话侧边栏 */}
      <SessionSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        currentSessionId={currentSession?.session_id}
        mode={mode}
        onModeChange={setMode}
        sessions={sessions}
        onDeleteSession={deleteSession}
        onEditSession={handleEditSession}
        onTogglePin={handleTogglePin}
        loading={sessionLoading}
      />

      {/* 右侧主内容区域 */}
      <main className="flex-1 flex flex-col h-full relative bg-white overflow-hidden">

        {/* 顶部导航栏 (仅在侧边栏关闭或移动端显示) */}
        {!showSidebar && (
          <div className="absolute top-4 left-4 z-50">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(true)}
              className="hover:bg-gray-100 text-gray-500"
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
          </div>
        )}

        {showWelcome ? (
          /* 欢迎页 / 新建会话页 */
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 relative">

            {/* Logo & 标题 - 移动到左上角 */}
            <div className="absolute top-8 left-8 flex items-center gap-4 z-10">
              <div className="w-14 h-14 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-200">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  面试<span className="text-teal-600">.AI</span>
                </h1>
                <p className="text-sm text-gray-500 max-w-md">
                  您的智能面试教练。
                </p>
              </div>
            </div>

            <div className="max-w-2xl w-full text-center mt-16">

              {/* 核心操作区域 */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6 text-left">

                {/* 1. 上传简历 */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold">1</span>
                    上传简历
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                  />

                  {!resume ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-teal-500 hover:bg-teal-50/50 transition-all cursor-pointer group"
                    >
                      <div className="p-3 bg-gray-50 rounded-full group-hover:bg-teal-100 transition-colors">
                        {isLoading ? <Loader2 className="w-6 h-6 text-teal-600 animate-spin" /> : <Upload className="w-6 h-6 text-gray-400 group-hover:text-teal-600" />}
                      </div>
                      <p className="text-sm text-gray-500 font-medium">点击上传 PDF 或 TXT 简历</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-100 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 rounded-lg">
                          <FileText className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{resume.original_name}</p>
                          <p className="text-xs text-teal-600">已就绪</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-teal-600">
                        更换
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. 输入岗位描述 (修改为点击弹窗编辑) */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold">2</span>
                    目标岗位
                  </label>

                  <div
                    onClick={() => {
                      setTempJobDescription(jobDescription);
                      setIsJobDialogOpen(true);
                    }}
                    className="relative group cursor-pointer"
                  >
                    <div className={cn(
                      "w-full rounded-xl border border-gray-200 bg-white p-4 text-sm transition-all",
                      "hover:border-teal-500 hover:ring-2 hover:ring-teal-50",
                      "min-h-[100px] max-h-[100px] overflow-hidden relative" // 固定高度
                    )}>
                      {jobDescription ? (
                        <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">{jobDescription}</p>
                      ) : (
                        <p className="text-gray-400">例如：高级Java工程师，要求熟悉Spring Boot和微服务架构...</p>
                      )}

                      {/* 遮罩和图标 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-teal-600 font-medium flex items-center gap-1 bg-white/90 px-3 py-1 rounded-full shadow-sm text-xs">
                          <Maximize2 className="w-3 h-3" /> 点击展开编辑
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2.5. 输入公司信息 (非必填) */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">选填</span>
                    公司信息
                  </label>

                  <input
                    type="text"
                    value={companyInfo}
                    onChange={(e) => setCompanyInfo(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm transition-all hover:border-teal-500 hover:ring-2 hover:ring-teal-50 focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                    placeholder="例如：大厂、创业公司、外企等（可选）"
                  />
                  <p className="text-xs text-gray-400">
                    提供公司信息可以让面试题目更贴近实际场景
                  </p>
                </div>

                {/* 3. 选择模式 */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold">3</span>
                    选择模式
                  </label>

                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setMode('coach')}
                      className={cn(
                        "cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-2",
                        mode === 'coach'
                          ? "border-teal-500 bg-teal-50/50"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className={cn("w-5 h-5", mode === 'coach' ? "text-teal-600" : "text-gray-400")} />
                        <span className={cn("font-medium", mode === 'coach' ? "text-teal-900" : "text-gray-700")}>辅导模式</span>
                      </div>
                      <p className="text-xs text-gray-500">实时反馈，详细解析，适合练习。</p>
                    </div>

                    <div
                      onClick={() => setMode('mock')}
                      className={cn(
                        "cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col gap-2",
                        mode === 'mock'
                          ? "border-emerald-500 bg-emerald-50/50"
                          : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Timer className={cn("w-5 h-5", mode === 'mock' ? "text-emerald-600" : "text-gray-400")} />
                        <span className={cn("font-medium", mode === 'mock' ? "text-emerald-900" : "text-gray-700")}>模拟面试</span>
                      </div>
                      <p className="text-xs text-gray-500">全真模拟，严格计时，适合冲刺。</p>
                    </div>
                  </div>
                </div>

                {/* 4. 开始按钮 */}
                <Button
                  className="w-full h-12 text-base font-medium bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all"
                  onClick={handleStartInterview}
                  disabled={!resume || !jobDescription.trim() || isLoading}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  开始面试
                </Button>

              </div>
            </div>
          </div>
        ) : (
          /* 聊天界面 */
          <>
            {/* 面试进度条 */}
            {interviewProgress && interviewProgress.total > 0 && (
              <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                        <span className="font-medium text-gray-700">面试进行中</span>
                      </div>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-500">
                        问题 <span className="font-semibold text-teal-600">{interviewProgress.current}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="font-semibold text-gray-700">{interviewProgress.total}</span>
                      </span>
                    </div>

                    {/* 进度条 */}
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${(interviewProgress.current / interviewProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {Math.round((interviewProgress.current / interviewProgress.total) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <ScrollArea
              className="h-full w-full"
              viewportRef={scrollViewportRef}
              onScroll={handleScroll}
            >
              <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 pb-48">
                {messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    {...m}
                    onEdit={m.role === 'user' ? (content) => handleEditMessage(i, content) : undefined}
                    onRegenerate={m.role === 'ai' ? () => handleRegenerateMessage(i) : undefined}
                  />
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== 'ai' && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm pl-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在思考...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* 底部输入框 */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent">
              <div className="max-w-3xl mx-auto relative">
                {/* 跳转到底部按钮 - 移动到输入框上方 */}
                {showScrollButton && (
                  <div className="absolute -top-12 left-0 right-0 flex justify-center z-20 pointer-events-none">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-full shadow-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 gap-2 pointer-events-auto animate-in fade-in zoom-in duration-300"
                      onClick={scrollToBottom}
                    >
                      <ArrowDown className="w-4 h-4" />
                      <span>回到底部</span>
                    </Button>
                  </div>
                )}

                <div className="relative bg-white rounded-2xl shadow-lg border border-gray-200 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
                  <Textarea
                    placeholder="输入您的回答..."
                    className="min-h-[120px] max-h-[400px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 p-5 pr-14 text-base leading-relaxed"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isStreaming}
                  />
                  <Button
                    size="icon"
                    className={cn(
                      "absolute right-2 bottom-2 h-9 w-9 transition-all",
                      isStreaming || input.trim()
                        ? "bg-teal-600 hover:bg-teal-700"
                        : "bg-gray-100 text-gray-400"
                    )}
                    onClick={isStreaming ? stopStreaming : handleSend}
                    disabled={!isStreaming && !input.trim()}
                  >
                    {isStreaming ? (
                      <Square className="h-4 w-4" fill="currentColor" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="sr-only">{isStreaming ? '暂停' : '发送'}</span>
                  </Button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-3">
                  AI 生成内容可能不准确，请核实重要信息。
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* 岗位描述编辑弹窗 */}
      <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>编辑目标岗位</DialogTitle>
            <DialogDescription>
              请详细描述您的目标岗位要求，JD 越详细，模拟面试越精准。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={tempJobDescription}
              onChange={(e) => setTempJobDescription(e.target.value)}
              className="min-h-[300px] max-h-[60vh] resize-none text-base leading-relaxed overflow-y-auto"
              placeholder="粘贴完整的职位描述(JD)..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJobDialogOpen(false)}>取消</Button>
            <Button onClick={() => {
              setJobDescription(tempJobDescription);
              setIsJobDialogOpen(false);
            }} className="bg-teal-600 hover:bg-teal-700">确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
