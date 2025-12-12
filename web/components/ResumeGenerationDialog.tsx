import { useState, useEffect } from "react";
import { Loader2, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    initResumeGeneration,
    submitGenerationAnswers,
    ApiConfig,
    ResumeOptimizeResult,
    ResumeGenerateInitResponse
} from "@/lib/api/resume";

interface ResumeGenerationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    resumeContent: string;
    jobDescription: string;
    optimizationResult: ResumeOptimizeResult;
    optimizationResultId?: number;
    apiConfig: ApiConfig;
    onSuccess: (resumeId: number, title: string, content: string) => void;
}

type Step = "init" | "question" | "generating" | "result";

export function ResumeGenerationDialog({
    isOpen,
    onClose,
    resumeContent,
    jobDescription,
    optimizationResult,
    optimizationResultId,
    apiConfig,
    onSuccess
}: ResumeGenerationDialogProps) {
    const [step, setStep] = useState<Step>("init");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [questions, setQuestions] = useState<string[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);

    // 重置状态
    useEffect(() => {
        if (isOpen) {
            setStep("init");
            setSessionId("");
            setQuestions([]);
            setAnswers({});
            setError(null);
            handleInit();
        }
    }, [isOpen]);

    const handleInit = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await initResumeGeneration({
                resume_content: resumeContent,
                job_description: jobDescription,
                optimization_result: optimizationResult,
                optimization_result_id: optimizationResultId,
                api_config: apiConfig
            });

            if (response.success) {
                setSessionId(response.session_id);
                if (response.needs_input && response.questions) {
                    setQuestions(response.questions);
                    setStep("question");
                } else if (!response.needs_input && response.result) {
                    // 直接成功
                    onSuccess(
                        response.result.resume_id,
                        response.result.title,
                        response.result.content
                    );
                    onClose();
                } else {
                    // 异常情况
                    setError("初始化返回状态异常，请重试");
                }
            } else {
                setError(response.message || "初始化失败");
            }
        } catch (err) {
            setError("网络请求失败");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmitAnswers = async () => {
        // 检查回答是否完整
        const answeredCount = Object.keys(answers).length;
        if (answeredCount < questions.length) {
            toast.error("请回答所有问题以便生成更准确的简历");
            return;
        }

        setIsLoading(true);
        setStep("generating");
        try {
            const response = await submitGenerationAnswers({
                session_id: sessionId,
                answers: answers,
                api_config: apiConfig
            });

            if (response.success && response.resume_id && response.content) {
                onSuccess(response.resume_id, response.title || "新简历", response.content);
                onClose();
            } else {
                setError(response.message || "生成失败");
                setStep("question"); // 回退以便重试
            }
        } catch (err) {
            setError("提交失败，请重试");
            setStep("question");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (index: number, value: string) => {
        setAnswers(prev => ({
            ...prev,
            [questions[index]]: value
        }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>生成专业简历</DialogTitle>
                    <DialogDescription>
                        {step === "init" && "正在分析简历需求..."}
                        {step === "question" && "请补充以下关键信息，以便为您量身定制简历"}
                        {step === "generating" && "AI 正在撰写和润色简历，请稍候..."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-[200px] py-4">
                    {/* Error State */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-lg mb-4">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Init / Loading State */}
                    {(step === "init" || (step === "generating" && isLoading)) && (
                        <div className="flex flex-col items-center justify-center h-full space-y-4 py-8">
                            <div className="relative">
                                <div className="absolute inset-0 bg-teal-100 rounded-full animate-ping opacity-20"></div>
                                <div className="bg-teal-50 p-4 rounded-full">
                                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 animate-pulse">
                                {step === "init" ? "正在深入分析您的经历..." : "正在精心打磨简历措辞..."}
                            </p>
                        </div>
                    )}

                    {/* Question Form */}
                    {step === "question" && !isLoading && (
                        <ScrollArea className="h-full max-h-[400px] pr-4">
                            <div className="space-y-6">
                                {questions.map((q, index) => (
                                    <div key={index} className="space-y-2">
                                        <Label className="text-sm font-medium text-gray-700">
                                            {index + 1}. {q}
                                        </Label>
                                        <Textarea
                                            value={answers[q] || ""}
                                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                                            placeholder="请输入具体内容（如：项目数据、具体贡献等）"
                                            className="min-h-[80px] text-sm resize-y"
                                        />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    {step === "question" && (
                        <>
                            <Button variant="outline" onClick={onClose} disabled={isLoading}>
                                取消
                            </Button>
                            <Button onClick={handleSubmitAnswers} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        提交中
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        开始生成
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                    {error && step === "init" && (
                        <Button onClick={handleInit}>重试</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
