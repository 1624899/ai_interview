"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, PanelLeft, Bot, Sparkles, GraduationCap, Timer, Maximize2 } from "lucide-react";
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [tempJobDescription, setTempJobDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    rollbackChat
  } = useInterviewChat();

  const {
    sessions,
    currentSession,
    createSession,
    fetchSession,
    clearCurrentSession,
    fetchSessions,
    deleteSession,
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

    if (editingIndex !== null) {
      // 如果是编辑模式，先回退到该消息之前的状态
      await rollbackChat(editingIndex);
      setEditingIndex(null);
    }

    await sendMessage(content, false, threadId, jobDescription);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadResume(e.target.files[0]);
    }
  };

  const handleStartInterview = async () => {
    if (resume && jobDescription.trim()) {
      // 1. 创建新会话 (前端管理)
      const newSession = await createSession(mode, jobDescription.trim(), jobDescription.trim(), 5);

      if (newSession) {
        const newThreadId = newSession.session_id;
        setThreadId(newThreadId);

        // 2. 启动面试流程 (后端初始化 + 触发 AI 首句)
        try {
          await startInterview(jobDescription.trim(), resume, mode, newThreadId);

          // 3. 刷新会话列表以获取后端生成的最新标题
          await fetchSessions('active', mode);
        } catch (error) {
          console.error('启动面试时出错:', error);
        }
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
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="max-w-2xl w-full space-y-10 text-center">

              {/* Logo & 标题 */}
              <div className="space-y-4">
                <div className="w-20 h-20 bg-teal-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-teal-200">
                  <Bot className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                  面试<span className="text-teal-600">.AI</span>
                </h1>
                <p className="text-lg text-gray-500 max-w-md mx-auto">
                  您的智能面试教练。上传简历，选择模式，开始模拟面试。
                </p>
              </div>

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
            <ScrollArea className="h-full w-full">
              <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 pb-32">
                {messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    {...m}
                    onEdit={(content) => {
                      setInput(content);
                      setEditingIndex(i);
                    }}
                  />
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== 'ai' && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm pl-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 正在思考...
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* 底部输入框 */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent">
              <div className="max-w-3xl mx-auto relative">
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
                      input.trim() ? "bg-teal-600 hover:bg-teal-700" : "bg-gray-100 text-gray-400"
                    )}
                    onClick={handleSend}
                    disabled={isStreaming || !input.trim()}
                  >
                    {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="sr-only">发送</span>}
                    {!isStreaming && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
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
