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
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: string;
}

export interface SessionMetadata {
    mode: 'coach' | 'mock';
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
    mode: 'coach' | 'mock';
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
    { id: 'zhipu', name: '智谱 AI', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: ['glm-4.6', 'glm-4.5', 'glm-4-flash', 'glm-4-air'] },
    { id: 'aliyun', name: '阿里云百炼', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b', 'qwen3-30b'] },
    { id: 'moonshot', name: 'Moonshot', baseUrl: 'https://api.moonshot.cn/v1', apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys', models: ['kimi-k2-thinking', 'kimi-k2-turbo-preview', 'kimi-k2'] },
    { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak', models: ['deepseek-ai/DeepSeek-V3.2', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen3-235B', 'THUDM/glm-4.5', 'moonshot-ai/Kimi-K2'] },
    { id: 'iflow', name: '心流开放平台（免费）', baseUrl: 'https://apis.iflow.cn/v1', apiKeyUrl: 'https://platform.iflow.cn/profile?tab=apiKey', models: ['qwen3-max', 'qwen3-coder-plus', 'glm-4.6', 'kimi-k2', 'qwen3-235b-a22b-instruct', 'deepseek-v3.2'] },
    { id: 'modelscope', name: 'ModelScope（免费）', baseUrl: 'https://api-inference.modelscope.cn/v1', apiKeyUrl: 'https://www.modelscope.cn/my/myaccesstoken', models: ['deepseek-ai/DeepSeek-V3.2', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'Qwen/Qwen3-235B-A22B-Instruct-2507'] },
    { id: 'minimax', name: 'Minimax', baseUrl: 'https://api.minimaxi.com/v1', apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key', models: ['MiniMax-M2'] },
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
};

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============================================================================
// 辅助函数
// ============================================================================

export function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}
