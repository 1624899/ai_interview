/**
 * API Config Slice - API 配置管理
 * 
 * 负责 LLM API 模型的配置管理
 */

import { v4 as uuidv4 } from 'uuid';
import type { ModelConfig, ApiConfig } from '../types';
import { DEFAULT_API_CONFIG } from '../types';

// ============================================================================
// 类型定义
// ============================================================================

export interface ApiConfigState {
    apiConfig: ApiConfig;
}

export interface ApiConfigActions {
    addModel: (model: Omit<ModelConfig, 'id' | 'createdAt'>) => ModelConfig | null;
    updateModel: (id: string, updates: Partial<ModelConfig>) => boolean;
    deleteModel: (id: string) => boolean;
    setSmartModel: (id: string) => boolean;
    setFastModel: (id: string) => boolean;
    getSmartModel: () => ModelConfig | null;
    getFastModel: () => ModelConfig | null;
    // 简历工具专家模型
    setGeneralModel: (id: string) => boolean;
    setMatchAnalystModel: (id: string) => boolean;
    setContentWriterModel: (id: string) => boolean;
    setHrReviewerModel: (id: string) => boolean;
    setReflectorModel: (id: string) => boolean;
    getGeneralModel: () => ModelConfig | null;
    getMatchAnalystModel: () => ModelConfig | null;
    getContentWriterModel: () => ModelConfig | null;
    getHrReviewerModel: () => ModelConfig | null;
    getReflectorModel: () => ModelConfig | null;
    // 通用方法
    isConfigured: () => boolean;
    getApiConfigForRequest: () => {
        smart: { api_key: string; base_url: string; model: string };
        fast: { api_key: string; base_url: string; model: string };
        general: { api_key: string; base_url: string; model: string };
        match_analyst: { api_key: string; base_url: string; model: string };
        content_writer: { api_key: string; base_url: string; model: string };
        hr_reviewer: { api_key: string; base_url: string; model: string };
        reflector: { api_key: string; base_url: string; model: string };
    } | null;
}

export type ApiConfigSlice = ApiConfigState & ApiConfigActions;

// ============================================================================
// Slice 工厂函数
// ============================================================================

type SetState = (partial: Partial<ApiConfigSlice> | ((state: ApiConfigSlice) => Partial<ApiConfigSlice>)) => void;
type GetState = () => ApiConfigSlice;

export const createApiConfigSlice = (set: SetState, get: GetState): ApiConfigSlice => ({
    // ===== 初始状态 =====
    apiConfig: DEFAULT_API_CONFIG,

    // ===== Actions =====

    addModel: (modelData) => {
        const { apiConfig } = get();
        const newModel: ModelConfig = {
            ...modelData,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
        };

        const newConfig = {
            ...apiConfig,
            models: [...apiConfig.models, newModel],
        };

        // 如果是第一个模型，自动设为所有通道的默认值
        if (apiConfig.models.length === 0) {
            newConfig.smartModelId = newModel.id;
            newConfig.fastModelId = newModel.id;
            newConfig.generalModelId = newModel.id;
            newConfig.matchAnalystModelId = newModel.id;
            newConfig.contentWriterModelId = newModel.id;
            newConfig.hrReviewerModelId = newModel.id;
            newConfig.reflectorModelId = newModel.id;
        }

        set({ apiConfig: newConfig });
        return newModel;
    },

    updateModel: (id, updates) => {
        const { apiConfig } = get();
        const modelIndex = apiConfig.models.findIndex(m => m.id === id);
        if (modelIndex === -1) return false;

        const updatedModels = [...apiConfig.models];
        updatedModels[modelIndex] = { ...updatedModels[modelIndex], ...updates };

        set({ apiConfig: { ...apiConfig, models: updatedModels } });
        return true;
    },

    deleteModel: (id) => {
        const { apiConfig } = get();
        const newConfig = {
            ...apiConfig,
            models: apiConfig.models.filter(m => m.id !== id),
            smartModelId: apiConfig.smartModelId === id ? '' : apiConfig.smartModelId,
            fastModelId: apiConfig.fastModelId === id ? '' : apiConfig.fastModelId,
            generalModelId: apiConfig.generalModelId === id ? '' : apiConfig.generalModelId,
            matchAnalystModelId: apiConfig.matchAnalystModelId === id ? '' : apiConfig.matchAnalystModelId,
            contentWriterModelId: apiConfig.contentWriterModelId === id ? '' : apiConfig.contentWriterModelId,
            hrReviewerModelId: apiConfig.hrReviewerModelId === id ? '' : apiConfig.hrReviewerModelId,
            reflectorModelId: apiConfig.reflectorModelId === id ? '' : apiConfig.reflectorModelId,
        };

        set({ apiConfig: newConfig });
        return true;
    },

    setSmartModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, smartModelId: id } });
        return true;
    },

    setFastModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, fastModelId: id } });
        return true;
    },

    // 简历工具专家模型 setters
    setGeneralModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, generalModelId: id } });
        return true;
    },

    setMatchAnalystModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, matchAnalystModelId: id } });
        return true;
    },

    setContentWriterModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, contentWriterModelId: id } });
        return true;
    },

    setHrReviewerModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, hrReviewerModelId: id } });
        return true;
    },

    setReflectorModel: (id) => {
        const { apiConfig } = get();
        if (!apiConfig.models.find(m => m.id === id)) return false;
        set({ apiConfig: { ...apiConfig, reflectorModelId: id } });
        return true;
    },

    // Getters
    getSmartModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.smartModelId) || null;
    },

    getFastModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.fastModelId) || null;
    },

    getGeneralModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.generalModelId) || null;
    },

    getMatchAnalystModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.matchAnalystModelId) || null;
    },

    getContentWriterModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.contentWriterModelId) || null;
    },

    getHrReviewerModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.hrReviewerModelId) || null;
    },

    getReflectorModel: () => {
        const { apiConfig } = get();
        return apiConfig.models.find(m => m.id === apiConfig.reflectorModelId) || null;
    },

    isConfigured: () => {
        const { apiConfig } = get();
        const smartModel = apiConfig.models.find(m => m.id === apiConfig.smartModelId);
        const fastModel = apiConfig.models.find(m => m.id === apiConfig.fastModelId);
        return !!(smartModel?.apiKey && fastModel?.apiKey);
    },

    getApiConfigForRequest: () => {
        const smartModel = get().getSmartModel();
        const fastModel = get().getFastModel();
        const generalModel = get().getGeneralModel();
        const matchAnalystModel = get().getMatchAnalystModel();
        const contentWriterModel = get().getContentWriterModel();
        const hrReviewerModel = get().getHrReviewerModel();
        const reflectorModel = get().getReflectorModel();

        if (!smartModel || !fastModel) return null;

        // 辅助函数：获取模型配置，如果未设置则回退到 smart
        const getModelConfig = (model: ModelConfig | null) => {
            const m = model || smartModel;
            return {
                api_key: m.apiKey,
                base_url: m.baseUrl,
                model: m.model,
            };
        };

        return {
            smart: getModelConfig(smartModel),
            fast: getModelConfig(fastModel),
            general: getModelConfig(generalModel),
            match_analyst: getModelConfig(matchAnalystModel),
            content_writer: getModelConfig(contentWriterModel),
            hr_reviewer: getModelConfig(hrReviewerModel),
            reflector: getModelConfig(reflectorModel),
        };
    },
});

