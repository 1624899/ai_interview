import { useMemo, useState } from 'react';
import { Trash2, MoreHorizontal, FileCheck, FileOutput } from 'lucide-react';
import { GeneratedResumeItem } from '@/lib/api/resume';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GeneratedResumeListProps {
    results: GeneratedResumeItem[];
    onSelect: (id: number) => void;
    onDelete: (id: number) => void;
    currentResultId?: number;
    loading?: boolean;
}

export function GeneratedResumeList({
    results,
    onSelect,
    onDelete,
    currentResultId,
    loading
}: GeneratedResumeListProps) {

    // 分组逻辑
    const groupedResults = useMemo(() => {
        const groups: { [key: string]: GeneratedResumeItem[] } = {
            '今天': [],
            '昨天': [],
            '过去7天': [],
            '更早': []
        };

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const yesterday = today - 86400000;
        const lastWeek = today - 86400000 * 7;

        results.forEach(result => {
            const date = new Date(result.created_at).getTime();
            if (date >= today) {
                groups['今天'].push(result);
            } else if (date >= yesterday) {
                groups['昨天'].push(result);
            } else if (date >= lastWeek) {
                groups['过去7天'].push(result);
            } else {
                groups['更早'].push(result);
            }
        });

        return groups;
    }, [results]);

    if (loading && results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 space-y-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                <div className="text-xs text-gray-400">加载生成的简历...</div>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 px-4 text-center">
                <p className="text-xs text-gray-400">暂无生成的简历</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-4">
                {Object.entries(groupedResults).map(([group, groupResults]) => (
                    groupResults.length > 0 && (
                        <div key={group}>
                            <h4 className="px-3 mb-1 text-[11px] font-medium text-gray-400">
                                {group}
                            </h4>
                            <div className="space-y-0.5">
                                {groupResults.map((result) => (
                                    <GeneratedResumeItemView
                                        key={result.id}
                                        result={result}
                                        isActive={result.id === currentResultId}
                                        onSelect={() => onSelect(result.id)}
                                        onDelete={() => onDelete(result.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </ScrollArea>
    );
}

interface GeneratedResumeItemViewProps {
    result: GeneratedResumeItem;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

function GeneratedResumeItemView({ result, isActive, onSelect, onDelete }: GeneratedResumeItemViewProps) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    const title = result.title || '未命名简历';
    const subtitle = new Date(result.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        onDelete();
        setIsDeleteDialogOpen(false);
    };

    return (
        <div
            onClick={onSelect}
            className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm w-[226px]",
                isActive
                    ? "bg-gray-200/60 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
        >
            <FileOutput className={cn(
                "w-4 h-4 flex-shrink-0 text-purple-600"
            )} />

            <div className="flex-1 min-w-0">
                <div className="truncate leading-none font-medium mb-1" title={title}>
                    {title}
                </div>
                <div className="text-[10px] text-gray-400 truncate">
                    {subtitle}
                </div>
            </div>

            <div className={cn(
                "flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
                isActive && "opacity-100"
            )}>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-gray-200 rounded-md"
                        >
                            <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={handleDeleteClick}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2 text-red-600" />
                            删除简历
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>删除此简历？</AlertDialogTitle>
                        <AlertDialogDescription>
                            此简历将被永久删除，不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDelete();
                            }}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
