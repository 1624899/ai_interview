import * as React from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    ({ className, checked = false, onCheckedChange, ...props }, ref) => {
        return (
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                ref={ref}
                onClick={() => onCheckedChange?.(!checked)}
                className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    checked ? "bg-teal-600" : "bg-gray-200",
                    className
                )}
                {...props}
            >
                <span
                    className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                        checked ? "translate-x-5" : "translate-x-0"
                    )}
                />
            </button>
        )
    }
)
Switch.displayName = "Switch"

export { Switch }
