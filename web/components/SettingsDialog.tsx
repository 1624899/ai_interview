'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Eye, EyeOff, Check, X, Loader2, AlertCircle, Trash2, Brain, Zap, ChevronLeft, Edit2, ChevronDown } from 'lucide-react';
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
    ModelConfig,
    API_PROVIDERS,
    maskApiKey,
    useInterviewStore
} from '@/store/useInterviewStore';
import { getUserId } from '@/hooks/useUserIdentity';

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// 添加/编辑模型的二级弹窗
interface ModelFormDialogProps {
    open: boolean;
    onClose: () => void;
    onSave: (model: Omit<ModelConfig, 'id' | 'createdAt'>) => void;
    editingModel?: ModelConfig;
}

function ModelFormDialog({ open, onClose, onSave, editingModel }: ModelFormDialogProps) {
    const [provider, setProvider] = useState(editingModel?.provider || '');
    const [apiKey, setApiKey] = useState(editingModel?.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(editingModel?.baseUrl || '');
    const [model, setModel] = useState(editingModel?.model || '');
    const [name, setName] = useState(editingModel?.name || '');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // 重置表单
    useEffect(() => {
        if (open) {
            if (editingModel) {
                setProvider(editingModel.provider);
                setApiKey(editingModel.apiKey);
                setBaseUrl(editingModel.baseUrl);
                setModel(editingModel.model);
                setName(editingModel.name);
            } else {
                setProvider('');
                setApiKey('');
                setBaseUrl('');
                setModel('');
                setName('');
            }
            setShowApiKey(false);
            setTestResult(null);
        }
    }, [open, editingModel]);

    // 选择提供商
    const handleProviderChange = (providerId: string) => {
        setProvider(providerId);
        const providerConfig = API_PROVIDERS.find(p => p.id === providerId);
        if (providerConfig) {
            setBaseUrl(providerConfig.baseUrl);
            if (providerConfig.models.length > 0) {
                setModel(providerConfig.models[0]);
            } else {
                setModel('');
            }
        }
        setTestResult(null);
    };

    // 测试连接
    const handleTestConnection = async () => {
        if (!apiKey || !baseUrl || !model) {
            setTestResult({ success: false, message: '请先填写完整的配置信息' });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_BASE_URL}/api/config/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': getUserId()
                },
                body: JSON.stringify({
                    api_key: apiKey,
                    base_url: baseUrl,
                    model: model
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

    // 保存
    const handleSave = () => {
        const providerConfig = API_PROVIDERS.find(p => p.id === provider);
        const configName = name || `${providerConfig?.name || '自定义'} - ${model}`;

        onSave({
            name: configName,
            provider,
            apiKey,
            baseUrl,
            model
        });
        onClose();
    };

    const currentProvider = API_PROVIDERS.find(p => p.id === provider);
    const canSave = apiKey && baseUrl && model;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ChevronLeft className="w-5 h-5 cursor-pointer hover:text-teal-600" onClick={onClose} />
                        {editingModel ? '编辑模型配置' : '添加模型配置'}
                    </DialogTitle>
                    <DialogDescription>
                        配置大模型 API，数据仅保存在本地浏览器中
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* API 提供商 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            API 提供商
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {API_PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => handleProviderChange(p.id)}
                                    className={cn(
                                        "px-3 py-2 text-sm rounded-lg border transition-all",
                                        provider === p.id
                                            ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                                    )}
                                >
                                    {p.name}
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
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                autoComplete="new-password"
                                name="api-key-field"
                                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 pr-12 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
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
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>

                    {/* 模型配置 */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            模型配置 <span className="text-red-500">*</span>
                        </label>
                        {currentProvider && currentProvider.models.length > 0 ? (
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                            >
                                <option value="">选择模型</option>
                                {currentProvider.models.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                                placeholder="输入模型名称，如 gpt-4o"
                            />
                        )}
                    </div>

                    {/* 配置名称（可选） */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            配置名称 <span className="text-gray-400 text-xs">（可选）</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="off"
                            name="config-name-field"
                            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none"
                        />
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
                        disabled={isTesting || !canSave}
                        className="flex-1 sm:flex-none"
                    >
                        {isTesting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                测试中...
                            </>
                        ) : (
                            '测试连接'
                        )}
                    </Button>
                    <div className="flex gap-2 flex-1 sm:flex-none">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!canSave}
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

// 主设置弹窗
export function SettingsDialog({
    open,
    onOpenChange
}: SettingsDialogProps) {
    const {
        apiConfig: config,
        addModel: onAddModel,
        updateModel: onUpdateModel,
        deleteModel: onDeleteModel,
        setSmartModel: onSetSmartModel,
        setFastModel: onSetFastModel
    } = useInterviewStore();
    const [showModelForm, setShowModelForm] = useState(false);
    const [editingModel, setEditingModel] = useState<ModelConfig | undefined>();

    // 打开添加模型弹窗
    const handleAddModel = () => {
        setEditingModel(undefined);
        setShowModelForm(true);
    };

    // 打开编辑模型弹窗
    const handleEditModel = (model: ModelConfig) => {
        setEditingModel(model);
        setShowModelForm(true);
    };

    // 保存模型配置
    const handleSaveModel = (modelData: Omit<ModelConfig, 'id' | 'createdAt'>) => {
        if (editingModel) {
            onUpdateModel(editingModel.id, modelData);
        } else {
            onAddModel(modelData);
        }
        setShowModelForm(false);
        setEditingModel(undefined);
    };

    // 删除模型
    const handleDeleteModel = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('确定要删除这个模型配置吗？')) {
            onDeleteModel(id);
        }
    };

    return (
        <>
            <Dialog open={open && !showModelForm} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-teal-600" />
                            API 设置
                        </DialogTitle>
                        <DialogDescription>
                            添加和管理您的大模型 API 配置
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-4">
                        {/* 添加模型区域 - 水平排列的卡片 */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700">添加模型：</label>
                            <div className="flex flex-wrap gap-3">
                                {/* 已配置的模型卡片 */}
                                {config.models.map((model) => {
                                    const provider = API_PROVIDERS.find(p => p.id === model.provider);
                                    return (
                                        <div
                                            key={model.id}
                                            onClick={() => handleEditModel(model)}
                                            className="group relative px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-teal-400 hover:shadow-sm transition-all cursor-pointer min-w-[120px]"
                                        >
                                            <div className="text-sm font-medium text-gray-900 truncate max-w-[100px]">
                                                {model.name.split(' - ')[0]}
                                            </div>
                                            <div className="text-xs text-gray-400 truncate">
                                                {model.model}
                                            </div>
                                            {/* 删除按钮 */}
                                            <button
                                                onClick={(e) => handleDeleteModel(model.id, e)}
                                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    );
                                })}

                                {/* 添加按钮 */}
                                <button
                                    onClick={handleAddModel}
                                    className="w-[72px] h-[72px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/50 transition-all"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* 模型配置区域 - 下拉选择 */}
                        {config.models.length > 0 && (
                            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4">
                                <label className="text-sm font-medium text-gray-700">模型配置</label>

                                {/* Smart 通道选择 */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                        <Brain className="w-4 h-4 text-purple-500" />
                                        Smart
                                        <span className="text-xs text-gray-400">（复杂任务：规划、总结）</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={config.smartModelId}
                                            onChange={(e) => onSetSmartModel(e.target.value)}
                                            className="w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                                        >
                                            <option value="">选择模型</option>
                                            {config.models.map((model) => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Fast 通道选择 */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-600">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        Fast
                                        <span className="text-xs text-gray-400">（快速响应：问答、点评）</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={config.fastModelId}
                                            onChange={(e) => onSetFastModel(e.target.value)}
                                            className="w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                                        >
                                            <option value="">选择模型</option>
                                            {config.models.map((model) => (
                                                <option key={model.id} value={model.id}>
                                                    {model.name}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 空状态提示 */}
                        {config.models.length === 0 && (
                            <div className="text-center py-6 text-gray-400 text-sm">
                                点击上方 + 按钮添加模型配置
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => onOpenChange(false)} className="bg-teal-600 hover:bg-teal-700">
                            完成
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 添加/编辑模型的二级弹窗 */}
            <ModelFormDialog
                open={showModelForm}
                onClose={() => {
                    setShowModelForm(false);
                    setEditingModel(undefined);
                }}
                onSave={handleSaveModel}
                editingModel={editingModel}
            />
        </>
    );
}
