'use client';

import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Check, X, Loader2, AlertCircle, Sparkles, Zap, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    ApiConfig,
    DEFAULT_API_CONFIG,
    API_PRESETS,
    maskApiKey,
    isConfigValid
} from '@/hooks/useApiConfig';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: ApiConfig;
    onSave: (config: ApiConfig) => boolean;
}

export function SettingsDialog({ open, onOpenChange, config, onSave }: SettingsDialogProps) {
    // 本地编辑状态
    const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
    const [showApiKey, setShowApiKey] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<number>(-1);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 当弹窗打开时，同步配置
    useEffect(() => {
        if (open) {
            setLocalConfig(config);
            setShowApiKey(false);
            setTestResult(null);

            // 检测当前配置匹配哪个预设
            const matchedIndex = API_PRESETS.findIndex(
                preset => preset.baseUrl === config.baseUrl
            );
            setSelectedPreset(matchedIndex >= 0 ? matchedIndex : API_PRESETS.length - 1);
        }
    }, [open, config]);

    // 应用预设
    const handlePresetChange = (index: number) => {
        setSelectedPreset(index);
        const preset = API_PRESETS[index];
        if (preset && preset.baseUrl) {
            setLocalConfig(prev => ({
                ...prev,
                baseUrl: preset.baseUrl,
                smartModel: preset.smartModels[0] || prev.smartModel,
                fastModel: preset.fastModels[0] || prev.fastModel
            }));
        }
    };

    // 测试连接（使用 smart 模型测试）
    const handleTestConnection = async () => {
        if (!isConfigValid(localConfig)) {
            setTestResult({ success: false, message: '请先填写完整的配置信息' });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_BASE_URL}/api/config/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    api_key: localConfig.apiKey,
                    base_url: localConfig.baseUrl,
                    model: localConfig.smartModel  // 用 smart 模型测试
                })
            });

            const data = await response.json();
            setTestResult({
                success: data.success,
                message: data.message || (data.success ? '连接成功！' : '连接失败')
            });
        } catch (error) {
            setTestResult({
                success: false,
                message: '无法连接到服务器，请检查网络'
            });
        } finally {
            setIsTesting(false);
        }
    };

    // 保存配置
    const handleSave = () => {
        if (onSave(localConfig)) {
            onOpenChange(false);
        }
    };

    const currentPreset = API_PRESETS[selectedPreset];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-teal-600" />
                        API 设置
                    </DialogTitle>
                    <DialogDescription>
                        配置您的大模型 API，数据仅保存在本地浏览器中。
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* API 提供商预设 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            API 提供商
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {API_PRESETS.map((preset, index) => (
                                <button
                                    key={preset.name}
                                    onClick={() => handlePresetChange(index)}
                                    className={cn(
                                        "px-3 py-2 text-sm rounded-lg border transition-all",
                                        selectedPreset === index
                                            ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    )}
                                >
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            API Key <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={localConfig.apiKey}
                                onChange={(e) => setLocalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-12 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                                placeholder="sk-xxxxxxxxxxxxxxxx"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400">
                            您的 API Key 仅保存在浏览器本地，不会上传到服务器
                        </p>
                    </div>

                    {/* Base URL */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Base URL <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={localConfig.baseUrl}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>

                    {/* 双通道模型配置 */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <span>模型配置</span>
                            <span className="text-xs text-gray-400 font-normal">（双通道架构）</span>
                        </div>

                        {/* Smart 模型 */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <Brain className="w-4 h-4 text-purple-500" />
                                Smart 模型 <span className="text-red-500">*</span>
                                <span className="text-xs text-gray-400">（规划、总结、深度分析）</span>
                            </label>
                            {currentPreset && currentPreset.smartModels.length > 0 ? (
                                <select
                                    value={localConfig.smartModel}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, smartModel: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                                >
                                    {currentPreset.smartModels.map((model: string) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={localConfig.smartModel}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, smartModel: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                                    placeholder="gpt-4o"
                                />
                            )}
                        </div>

                        {/* Fast 模型 */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                <Zap className="w-4 h-4 text-amber-500" />
                                Fast 模型 <span className="text-red-500">*</span>
                                <span className="text-xs text-gray-400">（快速问答、简单点评）</span>
                            </label>
                            {currentPreset && currentPreset.fastModels.length > 0 ? (
                                <select
                                    value={localConfig.fastModel}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, fastModel: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                                >
                                    {currentPreset.fastModels.map((model: string) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={localConfig.fastModel}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, fastModel: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                                    placeholder="gpt-4o-mini"
                                />
                            )}
                        </div>
                    </div>

                    {/* 测试连接结果 */}
                    {testResult && (
                        <div className={cn(
                            "flex items-center gap-2 p-3 rounded-lg text-sm",
                            testResult.success
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                        )}>
                            {testResult.success ? (
                                <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            )}
                            {testResult.message}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTesting || !isConfigValid(localConfig)}
                        className="flex-1 sm:flex-none"
                    >
                        {isTesting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                测试中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                测试连接
                            </>
                        )}
                    </Button>
                    <div className="flex gap-2 flex-1 sm:flex-none">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!isConfigValid(localConfig)}
                            className="flex-1 bg-teal-600 hover:bg-teal-700"
                        >
                            保存
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
