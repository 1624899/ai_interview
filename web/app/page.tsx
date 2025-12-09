"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { PanelLeft, Bot, Sparkles, AlertCircle, Loader2, X, Upload, FileText, GraduationCap, Timer, Maximize2, Square, ArrowDown, Mic, Award, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/ChatMessage";
import { Textarea } from "@/components/ui/textarea";
import { SessionSidebar } from "@/components/SessionSidebar";
import { AbilityProfileView } from "@/components/AbilityProfileView";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useInterviewStore } from "@/store/useInterviewStore";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InterviewPage() {
  // ===== 局部 UI 状态 =====
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [input, setInput] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [tempJobDescription, setTempJobDescription] = useState("");
  const [interviewStartTime, setInterviewStartTime] = useState<string>("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // ===== Store 状态与方法 =====
  const {
    // 状态
    messages,
    isStreaming,
    isLoading,
    resume,
    jobDescription,
    companyInfo,
    interviewProgress,
    maxQuestions,
    currentSession,
    showAbilityProfile,
    apiConfig, // 订阅 apiConfig 以便配置更新时自动刷新
    sessions,
    sessionLoading,
    threadId,

    // 方法
    fetchSessions,
    selectSession,
    createNewSession,
    deleteSession,
    updateSessionTitle,
    togglePinSession,
    setJobDescription,
    setCompanyInfo,
    setMaxQuestions,
    uploadResume,
    startInterview,
    sendMessage,
    stopStreaming,
    rollbackChat,
    clearMessages,
    restoreMessages,
    setInterviewProgress,
    setShowAbilityProfile: setStoreShowAbilityProfile
  } = useInterviewStore();

  // ===== 初始化 =====
  useEffect(() => {
    setIsMounted(true);
    fetchSessions('active', 'mock');
  }, [fetchSessions]);

  // ===== 语音输入 =====
  const { isListening, toggleListening } = useSpeechToText({
    onTranscript: (text) => {
      setInput((prev) => prev + text);
    }
  });

  // ===== 事件处理 =====

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await uploadResume(e.target.files[0]);
    }
  };

  const handleStartInterview = async () => {
    try {
      // 记录面试开始时间
      const now = new Date();
      const timeString = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      setInterviewStartTime(timeString);

      await startInterview();
    } catch (error) {
      console.error('启动面试失败:', error);
      // 这里可以添加 toast 提示
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const content = input;
    setInput("");
    await sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ===== 消息编辑和重新生成 =====
  const handleEditMessage = async (index: number, newContent: string) => {
    if (isStreaming) return;
    // 回退到该消息之前的状态
    await rollbackChat(index);
    // 直接发送编辑后的消息
    await sendMessage(newContent);
  };

  const handleRegenerateMessage = async (aiMessageIndex: number) => {
    if (isStreaming) return;

    // 特殊处理：如果是第一条消息（AI开场白），则重新开始面试流程
    if (aiMessageIndex === 0) {
      await rollbackChat(0);
      if (resume) {
        await startInterview();
      }
      return;
    }

    // 找到对应的用户消息（AI消息的前一条应该是用户消息）
    const userMessageIndex = aiMessageIndex - 1;
    if (userMessageIndex < 0 || messages[userMessageIndex].role !== 'user') {
      console.error('无法找到对应的用户消息');
      return;
    }

    const userMessage = messages[userMessageIndex];
    // 回退到用户消息之前的状态
    await rollbackChat(userMessageIndex);
    // 重新发送原有的用户消息
    await sendMessage(userMessage.content);
  };

  // ===== 会话管理 =====
  const handleSessionSelect = async (sessionId: string) => {
    await selectSession(sessionId);
    // 确保关闭能力画像
    setStoreShowAbilityProfile(false);
    // 如果是移动端，选择后自动关闭侧边栏
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleNewSession = () => {
    createNewSession();
    setStoreShowAbilityProfile(false);
    setInterviewStartTime("");
  };

  const handleEditSession = async (sessionId: string, newTitle: string) => {
    await updateSessionTitle(sessionId, newTitle);
  };

  const handleTogglePin = async (sessionId: string, pinned: boolean) => {
    await togglePinSession(sessionId, pinned);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
    setAutoScrollEnabled(true);
  };

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

  // 自动滚动效果
  useEffect(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScrollEnabled]);

  // 防止 Hydration 错误
  if (!isMounted) return null;

  // 判断是否显示欢迎页
  // 逻辑：没有消息且没有当前会话，且不在流式传输中
  const showWelcome = messages.length === 0 && !currentSession && !isStreaming;

  // API 配置状态 - 使用 useMemo 确保 apiConfig 变化时重新计算
  const hasApiConfig = useMemo(() => {
    const smartModel = apiConfig.models.find(m => m.id === apiConfig.smartModelId);
    const fastModel = apiConfig.models.find(m => m.id === apiConfig.fastModelId);
    return !!(smartModel?.apiKey && fastModel?.apiKey);
  }, [apiConfig]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1d1d1f] font-sans antialiased">

      {/* 侧边栏 */}
      <SessionSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onOpenSettings={() => setShowSettingsDialog(true)}
      />

      {/* 主内容区域 */}
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

        {/* 视图切换逻辑 */}
        {showAbilityProfile ? (
          // 能力画像视图
          <div className="flex-1 flex flex-col h-full relative">
            <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStoreShowAbilityProfile(false)}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  返回对话
                </Button>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">综合能力画像</h2>
                  <p className="text-xs text-gray-500">基于最近5次面试的综合分析</p>
                </div>
              </div>
            </div>
            <AbilityProfileView />
          </div>
        ) : showWelcome ? (
          // 欢迎页 / 配置页
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 relative">
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-white to-white pointer-events-none" />

            <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
              {/* 左侧：介绍 */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-200 mb-6">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 leading-tight">
                    AI 模拟面试<br />
                    <span className="text-teal-600">助你拿到理想 Offer</span>
                  </h1>
                  <p className="text-lg text-gray-500 leading-relaxed max-w-md">
                    上传简历，粘贴职位描述，立即开始一场真实的模拟面试。获取实时反馈，提升面试技巧。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">智能追问</h3>
                    <p className="text-sm text-gray-500">基于上下文的深度追问</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center mb-3">
                      <Award className="w-4 h-4 text-pink-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">能力评估</h3>
                    <p className="text-sm text-gray-500">多维度的能力画像分析</p>
                  </div>
                </div>
              </div>

              {/* 右侧：配置表单 */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-8">
                {/* 1. 上传简历 */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold">1</span>
                    上传简历 (PDF/Word)
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.md"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={cn(
                      "w-full h-14 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all",
                      resume
                        ? "border-teal-200 bg-teal-50 text-teal-700"
                        : "border-gray-200 bg-gray-50 text-gray-400 group-hover:border-teal-300 group-hover:bg-teal-50/30"
                    )}>
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : resume ? (
                        <>
                          <FileText className="w-5 h-5" />
                          <span className="font-medium truncate max-w-[200px]">{resume.original_name}</span>
                          <span className="text-xs bg-teal-200/50 px-2 py-0.5 rounded-full">已上传</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span className="font-medium">点击上传简历</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. 职位描述 - 点击弹窗编辑 */}
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
                      "min-h-[100px] max-h-[100px] overflow-hidden relative"
                    )}>
                      {jobDescription ? (
                        <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">{jobDescription}</p>
                      ) : (
                        <p className="text-gray-400">例如：高级Java工程师，要求熟悉Spring Boot和微服务架构...</p>
                      )}

                      {/* 悬停遮罩和提示 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-teal-600 font-medium flex items-center gap-1 bg-white/90 px-3 py-1 rounded-full shadow-sm text-xs">
                          <Maximize2 className="w-3 h-3" /> 点击展开编辑
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2.5. 公司信息 (选填) */}
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
                    placeholder="大厂、创业公司、外企等（主要业务、规模大小）"
                  />
                  <p className="text-xs text-gray-400">
                    提供公司信息可以让面试题目更贴近实际场景
                  </p>
                </div>

                {/* 3. 设置问题数量 */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-600 text-xs font-bold">3</span>
                    面试问题数量 (3-10)
                  </label>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="3"
                      max="10"
                      step="1"
                      value={maxQuestions}
                      onChange={(e) => setMaxQuestions(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                    />
                    <div className="w-12 h-10 flex items-center justify-center bg-teal-50 border border-teal-100 rounded-lg text-teal-700 font-semibold">
                      {maxQuestions}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    建议设置为 5 个问题，既能充分展示能力，又不会过于疲劳
                  </p>
                </div>

                {/* API 配置提示 */}
                {!hasApiConfig && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900">需要配置 API</p>
                      <p className="text-xs text-amber-700 mt-1">
                        请先在右上角设置中配置您的大模型 API，才能开始使用面试功能
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettingsDialog(true)}
                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      去配置
                    </Button>
                  </div>
                )}

                {/* 4. 开始按钮 */}
                <Button
                  className="w-full h-12 text-base font-medium bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleStartInterview}
                  disabled={!resume || !jobDescription.trim() || isLoading || !hasApiConfig}
                >
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  开始面试
                </Button>

              </div>
            </div>
          </div>
        ) : (
          // 聊天界面
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 面试进度条 - 仅在有消息时显示 */}
            {interviewProgress && interviewProgress.total > 0 && messages.length > 0 && (
              <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-6 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          interviewProgress.current >= interviewProgress.total ? "bg-gray-400" : "bg-teal-500 animate-pulse"
                        )}></div>
                        <span className="font-medium text-gray-700">
                          {interviewProgress.current >= interviewProgress.total ? "面试已完成" : "面试进行中"}
                        </span>
                      </div>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">
                        问题 {Math.min(interviewProgress.current + 1, interviewProgress.total)} / {interviewProgress.total}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Timer className="w-4 h-4" />
                        <span>{interviewStartTime || '--:--'}</span>
                      </div>
                    </div>
                  </div>
                  {/* 进度条 */}
                  <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(interviewProgress.current / interviewProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 聊天区域 */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
              <ScrollArea className="flex-1 px-4 overflow-hidden" viewportRef={scrollViewportRef} onScroll={handleScroll}>
                <div className="max-w-3xl mx-auto py-6 space-y-6">
                  {/* 初始加载状态：当正在加载或流式传输且没有消息时显示 */}
                  {(isLoading || isStreaming) && messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in duration-500">
                      <div className="relative">
                        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                          <Bot className="w-4 h-4 text-teal-600" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-medium text-gray-900">正在为您准备面试...</h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">
                          AI 面试官正在阅读您的简历并生成个性化问题，请稍候。
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, index) => (
                    <ChatMessage
                      key={index}
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      onEdit={msg.role === 'user' ? (content) => handleEditMessage(index, content) : undefined}
                      onRegenerate={msg.role === 'ai' ? () => handleRegenerateMessage(index) : undefined}
                    />
                  ))}

                  {/* 后续对话的思考状态：仅在流式传输中且最后一条消息是用户消息时显示 */}
                  {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
                    <div className="flex items-center gap-2 text-gray-400 text-sm px-4 animate-pulse">
                      <Bot className="w-4 h-4" />
                      <span>面试官正在思考...</span>
                    </div>
                  )}
                  {/* 底部留白 */}
                  <div className="h-4" />
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* 输入区域 */}
              <div className="relative w-full bg-white border-t border-gray-100 px-6 py-4 z-20">
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

                  <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
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
                      variant="ghost"
                      className={cn(
                        "absolute right-14 bottom-2 h-9 w-9 transition-all hover:bg-gray-100 text-gray-400",
                        isListening && "text-red-500 hover:text-red-600 hover:bg-red-50 animate-pulse"
                      )}
                      onClick={toggleListening}
                      title={isListening ? "停止录音" : "语音输入"}
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
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
            </div>
          </div>
        )}
      </main>

      {/* 职位描述编辑弹窗 */}
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

      {/* 设置弹窗 */}
      <SettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
      />
    </div>
  );
}
