import { useState, useCallback, useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let globalToastFn: ((message: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  if (globalToastFn) globalToastFn(message, type);
}

const typeStyles: Record<ToastType, { container: string; iconClass: string; icon: string }> = {
  success: { container: 'border-green-600 bg-green-950', iconClass: 'text-green-500', icon: '✓' },
  error:   { container: 'border-red-600 bg-red-950', iconClass: 'text-red-500', icon: '✕' },
  info:    { container: 'border-blue-500 bg-slate-900', iconClass: 'text-blue-500', icon: 'ℹ' },
  warning: { container: 'border-amber-500 bg-amber-950/80', iconClass: 'text-amber-500', icon: '⚠' },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    globalToastFn = addToast;
    return () => { globalToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => {
        const s = typeStyles[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex min-w-[200px] max-w-[360px] items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium text-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${s.container}`}
          >
            <span className={`shrink-0 text-base font-bold ${s.iconClass}`}>{s.icon}</span>
            <span>{t.message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
