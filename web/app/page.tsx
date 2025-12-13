"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { PanelLeft, Bot, Loader2, Award, Plus, MessageCircle, FileText, ArrowDown, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/ChatMessage";
import { SessionSidebar } from "@/components/SessionSidebar";
import { AbilityProfileView } from "@/components/AbilityProfileView";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SessionProfileDialog } from "@/components/SessionProfileDialog";
import { useInterviewStore } from "@/store/useInterviewStore";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { getUserId } from "@/hooks/useUserIdentity";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster, toast } from "sonner";
import { ResumeTools } from "@/components/ResumeTools";
import { LandingPage } from "@/components/LandingPage";
import { InterviewSetup } from "@/components/interview/InterviewSetup";
import { GuidePage } from "@/components/GuidePage"; // Added GuidePage import

// 定义视图类型，包含 'landing'
type ViewType = "landing" | "interview" | "resume" | "guide"; // Updated ViewType

export default function InterviewPage() {
  // ===== 局部 UI 状态 =====
  const [showSidebar, setShowSidebar] = useState(true);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [input, setInput] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  // const [isJobDialogOpen, setIsJobDialogOpen] = useState(false); // Moved to InterviewSetup
  // const [tempJobDescription, setTempJobDescription] = useState(""); // Moved to InterviewSetup

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [showSessionProfileDialog, setShowSessionProfileDialog] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<ViewType>("landing");

  // 持久化视图状态
  useEffect(() => {
    const savedTab = localStorage.getItem("activeMainTab") as ViewType | null;
    if (savedTab && (savedTab === "resume" || savedTab === "interview" || savedTab === "landing")) {
      setActiveMainTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("activeMainTab", activeMainTab);
  }, [activeMainTab]);

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
    setShowAbilityProfile: setStoreShowAbilityProfile,
    apiError,
    clearApiError,
  } = useInterviewStore();

  // ===== 初始化 =====
  useEffect(() => {
    setIsMounted(true);
    fetchSessions(undefined, 'mock');
  }, [fetchSessions]);

  // ===== API 错误 Toast 提示 =====
  useEffect(() => {
    if (apiError) {
      toast.error(apiError, {
        description: '请检查 API 配置后重试',
        duration: 5000,
        action: {
          label: '去配置',
          onClick: () => setShowSettingsDialog(true),
        },
      });
      clearApiError();
    }
  }, [apiError, clearApiError]);

  // ===== 语音输入 =====
  const { isListening, toggleListening } = useSpeechToText({
    onTranscript: (text) => {
      setInput((prev) => prev + text);
    }
  });

  // ===== 事件处理 =====

  // Resume upload handler for InterviewSetup
  const handleUploadResume = async (file: File) => {
    await uploadResume(file);
  };

  const handleStartInterview = async () => {
    try {


      await startInterview();
    } catch (error) {
      console.error('启动面试失败:', error);
      // apiError 已在 store 中设置，useEffect 会自动显示 toast
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
  // Note: Sidebar handles session selection.
  const handleSessionSelect = async (sessionId: string) => {
    await selectSession(sessionId);
    setStoreShowAbilityProfile(false);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const handleNewSession = () => {
    createNewSession();
    setStoreShowAbilityProfile(false);

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

  // API 配置状态 - 使用 useMemo 确保 apiConfig 变化时重新计算
  const hasApiConfig = useMemo(() => {
    const smartModel = apiConfig.models.find(m => m.id === apiConfig.smartModelId);
    const fastModel = apiConfig.models.find(m => m.id === apiConfig.fastModelId);
    return !!(smartModel?.apiKey && fastModel?.apiKey);
  }, [apiConfig]);

  // 防止 Hydration 错误
  // 导航处理函数
  const handleNavigate = (page: ViewType) => {
    // 如果要去使用指南，直接放行
    if (page === 'guide') {
      setActiveMainTab(page);
      return;
    }

    // 检查 API 配置
    const isConfigured = useInterviewStore.getState().isConfigured();
    if (!isConfigured) {
      toast.error("请先配置 API 参数", {
        description: "使用此功能需要先设置 API Key 和模型参数",
        action: {
          label: "去配置",
          onClick: () => setShowSettingsDialog(true),
        },
      });
      setShowSettingsDialog(true);
      return;
    }

    setShowSessionProfileDialog(false);
    setActiveMainTab(page);
  };

  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // 判断是否显示面试配置页
  // 逻辑：没有消息且没有当前会话，且不在流式传输中
  const showSetup = messages.length === 0 && !currentSession && !isStreaming;

  // 根据 activeMainTab 渲染不同视图
  if (activeMainTab === 'landing') {
    return (
      <>
        <LandingPage onNavigate={handleNavigate} />
        <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />
      </>
    );
  }

  if (activeMainTab === 'guide') {
    return <GuidePage onBack={() => setActiveMainTab('landing')} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1d1d1f] font-sans antialiased">

      {/* 侧边栏 */}
      <SessionSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onOpenSettings={() => setShowSettingsDialog(true)}
        currentView={activeMainTab as "interview" | "resume"}
        onViewChange={(view) => setActiveMainTab(view)}
      />

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col h-full relative bg-white overflow-hidden">

        {/* 顶部导航栏 */}
        <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="mx-auto px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!showSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSidebar(true)}
                  className="hover:bg-gray-100 text-gray-500"
                >
                  <PanelLeft className="w-5 h-5" />
                </Button>
              )}

              {/* 标题 */}
              <div className="flex items-center gap-2 font-medium text-gray-700">
                {activeMainTab === "interview" ? (
                  <>
                    <MessageCircle size={18} className="text-teal-600" />
                    <span>模拟面试</span>
                  </>
                ) : (
                  <>
                    <FileText size={18} className="text-teal-600" />
                    <span>简历工具</span>
                  </>
                )}
              </div>
            </div>
            {/* Back to Home Button? Optional, maybe user can just use sidebar to navigate types, but Landing is outside sidebar */}
            <Button variant="ghost" size="sm" onClick={() => setActiveMainTab('landing')} className="text-gray-500 text-xs">
              返回首页
            </Button>
          </div>
        </div>

        {/* 视图切换逻辑 */}
        {activeMainTab === "resume" ? (
          /* 简历工具视图 */
          <div className="flex-1 overflow-hidden p-6">
            <div className="max-w-6xl mx-auto h-full">
              <ResumeTools
                apiConfig={hasApiConfig ? useInterviewStore.getState().getApiConfigForRequest() : null}
                resumeContent={resume?.content || ""}
                onResumeChange={(content) => {
                  // 可以同步简历内容到 store，但这里简化处理
                }}
              />
            </div>
          </div>
        ) : showAbilityProfile ? (
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
                  <Award className="w-4 h-4" />
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
        ) : showSetup ? (
          // 面试配置页 (New Session / Setup)
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 relative bg-gray-50/30">
            {/* 背景装饰 */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50/50 via-white to-white pointer-events-none" />

            <div className="w-full max-w-3xl mx-auto relative z-10">
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">开启新的模拟面试</h1>
                <p className="text-gray-500">配置您的简历和目标岗位，AI 面试官将为您量身定制面试问题</p>
              </div>

              <InterviewSetup
                resume={resume}
                onUploadResume={handleUploadResume}
                jobDescription={jobDescription}
                onJobDescriptionChange={setJobDescription}
                companyInfo={companyInfo}
                onCompanyInfoChange={setCompanyInfo}
                maxQuestions={maxQuestions}
                onMaxQuestionsChange={setMaxQuestions}
                isLoading={isLoading}
                hasApiConfig={hasApiConfig}
                onStartInterview={handleStartInterview}
                onConfigureApi={() => setShowSettingsDialog(true)}
              />
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
                <div className="max-w-3xl mx-auto pt-6 pb-2 space-y-6">
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
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>



              {/* 输入区域 */}
              <div className="relative w-full bg-white border-t border-gray-100 px-6 py-4 z-20">
                <div className="max-w-3xl mx-auto relative">
                  {/* 滚动到底部按钮 - 移动到输入框上方，确保不被遮挡 */}
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
                  {/* 开启下一轮面试按钮 - 仅在面试完成时显示 */}
                  {interviewProgress &&
                    interviewProgress.current >= interviewProgress.total &&
                    currentSession?.metadata.status === 'completed' && (
                      <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            {/* 判断是否为最后一轮（第3轮） */}
                            {(currentSession.metadata.round_index ?? 1) >= 3 ? (
                              <>
                                <h4 className="font-semibold text-gray-900 mb-1">🎉 所有面试已结束！</h4>
                                <p className="text-sm text-gray-600">
                                  恭喜您完成了全部 3 轮面试，点击查看本轮能力画像
                                </p>
                              </>
                            ) : (
                              <>
                                <h4 className="font-semibold text-gray-900 mb-1">面试已完成！</h4>
                                <p className="text-sm text-gray-600">
                                  继续进行下一轮面试，深入考察您的专业能力
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              onClick={() => setShowSessionProfileDialog(true)}
                              className="gap-2"
                            >
                              <Award className="w-4 h-4 text-pink-500" />
                              本轮能力画像
                            </Button>
                            {/* 仅在非最后一轮时显示下一轮选项 */}
                            {(currentSession.metadata.round_index ?? 1) < 3 && (
                              <>
                                <select
                                  id="next-round-questions"
                                  className="h-9 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                  defaultValue={5}
                                  onChange={(e) => {
                                    // 更新全局状态中的 maxQuestions
                                    useInterviewStore.setState({ maxQuestions: parseInt(e.target.value) });
                                  }}
                                >
                                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                                    <option key={n} value={n}>{n} 道题</option>
                                  ))}
                                </select>
                                <Button
                                  onClick={async () => {
                                    try {
                                      // 从 store 获取最新的题目数量
                                      const nextRoundQuestions = useInterviewStore.getState().maxQuestions;

                                      // 设置加载状态，清空消息以显示加载动画
                                      useInterviewStore.setState({
                                        isLoading: true,
                                        isStreaming: true,
                                        messages: [],
                                        interviewProgress: { current: 0, total: nextRoundQuestions }
                                      });

                                      // 1. 创建下一轮会话
                                      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/sessions/${currentSession.session_id}/next-round`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'X-User-ID': getUserId()
                                        },
                                        body: JSON.stringify({
                                          max_questions: nextRoundQuestions
                                        })
                                      });

                                      if (!response.ok) {
                                        const error = await response.json();
                                        throw new Error(error.message || '创建下一轮失败');
                                      }

                                      const data = await response.json();
                                      const newSessionId = data.session.session_id;

                                      // 2. 刷新会话列表并选择新会话
                                      await fetchSessions(undefined, 'mock');
                                      await selectSession(newSessionId);

                                      // 3. 直接调用 /chat/start，后端会从数据库加载继承的简历/JD
                                      const apiConfig = useInterviewStore.getState().getApiConfigForRequest();
                                      if (!apiConfig) {
                                        throw new Error('请先配置 API');
                                      }

                                      const startResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat/start`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          'X-User-ID': getUserId()
                                        },
                                        body: JSON.stringify({
                                          thread_id: newSessionId,
                                          mode: 'mock',
                                          max_questions: nextRoundQuestions,
                                          api_config: apiConfig,
                                        })
                                      });

                                      if (!startResponse.ok) {
                                        throw new Error('启动面试失败');
                                      }

                                      // 4. 处理流式响应
                                      const reader = startResponse.body?.getReader();
                                      if (reader) {
                                        const decoder = new TextDecoder();
                                        let buffer = '';

                                        while (true) {
                                          const { done, value } = await reader.read();
                                          if (done) {
                                            if (buffer.trim()) {
                                              try {
                                                const jsonData = JSON.parse(buffer);
                                                if (jsonData.first_question) {
                                                  useInterviewStore.setState({
                                                    messages: [{
                                                      role: 'ai',
                                                      content: jsonData.first_question,
                                                      timestamp: new Date().toISOString(),
                                                    }],
                                                    isLoading: false,
                                                    isStreaming: false,
                                                  });
                                                }
                                              } catch { }
                                            }
                                            break;
                                          }
                                          buffer += decoder.decode(value, { stream: true });
                                        }
                                      }

                                    } catch (error) {
                                      console.error('创建下一轮失败:', error);
                                      toast.error((error as Error).message || '创建下一轮失败');
                                      useInterviewStore.setState({ isLoading: false, isStreaming: false });
                                    }
                                  }}
                                  disabled={isLoading || isStreaming}
                                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2 disabled:opacity-50"
                                >
                                  {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                  {isLoading ? '准备中...' : '开启下一轮'}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* 判断面试是否已完成 */}
                  {(() => {
                    const isInterviewCompleted = !!(interviewProgress && interviewProgress.current >= interviewProgress.total);
                    return (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 relative flex">
                          {/* 输入框 Textarea */}
                          <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isInterviewCompleted ? "本轮面试已结束" : "输入您的回答..."}
                            disabled={isStreaming || isInterviewCompleted}
                            className={cn(
                              "w-full resize-none rounded-2xl border border-gray-200 py-3 pl-4 pr-12 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-50 min-h-[120px] max-h-[200px]",
                              isInterviewCompleted && "bg-gray-50 cursor-not-allowed opacity-60"
                            )}
                            rows={4}
                          />
                          {/* 语音按钮 */}
                          <button
                            onClick={toggleListening}
                            disabled={isInterviewCompleted}
                            className={cn(
                              "absolute right-3 bottom-3 p-2 rounded-full transition-colors",
                              isListening ? "bg-red-100 text-red-500 animate-pulse" : "hover:bg-gray-100 text-gray-400",
                              isInterviewCompleted && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                          </button>
                        </div>

                        <Button
                          onClick={isStreaming ? stopStreaming : handleSend}
                          disabled={!isStreaming && (!input.trim() || isInterviewCompleted)}
                          className={cn(
                            "h-[52px] w-[52px] rounded-2xl transition-all",
                            isStreaming
                              ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200"
                              : input.trim() && !isInterviewCompleted
                                ? "bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-200"
                                : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {isStreaming ? (
                            <Square className="w-5 h-5" fill="currentColor" />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                          )}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />
        <SessionProfileDialog
          open={showSessionProfileDialog}
          onOpenChange={setShowSessionProfileDialog}
          sessionId={currentSession?.session_id || ""}
        />
        <Toaster />
      </main>
    </div>
  );
}
