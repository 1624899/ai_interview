/**
 * API 配置管理 Hook
 * 
 * 负责用户 API Key、Base URL、Model 的存储与管理
 * 支持双通道配置：Smart (复杂任务) 和 Fast (快速响应)
 */

import { useState, useEffect, useCallback } from 'react';

const API_CONFIG_KEY = 'interview_ai_api_config';

/**
 * API 配置接口
 * 支持双通道模型配置
 */
export interface ApiConfig {
    apiKey: string;
    baseUrl: string;
    smartModel: string;  // 用于复杂任务：规划、总结、深度分析
    fastModel: string;   // 用于快速响应：问题生成、简单点评
}

/**
 * 默认配置（提示用户填写）
 */
export const DEFAULT_API_CONFIG: ApiConfig = {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    smartModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini'
};

/**
 * 常用的 API 提供商预设
 */
export const API_PRESETS = [
    {
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        smartModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-4'],
        fastModels: ['gpt-4o-mini', 'gpt-3.5-turbo']
    },
    {
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        smartModels: ['deepseek-chat', 'deepseek-reasoner'],
        fastModels: ['deepseek-chat']
    },
    {
        name: '智谱 AI',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        smartModels: ['glm-4-plus', 'glm-4'],
        fastModels: ['glm-4-flash', 'glm-4-flashx']
    },
    {
        name: '阿里云百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        smartModels: ['qwen-max', 'qwen-plus'],
        fastModels: ['qwen-turbo', 'qwen-plus']
    },
    {
        name: '月之暗面 Kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        smartModels: ['moonshot-v1-128k', 'moonshot-v1-32k'],
        fastModels: ['moonshot-v1-8k']
    },
    {
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        smartModels: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V2.5'],
        fastModels: ['Qwen/Qwen2.5-7B-Instruct', 'THUDM/glm-4-9b-chat']
    },
    {
        name: '自定义',
        baseUrl: '',
        smartModels: [],
        fastModels: []
    }
];

/**
 * API Key 脱敏显示
 * 
 * @param apiKey 完整的 API Key
 * @returns 脱敏后的显示文本，如 "sk-xxxx...xxxx"
 */
export function maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 12) return '****';

    const prefix = apiKey.substring(0, 6);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}...${suffix}`;
}

/**
 * 验证 API 配置是否完整
 */
export function isConfigValid(config: ApiConfig): boolean {
    return !!(config.apiKey && config.baseUrl && config.smartModel && config.fastModel);
}

/**
 * API 配置管理 Hook
 */
export function useApiConfig() {
    const [config, setConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
    const [isConfigured, setIsConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // 从 localStorage 加载配置
    useEffect(() => {
        if (typeof window === 'undefined') return;

        try {
            const stored = localStorage.getItem(API_CONFIG_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as ApiConfig;
                setConfig(parsed);
                setIsConfigured(isConfigValid(parsed));
                console.log('✅ 已加载 API 配置');
            } else {
                console.log('ℹ️ 未找到 API 配置，请先配置');
            }
        } catch (error) {
            console.error('读取 API 配置失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 保存配置
    const saveConfig = useCallback((newConfig: ApiConfig) => {
        if (typeof window === 'undefined') return false;

        try {
            localStorage.setItem(API_CONFIG_KEY, JSON.stringify(newConfig));
            setConfig(newConfig);
            setIsConfigured(isConfigValid(newConfig));
            console.log('✅ API 配置已保存');
            return true;
        } catch (error) {
            console.error('保存 API 配置失败:', error);
            return false;
        }
    }, []);

    // 更新部分配置
    const updateConfig = useCallback((updates: Partial<ApiConfig>) => {
        const newConfig = { ...config, ...updates };
        return saveConfig(newConfig);
    }, [config, saveConfig]);

    // 清除配置
    const clearConfig = useCallback(() => {
        if (typeof window === 'undefined') return;

        localStorage.removeItem(API_CONFIG_KEY);
        setConfig(DEFAULT_API_CONFIG);
        setIsConfigured(false);
        console.log('🧹 API 配置已清除');
    }, []);

    // 应用预设
    const applyPreset = useCallback((presetIndex: number) => {
        const preset = API_PRESETS[presetIndex];
        if (!preset) return;

        updateConfig({
            baseUrl: preset.baseUrl,
            smartModel: preset.smartModels[0] || '',
            fastModel: preset.fastModels[0] || ''
        });
    }, [updateConfig]);

    return {
        config,
        isConfigured,
        isLoading,
        saveConfig,
        updateConfig,
        clearConfig,
        applyPreset,
        maskedApiKey: maskApiKey(config.apiKey)
    };
}

/**
 * 获取当前 API 配置（非 Hook 版本，用于普通函数中）
 * 
 * @returns 当前 API 配置，如果未配置则返回 null
 */
export function getApiConfig(): ApiConfig | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(API_CONFIG_KEY);
        if (stored) {
            const config = JSON.parse(stored) as ApiConfig;
            return isConfigValid(config) ? config : null;
        }
    } catch (error) {
        console.error('读取 API 配置失败:', error);
    }

    return null;
}
