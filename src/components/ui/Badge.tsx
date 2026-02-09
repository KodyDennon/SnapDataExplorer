import { cn } from "../../lib/utils";
import { HTMLAttributes, forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: "default" | "success" | "warning" | "error" | "info";
    size?: "sm" | "md";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = "default", size = "md", children, ...props }, ref) => {
        const variants = {
            default: "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200",
            success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
            error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            info: "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
        };

        const sizes = {
            sm: "text-xs px-2 py-0.5",
            md: "text-sm px-2.5 py-1",
        };

        return (
            <span
                ref={ref}
                className={cn(
                    "inline-flex items-center font-medium rounded-full",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            >
                {children}
            </span>
        );
    }
);

Badge.displayName = "Badge";
