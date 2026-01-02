"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, BarChart3, FileText, BrainCircuit, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ResumeProcessingViewProps {
    type: 'analyze' | 'optimize';
    message?: string;
}

export function ResumeProcessingView({ type, message }: ResumeProcessingViewProps) {
    const [dots, setDots] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => (prev.length >= 3 ? "" : prev + "."));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const config = {
        analyze: {
            title: "竞争力分析中",
            description: "AI 正在多维度评估您的简历竞争力...",
            icon: BarChart3,
            color: "from-teal-500 to-emerald-400",
            glow: "rgba(20, 184, 166, 0.15)",
            steps: [
                "解析简历结构与完整度",
                "评估工作量化指标",
                "分析核心亮点与技术深度",
                "匹配目标岗位需求"
            ]
        },
        optimize: {
            title: "内容深度优化中",
            description: "AI 专家正在为您生成针对性的优化建议...",
            icon: FileText,
            color: "from-blue-500 to-indigo-400",
            glow: "rgba(59, 130, 246, 0.15)",
            steps: [
                "识别 JD 关键技能要求",
                "查漏补缺缺失关键词",
                "强化项目描述吸引力",
                "生成 HR 视角通过率预估"
            ]
        }
    };

    const current = config[type];
    const Icon = current.icon;

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50/30 rounded-xl relative overflow-hidden min-h-[500px]">
            {/* 背景动态装饰 */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full blur-[80px]"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                style={{ backgroundColor: current.glow }}
            />

            <div className="relative z-10 flex flex-col items-center max-w-md w-full">
                {/* 核心 Icon 动画 */}
                <div className="relative mb-12">
                    <motion.div
                        className={cn(
                            "w-24 h-24 rounded-[2rem] flex items-center justify-center shadow-2xl text-white",
                            "bg-gradient-to-tr",
                            current.color
                        )}
                        animate={{
                            y: [0, -15, 0],
                            rotate: [3, 5, 3],
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <motion.div
                            animate={{ opacity: [0.8, 1, 0.8] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Icon size={48} />
                        </motion.div>
                    </motion.div>

                    {/* 环绕的小图标 */}
                    <motion.div
                        className="absolute -top-4 -right-4 w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center"
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Sparkles size={20} className="text-amber-400 fill-amber-400" />
                    </motion.div>

                    <motion.div
                        className="absolute -bottom-4 -left-4 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    >
                        <BrainCircuit size={24} className="text-teal-600" />
                    </motion.div>

                    <motion.div
                        className="absolute top-1/2 -right-16 -translate-y-1/2 opacity-20"
                        animate={{ opacity: [0.1, 0.3, 0.1], scale: [0.9, 1.1, 0.9] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        <Zap size={32} className="text-teal-400" />
                    </motion.div>
                </div>

                {/* 文字内容 */}
                <div className="text-center space-y-4 mb-10 w-full">
                    <motion.h2
                        className="text-2xl font-bold text-gray-900 flex items-center justify-center gap-2"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {message || current.title}{dots}
                    </motion.h2>
                    <motion.p
                        className="text-gray-500 text-sm leading-relaxed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {current.description}
                    </motion.p>
                </div>

                {/* 进度步长展示 */}
                <div className="w-full space-y-3">
                    {current.steps.map((step, idx) => (
                        <motion.div
                            key={idx}
                            className="flex items-center gap-3 p-3 bg-white/60 backdrop-blur-sm border border-white/50 rounded-xl shadow-sm"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + idx * 0.1 }}
                        >
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center">
                                <Loader2 size={12} className="text-teal-600 animate-spin" />
                            </div>
                            <span className="text-xs text-gray-600 font-medium">{step}</span>
                        </motion.div>
                    ))}
                </div>

                {/* 底部流光进度条 */}
                <div className="mt-12 w-full max-w-[240px] h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                    <motion.div
                        className={cn(
                            "absolute top-0 bottom-0 bg-gradient-to-r",
                            current.color
                        )}
                        animate={{
                            left: ["-100%", "100%"],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        style={{ width: "100%" }}
                    />
                </div>
            </div>
        </div>
    );
}
