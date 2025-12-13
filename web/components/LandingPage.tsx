"use client";

import { Bot, FileText, Stethoscope, Wand2, ArrowRight, CheckCircle2, TrendingUp, Calendar, Zap, Star, Download, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LandingPageProps {
    onNavigate: (page: "interview" | "resume" | "guide") => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
    const scrollToFeatures = () => {
        const featuresSection = document.getElementById('features-section');
        if (featuresSection) {
            featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* 顶部导航 */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xl text-gray-900">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg shadow-lg shadow-teal-200" />
                        <span>面面-AI求职助手</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-15 text-base font-medium text-gray-600">
                        <span
                            className="cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={scrollToFeatures}
                        >
                            功能特性
                        </span>
                        <span
                            className="cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => onNavigate("guide")}
                        >
                            使用指南
                        </span>
                        <span className="cursor-pointer hover:text-teal-600 transition-colors">关于我们</span>
                    </nav>

                    <Button
                        onClick={() => onNavigate("interview")}
                        className="bg-gray-900 hover:bg-gray-800 text-white rounded-full px-6 shadow-none"
                    >
                        开始使用
                    </Button>
                </div>
            </header>

            {/* 首页头图 */}
            <main className="flex-1">
                <section className="pt-45 pb-40 px-6">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                        {/* 左侧内容 */}
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 border border-teal-100 rounded-full text-teal-700 text-sm font-medium">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                                </span>
                                AI 驱动的面试与简历专家
                            </div>

                            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight leading-[1.1]">
                                求职准备的<br />
                                <span className="relative inline-block mt-2">
                                    数字核心引擎
                                    <svg className="absolute w-full h-3 -bottom-1 left-0 text-teal-400 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                                        <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" opacity="0.4" />
                                    </svg>
                                </span>
                            </h1>

                            <p className="text-lg text-gray-500 leading-relaxed max-w-lg">
                                不仅仅是简单的问答。我们引入了<b>匹配分析师</b>、<b>内容优化师</b>与<b>HR审核官</b>等多位 AI 专家，为你提供圆桌会议式的简历诊断与优化服务，并配合全真模拟面试，助你拿下理想 Offer。
                            </p>

                            <div className="flex flex-wrap gap-4 pt-4">
                                <Button
                                    size="lg"
                                    onClick={() => onNavigate("interview")}
                                    className="h-14 px-8 rounded-full bg-teal-600 hover:bg-teal-500 text-white shadow-xl shadow-teal-200 text-base font-semibold transition-all hover:-translate-y-0.5"
                                >
                                    立即开始模拟面试 <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>

                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => onNavigate("resume")}
                                    className="h-14 px-8 rounded-full border-gray-200 hover:border-teal-200 hover:bg-teal-50 text-gray-700 text-base font-semibold"
                                >
                                    <FileText className="mr-2 w-5 h-5" />
                                    专家简历诊断
                                </Button>
                            </div>

                            <div className="pt-8 grid grid-cols-2 gap-6 max-w-lg">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">多轮面试模拟</h4>
                                        <p className="text-xs text-gray-500 mt-1">还原真实面试场景</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">个人画像生成</h4>
                                        <p className="text-xs text-gray-500 mt-1">多维度能力评估</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                        <Stethoscope className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">专家精确会诊</h4>
                                        <p className="text-xs text-gray-500 mt-1">匹配/内容/HR 三维诊断</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                                        <TrendingUp className="w-5 h-5 text-gray-700" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900">JD 定向优化</h4>
                                        <p className="text-xs text-gray-500 mt-1">基于目标职位的精准优化</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 右侧内容 - 模型 */}
                        <div className="relative animate-in fade-in slide-in-from-right-5 duration-1000 delay-200 hidden lg:block">
                            {/* 背景装饰 */}
                            <div className="absolute -top-20 -right-20 w-96 h-96 bg-teal-100/50 rounded-full blur-3xl opacity-50" />
                            <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-100/50 rounded-full blur-3xl opacity-50" />

                            {/* 模型卡片容器 */}
                            <div className="relative bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 max-w-lg mx-auto transform rotate-1 hover:rotate-0 transition-transform duration-500">

                                {/* 仪表板标题 */}
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <div className="text-xs text-gray-400 font-medium mb-1">DASHBOARD</div>
                                        <div className="font-bold text-gray-900 text-lg">求职竞争力分析</div>
                                    </div>
                                    <div className="flex -space-x-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] text-blue-600 font-bold" title="匹配分析师">M</div>
                                        <div className="w-8 h-8 rounded-full bg-purple-100 border-2 border-white flex items-center justify-center text-[10px] text-purple-600 font-bold" title="内容优化师">C</div>
                                        <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-[10px] text-orange-600 font-bold" title="HR审核官">H</div>
                                    </div>
                                </div>

                                {/* 主要统计卡片 */}
                                <div className="flex gap-4 mb-6">
                                    <div className="flex-1 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-teal-200 transform hover:-translate-y-1 transition-transform">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                                <FileText className="w-5 h-5 text-white" />
                                            </div>
                                            <span className="text-teal-100 text-xs font-medium bg-white/10 px-2 py-1 rounded-full">进行中</span>
                                        </div>
                                        <div className="text-lg font-bold mb-1">专家诊断中</div>
                                        <div className="text-teal-100 text-[10px] opacity-80">三位 AI 专家正在分析您的简历...</div>
                                    </div>

                                    <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm transform hover:-translate-y-1 transition-transform">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-blue-600" />
                                            </div>
                                        </div>
                                        <div className="text-3xl font-bold text-gray-900 mb-1">12<span className="text-lg text-gray-400 font-normal">场</span></div>
                                        <div className="text-gray-500 text-sm">实战模拟面试</div>
                                    </div>
                                </div>

                                {/* 列表项 - 漂浮卡片效果 */}
                                <div className="relative">
                                    <div className="text-xs text-gray-400 font-medium mb-3 uppercase tracking-wider">最新优化建议</div>

                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 group cursor-pointer hover:border-teal-200 transition-all">
                                        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg group-hover:bg-purple-100 transition-colors">
                                            <Star className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-900 text-sm">STAR 法则应用建议</h4>
                                            <div className="mt-1 text-xs text-gray-500 line-clamp-1">
                                                建议将"负责前端开发"修改为"主导..."
                                            </div>
                                        </div>
                                        <Button size="icon" variant="ghost" className="rounded-full bg-gray-50 group-hover:bg-teal-600 group-hover:text-white transition-all">
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {/* 漂浮徽章 */}
                                    <div className="absolute -right-4 top-8 bg-white rounded-xl shadow-lg border border-gray-100 p-3 flex items-center gap-3 animate-float">
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm">优化完成</div>
                                            <div className="text-xs text-gray-500">匹配度提升 30%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 添加按钮 */}
                                <div className="absolute -bottom-5 -right-5">
                                    <button className="w-14 h-14 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-110 transition-transform">
                                        <Wand2 className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 功能部分 1 */}
                <section id="features-section" className="py-24 bg-slate-50 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16 max-w-3xl">
                            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-left">
                                洞察真实竞争力
                            </h2>
                            <p className="mt-4 text-lg text-gray-500 text-left">
                                分析模拟面试对话内容，多维度评估简历质量，精准定位求职短板。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* 卡片 2：极速启动 */}
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col relative overflow-hidden group">
                                <div className="mb-6 relative z-10">
                                    <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 mb-4">
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">极速启动</h3>
                                    <p className="text-gray-500 text-sm">三步配置，一键开启模拟面试。</p>
                                </div>

                                {/* 模拟 UI - 表单布局 */}
                                <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100 flex-1 flex flex-col relative top-4 group-hover:top-2 transition-all duration-500">
                                    {/* 表单元素 */}
                                    <div className="space-y-4 flex-1">
                                        {/* 第1步：上传简历 */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 text-[10px] font-bold flex items-center justify-center">1</span>
                                                <span className="text-xs font-bold text-slate-700">上传简历</span>
                                            </div>
                                            <div className="h-10 border border-dashed border-slate-300 rounded-lg bg-white flex items-center justify-center gap-2 text-slate-400 hover:border-teal-400 hover:text-teal-500 transition-colors cursor-default">
                                                <FileText className="w-3.5 h-3.5" />
                                                <span className="text-[10px] font-medium">支持 PDF/Word 文件</span>
                                            </div>
                                        </div>

                                        {/* 第2步：职位描述 */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 text-[10px] font-bold flex items-center justify-center">2</span>
                                                <span className="text-xs font-bold text-slate-700">岗位要求</span>
                                            </div>
                                            <div className="h-14 border border-slate-200 rounded-lg bg-white p-2">
                                                <div className="space-y-1.5">
                                                    <div className="h-1.5 bg-slate-100 rounded-full w-3/4"></div>
                                                    <div className="h-1.5 bg-slate-100 rounded-full w-full"></div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 步骤3：公司信息（可选）*/}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-teal-50 text-teal-500 text-[10px] font-bold flex items-center justify-center">3</span>
                                                <span className="text-xs font-bold text-slate-700">公司信息 <span className="text-slate-400 font-normal scale-90 inline-block">(选填)</span></span>
                                            </div>
                                            <div className="h-8 border border-slate-200 rounded-lg bg-white flex items-center px-2">
                                                <span className="text-[10px] text-slate-300">请输入目标公司信息...</span>
                                            </div>
                                        </div>

                                        {/* 步骤 4：设置 */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 text-[10px] font-bold flex items-center justify-center">4</span>
                                                <span className="text-xs font-bold text-slate-700">题目数量</span>
                                            </div>
                                            <div className="flex items-center gap-2 pt-1">
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div className="w-3/5 h-full bg-teal-400 rounded-full"></div>
                                                </div>
                                                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">5题</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 模拟按钮 */}
                                    <div className="mt-5 pt-4 border-t border-slate-200/60">
                                        <div className="w-full h-9 bg-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-teal-200 group-hover:bg-teal-500 transition-colors">
                                            开始模拟面试
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 卡片 1：简历分析（跨度 2） */}
                            <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative group">
                                <div className="mb-8 relative z-10">
                                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                                        <TrendingUp className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">深度简历竞争力分析</h3>
                                    <p className="text-gray-500">关联面试记录，对标目标岗位 JD，提供精确到点的优化建议。</p>
                                </div>

                                {/* 模拟 UI - 分析结果 */}
                                <div className="space-y-4 relative top-4 group-hover:top-2 transition-all duration-500">
                                    {/* 1. 竞争力分析结果 */}
                                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-3">
                                                <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                                                <span className="font-bold text-slate-800">竞争力分析结果</span>
                                            </div>
                                            <div className="text-4xl font-bold text-teal-600">88<span className="text-sm text-slate-400 ml-1">分</span></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                            {[
                                                { label: "表达清晰", val: 88, color: "bg-blue-500", textColor: "text-blue-600" },
                                                { label: "JD匹配", val: 93, color: "bg-blue-500", textColor: "text-blue-600" },
                                                { label: "结构规范", val: 92, color: "bg-teal-500", textColor: "text-teal-600" },
                                                { label: "亮点突出", val: 90, color: "bg-teal-500", textColor: "text-teal-600" },
                                                { label: "内容完整", val: 90, color: "bg-purple-500", textColor: "text-purple-600" },
                                                { label: "量化程度", val: 95, color: "bg-purple-500", textColor: "text-purple-600" }
                                            ].map(item => (
                                                <div key={item.label} className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-bold text-slate-700">{item.label}</span>
                                                        <span className={`text-sm font-bold ${item.textColor}`}>{item.val}</span>
                                                    </div>
                                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.val}%` }}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. 优势/待改进  */}
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* 优势 */}
                                        <div className="bg-green-50/50 rounded-xl p-4 border border-green-100">
                                            <div className="flex items-center gap-2 mb-3 text-green-700 font-bold text-sm">
                                                <CheckCircle2 className="w-4 h-4" />
                                                优势
                                            </div>
                                            <div className="bg-white/60 rounded-lg p-2 text-xs text-green-800 leading-relaxed mb-2">
                                                兼具 AI 工程与产品双重能力，高效衔接技术与业务
                                            </div>
                                            <div className="bg-white/60 rounded-lg p-2 text-xs text-green-800 leading-relaxed">
                                                已验证 AI 落地能力，对口程度高
                                            </div>
                                        </div>
                                        {/* 待改进 */}
                                        <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100">
                                            <div className="flex items-center gap-2 mb-3 text-orange-700 font-bold text-sm">
                                                <TrendingUp className="w-4 h-4" />
                                                待改进
                                            </div>
                                            <div className="bg-white/60 rounded-lg p-2 text-xs text-orange-800 leading-relaxed mb-2">
                                                工作经历较短，需强调稳定性
                                            </div>
                                            <div className="bg-white/60 rounded-lg p-2 text-xs text-orange-800 leading-relaxed">
                                                需证明产品主导权而非兼岗
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


                {/* 功能部分 2*/}
                <section className="py-24 bg-white border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16 max-w-3xl">
                            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-left">
                                给出精准方案
                            </h2>
                            <p className="mt-4 text-lg text-gray-500 text-left">
                                从精准画像到内容落地，让每一次优化都切实可见。
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* 卡片 1：面试能力精准画像 */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">面试能力精准画像</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        基于 STAR 法则拆解您的回答，生成包含专业能力、协作、逻辑等多维度的六边形能力评估图。
                                    </p>
                                </div>

                                {/* 可视化容器 - 暗黑模式 */}
                                <div className="mt-auto bg-[#0F172A] rounded-2xl p-6 relative overflow-hidden aspect-[4/3] flex items-center justify-center group-hover:shadow-inner transition-all">
                                    {/* 装饰 - 暗黑模式下的发光背景 */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl"></div>

                                    {/* 雷达图容器 */}
                                    <div className="w-full max-w-[260px] aspect-square relative flex items-center justify-center">
                                        {/* 数据形状 - 六边形雷达图 */}
                                        <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 overflow-visible">
                                            <defs>
                                                <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.4" />
                                                    <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.1" />
                                                </linearGradient>
                                            </defs>

                                            {/* 背景网格 - 六边形 */}
                                            <g stroke="#2DD4BF" strokeWidth="0.5" fill="none" className="opacity-20">
                                                {/* 外部六边形 */}
                                                <path d="M50 15 L80 32 L80 68 L50 85 L20 68 L20 32 Z" strokeDasharray="4 4" />
                                                {/* 中间六边形 */}
                                                <path d="M50 32.5 L65 41 L65 59 L50 67.5 L35 59 L35 41 Z" strokeDasharray="4 4" />
                                                {/* 十字线 */}
                                                <path d="M50 15 L50 85" strokeDasharray="2 2" />
                                                <path d="M20 32 L80 68" strokeDasharray="2 2" />
                                                <path d="M80 32 L20 68" strokeDasharray="2 2" />
                                            </g>

                                            {/* 主要数据多边形 - 仅填充（无描边/点） */}
                                            <path
                                                d="M50 18 L77 34 L75 65 L50 85 L23 66 L22 34 Z"
                                                fill="url(#radarGradient)"
                                                stroke="#2DD4BF"
                                                strokeWidth="1"
                                                className="opacity-90 max-w-full"
                                            />
                                        </svg>

                                        {/* Labels */}
                                        <div className="absolute inset-0 pointer-events-none">
                                            <span className="absolute top-[8%] left-1/2 -translate-x-1/2 text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">专业能力</span>
                                            <span className="absolute top-[28%] -right-[8%] text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">执行与结果导向</span>
                                            <span className="absolute bottom-[28%] -right-[8%] text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">逻辑与问题解决</span>
                                            <span className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">沟通表达力</span>
                                            <span className="absolute bottom-[28%] -left-[2%] text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">成长潜力</span>
                                            <span className="absolute top-[28%] -left-[2%] text-[10px] font-medium text-teal-100/90 whitespace-nowrap bg-[#0F172A]/80 px-1 rounded">协作能力</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 卡片2：优化建议 */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">智能优化建议</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        不只是指出问题，更提供具体可行的修改方案。P1/P2 优先级划分，让优化有的放矢。
                                    </p>
                                </div>

                                {/* 视觉容器 - 暗黑模式 */}
                                <div className="mt-auto bg-[#0F172A] rounded-2xl p-5 relative overflow-hidden aspect-[4/3] flex flex-col justify-center space-y-3 group-hover:shadow-inner transition-all">
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                                    {/* 建议项目 */}
                                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/5 hover:bg-white/15 transition-colors cursor-default">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-red-500/20 text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-500/30">P1</span>
                                            <span className="text-xs font-bold text-white">产品经验真实性</span>
                                        </div>
                                        <div className="text-[12px] text-gray-400 line-clamp-2">
                                            建议将"产品负责人"修改为"承担产品接口人角色"，避免夸大。
                                        </div>
                                    </div>

                                    <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-orange-500/20 text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-500/30">P2</span>
                                            <span className="text-xs font-bold text-gray-200">效果评估深度</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 line-clamp-1">
                                            补充定义 KPI、收集用户反馈等闭环手段。
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 卡片3：简历重写 */}
                            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group">
                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">AI 辅助内容重写</h3>
                                    <p className="text-gray-500 text-sm leading-relaxed">
                                        对标专家级简历范文，AI 自动重写描述，提升内容的专业度、逻辑性与人岗匹配度。
                                    </p>
                                </div>

                                {/* 视觉容器 - 暗黑模式 */}
                                <div className="mt-auto bg-[#0F172A] rounded-2xl p-5 relative overflow-hidden aspect-[4/3] flex flex-col justify-center group-hover:shadow-inner transition-all">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>

                                    <div className="space-y-3 relative z-10 pl-2">
                                        {/* 之前 */}
                                        <div className="flex gap-2 opacity-50">
                                            <div className="w-0.5 h-full bg-gray-600 rounded-full"></div>
                                            <div className="text-[14px] text-gray-400 font-mono line-through">
                                                负责 AI 项目的前端开发，做了一些页面。
                                            </div>
                                        </div>

                                        {/* 箭 头*/}
                                        <div className="text-teal-500 animate-bounce py-1">
                                            <ArrowRight className="w-4 h-4 rotate-90 ml-1" />
                                        </div>

                                        {/* 之后 */}
                                        <div className="flex gap-2">
                                            <div className="w-0.5 h-full bg-teal-500 rounded-full"></div>
                                            <div className="text-[14px] text-teal-50 font-mono leading-relaxed">
                                                主导 <span className="text-teal-400">AI 智能体</span>前端架构设计，使用 React 实现响应式界面，
                                                <span className="bg-teal-500/20 text-teal-300 px-1 rounded mx-1">效率提升 30%</span>。
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 功能部分 3 */}
                <section className="py-24 bg-slate-50 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16 max-w-3xl">
                            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl text-left">
                                优秀的简历生成
                            </h2>
                            <p className="mt-4 text-lg text-gray-500 text-left">
                                深度解析个人经历，AI 驱动的一站式简历重塑方案
                            </p>
                        </div>
                        {/* 卡片 3：简历生成 */}
                        <div className="lg:col-span-3 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-xl overflow-hidden relative group text-white">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                                <div className="relative z-10">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white mb-6 backdrop-blur-sm">
                                        <Wand2 className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-4">专家级简历智能生成</h3>
                                    <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                                        无需繁琐排版，AI 基于深度诊断结果与目标岗位要求，为您自动撰写、润色并排版出专业的求职简历。支持针对性补充关键细节，让每一份简历都直击要害。
                                    </p>
                                    <Button
                                        onClick={() => onNavigate("resume")}
                                        className="bg-teal-500 hover:bg-teal-400 text-white rounded-full px-8 py-6 text-lg font-semibold border-none"
                                    >
                                        开始生成优化建议 <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </div>

                                {/* 模拟 UI - 简历预览窗口 */}
                                <div className="relative mx-auto w-full max-w-md transform rotate-2 hover:rotate-0 transition-transform duration-500">
                                    {/* 窗口容器 */}
                                    <div className="bg-[#F8FAFC] rounded-lg shadow-2xl overflow-hidden">
                                        {/* 顶部工具栏 */}
                                        <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {/* Mac 窗口控制点 */}
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/30"></div>
                                                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/30"></div>
                                                    <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/30"></div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-teal-50 rounded flex items-center justify-center text-teal-600">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-gray-900">张三-高级产品经理简历</div>
                                                        <div className="text-[10px] text-gray-500">Markdown 预览模式</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 cursor-pointer hover:bg-gray-100">
                                                    <Copy className="w-3 h-3" /> 复制
                                                </div>
                                                <div className="flex items-center gap-1 px-2 py-1 bg-teal-50 border border-teal-100 rounded text-xs text-teal-600 font-medium cursor-pointer hover:bg-teal-100">
                                                    <Download className="w-3 h-3" /> 下载
                                                </div>
                                                <X className="w-4 h-4 text-gray-300 ml-1 cursor-pointer hover:text-gray-500" />
                                            </div>
                                        </div>

                                        {/* 简历内容区域 */}
                                        <div className="p-6 h-[400px] overflow-hidden relative bg-slate-100">
                                            {/* 滚动条模拟 */}
                                            <div className="absolute right-1.5 top-2 bottom-2 w-1.5 bg-gray-200/50 rounded-full z-10">
                                                <div className="w-full h-1/3 bg-gray-300 rounded-full"></div>
                                            </div>

                                            {/* 纸张效果 */}
                                            <div className="bg-white shadow-sm border border-gray-100 rounded min-h-full p-8 text-gray-800 scale-[0.9] origin-top">
                                                {/* 简历头部 */}
                                                <div className="text-center mb-8">
                                                    <h1 className="text-2xl font-bold text-gray-900 mb-3">张三</h1>

                                                    <div className="bg-slate-50 py-3 px-4 rounded-lg text-[10px] text-gray-600 leading-relaxed border border-gray-100">
                                                        "138-xxxx-xxxx | zhangsan@email.com <br />
                                                        高级产品经理 | 期望薪资：25-35K | 期望城市：上海"
                                                    </div>
                                                </div>

                                                {/* 个人简介 */}
                                                <div className="mb-6">
                                                    <h2 className="text-sm font-bold text-gray-900 border-b-2 border-gray-900 pb-1 mb-3">
                                                        个人简介
                                                    </h2>
                                                    <ul className="space-y-2 text-[10px] leading-relaxed text-gray-600">
                                                        <li className="flex gap-2">
                                                            <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                                                            <span>5年互联网大厂经验，擅长用户增长与商业化变现。</span>
                                                        </li>
                                                        <li className="flex gap-2">
                                                            <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                                                            <span>主导过千万级用户产品的从0到1，具备优秀的数据分析能力。</span>
                                                        </li>
                                                    </ul>
                                                </div>

                                                {/* 工作经历 */}
                                                <div className="mb-6">
                                                    <h2 className="text-sm font-bold text-gray-900 border-b-2 border-gray-900 pb-1 mb-3">
                                                        工作经历
                                                    </h2>

                                                    <div className="mb-3">
                                                        <div className="flex justify-between items-baseline mb-1">
                                                            <h3 className="text-xs font-bold text-gray-800">某知名科技公司 | 高级产品经理</h3>
                                                            <span className="text-[10px] text-gray-500">2021.03 - 至今</span>
                                                        </div>
                                                        <ul className="space-y-1.5 text-[10px] leading-relaxed text-gray-600">
                                                            <li className="flex gap-2">
                                                                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                                                                <span>负责核心业务线的规划与落地，协调产研团队 20+ 人。</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                                                                <span>搭建智能化运营后台，引入 AI 算法提升审核效率 40%。</span>
                                                            </li>
                                                            <li className="flex gap-2">
                                                                <span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></span>
                                                                <span>优化用户转化链路，使核心转化率提升 15%，季度营收增长 200万。</span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* 页脚标志（可选，美观填充） */}
            <footer className="border-t border-gray-100 py-12">
                <div className="max-w-7xl mx-auto px-6">
                    <p className="text-center text-sm text-gray-400 mb-6">即刻免费体验</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40">
                        {/* 页脚标志占位符（可选，美观填充） */}
                        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                        <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
                    </div>
                </div>
            </footer>
        </div >
    );
}

