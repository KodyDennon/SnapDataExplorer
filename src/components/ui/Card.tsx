import { cn } from "../../lib/utils";
import { HTMLAttributes, forwardRef, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "surface" | "elevated" | "glass";
    padding?: "none" | "sm" | "md" | "lg";
    header?: ReactNode;
    footer?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    (
        {
            className,
            variant = "surface",
            padding = "md",
            header,
            footer,
            children,
            ...props
        },
        ref
    ) => {
        const variants = {
            surface:
                "bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700",
            elevated:
                "bg-white dark:bg-surface-800 shadow-xl shadow-surface-900/10 dark:shadow-black/30",
            glass:
                "bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/20 dark:border-surface-700/50",
        };

        const paddings = {
            none: "",
            sm: "p-3",
            md: "p-5",
            lg: "p-7",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-2xl overflow-hidden transition-all duration-200",
                    variants[variant],
                    className
                )}
                {...props}
            >
                {header && (
                    <div className="px-5 py-4 border-b border-surface-200 dark:border-surface-700 font-semibold">
                        {header}
                    </div>
                )}
                <div className={cn(paddings[padding])}>{children}</div>
                {footer && (
                    <div className="px-5 py-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
                        {footer}
                    </div>
                )}
            </div>
        );
    }
);

Card.displayName = "Card";
