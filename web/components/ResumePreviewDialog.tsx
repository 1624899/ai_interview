import { useState } from "react";
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, Check, X, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ResumePreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    content: string;
}

export function ResumePreviewDialog({
    isOpen,
    onClose,
    title,
    content
}: ResumePreviewDialogProps) {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setIsCopied(true);
            toast.success("简历内容已复制");
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            toast.error("复制失败");
        }
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("已开始下载 Markdown 文件");
    };

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
                            <p className="text-xs text-gray-500">Markdown 预览模式</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-gray-100/50 p-6">
                    <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 min-h-[1000px] p-10 md:p-14 mb-8">
                        <div className="prose prose-slate max-w-none 
                            prose-headings:font-bold prose-headings:text-gray-900 
                            prose-h1:text-center prose-h1:text-4xl prose-h1:mb-6
                            prose-h2:text-xl prose-h2:border-b-2 prose-h2:border-gray-900 prose-h2:pb-2 prose-h2:mt-8 prose-h2:uppercase
                            prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2
                            prose-p:text-gray-700 prose-p:leading-relaxed
                            prose-li:text-gray-700 prose-li:marker:text-gray-500
                            prose-strong:text-gray-900 prose-strong:font-bold
                            [&>blockquote]:text-center [&>blockquote]:text-gray-600 [&>blockquote]:border-none [&>blockquote]:bg-gray-50 [&>blockquote]:py-2 [&>blockquote]:px-4 [&>blockquote]:rounded-md [&>blockquote]:not-italic">
                            <ReactMarkdown
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                rehypePlugins={[rehypeHighlight as any]}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
