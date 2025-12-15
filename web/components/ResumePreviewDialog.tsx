import { useState, useRef, useCallback, useEffect } from "react";

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, Check, X, FileText, Edit3, Eye, ImagePlus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

interface ResumePreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
    onContentChange?: (newContent: string) => void;
}

export function ResumePreviewDialog({
    isOpen,
    onClose,
    title,
    content,
    onContentChange
}: ResumePreviewDialogProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editableContent, setEditableContent] = useState(content);
    const [photo, setPhoto] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 当 content prop 变化时，同步更新 editableContent
    useEffect(() => {
        setEditableContent(content);
        setHasChanges(false);
    }, [content]);

    const handleContentChange = useCallback((value: string) => {
        setEditableContent(value);
        setHasChanges(value !== content);
    }, [content]);

    const handleSave = useCallback(() => {
        if (onContentChange) {
            onContentChange(editableContent);
        }
        setHasChanges(false);
        toast.success("简历内容已保存");
    }, [editableContent, onContentChange]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(editableContent);
            setIsCopied(true);
            toast.success("简历内容已复制");
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            toast.error("复制失败");
        }
    };

    const handleDownload = async () => {
        const element = document.getElementById('resume-preview-content');
        if (!element) {
            toast.error("无法找到简历内容");
            return;
        }

        // 克隆元素
        const clonedElement = element.cloneNode(true) as HTMLElement;

        // 仅移除照片容器中的删除按钮，保留照片本身以维持布局
        // 查找包含图片的容器
        const photoContainer = clonedElement.querySelector('.absolute .relative.group');
        if (photoContainer) {
            const deleteBtn = photoContainer.querySelector('button');
            if (deleteBtn) {
                deleteBtn.remove();
            }
        }

        // 创建打印专用的窗口
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error("无法打开打印窗口，请检查浏览器是否阻止了弹窗");
            return;
        }

        // 获取当前页面的样式
        const styles = Array.from(document.styleSheets)
            .map(styleSheet => {
                try {
                    return Array.from(styleSheet.cssRules)
                        .map(rule => rule.cssText)
                        .join('\n');
                } catch {
                    // 跨域样式表无法访问
                    return '';
                }
            })
            .join('\n');

        // 构建打印页面
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title || '简历'}</title>
                <style>
                    ${styles}

                    /* 基础样式重置 */
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    /* 屏幕显示样式 (打印预览前的样子) */
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Microsoft YaHei', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.5;
                        color: #1a1a1a;
                        background: #f0f2f5;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                        font-size: 12px;
                    }
                    #resume-content-wrapper {
                        background: white;
                        width: 210mm;
                        min-height: 297mm;
                        padding: 15mm 18mm;
                        margin: 0 auto;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        box-sizing: border-box;
                    }

                    /* 简历内容样式 */
                    .resume-content h1 {
                        font-size: 22px !important;
                        margin-bottom: 24px !important;
                        text-align: center;
                        font-weight: 700;
                    }
                    .resume-content h2 {
                        font-size: 14px !important;
                        margin-top: 12px !important;
                        margin-bottom: 6px !important;
                        padding-bottom: 3px !important;
                        border-bottom: 1.5px solid #1a1a1a !important;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .resume-content h3 {
                        font-size: 13px !important;
                        margin-top: 8px !important;
                        margin-bottom: 3px !important;
                        font-weight: 600;
                    }
                    .resume-content p {
                        font-size: 12px !important;
                        line-height: 1.5 !important;
                        margin-bottom: 4px !important;
                        color: #333;
                    }
                    .resume-content blockquote {
                        font-size: 11px !important;
                        text-align: center;
                        margin: 4px 0 25px 0 !important;
                        background: #f8f9fa;
                        border: none !important;
                        border-radius: 4px;
                        color: #555;
                    }
                    .resume-content blockquote p {
                        margin: 0 !important;
                    }
                    .resume-content ul, .resume-content ol {
                        font-size: 12px !important;
                        margin: 4px 0 6px 0 !important;
                        padding-left: 18px !important;
                    }
                    .resume-content li {
                        margin-bottom: 2px !important;
                        line-height: 1.45 !important;
                    }
                    .resume-content strong {
                        font-weight: 600;
                    }
                    
                    /* 照片样式 */
                    .resume-content img {
                        width: 75px !important;
                        height: 90px !important;
                        object-fit: cover;
                        border-radius: 2px;
                    }
                    .resume-content .absolute {
                        position: absolute;
                        top: 15mm !important;
                        right: 18mm !important;
                    }

                    /* 打印样式 */
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            background: white !important;
                            display: block;
                            font-size: 13px;
                        }
                        #resume-content-wrapper {
                            margin: 0 !important;
                            padding: 10mm 12mm !important;
                            box-shadow: none !important;
                            border: none !important;
                            width: 100% !important;
                            min-height: auto !important;
                        }
                        .resume-content h1 {
                            font-size: 24px !important;
                            margin-bottom: 12px !important;
                            padding-right: 100px !important;
                        }
                        .resume-content h2 {
                            font-size: 15px !important;
                            margin-top: 12px !important;
                            margin-bottom: 6px !important;
                        }
                        .resume-content h3 {
                            font-size: 14px !important;
                            margin-top: 8px !important;
                        }
                        .resume-content p, .resume-content li {
                            font-size: 13px !important;
                            line-height: 1.5 !important;
                        }
                        .resume-content blockquote {
                            font-size: 12px !important;
                            margin: 4px 0 14px 0 !important;
                            padding-right: 100px !important;
                        }
                        .resume-content ul, .resume-content ol {
                            margin: 4px 0 6px 0 !important;
                            padding-left: 18px !important;
                        }
                        .resume-content li {
                            margin-bottom: 2px !important;
                        }
                        .resume-content img {
                            width: 75px !important;
                            height: 90px !important;
                        }
                        .resume-content .absolute {
                            top: 10mm !important;
                            right: 12mm !important;
                        }
                        @page {
                            size: A4;
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div id="resume-content-wrapper" class="resume-content relative">
                    ${clonedElement.innerHTML}
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();

        // 等待内容加载完成后打印
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        };

        toast.success("打印对话框已打开，请选择「另存为 PDF」来保存", { duration: 5000 });
    };

    const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error("请上传图片文件");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error("图片大小不能超过 5MB");
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                setPhoto(event.target?.result as string);
                toast.success("照片已添加");
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleRemovePhoto = useCallback(() => {
        setPhoto(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        toast.success("照片已移除");
    }, []);

    const toggleEditMode = useCallback(() => {
        if (isEditMode && hasChanges) {
            // 从编辑模式切换到预览模式时，提示用户保存
            const confirmSwitch = window.confirm("您有未保存的更改，是否放弃更改？");
            if (!confirmSwitch) return;
            setEditableContent(content);
            setHasChanges(false);
        }
        setIsEditMode(!isEditMode);
    }, [isEditMode, hasChanges, content]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 bg-gray-50/95 backdrop-blur overflow-hidden">
                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>
                            <p className="text-xs text-gray-500">
                                {isEditMode ? "编辑模式" : "Markdown 预览模式"}
                                {hasChanges && <span className="ml-2 text-amber-500">• 有未保存的更改</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* 模式切换按钮 */}
                        <Button
                            variant={isEditMode ? "default" : "outline"}
                            size="sm"
                            onClick={toggleEditMode}
                            className={cn("gap-2", isEditMode && "bg-teal-600 hover:bg-teal-700")}
                        >
                            {isEditMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                            {isEditMode ? "预览" : "编辑"}
                        </Button>

                        {/* 保存按钮 - 仅在编辑模式且有更改时显示 */}
                        {isEditMode && hasChanges && onContentChange && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSave}
                                className="gap-2 bg-green-600 hover:bg-green-700"
                            >
                                <Save className="w-4 h-4" />
                                保存
                            </Button>
                        )}

                        {/* 照片上传按钮 */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handlePhotoUpload}
                            accept="image/*"
                            className="hidden"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="gap-2"
                        >
                            <ImagePlus className="w-4 h-4" />
                            {photo ? "更换照片" : "添加照片"}
                        </Button>

                        {photo && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRemovePhoto}
                                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}

                        <div className="w-px h-6 bg-gray-300 mx-1" />

                        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {isCopied ? "已复制" : "复制"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
                            <Download className="w-4 h-4" />
                            下载
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
                            <X className="w-5 h-5 text-gray-500" />
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-100/50 p-6">
                    <div id="resume-preview-content" className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 min-h-[1000px] p-10 md:p-14 mb-8 relative">
                        {/* 照片显示区域 */}
                        {photo && (
                            <div className="absolute top-10 right-10 md:top-14 md:right-14 z-10">
                                <div className="relative group">
                                    <img
                                        src={photo}
                                        alt="简历照片"
                                        className="w-20 h-24 object-cover rounded-sm"
                                    />
                                    <button
                                        onClick={handleRemovePhoto}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {isEditMode ? (
                            /* 编辑模式 */
                            <div className="min-h-[900px]">
                                <Textarea
                                    value={editableContent}
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    className="w-full min-h-[900px] font-mono text-sm border-gray-300 focus:border-teal-500 focus:ring-teal-500 resize-none"
                                    placeholder="在此编辑您的简历内容（支持 Markdown 格式）..."
                                />
                                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Markdown 格式提示</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                        <div><code className="bg-gray-200 px-1 rounded"># 标题</code> - 一级标题</div>
                                        <div><code className="bg-gray-200 px-1 rounded">## 标题</code> - 二级标题</div>
                                        <div><code className="bg-gray-200 px-1 rounded">**粗体**</code> - 粗体文本</div>
                                        <div><code className="bg-gray-200 px-1 rounded">*斜体*</code> - 斜体文本</div>
                                        <div><code className="bg-gray-200 px-1 rounded">- 项目</code> - 无序列表</div>
                                        <div><code className="bg-gray-200 px-1 rounded">1. 项目</code> - 有序列表</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* 预览模式 */
                            <div className={cn(
                                "prose prose-slate max-w-none",
                                "prose-headings:font-bold prose-headings:text-gray-900",
                                "prose-h1:text-center prose-h1:text-4xl prose-h1:mb-6",
                                "prose-h2:text-xl prose-h2:border-b-2 prose-h2:border-gray-900 prose-h2:pb-2 prose-h2:mt-8 prose-h2:uppercase",
                                "prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2",
                                "prose-p:text-gray-700 prose-p:leading-relaxed",
                                "prose-li:text-gray-700 prose-li:marker:text-gray-500",
                                "prose-strong:text-gray-900 prose-strong:font-bold",
                                "[&>blockquote]:text-center [&>blockquote]:text-gray-600 [&>blockquote]:border-none [&>blockquote]:bg-gray-50 [&>blockquote]:py-2 [&>blockquote]:px-4 [&>blockquote]:rounded-md [&>blockquote]:not-italic",
                            )}>
                                <ReactMarkdown
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    rehypePlugins={[rehypeHighlight as any]}
                                >
                                    {editableContent}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
