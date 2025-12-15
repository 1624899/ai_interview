'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AbilityProfile } from '@/lib/api/profile';

interface Props {
    data: AbilityProfile;
}

export function AbilityRadarChart({ data }: Props) {
    // 转换数据为雷达图格式
    const chartData = [
        {
            dimension: '专业能力',
            score: data.professional_competence.score,
            fullMark: 10
        },
        {
            dimension: '执行与结果导向',
            score: data.execution_results.score,
            fullMark: 10
        },
        {
            dimension: '逻辑与问题解决',
            score: data.logic_problem_solving.score,
            fullMark: 10
        },
        {
            dimension: '沟通表达力',
            score: data.communication.score,
            fullMark: 10
        },
        {
            dimension: '成长潜力',
            score: data.growth_potential.score,
            fullMark: 10
        },
        {
            dimension: '协作能力',
            score: data.collaboration.score,
            fullMark: 10
        },
    ];

    return (
        <div className="w-full">
            <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={chartData}>
                    <PolarGrid stroke="#2DD4BF" strokeOpacity={0.2} />
                    <PolarAngleAxis
                        dataKey="dimension"
                        tick={{ fill: '#94a3b8', fontSize: 13, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                        domain={[0, 10]}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickCount={6}
                    />
                    <Radar
                        name="能力评分"
                        dataKey="score"
                        stroke="#2DD4BF"
                        fill="#2DD4BF"
                        fillOpacity={0.3}
                        strokeWidth={2}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: '#e2e8f0'
                        }}
                        formatter={(value) => [`${value} / 10`, '评分']}
                    />
                    <Legend
                        wrapperStyle={{
                            paddingTop: '20px',
                            color: '#94a3b8'
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
