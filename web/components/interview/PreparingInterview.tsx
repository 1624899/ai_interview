import { Loader2, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreparingInterviewProps {
    variant?: 'light' | 'dark';
}

export function PreparingInterview({ variant = 'light' }: PreparingInterviewProps) {
    const isDark = variant === 'dark';

    return (
        <div className={cn(
            "flex flex-col items-center justify-center py-20 px-10 space-y-8 animate-in fade-in zoom-in duration-700 relative overflow-hidden",
            isDark ? "text-white" : "text-gray-900"
        )}>
            {/* 背景装饰球 */}
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl animate-pulse",
                isDark ? "bg-indigo-500/10" : "bg-teal-200/20"
            )} />
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-2xl animate-pulse delay-700",
                isDark ? "bg-purple-500/10" : "bg-blue-200/20"
            )} />

            <div className="relative">
                <div className={cn(
                    "w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl rotate-3 animate-bounce",
                    isDark ? "bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-indigo-500/30" : "bg-gradient-to-tr from-teal-500 to-emerald-400 shadow-teal-200/50"
                )}>
                    <Bot className="w-12 h-12 text-white" />
                </div>
                <div className={cn(
                    "absolute -top-2 -right-2 rounded-xl p-2 shadow-lg animate-spin-slow",
                    isDark ? "bg-slate-800" : "bg-white"
                )}>
                    <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
                <div className={cn(
                    "absolute -bottom-4 -left-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg animate-pulse",
                    isDark ? "bg-slate-800" : "bg-white"
                )}>
                    <Loader2 className={cn("w-6 h-6 animate-spin", isDark ? "text-indigo-400" : "text-teal-600")} />
                </div>
            </div>

            <div className="text-center space-y-3 relative z-10">
                <h3 className={cn(
                    "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r",
                    isDark ? "from-white via-indigo-100 to-white" : "from-gray-900 via-gray-800 to-gray-900"
                )}>
                    正在为您准备面试...
                </h3>
                <div className="flex flex-col items-center gap-2">
                    <p className={cn(
                        "max-w-xs mx-auto leading-relaxed",
                        isDark ? "text-white/60" : "text-gray-500"
                    )}>
                        AI 面试官正在深度分析您的简历
                    </p>
                    <div className="flex gap-1">
                        <span className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-indigo-400" : "bg-teal-400")} style={{ animationDelay: '0ms' }} />
                        <span className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-indigo-400" : "bg-teal-400")} style={{ animationDelay: '150ms' }} />
                        <span className={cn("w-1 h-1 rounded-full animate-bounce", isDark ? "bg-indigo-400" : "bg-teal-400")} style={{ animationDelay: '300ms' }} />
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 8s linear infinite;
                }
            `}</style>
        </div>
    );
}
