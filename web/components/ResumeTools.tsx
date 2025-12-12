"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, BarChart3, Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useInterviewStore } from "@/store/useInterviewStore";
import { ResumeGenerationDialog } from "./ResumeGenerationDialog";
import { ResumePreviewDialog } from "./ResumePreviewDialog";

import {
    analyzeResume,
    optimizeResumeStreaming,
    CompletedSession,
    ResumeAnalyzeResult,
    ResumeOptimizeResult,
    ApiConfig,
    OptimizeProgressEvent,
} from "@/lib/api/resume";
import { API_BASE_URL, getUserId } from "@/lib/api/config";

interface ResumeToolsProps {
    apiConfig: ApiConfig | null;
    resumeContent: string;
    onResumeChange?: (content: string) => void;
}

export function ResumeTools({ apiConfig, resumeContent, onResumeChange }: ResumeToolsProps) {
    // 输入状态
    const [localResume, setLocalResume] = useState(resumeContent);
    const [jobDescription, setJobDescription] = useState("");

    // 会话选择状态
    const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
    const [includeProfile, setIncludeProfile] = useState(false);

    // 加载状态
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);

    // 结果状态
    const [analyzeResult, setAnalyzeResult] = useState<ResumeAnalyzeResult | null>(null);
    const [optimizeResult, setOptimizeResult] = useState<ResumeOptimizeResult | null>(null);
    const [currentResultId, setCurrentResultId] = useState<number | undefined>(undefined);

    // 生成流程状态
    const [showGenerationDialog, setShowGenerationDialog] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewContent, setPreviewContent] = useState({ title: "", content: "" });

    // UI 状态
    const [activeTab, setActiveTab] = useState("analyze");
    const [showSessionPicker, setShowSessionPicker] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState<string>("");
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const resultsBottomRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        resultsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const {
        currentResumeResult,
        fetchCompletedSessions,
        fetchResumeResults,
        selectResumeResult,
        completedSessions: storeCompletedSessions,
        completedSessionsLoading: isLoadingSessions
    } = useInterviewStore();

    // 监听历史记录选择
    useEffect(() => {
        if (currentResumeResult) {
            // 填充数据
            setLocalResume(currentResumeResult.resume_content);
            setJobDescription(currentResumeResult.job_description || "");
            setSelectedSessions(currentResumeResult.session_ids || []);
            setIncludeProfile(currentResumeResult.include_profile || false);

            // 设置结果并切换 Tab
            if (currentResumeResult.result_type === 'analyze') {
                setAnalyzeResult(currentResumeResult.result_data as ResumeAnalyzeResult);
                setOptimizeResult(null);
                setActiveTab('analyze');
            } else {
                setOptimizeResult(currentResumeResult.result_data as ResumeOptimizeResult);
                setAnalyzeResult(null);
                setActiveTab('optimize');
            }
            setCurrentResultId(currentResumeResult.id);
        } else {
            // 新建模式：清空结果和非简历输入
            setAnalyzeResult(null);
            setOptimizeResult(null);
            setCurrentResultId(undefined);

            // 重置表单状态
            setJobDescription("");
            setSelectedSessions([]);
            setIncludeProfile(false);
        }
    }, [currentResumeResult]);

    // 同步外部简历内容（仅在非查看历史记录模式下）
    useEffect(() => {
        if (!currentResumeResult) {
            setLocalResume(resumeContent);
        }
    }, [resumeContent, currentResumeResult]);

    // 加载已完成会话列表
    useEffect(() => {
        fetchCompletedSessions();
    }, [fetchCompletedSessions]);

    // 使用 store 中的 sessions 覆盖本地 sessions (为了保持向下兼容不需要修改太多渲染代码)
    const displaySessions = storeCompletedSessions;

    // 文件上传处理
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE_URL}/api/upload/resume`, {
                method: 'POST',
                headers: { 'X-User-ID': getUserId() },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail?.message || '上传失败');
            }

            const data = await response.json();
            setLocalResume(data.text_content);
            onResumeChange?.(data.text_content);
            toast.success(`已从 ${file.name} 提取简历内容`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '文件上传失败');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSessionToggle = (sessionId: string) => {
        setSelectedSessions((prev) => {
            if (prev.includes(sessionId)) {
                return prev.filter((id) => id !== sessionId);
            }
            if (prev.length >= 3) {
                toast.warning("最多只能选择 3 个面试记录");
                return prev;
            }
            return [...prev, sessionId];
        });
    };

    const handleAnalyze = async () => {
        if (!localResume.trim()) {
            toast.error("请输入简历内容");
            return;
        }
        if (!apiConfig) {
            toast.error("请先配置 API Key");
            return;
        }

        setIsAnalyzing(true);
        setAnalyzeResult(null);

        try {
            const response = await analyzeResume({
                resume_content: localResume,
                job_description: jobDescription || undefined,
                session_ids: selectedSessions,
                api_config: apiConfig,
            });

            if (response.success && response.result) {
                setAnalyzeResult(response.result);
                toast.success("分析完成");
                // 刷新侧边栏历史记录，完成后自动选中新记录
                await fetchResumeResults();
                if (response.result_id) {
                    selectResumeResult(response.result_id);
                }
            } else {
                toast.error(response.message || "分析失败");
            }
        } catch (error) {
            toast.error("分析失败，请重试");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOptimize = async () => {
        if (!localResume.trim()) {
            toast.error("请输入简历内容");
            return;
        }
        if (!jobDescription.trim()) {
            toast.error("请输入目标职位描述");
            return;
        }
        if (!apiConfig) {
            toast.error("请先配置 API Key");
            return;
        }

        setIsOptimizing(true);
        setOptimizeResult(null);
        setOptimizeProgress("正在初始化...");

        try {
            const response = await optimizeResumeStreaming(
                {
                    resume_content: localResume,
                    job_description: jobDescription,
                    session_ids: selectedSessions,
                    include_overall_profile: includeProfile,
                    api_config: apiConfig,
                },
                (event: OptimizeProgressEvent) => {
                    setOptimizeProgress(event.message);
                }
            );

            if (response.success && response.result) {
                setOptimizeResult(response.result);
                toast.success("优化建议生成完成");
                // 刷新侧边栏历史记录，完成后自动选中新记录
                await fetchResumeResults();
                if (response.result_id) {
                    setCurrentResultId(response.result_id);
                    selectResumeResult(response.result_id);
                }
            } else {
                toast.error(response.message || "优化失败");
            }
        } catch (error) {
            toast.error("优化失败，请重试");
        } finally {
            setIsOptimizing(false);
            setOptimizeProgress("");
        }
    };

    const getDimensionLabel = (key: string): string => {
        const labels: Record<string, string> = {
            structure: "结构规范",
            completeness: "内容完整",
            quantification: "量化程度",
            clarity: "表达清晰",
            highlights: "亮点突出",
            job_match: "JD匹配",
        };
        return labels[key] || key;
    };

    // 渲染会话选择器
    const renderSessionPicker = () => (
        <div className="space-y-3">
            <div
                className="flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowSessionPicker(!showSessionPicker)}
            >
                <Label className="cursor-pointer">关联面试记录（可选）</Label>
                <div className="flex items-center gap-2">
                    {selectedSessions.length > 0 && (
                        <span className="text-sm text-gray-500">
                            已选 {selectedSessions.length}/3
                        </span>
                    )}
                    {showSessionPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {showSessionPicker && (
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {isLoadingSessions ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="animate-spin" size={20} />
                        </div>
                    ) : displaySessions.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">
                            暂无已完成的面试记录
                        </p>
                    ) : (
                        displaySessions.map((session) => (
                            <div
                                key={session.session_id}
                                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                onClick={() => handleSessionToggle(session.session_id)}
                            >
                                <Checkbox
                                    checked={selectedSessions.includes(session.session_id)}
                                    onCheckedChange={() => handleSessionToggle(session.session_id)}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{session.title}</p>
                                    <p className="text-xs text-gray-500">
                                        第{session.round_index}轮 · {session.message_count} 条消息
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );

    // 渲染空状态
    const renderEmptyState = (type: "analyze" | "optimize") => (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                {type === "analyze" ? <BarChart3 size={32} className="text-teal-500" /> : <FileText size={32} className="text-teal-500" />}
            </div>
            <h3 className="text-lg font-medium text-gray-600 mb-2">
                {type === "analyze" ? "准备进行竞争力分析" : "准备进行内容优化"}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                {type === "analyze"
                    ? "请在左侧填写简历内容，我们将在多维度为您评估简历竞争力。"
                    : "请在左侧填写简历和目标JD，我们将为您提供针对性的优化建议。"}
            </p>
        </div>
    );

    // 渲染分析结果
    const renderAnalyzeResult = () => {
        if (!analyzeResult) return null;

        const radarData = Object.entries(analyzeResult.dimension_scores).map(([key, value]) => ({
            dimension: key,
            score: value.score / 10,
            label: getDimensionLabel(key),
        }));

        return (
            <div className="space-y-6 mt-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <BarChart3 size={20} />
                            竞争力分析结果
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-teal-600">
                                    {analyzeResult.overall_score.toFixed(0)}
                                </div>
                                <div className="text-sm text-gray-500">综合评分</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {radarData.map((item) => (
                                <div key={item.dimension} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-medium">{item.label}</span>
                                        <span className="text-sm font-bold text-teal-600">{(item.score * 10).toFixed(0)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-teal-500 rounded-full transition-all"
                                            style={{ width: `${item.score * 10}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-green-600">
                                <CheckCircle size={16} />
                                优势
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3">
                                {analyzeResult.strengths.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-green-50/80 text-green-800 rounded-xl text-sm leading-relaxed border border-green-100/50 shadow-sm">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                                <AlertCircle size={16} />
                                待改进
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3">
                                {analyzeResult.weaknesses.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-orange-50/80 text-orange-800 rounded-xl text-sm leading-relaxed border border-orange-100/50 shadow-sm">
                                        {item}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">优先改进建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="list-decimal list-inside space-y-2">
                            {analyzeResult.priority_improvements.map((item, idx) => (
                                <li key={idx} className="text-sm">{item}</li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>

                {analyzeResult.interview_insights && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">面试洞察</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">{analyzeResult.interview_insights}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    // 渲染优化结果
    const renderOptimizeResult = () => {
        if (!optimizeResult) return null;

        return (
            <div className="space-y-6 mt-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={20} />
                                优化建议
                            </div>
                            <Button
                                size="sm"
                                className="h-9 text-sm font-medium bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all px-4"
                                onClick={scrollToBottom}
                            >
                                ↓ 下滑直接生成
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-8 mb-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-teal-600">
                                    {optimizeResult.match_score.toFixed(0)}%
                                </div>
                                <div className="text-sm text-gray-500">JD 匹配度</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">
                                    {optimizeResult.hr_pass_rate.toFixed(0)}%
                                </div>
                                <div className="text-sm text-gray-500">HR 通过率</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm">关键改进点</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {optimizeResult.key_improvements.slice(0, 5).map((item, idx) => (
                                <div key={idx} className="border-l-2 border-teal-500 pl-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">
                                            优先级 {item.priority}
                                        </span>
                                        <span className="text-sm font-medium">{item.area}</span>
                                    </div>
                                    <p className="text-sm text-gray-500">{item.issue}</p>
                                    <p className="text-sm mt-1">{item.action}</p>
                                    {item.example && (
                                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                                            <span className="font-medium">示例：</span>{item.example}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {optimizeResult.keyword_analysis && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">关键词分析</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {optimizeResult.keyword_analysis.missing.length > 0 && (
                                <div>
                                    <p className="text-xs text-orange-600 mb-1">缺失的关键词</p>
                                    <div className="flex flex-wrap gap-2">
                                        {optimizeResult.keyword_analysis.missing.map((item, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {optimizeResult.keyword_analysis.matched.length > 0 && (
                                <div>
                                    <p className="text-xs text-green-600 mb-1">已匹配的关键词</p>
                                    <div className="flex flex-wrap gap-2">
                                        {optimizeResult.keyword_analysis.matched.map((item, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {optimizeResult.interview_insights && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">面试洞察</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-600">{optimizeResult.interview_insights}</p>
                        </CardContent>
                    </Card>
                )}

                {/* 生成简历按钮 */}
                <div className="pt-4 border-t" ref={resultsBottomRef}>
                    <Button
                        onClick={() => setShowGenerationDialog(true)}
                        className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
                        size="lg"
                    >
                        <FileText className="w-5 h-5 mr-2" />
                        生成优化简历
                    </Button>
                    <p className="text-xs text-gray-500 text-center mt-2">
                        根据优化建议，自动生成完整简历
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                id="resume-upload"
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-2 mb-4 shrink-0">
                    <TabsTrigger value="analyze">
                        <BarChart3 size={16} className="mr-2" />
                        竞争力分析
                    </TabsTrigger>
                    <TabsTrigger value="optimize">
                        <FileText size={16} className="mr-2" />
                        内容优化
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="analyze" className="flex-1 overflow-hidden data-[state=active]:flex flex-col min-h-0 mt-0">
                    <div className="grid lg:grid-cols-12 gap-6 h-full min-h-0">
                        {/* 左侧输入区 */}
                        <div className="lg:col-span-5 h-full overflow-hidden flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm min-h-0">
                            {/* Fixed Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
                                <Label className="text-base font-medium text-gray-900">输入信息</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="h-8 bg-white"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="animate-spin mr-1.5" size={12} />
                                            上传中...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} className="mr-1.5" />
                                            导入简历
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-hidden relative min-h-0">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-5 pb-xxl">
                                        {/* 简历内容 */}
                                        <div className="space-y-2 flex flex-col">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-normal text-gray-500">简历纯文本内容</Label>
                                            </div>
                                            <Textarea
                                                placeholder="粘贴简历内容，或点击上方导入文件..."
                                                value={localResume}
                                                onChange={(e) => {
                                                    setLocalResume(e.target.value);
                                                    onResumeChange?.(e.target.value);
                                                }}
                                                className="h-[250px] focus:h-[550px] transition-all duration-300 resize-none border-gray-200 focus:border-teal-500 font-mono text-sm leading-relaxed p-4"
                                            />
                                        </div>

                                        {/* JD 内容 */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-normal text-gray-500">目标职位描述（可选）</Label>
                                            <Textarea
                                                placeholder="输入目标职位的 JD/岗位名，分析匹配度更准确..."
                                                value={jobDescription}
                                                onChange={(e) => setJobDescription(e.target.value)}
                                                className="h-[150px] focus:h-[280px] transition-all duration-300 resize-none border-gray-200 focus:border-teal-500 text-sm"
                                            />
                                        </div>

                                        {/* Session Picker */}
                                        {renderSessionPicker()}

                                        {/* Pad for footer */}
                                        <div className="h-16"></div>
                                    </div>
                                </ScrollArea>

                                {/* Fixed Footer overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-gray-100 z-10">
                                    <Button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing || !localResume.trim() || !apiConfig}
                                        className="w-full bg-teal-600 hover:bg-teal-700 h-11 text-[15px] font-medium shadow-md shadow-teal-100 transition-all"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2" size={18} />
                                                分析中...
                                            </>
                                        ) : (
                                            <>
                                                <BarChart3 size={18} className="mr-2" />
                                                开始竞争力分析
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* 右侧结果区 */}
                        <div className="lg:col-span-7 h-full overflow-hidden flex flex-col min-h-0">
                            {analyzeResult ? (
                                <ScrollArea className="h-full pr-4">
                                    <div className="pb-4">
                                        {renderAnalyzeResult()}
                                    </div>
                                </ScrollArea>
                            ) : (
                                renderEmptyState("analyze")
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="optimize" className="flex-1 overflow-hidden data-[state=active]:flex flex-col min-h-0 mt-0">
                    <div className="grid lg:grid-cols-12 gap-6 h-full min-h-0">
                        {/* 左侧输入区 */}
                        <div className="lg:col-span-5 h-full overflow-hidden flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm min-h-0">
                            {/* Fixed Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
                                <Label className="text-base font-medium text-gray-900">输入信息</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="h-8 bg-white"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="animate-spin mr-1.5" size={12} />
                                            上传中...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} className="mr-1.5" />
                                            导入简历
                                        </>
                                    )}
                                </Button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-hidden relative min-h-0">
                                <ScrollArea className="h-full">
                                    <div className="p-4 space-y-5 pb-xxl">
                                        {/* 简历内容 */}
                                        <div className="space-y-2 flex flex-col">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-xs font-normal text-gray-500">简历纯文本内容</Label>
                                            </div>
                                            <Textarea
                                                placeholder="粘贴简历内容，或点击上方导入文件..."
                                                value={localResume}
                                                onChange={(e) => {
                                                    setLocalResume(e.target.value);
                                                    onResumeChange?.(e.target.value);
                                                }}
                                                className="h-[250px] focus:h-[550px] transition-all duration-300 resize-none border-gray-200 focus:border-teal-500 font-mono text-sm leading-relaxed p-4"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-normal text-gray-500">目标职位描述 <span className="text-red-500">*</span></Label>
                                            <Textarea
                                                placeholder="输入目标职位的 JD/岗位名..."
                                                value={jobDescription}
                                                onChange={(e) => setJobDescription(e.target.value)}
                                                className="h-[150px] focus:h-[280px] transition-all duration-300 resize-none border-gray-200 focus:border-teal-500 text-sm"
                                            />
                                        </div>

                                        {renderSessionPicker()}

                                        <div className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50 bg-white cursor-pointer select-none" onClick={() => setIncludeProfile(!includeProfile)}>
                                            <Label htmlFor="include-profile" className="cursor-pointer flex flex-col pointer-events-none">
                                                <span className="font-medium text-gray-700">包含综合能力画像</span>
                                                <span className="text-xs text-gray-400 font-normal">基于过往面试表现进行评估</span>
                                            </Label>
                                            <Switch
                                                id="include-profile"
                                                checked={includeProfile}
                                                onCheckedChange={setIncludeProfile}
                                                className="data-[state=checked]:bg-teal-600"
                                            />
                                        </div>

                                        {/* Pad for footer */}
                                        <div className="h-16"></div>
                                    </div>
                                </ScrollArea>

                                {/* Fixed Footer overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-gray-100 z-10">
                                    <Button
                                        onClick={handleOptimize}
                                        disabled={isOptimizing || !localResume.trim() || !jobDescription.trim() || !apiConfig}
                                        className="w-full bg-teal-600 hover:bg-teal-700 h-11 text-[15px] font-medium shadow-md shadow-teal-100 transition-all"
                                    >
                                        {isOptimizing ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2" size={18} />
                                                {optimizeProgress || "优化中..."}
                                            </>
                                        ) : (
                                            <>
                                                <FileText size={18} className="mr-2" />
                                                生成内容优化建议
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* 右侧结果区 */}
                        <div className="lg:col-span-7 h-full overflow-hidden flex flex-col min-h-0">
                            {optimizeResult ? (
                                <ScrollArea className="h-full pr-4">
                                    <div className="pb-4">
                                        {renderOptimizeResult()}
                                    </div>
                                </ScrollArea>
                            ) : (
                                renderEmptyState("optimize")
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Dialogs */}
            {apiConfig && optimizeResult && (
                <ResumeGenerationDialog
                    isOpen={showGenerationDialog}
                    onClose={() => setShowGenerationDialog(false)}
                    resumeContent={localResume}
                    jobDescription={jobDescription}
                    optimizationResult={optimizeResult}
                    optimizationResultId={currentResultId}
                    apiConfig={apiConfig}
                    onSuccess={(id, title, content) => {
                        setPreviewContent({ title, content });
                        setShowPreviewDialog(true);
                        // 刷新已生成列表
                        useInterviewStore.getState().fetchGeneratedResumes?.();
                    }}
                />
            )}

            <ResumePreviewDialog
                isOpen={showPreviewDialog}
                onClose={() => setShowPreviewDialog(false)}
                title={previewContent.title}
                content={previewContent.content}
            />
        </div>
    );
}
