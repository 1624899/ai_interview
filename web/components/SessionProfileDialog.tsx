'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, X, Sparkles } from 'lucide-react';
import { getSessionProfile, type AbilityProfile } from '@/lib/api/profile';
import { AbilityRadarChart } from './RadarChart';
import { SkillTags } from './SkillTags';
import { Button } from './ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from './ui/dialog';

interface Props {
    sessionId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SessionProfileDialog({ sessionId, open, onOpenChange }: Props) {
    const [profile, setProfile] = useState<AbilityProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (open && sessionId) {
            loadProfile();
        }
    }, [open, sessionId]);

    async function loadProfile() {
        setLoading(true);
        const response = await getSessionProfile(sessionId);

        if (response.success && response.profile) {
            setProfile(response.profile);
            setGenerating(false);
        } else {
            setProfile(null);
            setGenerating(true); // 画像正在生成中
        }
        setLoading(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-teal-600" />
                        本轮面试能力评估
                    </DialogTitle>
                </DialogHeader>

                {/* 加载状态 */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
                        <p className="text-sm text-gray-500">加载中...</p>
                    </div>
                )}

                {/* 生成中状态 */}
                {!loading && generating && (
                    <div className="flex flex-col items-center justify-center py-20 px-6">
                        <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                            <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">画像生成中</h3>
                        <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
                            AI 正在分析您的面试表现，请稍等片刻...
                        </p>
                        <Button
                            onClick={loadProfile}
                            variant="outline"
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            刷新
                        </Button>
                    </div>
                )}

                {/* 有数据 - 显示画像 */}
                {!loading && !generating && profile && (
                    <div className="space-y-6">
                        {/* 雷达图 */}
                        <div className="bg-gray-50 rounded-xl p-6">
                            <h3 className="text-base font-semibold text-gray-900 mb-4">能力雷达图</h3>
                            <AbilityRadarChart data={profile} />
                        </div>

                        {/* 技能标签 */}
                        {profile.skill_tags && profile.skill_tags.length > 0 && (
                            <div className="bg-gray-50 rounded-xl p-6">
                                <SkillTags tags={profile.skill_tags} />
                            </div>
                        )}

                        {/* 综合评价 */}
                        {profile.overall_assessment && (
                            <div className="bg-gray-50 rounded-xl p-6">
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
                                        <div className="bg-gray-50 rounded-xl p-6">
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
                                        <div className="bg-gray-50 rounded-xl p-6">
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
                )}
            </DialogContent>
        </Dialog>
    );
}
