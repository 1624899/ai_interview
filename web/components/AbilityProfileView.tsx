'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
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
                    <Sparkles className="w-8 h-8 text-teal-600" />
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
                            <Sparkles className="w-4 h-4" />
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
        <div className="overflow-y-auto h-full p-6">
            <div className="max-w-4xl mx-auto space-y-6">
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

                {/* 雷达图 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">能力雷达图</h3>
                    <AbilityRadarChart data={profile} />
                </div>

                {/* 技能标签 */}
                {profile.skill_tags && profile.skill_tags.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <SkillTags tags={profile.skill_tags} />
                    </div>
                )}

                {/* 综合评价 */}
                {profile.overall_assessment && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">综合评价</h3>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {profile.overall_assessment}
                        </p>
                    </div>
                )}

                {/* 优势和不足 */}
                {(profile.key_strengths && profile.key_strengths.length > 0 ||
                    profile.key_weaknesses && profile.key_weaknesses.length > 0) && (
                        <div className="grid grid-cols-2 gap-4">
                            {profile.key_strengths && profile.key_strengths.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    <h3 className="text-base font-semibold text-gray-900 mb-3">主要优势</h3>
                                    <ul className="space-y-2">
                                        {profile.key_strengths.map((strength, index) => (
                                            <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                                <span className="text-teal-600 mt-0.5">✓</span>
                                                <span>{strength}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {profile.key_weaknesses && profile.key_weaknesses.length > 0 && (
                                <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    <h3 className="text-base font-semibold text-gray-900 mb-3">待提升项</h3>
                                    <ul className="space-y-2">
                                        {profile.key_weaknesses.map((weakness, index) => (
                                            <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                                                <span className="text-amber-600 mt-0.5">△</span>
                                                <span>{weakness}</span>
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
