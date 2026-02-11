import { cn } from "../../lib/utils";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "solid" | "outline" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = "solid",
            size = "md",
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            ...props
        },
        ref
    ) => {
        const baseStyles =
            "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 disabled:opacity-50 disabled:cursor-not-allowed";

        const variants = {
            solid:
                "bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-lg shadow-brand-600/25",
            outline:
                "border-2 border-surface-300 dark:border-surface-600 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800",
            ghost:
                "text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800",
        };

        const sizes = {
            sm: "h-8 px-3 text-sm gap-1.5",
            md: "h-10 px-4 text-sm gap-2",
            lg: "h-12 px-6 text-base gap-2.5",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && (
                    <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                )}
                {!isLoading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
            </button>
        );
    }
);

Button.displayName = "Button";
