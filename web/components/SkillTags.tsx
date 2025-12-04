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
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-full text-sm font-medium shadow-sm hover:bg-blue-600 transition-colors"
                    >
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
}
