/**
 * 能力画像 API 接口
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
import { getUserId } from '@/hooks/useUserIdentity';

// 维度评分接口
export interface DimensionScore {
    score: number;
    evidence: string;
    trend?: string;
}

// 能力画像接口
export interface AbilityProfile {
    professional_competence: DimensionScore;
    execution_results: DimensionScore;
    logic_problem_solving: DimensionScore;
    communication: DimensionScore;
    growth_potential: DimensionScore;
    collaboration: DimensionScore;
    skill_tags: string[];
    overall_assessment?: string;
    key_strengths?: string[];
    key_weaknesses?: string[];
    recommendation?: string;
    confidence?: number;
    last_updated: string;
}

// API 响应接口
export interface ProfileResponse {
    success: boolean;
    profile?: AbilityProfile;
    generated_at?: string;
    message?: string;
}

/**
 * 获取综合能力画像（从数据库读取）
 */
export async function getOverallProfile(): Promise<ProfileResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/profile/overall`, {
            headers: { 'X-User-ID': getUserId() }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('获取能力画像失败:', error);
        return {
            success: false,
            message: '网络错误，请稍后重试'
        };
    }
}

/**
 * 生成综合能力画像（手动触发）
 */
export async function generateProfile(apiConfig?: any): Promise<ProfileResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/profile/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': getUserId()
            },
            body: apiConfig ? JSON.stringify({
                user_id: getUserId(),
                api_config: apiConfig
            }) : undefined
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('生成能力画像失败:', error);
        return {
            success: false,
            message: '网络错误，请稍后重试'
        };
    }
}

/**
 * 获取单个会话的能力画像
 */
export async function getSessionProfile(sessionId: string): Promise<ProfileResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/profile/session/${sessionId}`, {
            headers: { 'X-User-ID': getUserId() }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('获取会话画像失败:', error);
        return {
            success: false,
            message: '网络错误，请稍后重试'
        };
    }
}
