'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Check, Brain, Wand2, Lightbulb } from 'lucide-react';
import { getOverallProfile, generateProfile, type AbilityProfile } from '@/lib/api/profile';
import { AbilityRadarChart } from './RadarChart';
import { SkillTags } from './SkillTags';
import { Button } from './ui/button';
import { useInterviewStore } from '@/store/useInterviewStore';

export function AbilityProfileView() {
    const [profile, setProfile] = useState<AbilityProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        setError(null);
        const response = await getOverallProfile();

        if (response.success && response.profile) {
            setProfile(response.profile);
            setGeneratedAt(response.generated_at || null);
        } else {
            setProfile(null);
            setGeneratedAt(null);
        }
        setLoading(false);
    }

    async function handleGenerate() {
        setGenerating(true);
        setError(null);

        // 获取当前 API 配置
        const apiConfig = useInterviewStore.getState().getApiConfigForRequest();

        if (!apiConfig) {
            setError('请先在设置中配置 API Key');
            setGenerating(false);
            return;
        }

        const response = await generateProfile(apiConfig);

        if (response.success && response.profile) {
            setProfile(response.profile);
            setGeneratedAt(new Date().toISOString());
        } else {
            setError(response.message || '生成失败，请稍后重试');
        }
        setGenerating(false);
    }

    // 加载状态
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
                <p className="text-sm text-gray-500">加载中...</p>
            </div>
        );
    }

    // 空状态 - 尚未生成画像
    if (!profile) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                    <Brain className="w-8 h-8 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">尚未生成能力画像</h3>
                <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
                    完成面试后，点击下方按钮生成您的综合能力评估报告
                </p>
                <Button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                >
                    {generating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-4 h-4" />
                            生成能力画像
                        </>
                    )}
                </Button>
                {error && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}
            </div>
        );
    }

    // 有数据 - 显示画像
    return (
        <div className="overflow-y-auto h-full p-6 bg-slate-50/50">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
                {/* 标题和操作栏 */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">能力评分</h2>
                        {generatedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                                生成时间: {new Date(generatedAt).toLocaleString('zh-CN')}
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleGenerate}
                        disabled={generating}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                重新生成中...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                重新生成
                            </>
                        )}
                    </Button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* 深色仪表盘区域 */}
                <div className="bg-[#0F172A] rounded-2xl border border-gray-800 p-8 relative overflow-hidden shadow-xl">
                    {/* 背景装饰 - 网格 */}
                    <div className="absolute inset-0 bg-white/5 opacity-20"></div>
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[80px]"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[80px]"></div>
                    </div>

                    {/* 背景装饰 - 中间发光 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        {/* 左侧：雷达图 */}
                        <div className="flex-1 w-full max-w-md">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span className="w-1 h-6 bg-teal-400 rounded-full inline-block"></span>
                                能力雷达图
                            </h3>
                            <div className="bg-white/5 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
                                <AbilityRadarChart data={profile} />
                            </div>
                        </div>

                        {/* 右侧：技能标签与摘要 */}
                        <div className="flex-1 w-full flex flex-col justify-center">
                            {profile.skill_tags && profile.skill_tags.length > 0 && (
                                <div className="mb-8">
                                    <h4 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">识别到的技能栈</h4>
                                    <div className="flex flex-wrap gap-2.5">
                                        {profile.skill_tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1.5 bg-white/10 text-teal-50 border border-white/10 rounded-lg text-sm font-medium hover:bg-white/20 hover:border-teal-500/30 transition-all cursor-default"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 简短的引导文案 */}
                            <div className="bg-gradient-to-br from-teal-500/20 to-blue-600/20 rounded-xl p-5 border border-white/10">
                                <div className="flex items-start gap-3">
                                    <Lightbulb className="w-5 h-5 text-teal-400 mt-1 flex-shrink-0" />
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        基于面试表现，虽然您的经验年限较短，但在<strong className="text-teal-300">{profile.key_strengths?.[0] || '某些领域'}</strong>展现出了不错的潜力。建议重点加强<strong className="text-teal-300">{profile.key_weaknesses?.[0] || '薄弱项'}</strong>的积累。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 综合评价 */}
                {profile.overall_assessment && (
                    <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-8 shadow-sm relative overflow-hidden group">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            综合评价
                        </h3>
                        <p className="text-base text-gray-700 leading-8 text-justify">
                            {profile.overall_assessment}
                        </p>
                    </div>
                )}

                {/* 优势和不足 */}
                {(profile.key_strengths && profile.key_strengths.length > 0 ||
                    profile.key_weaknesses && profile.key_weaknesses.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {profile.key_strengths && profile.key_strengths.length > 0 && (
                                <div className="bg-emerald-50/60 rounded-2xl border border-emerald-100 p-6 shadow-sm relative overflow-hidden h-full">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-emerald-600">优势</span>
                                    </h3>
                                    <ul className="space-y-4">
                                        {profile.key_strengths.map((strength, index) => (
                                            <li key={index} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mt-0.5">
                                                    <Check className="w-3 h-3 stroke-[3px]" />
                                                </span>
                                                <span className="text-sm text-gray-700 leading-relaxed">{strength}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {profile.key_weaknesses && profile.key_weaknesses.length > 0 && (
                                <div className="bg-orange-50/60 rounded-2xl border border-orange-100 p-6 shadow-sm relative overflow-hidden h-full">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                            <AlertCircle className="w-4 h-4" />
                                        </div>
                                        <span className="text-orange-600">待改进</span>
                                    </h3>
                                    <ul className="space-y-4">
                                        {profile.key_weaknesses.map((weakness, index) => (
                                            <li key={index} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold mt-0.5">!</span>
                                                <span className="text-sm text-gray-700 leading-relaxed">{weakness}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    );
}
