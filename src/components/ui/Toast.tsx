import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface NotifyOptions {
  action?: ToastAction;
  /** Thời gian tự đóng (ms). Mặc định 4000, lỗi hoặc có nút hành động 7000. */
  durationMs?: number;
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

export interface ToastApi {
  success: (message: string, options?: NotifyOptions) => void;
  error: (message: string, options?: NotifyOptions) => void;
  info: (message: string, options?: NotifyOptions) => void;
}

const MAX_VISIBLE = 3;

const noop = () => undefined;
const ToastContext = createContext<ToastApi>({ success: noop, error: noop, info: noop });

/** Hook dùng ở mọi nơi; nếu thiếu Provider thì là no-op nên không làm vỡ giao diện. */
export const useToast = (): ToastApi => useContext(ToastContext);

const STYLES: Record<ToastKind, { icon: React.ReactNode; ring: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />, ring: 'border-emerald-500/30' },
  error: { icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />, ring: 'border-red-500/40' },
  info: { icon: <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />, ring: 'border-white/15' },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, options?: NotifyOptions) => {
      const id = nextId.current++;
      setItems((prev) => {
        // Bỏ thông báo trùng nội dung đang hiển thị để không lặp khi bấm liên tục
        const rest = prev.filter((i) => i.message !== message);
        return [...rest, { id, kind, message, action: options?.action }].slice(-MAX_VISIBLE);
      });
      const duration = options?.durationMs ?? (kind === 'error' || options?.action ? 7000 : 4000);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[140] flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,420px)]"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border ${STYLES[item.kind].ring} shadow-2xl text-sm text-white animate-in fade-in slide-in-from-bottom-2 duration-200`}
          >
            {STYLES[item.kind].icon}
            <span className="flex-1 min-w-0 break-words">{item.message}</span>
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action!.onClick();
                  dismiss(item.id);
                }}
                className="shrink-0 text-xs font-bold text-apple-pink hover:underline cursor-pointer"
              >
                {item.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Đóng thông báo"
              className="shrink-0 p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
