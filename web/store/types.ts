/**
 * Store Types & Constants
 * 
 * 所有 store 相关的类型定义和常量配置
 */

import { ResumeAnalyzeResult, ResumeOptimizeResult } from '@/lib/api/resume';

// ============================================================================
// 类型定义
// ============================================================================

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    audio_url?: string;
}

export interface SessionMetadata {
    mode: 'mock' | 'voice';
    resume_filename?: string;
    job_description?: string;
    question_count: number;
    max_questions: number;
    status: 'active' | 'completed' | 'archived';
    pinned?: boolean;
    round_index?: number;
}

export interface InterviewSession {
    session_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    metadata: SessionMetadata;
    messages: Message[];
}

export interface SessionListItem {
    session_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    mode: 'mock' | 'voice';
    status: 'active' | 'completed' | 'archived';
    message_count: number;
    question_count: number;
    pinned?: boolean;
    round_index?: number;
    round_type?: string;
}

export interface ResumeInfo {
    filename: string;
    original_name: string;
    content: string;
}

export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    createdAt: string;
}

export interface ApiConfig {
    models: ModelConfig[];
    smartModelId: string;
    fastModelId: string;
    // 简历工具专家模型
    generalModelId: string;        // 通用任务（简历分析 + 主持人）
    matchAnalystModelId: string;   // 匹配分析师
    contentWriterModelId: string;  // 内容优化师
    hrReviewerModelId: string;     // HR审核官
    reflectorModelId: string;      // 质量审核
    voiceModelId: string;          // 语音面试 (Qwen3-Omni)
}

export interface InterviewProgress {
    current: number;
    total: number;
}

export interface ResumeResultItem {
    id: number;
    user_id: string;
    result_type: 'analyze' | 'optimize';
    resume_content: string;
    job_description: string | null;
    session_ids: string[];
    include_profile: boolean;
    result_data: ResumeAnalyzeResult | ResumeOptimizeResult;
    created_at: string;
}

// ============================================================================
// 常量配置
// ============================================================================

// API 提供商配置 (2025年最新模型)
export const API_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKeyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4o-mini', 'gpt-4o'] },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', apiKeyUrl: 'https://platform.deepseek.com/api_keys', models: ['deepseek-chat', 'deepseek-reasoner'] },
    { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: ['glm-4.7', 'glm-4.6', 'glm-4.5', 'glm-4-flash', 'glm-4-air'] },
    { id: 'aliyun', name: '阿里云百炼 (含语音配置，新用户实名赠送百万token)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key', models: ['qwen3-omni-flash-2025-12-01', 'qwen3-max', 'qwen3-235b-a22b-instruct-2507', 'deepseek-v3.2', 'Moonshot-Kimi-K2-Instruct', 'qwen3-next-80b-a3b-instruct', 'qwen3-30b-a3b-instruct-2507'] },
    { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys', models: ['kimi-k2-thinking', 'kimi-k2-turbo-preview', 'kimi-k2'] },
    { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak', models: ['deepseek-ai/DeepSeek-V3.2', 'MiniMaxAI/MiniMax-M2', 'zai-org/GLM-4.7', 'moonshotai/Kimi-K2-Instruct-0905'] },
    { id: 'iflow', name: '心流开放平台（免费，含资源限制）', baseUrl: 'https://apis.iflow.cn/v1', apiKeyUrl: 'https://platform.iflow.cn/profile?tab=apiKey', models: ['qwen3-max', 'qwen3-coder-plus', 'glm-4.6', 'kimi-k2', 'qwen3-235b-a22b-instruct', 'deepseek-v3.2'] },
    { id: 'modelscope', name: '魔搭社区（免费，含资源限制，且需关联阿里云百炼）', baseUrl: 'https://api-inference.modelscope.cn/v1', apiKeyUrl: 'https://www.modelscope.cn/my/myaccesstoken', models: ['deepseek-ai/DeepSeek-V3.2', 'XiaomiMiMo/MiMo-V2-Flash', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'Qwen/Qwen3-235B-A22B-Instruct-2507'] },
    { id: 'minimax', name: 'Minimax', baseUrl: 'https://api.minimaxi.com/v1', apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key', models: ['MiniMax-M2.1'] },
    { id: 'aiping', name: 'AI Ping（含限时免费模型） ', baseUrl: 'https://aiping.cn/api/v1', apiKeyUrl: 'https://www.aiping.cn/user/apikey', models: ['GLM-4.7', 'MiniMax-M2.1', 'DeepSeek-V3.2', 'Qwen3-235B-A22B', 'Doubao-Seedream-4.5', 'MiMo-V2-Flash'] },
    { id: 'custom', name: '自定义', baseUrl: '', apiKeyUrl: '', models: [] },
];

export const DEFAULT_API_CONFIG: ApiConfig = {
    models: [],
    smartModelId: '',
    fastModelId: '',
    generalModelId: '',
    matchAnalystModelId: '',
    contentWriterModelId: '',
    hrReviewerModelId: '',
    reflectorModelId: '',
    voiceModelId: '',
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// 辅助函数
// ============================================================================

export function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}
