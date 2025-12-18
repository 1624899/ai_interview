import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInterviewStore } from "@/store/useInterviewStore";

export function VoiceToggleButton() {
    const setVoiceMode = useInterviewStore((state) => state.setVoiceMode);

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoiceMode(true)}
            className="gap-2 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
        >
            <Headphones className="w-4 h-4" />
            语音模式
        </Button>
    );
}
