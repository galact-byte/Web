import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

const AUTO_DISMISS_MS: Record<ToastTone, number> = {
  success: 3200,
  info: 3600,
  error: 5200,
};

const toneStyles: Record<ToastTone, { container: string; icon: string; symbol: string }> = {
  success: { container: 'border-green-200 bg-green-50 text-green-800', icon: 'bg-green-500', symbol: '✓' },
  error: { container: 'border-red-200 bg-red-50 text-red-700', icon: 'bg-red-500', symbol: '!' },
  info: { container: 'border-blue-200 bg-blue-50 text-blue-700', icon: 'bg-blue-500', symbol: 'i' },
};

/**
 * 全局轻提示：替代分散的 window.alert，保持非阻塞、可堆叠、自动消失，
 * 副作用（定时器）集中在 Provider 内，组件只调用 showToast。
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback<ShowToast>((message, tone = 'info') => {
    const text = message.trim();
    if (!text) return;
    const id = (idRef.current += 1);
    setToasts((current) => [...current, { id, message: text, tone }]);
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS[tone]);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  const contextValue = useMemo(() => showToast, [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((toast) => {
          const style = toneStyles[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              className={`pointer-events-auto flex items-start gap-3 border ${style.container} p-3 shadow-lg`}
            >
              <span aria-hidden className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${style.icon}`}>{style.symbol}</span>
              <p className="min-w-0 flex-1 whitespace-pre-line break-words text-sm leading-5">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="关闭提示"
                className="-mr-1 -mt-1 shrink-0 px-1 text-lg leading-none text-current opacity-60 transition-opacity hover:opacity-100"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ShowToast {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast 必须在 ToastProvider 内使用');
  }
  return context;
}
