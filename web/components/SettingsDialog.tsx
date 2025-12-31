'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Eye, EyeOff, Check, Loader2, AlertCircle, Brain, Zap, ChevronLeft, ChevronDown, FileText, Users, PenTool, UserCheck, CheckCircle, Copy, HelpCircle, ExternalLink, Key, Award } from 'lucide-react';
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
    initialValues?: Partial<ModelConfig>;
}

function ModelFormDialog({ open, onClose, onSave, editingModel, initialValues }: ModelFormDialogProps) {
    const [provider, setProvider] = useState(editingModel?.provider || '');
    const [apiKey, setApiKey] = useState(editingModel?.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(editingModel?.baseUrl || '');
    const [model, setModel] = useState(editingModel?.model || '');
    const [name, setName] = useState(editingModel?.name || '');
    const [showApiKey, setShowApiKey] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
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
            } else if (initialValues) {
                setProvider(initialValues.provider || '');
                setApiKey(initialValues.apiKey || '');
                setBaseUrl(initialValues.baseUrl || '');
                setModel(initialValues.model || '');
                setName(''); // 复制时不复制名称，当作新配置
            } else {
                // 默认选中 ai ping
                const defaultProvider = 'aiping';
                setProvider(defaultProvider);
                const providerConfig = API_PROVIDERS.find(p => p.id === defaultProvider);
                if (providerConfig) {
                    setBaseUrl(providerConfig.baseUrl);
                    if (providerConfig.models.length > 0) {
                        setModel(providerConfig.models[0]);
                    } else {
                        setModel('');
                    }
                }
                setApiKey('');
                setName('');
            }
            setShowApiKey(false);
            setTestResult(null);
            setShowTutorial(false);
        }
    }, [open, editingModel, initialValues]);

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
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2">
                            <ChevronLeft className="w-5 h-5 cursor-pointer hover:text-teal-600" onClick={onClose} />
                            {editingModel ? '编辑模型配置' : '添加模型配置'}
                        </DialogTitle>
                        <button
                            onClick={() => setShowTutorial(!showTutorial)}
                            className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium bg-teal-50 px-2 py-1 rounded-md transition-colors"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                            教程
                        </button>
                    </div>
                    <DialogDescription>
                        配置大模型 API，数据仅保存在本地浏览器中
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-5">
                        {/* 配置教程面板 */}
                        {showTutorial && (
                            <div className="mb-5 p-4 rounded-xl border border-teal-100 bg-teal-50/40 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 text-sm font-bold text-teal-800">
                                    <Award className="w-4 h-4 text-orange-500" /> 快速配置建议
                                </div>
                                <div className="space-y-2 text-[11px] text-teal-700 leading-relaxed">
                                    <p>1. <strong>获取福利：</strong> 推荐使用 <a href="https://www.aiping.cn/#?invitation_code=SJY0NW" target="_blank" className="underline font-bold text-orange-600 font-bold underline">AI Ping</a> 注册，输入邀请码 <b>SJY0NW</b> 可领 <b>20元</b> 奖励。</p>
                                    <p>2. <strong>填写说明：</strong> 选择提供商后会自动填入 Base URL。你只需要粘贴你的 <b>API Key</b> ，并选择模型配置即可。</p>
                                    <p>3. <strong>测试连接：</strong> 保存前请务必点击底部的“测试连接”，确保配置有效。</p>
                                </div>
                            </div>
                        )}
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
                            {currentProvider?.apiKeyUrl ? (
                                <p className="text-xs text-teal-600">
                                    <a
                                        href={currentProvider.apiKeyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline inline-flex items-center gap-1"
                                    >
                                        → 点击获取 {currentProvider.name} API Key
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </p>
                            ) : (
                                <p className="text-xs text-gray-400">
                                    您的 API Key 仅保存在浏览器本地，不会上传到服务器
                                </p>
                            )}
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
                </div>

                <DialogFooter className="p-6 pt-4 border-t bg-gray-50/50 flex-col sm:flex-row gap-2">
                    {!testResult && (
                        <div className="flex items-center gap-2 px-1 pb-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <p className="text-xs text-orange-600 font-medium">请先测试连接，确保配置可用</p>
                        </div>
                    )}
                    <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTesting || !canSave}
                        className="flex-1 sm:flex-none border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 hover:text-orange-800 hover:border-orange-300 transition-colors"
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
        setFastModel: onSetFastModel,
        // 简历工具专家模型
        setGeneralModel: onSetGeneralModel,
        setMatchAnalystModel: onSetMatchAnalystModel,
        setContentWriterModel: onSetContentWriterModel,
        setHrReviewerModel: onSetHrReviewerModel,
        setReflectorModel: onSetReflectorModel,
        setVoiceModel: onSetVoiceModel
    } = useInterviewStore();
    const [showModelForm, setShowModelForm] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [editingModel, setEditingModel] = useState<ModelConfig | undefined>();
    const [sourceModel, setSourceModel] = useState<ModelConfig | undefined>();

    // 当没有配置任何模型时，默认开启教程
    useEffect(() => {
        if (open && config.models.length === 0) {
            setShowTutorial(true);
        }
    }, [open, config.models.length]);

    // 打开添加模型弹窗
    const handleAddModel = () => {
        setEditingModel(undefined);
        setSourceModel(undefined);
        setShowModelForm(true);
    };

    // 复制模型配置
    const handleDuplicateModel = (model: ModelConfig, e: React.MouseEvent) => {
        e.stopPropagation();
        setSourceModel(model);
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
                <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="flex items-center gap-2">
                                <Settings className="w-5 h-5 text-teal-600" />
                                API 设置
                            </DialogTitle>
                            <button
                                onClick={() => setShowTutorial(!showTutorial)}
                                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium bg-teal-50 px-2 py-1 rounded-md transition-colors"
                            >
                                <HelpCircle className="w-3.5 h-3.5" />
                                配置教程
                            </button>
                        </div>
                        <DialogDescription>
                            添加和管理您的大模型 API 配置
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="space-y-5">
                            {/* 配置教程面板 */}
                            {showTutorial && (
                                <div className="p-5 rounded-2xl border border-teal-100 bg-teal-50/40 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 shadow-inner">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-base font-bold text-teal-900">
                                            <HelpCircle className="w-5 h-5" />
                                            小白配置全攻略 (2026年1月版)
                                        </div>
                                        <button onClick={() => setShowTutorial(false)} className="text-teal-400 hover:text-teal-600">×</button>
                                    </div>

                                    {/* 1. 核心概念 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white/60 rounded-xl border border-teal-50">
                                            <div className="font-bold text-xs text-teal-800 mb-1 flex items-center gap-1">
                                                <Key className="w-3 h-3" /> API Key 是什么？
                                            </div>
                                            <p className="text-[11px] text-teal-600 leading-snug">就像是给 AI 拨号的“手机卡卡密”，每个账号独有且必须有余额才能通话。</p>
                                        </div>
                                        <div className="p-3 bg-white/60 rounded-xl border border-teal-50">
                                            <div className="font-bold text-xs text-teal-800 mb-1 flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" /> Base URL 是什么？
                                            </div>
                                            <p className="text-[11px] text-teal-600 leading-snug">AI 的“服务器地址”，通常以 <code>/v1</code> 结尾，不能填错。</p>
                                        </div>
                                    </div>

                                    {/* 2. 步骤引导 */}
                                    <div className="space-y-3">
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-teal-900">获取密钥 (福利推荐)</p>
                                                <p className="text-[11px] text-teal-700 leading-relaxed">
                                                    首选 <a href="https://www.aiping.cn/#?invitation_code=SJY0NW" target="_blank" className="underline font-bold text-orange-600">AI Ping</a> 注册（通过此链接或者输入邀请码 <b>SJY0NW</b> 可领<b>20元</b>算力点奖励）
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-teal-900">录入模型配置</p>
                                                <p className="text-[11px] text-teal-700">点击下方的 <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-400"><Plus className="w-2.5 h-2.5 inline" /></span> 按钮，提供商选 <b>AI Ping</b> 或 <b>其他免费模型提供商</b>，粘贴 Key，保存即可。</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-bold text-teal-900">分配各个“大脑”任务</p>
                                                <p className="text-[11px] text-teal-700 leading-relaxed">
                                                    在下方下拉框中选择你刚才添加的模型：<br />
                                                    - <b>Smart (指挥官):</b> 选 <code>deepseek-v3</code> 或 <code>qwen3-max</code>。<br />
                                                    - <b>Fast (对话员):</b> 选 <code>mimo-v2-flash</code>，速度极快顺滑。
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. 最佳方案推荐 */}
                                    <div className="p-3 bg-teal-600/5 rounded-xl border border-teal-200 dashed">
                                        <div className="text-xs font-bold text-teal-900 mb-2 flex items-center gap-1.5">
                                            <Award className="w-4 h-4 text-orange-500" /> 当前最省心组合方案（均可免费白嫖）
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="flex items-center gap-1 text-teal-800">
                                                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                                                主力模型：Qwen3-Max（心流）
                                            </div>
                                            <div className="flex items-center gap-1 text-teal-800">
                                                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                                                对话模型：MiMo-V2（ai ping）
                                            </div>
                                            <div className="flex items-center gap-1 text-teal-800">
                                                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                                                通用任务：GLM-4.7（ai ping）
                                            </div>
                                            <div className="flex items-center gap-1 text-teal-800">
                                                <span className="w-1 h-1 rounded-full bg-teal-400"></span>
                                                语音面试：Qwen3-Omni（阿里云百炼）
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-teal-100/50 flex items-center justify-between">
                                        <div className="flex gap-2.5">
                                            {API_PROVIDERS.filter(p => p.apiKeyUrl).slice(0, 3).map(p => (
                                                <a key={p.id} href={p.apiKeyUrl} target="_blank" className="flex items-center gap-0.5 text-[10px] text-teal-600 hover:underline">
                                                    <ExternalLink className="w-2 h-2" />
                                                    {p.name.split('(')[0]}
                                                </a>
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-teal-500 italic">设置将实时保存到浏览器本地</span>
                                    </div>
                                </div>
                            )}
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
                                                <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => handleDuplicateModel(model, e)}
                                                        className="w-5 h-5 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 shadow-sm"
                                                        title="复制配置"
                                                    >
                                                        <Copy className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteModel(model.id, e)}
                                                        className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-sm"
                                                        title="删除配置"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
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
                                <>
                                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4">
                                        <label className="text-sm font-medium text-gray-700">面试功能模型配置</label>

                                        {/* Smart 通道选择 */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <Brain className="w-4 h-4 text-purple-500" />
                                                Smart
                                                <span className="text-xs text-gray-400">（复杂任务：规划、总结，推荐 Qwen3-Max ）</span>
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
                                                <span className="text-xs text-gray-400">（快速响应：问答、点评，推荐 MiMo-V2-Flash/ DeepSeek-V3.2）</span>
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

                                    {/* 简历工具专家模型配置 */}
                                    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4">
                                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-teal-600" />
                                            简历工具模型配置
                                        </label>

                                        <div className="flex items-start gap-2 p-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <p>注意：心流、魔搭免费模型存在并发限制，匹配分析师、内容优化师、HR审核官只允许一个配置免费模型。deepseekv3.2与deepseekchat是同一模型</p>
                                        </div>

                                        {/* 通用任务（简历分析 + 主持人） */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <Brain className="w-4 h-4 text-indigo-500" />
                                                通用任务
                                                <span className="text-xs text-gray-400">（简历分析、主持人，推荐Qwen3-Max）</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={config.generalModelId || ''}
                                                    onChange={(e) => onSetGeneralModel(e.target.value)}
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

                                        {/* 匹配分析师 */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <Users className="w-4 h-4 text-blue-500" />
                                                匹配分析师
                                                <span className="text-xs text-gray-400">（JD关键词匹配，推荐Qwen3-Max/DeepSeek-V3.2）</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={config.matchAnalystModelId || ''}
                                                    onChange={(e) => onSetMatchAnalystModel(e.target.value)}
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

                                        {/* 内容优化师 */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <PenTool className="w-4 h-4 text-green-500" />
                                                内容优化师
                                                <span className="text-xs text-gray-400">（内容重写建议，推荐 DeepSeek-V3.2 / GLM-4.7）</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={config.contentWriterModelId || ''}
                                                    onChange={(e) => onSetContentWriterModel(e.target.value)}
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

                                        {/* HR审核官 */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <UserCheck className="w-4 h-4 text-orange-500" />
                                                HR审核官
                                                <span className="text-xs text-gray-400">（模拟HR筛选，推荐 GLM-4.7 / DeepSeek-V3.2）</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={config.hrReviewerModelId || ''}
                                                    onChange={(e) => onSetHrReviewerModel(e.target.value)}
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

                                        {/* 质量审核 */}
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-600">
                                                <CheckCircle className="w-4 h-4 text-purple-500" />
                                                质量审核
                                                <span className="text-xs text-gray-400">（质量检查，推荐kimi-k2/MiMo-V2-Flash）</span>
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={config.reflectorModelId || ''}
                                                    onChange={(e) => onSetReflectorModel(e.target.value)}
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

                                    {/* 语音面试 */}
                                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                                        <h4 className="text-sm font-medium text-purple-800 mb-2">🎤 语音面试</h4>
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-600">语音模型 (必须选择 Qwen3-Omni)</label>
                                            <div className="relative">
                                                <select
                                                    value={config.voiceModelId || ''}
                                                    onChange={(e) => onSetVoiceModel(e.target.value)}
                                                    className="w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 pr-10 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-50 focus:outline-none bg-white"
                                                >
                                                    <option value="">选择模型</option>
                                                    {config.models
                                                        .filter(m => m.model === 'qwen3-omni-flash-2025-12-01')
                                                        .map((model) => (
                                                            <option key={model.id} value={model.id}>
                                                                {model.name}
                                                            </option>
                                                        ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                            <p className="text-xs text-purple-600 font-medium mt-1.5 flex items-center gap-1.5">
                                                <AlertCircle className="w-3 h-3" />
                                                语音功能仅支持：qwen3-omni-flash-2025-12-01
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* 空状态提示 */}
                            {config.models.length === 0 && (
                                <div className="text-center py-6 text-gray-400 text-sm">
                                    点击上方 + 按钮添加模型配置
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t bg-gray-50/50">
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
                    setSourceModel(undefined);
                }}
                onSave={handleSaveModel}
                editingModel={editingModel}
                initialValues={sourceModel}
            />
        </>
    );
}