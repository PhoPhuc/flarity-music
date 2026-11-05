import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Hành động phá hủy: nút đỏ và mặc định focus vào "Hủy". */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

type Pending = { id: number } & (
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void }
);
type PendingInput =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (v: string | null) => void };

// Mặc định (không có Provider) quay về hộp thoại của trình duyệt để không mất chức năng.
const fallbackApi: DialogApi = {
  confirm: async (o) => window.confirm(`${o.title}${typeof o.message === 'string' ? `\n\n${o.message}` : ''}`),
  prompt: async (o) => window.prompt(o.title, o.defaultValue ?? ''),
};
const DialogContext = createContext<DialogApi>(fallbackApi);

export const useDialog = (): DialogApi => useContext(DialogContext);

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const DialogView: React.FC<{ pending: Pending; onClose: () => void }> = ({ pending, onClose }) => {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState(pending.kind === 'prompt' ? pending.options.defaultValue ?? '' : '');

  const isDanger = pending.kind === 'confirm' && pending.options.danger;
  const confirmLabel = pending.options.confirmLabel ?? (pending.kind === 'prompt' ? 'Xác nhận' : 'Đồng ý');
  const cancelLabel = pending.options.cancelLabel ?? 'Hủy';
  const message = pending.options.message;

  const cancel = useCallback(() => {
    if (pending.kind === 'confirm') pending.resolve(false);
    else pending.resolve(null);
    onClose();
  }, [pending, onClose]);

  // Focus: ô nhập > nút Hủy (nếu nguy hiểm) > nút xác nhận. Trả focus về chỗ cũ khi đóng.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (pending.kind === 'prompt') {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (isDanger) cancelRef.current?.focus();
    else confirmRef.current?.focus();
    return () => previous?.focus?.();
  }, [pending, isDanger]);

  // Escape (bắt ở capture để không đóng cùng lúc các modal bên dưới) và giữ Tab trong hộp thoại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
      } else if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cancel]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.kind === 'confirm') {
      pending.resolve(true);
    } else {
      const trimmed = value.trim();
      if (!trimmed) {
        inputRef.current?.focus();
        return;
      }
      pending.resolve(trimmed);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl bg-neutral-900 border border-white/10 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
      >
        <h2 id={titleId} className="text-lg font-bold text-white">
          {pending.options.title}
        </h2>
        {message && (
          <div id={descId} className="text-sm text-neutral-300 leading-relaxed">
            {message}
          </div>
        )}
        {pending.kind === 'prompt' && (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={pending.options.placeholder}
            aria-label={pending.options.title}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-apple-pink"
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-200 bg-white/10 hover:bg-white/15 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer ${
              isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-apple-pink hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<Pending[]>([]);
  const nextId = useRef(1);

  const enqueue = useCallback(<T,>(build: (resolve: (v: T) => void) => PendingInput): Promise<T> => {
    return new Promise<T>((resolve) => {
      const id = nextId.current++;
      setQueue((prev) => [...prev, { id, ...build(resolve) } as Pending]);
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) => enqueue<boolean>((resolve) => ({ kind: 'confirm', options, resolve })),
      prompt: (options) => enqueue<string | null>((resolve) => ({ kind: 'prompt', options, resolve })),
    }),
    [enqueue]
  );

  const current = queue[0];
  const close = useCallback(() => setQueue((prev) => prev.slice(1)), []);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current && <DialogView key={current.id} pending={current} onClose={close} />}
    </DialogContext.Provider>
  );
};
