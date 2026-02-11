import { Toast as ToastType } from "../hooks/useToast";

interface ToastContainerProps {
  toasts: ToastType[];
  onDismiss: (id: string) => void;
}

const STYLES: Record<ToastType["type"], { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "bg-green-50 dark:bg-green-950", border: "border-green-200 dark:border-green-800", text: "text-green-800 dark:text-green-200", icon: "\u2713" },
  error: { bg: "bg-red-50 dark:bg-red-950", border: "border-red-200 dark:border-red-800", text: "text-red-800 dark:text-red-200", icon: "\u2717" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950", border: "border-amber-200 dark:border-amber-800", text: "text-amber-800 dark:text-amber-200", icon: "!" },
  info: { bg: "bg-blue-50 dark:bg-blue-950", border: "border-blue-200 dark:border-blue-800", text: "text-blue-800 dark:text-blue-200", icon: "i" },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 max-w-sm" role="alert" aria-live="polite">
      {toasts.map((toast) => {
        const s = STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`${s.bg} ${s.border} border rounded-xl px-4 py-3 shadow-lg flex items-start gap-3 animate-slide-in`}
          >
            <span className={`${s.text} font-black text-sm w-5 h-5 flex items-center justify-center rounded-full border ${s.border} shrink-0 mt-0.5`}>
              {s.icon}
            </span>
            <p className={`${s.text} text-sm font-medium flex-1`}>{toast.message}</p>
            <button
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className={`${s.text} opacity-50 hover:opacity-100 text-lg leading-none shrink-0`}
            >
              {"\u00D7"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
