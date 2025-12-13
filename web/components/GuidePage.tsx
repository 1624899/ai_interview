"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, FileText, ArrowLeft, Upload, Settings, MessageSquare, FileOutput, Search, PenTool, UserCheck, Layout, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuidePageProps {
    onBack: () => void;
}

export function GuidePage({ onBack }: GuidePageProps) {
    const [activeTab, setActiveTab] = useState<"interview" | "resume">("interview");

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-gray-100">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Button>
                        <div className="font-bold text-xl text-gray-900 flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white shadow-md">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            使用指南
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 pt-24 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* 介绍 */}
                    <div className="text-center mb-12 space-y-4">
                        <h1 className="text-4xl font-bold text-gray-900">如何使用 AI 求职助手？</h1>
                        <p className="text-lg text-gray-500">只需几步，轻松开启您的智能化求职准备之旅</p>
                    </div>

                    {/* 选项卡 */}
                    <div className="flex justify-center mb-12">
                        <div className="bg-gray-100 p-1.5 rounded-full inline-flex">
                            <button
                                onClick={() => setActiveTab("interview")}
                                className={cn(
                                    "px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                                    activeTab === "interview"
                                        ? "bg-white text-teal-600 shadow-md transform scale-105"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <Bot className="w-4 h-4" />
                                AI 模拟面试
                            </button>
                            <button
                                onClick={() => setActiveTab("resume")}
                                className={cn(
                                    "px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2",
                                    activeTab === "resume"
                                        ? "bg-white text-blue-600 shadow-md transform scale-105"
                                        : "text-gray-500 hover:text-gray-900"
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                简历智能优化
                            </button>
                        </div>
                    </div>

                    {/* 内容 */}
                    <div className="relative min-h-[500px]">
                        {/* 模拟面试指南 */}
                        <div className={cn(
                            "transition-all duration-500 absolute top-0 left-0 w-full",
                            activeTab === "interview"
                                ? "opacity-100 translate-x-0 z-10"
                                : "opacity-0 -translate-x-10 z-0 pointer-events-none"
                        )}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <GuideCard
                                    step="01"
                                    title="配置 API 设置"
                                    description="在使用任何功能前，请点击左下角的设置按钮，配置您的 LLM API Key,并测试链接是否正常。这是智能体运行的基础。"
                                    icon={<Settings className="w-6 h-6 text-white" />}
                                    color="bg-teal-500"
                                />
                                <GuideCard
                                    step="02"
                                    title="上传简历与职位描述"
                                    description="上传您的 PDF 简历，粘贴目标职位的 JD，添加公司信息（可选），配置题目数量。AI 将基于以上内容为您生成定制化的面试问题。"
                                    icon={<Upload className="w-6 h-6 text-white" />}
                                    color="bg-teal-500"
                                />
                                <GuideCard
                                    step="03"
                                    title="专业性面试"
                                    description="对话框回答您可以选择同步打开语音输入。支持进阶面试对您的能力与岗位匹配程度进行深度评估，总共3轮。"
                                    icon={<MessageSquare className="w-6 h-6 text-white" />}
                                    color="bg-teal-500"
                                />
                                <GuideCard
                                    step="04"
                                    title="获取评估报告"
                                    description="每轮面试结束后，可以获取详细的评分报告、能力画像。包含优势、不足及改进建议。"
                                    icon={<FileOutput className="w-6 h-6 text-white" />}
                                    color="bg-teal-500"
                                />
                            </div>
                        </div>

                        {/* 简历智能优化指南 */}
                        <div className={cn(
                            "transition-all duration-500 absolute top-0 left-0 w-full",
                            activeTab === "resume"
                                ? "opacity-100 translate-x-0 z-10"
                                : "opacity-0 translate-x-10 z-0 pointer-events-none"
                        )}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <GuideCard
                                    step="01"
                                    title="配置 API 设置"
                                    description="同样需要先配置好 API Key。我们支持 OpenAI 及兼容协议的模型，简历助手请尽量选择非免费API，避免运行失败。"
                                    icon={<Settings className="w-6 h-6 text-white" />}
                                    color="bg-blue-500"
                                />
                                <GuideCard
                                    step="02"
                                    title="导入原始简历"
                                    description="将现有的简历内容粘贴到工具中，或直接上传 PDF 文档进行智能解析。"
                                    icon={<Upload className="w-6 h-6 text-white" />}
                                    color="bg-blue-500"
                                />
                                <GuideCard
                                    step="03"
                                    title="智能诊断与优化"
                                    description="三位 AI 专家（分析师、优化师、HR）协同工作，基于目标 JD 对简历进行全方位诊断和提出内容优化建议。"
                                    icon={<UserCheck className="w-6 h-6 text-white" />}
                                    color="bg-blue-500"
                                />
                                <GuideCard
                                    step="04"
                                    title="简历生成"
                                    description="内容优化建议生成后，您可以直接点击生成简历按钮，AI 将根据您的优化建议生成一份全新的简历。"
                                    icon={<Layout className="w-6 h-6 text-white" />}
                                    color="bg-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function GuideCard({ step, title, description, icon, color }: { step: string, title: string, description: string, icon: React.ReactNode, color: string }) {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xl shadow-gray-100/50 hover:shadow-2xl hover:shadow-gray-200/50 transition-all hover:-translate-y-1 group">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform", color)}>
                    {icon}
                </div>
                <span className="text-5xl font-black text-gray-300 select-none group-hover:text-gray-500 transition-colors">{step}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 leading-relaxed text-sm">
                {description}
            </p>
        </div>
    )
}
