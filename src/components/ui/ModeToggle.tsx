import { cn } from "../../lib/utils";

export type ViewMode = "pro" | "chill";

interface ModeToggleProps {
    mode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
    className?: string;
}

export function ModeToggle({ mode, onModeChange, className }: ModeToggleProps) {
    return (
        <div
            className={cn(
                "relative flex items-center bg-surface-100 dark:bg-surface-800 rounded-full p-1 gap-1",
                className
            )}
        >
            {/* Sliding indicator */}
            <div
                className={cn(
                    "absolute h-8 rounded-full bg-brand-600 transition-all duration-300 ease-out shadow-lg",
                    mode === "pro" ? "left-1 w-[72px]" : "left-[76px] w-[64px]"
                )}
            />

            <button
                onClick={() => onModeChange("pro")}
                className={cn(
                    "relative z-10 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
                    mode === "pro"
                        ? "text-white"
                        : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                )}
            >
                <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Pro
                </span>
            </button>

            <button
                onClick={() => onModeChange("chill")}
                className={cn(
                    "relative z-10 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200",
                    mode === "chill"
                        ? "text-white"
                        : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
                )}
            >
                <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Chill
                </span>
            </button>
        </div>
    );
}
