'use client';

interface Props {
    tags: string[];
}

export function SkillTags({ tags }: Props) {
    if (tags.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">技能标签</h3>
            <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                    <span
                        key={index}
                        className="px-3 py-1.5 bg-white text-blue-600 border border-blue-400 rounded-xl text-sm font-medium hover:bg-blue-50 hover:border-blue-500 transition-colors"
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}
