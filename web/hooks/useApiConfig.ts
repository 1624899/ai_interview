/**
 * API 配置管理 Hook
 * 
 * 支持自由添加、组合多个模型配置
 */

import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const API_CONFIG_KEY = 'interview_ai_api_config_v2';

/**
 * 单个模型配置
 */
export interface ModelConfig {
    id: string;
    name: string;           // 用户自定义的配置名称，如 "我的GPT-4"
    provider: string;       // 提供商名称
    apiKey: string;
    baseUrl: string;
    model: string;          // 模型名称
    createdAt: number;
}

/**
 * 完整的 API 配置
 */
export interface ApiConfig {
    models: ModelConfig[];   // 已配置的模型列表
    smartModelId: string;    // Smart 通道使用的模型 ID
    fastModelId: string;     // Fast 通道使用的模型 ID
}

/**
 * 默认配置
 */
export const DEFAULT_API_CONFIG: ApiConfig = {
    models: [],
    smartModelId: '',
    fastModelId: ''
};

/**
 * API 提供商预设
 */
export const API_PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-reasoner']
    },
    {
        id: 'zhipu',
        name: '智谱 AI',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-4-flashx']
    },
    {
        id: 'aliyun',
        name: '阿里云百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo']
    },
    {
        id: 'moonshot',
        name: '月之暗面 Kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k']
    },
    {
        id: 'siliconflow',
        name: 'SiliconFlow',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: ['Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5']
    },
    {
        id: 'custom',
        name: '自定义',
        baseUrl: '',
        models: []
    }
];

/**
 * API Key 脱敏显示
 */
export function maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 12) return '****';

    const prefix = apiKey.substring(0, 6);
    const suffix = apiKey.substring(apiKey.length - 4);
    return `${prefix}...${suffix}`;
}

/**
 * 验证单个模型配置是否完整
 */
export function isModelConfigValid(config: ModelConfig): boolean {
    return !!(config.apiKey && config.baseUrl && config.model);
}

/**
 * 验证整体 API 配置是否可用
 */
export function isConfigValid(config: ApiConfig): boolean {
    if (config.models.length === 0) return false;

    const smartModel = config.models.find(m => m.id === config.smartModelId);
    const fastModel = config.models.find(m => m.id === config.fastModelId);

    return !!(smartModel && fastModel && isModelConfigValid(smartModel) && isModelConfigValid(fastModel));
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

    // 添加模型配置
    const addModel = useCallback((model: Omit<ModelConfig, 'id' | 'createdAt'>) => {
        const newModel: ModelConfig = {
            ...model,
            id: uuidv4(),
            createdAt: Date.now()
        };

        const newConfig = {
            ...config,
            models: [...config.models, newModel]
        };

        // 如果是第一个模型，自动设为 smart 和 fast
        if (config.models.length === 0) {
            newConfig.smartModelId = newModel.id;
            newConfig.fastModelId = newModel.id;
        }

        return saveConfig(newConfig) ? newModel : null;
    }, [config, saveConfig]);

    // 更新模型配置
    const updateModel = useCallback((id: string, updates: Partial<ModelConfig>) => {
        const newConfig = {
            ...config,
            models: config.models.map(m =>
                m.id === id ? { ...m, ...updates } : m
            )
        };
        return saveConfig(newConfig);
    }, [config, saveConfig]);

    // 删除模型配置
    const deleteModel = useCallback((id: string) => {
        const newConfig = {
            ...config,
            models: config.models.filter(m => m.id !== id),
            // 如果删除的是当前选中的，重置选择
            smartModelId: config.smartModelId === id ? '' : config.smartModelId,
            fastModelId: config.fastModelId === id ? '' : config.fastModelId
        };
        return saveConfig(newConfig);
    }, [config, saveConfig]);

    // 设置 Smart 模型
    const setSmartModel = useCallback((id: string) => {
        return saveConfig({ ...config, smartModelId: id });
    }, [config, saveConfig]);

    // 设置 Fast 模型
    const setFastModel = useCallback((id: string) => {
        return saveConfig({ ...config, fastModelId: id });
    }, [config, saveConfig]);

    // 清除所有配置
    const clearConfig = useCallback(() => {
        if (typeof window === 'undefined') return;

        localStorage.removeItem(API_CONFIG_KEY);
        setConfig(DEFAULT_API_CONFIG);
        setIsConfigured(false);
        console.log('🧹 API 配置已清除');
    }, []);

    // 获取当前选中的模型
    const getSmartModel = useCallback(() => {
        return config.models.find(m => m.id === config.smartModelId);
    }, [config]);

    const getFastModel = useCallback(() => {
        return config.models.find(m => m.id === config.fastModelId);
    }, [config]);

    return {
        config,
        isConfigured,
        isLoading,
        saveConfig,
        addModel,
        updateModel,
        deleteModel,
        setSmartModel,
        setFastModel,
        clearConfig,
        getSmartModel,
        getFastModel
    };
}

/**
 * 获取当前 API 配置（非 Hook 版本，用于普通函数中）
 * 返回 smart 和 fast 模型的配置
 */
export function getApiConfig(): { smartModel: ModelConfig; fastModel: ModelConfig } | null {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(API_CONFIG_KEY);
        if (stored) {
            const config = JSON.parse(stored) as ApiConfig;
            const smartModel = config.models.find(m => m.id === config.smartModelId);
            const fastModel = config.models.find(m => m.id === config.fastModelId);

            if (smartModel && fastModel && isModelConfigValid(smartModel) && isModelConfigValid(fastModel)) {
                return { smartModel, fastModel };
            }
        }
    } catch (error) {
        console.error('读取 API 配置失败:', error);
    }

    return null;
}
