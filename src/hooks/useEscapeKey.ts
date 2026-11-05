import { useEffect } from 'react';

/**
 * Gọi `onEscape` khi người dùng nhấn Escape. Chỉ lắng nghe khi `active` là true
 * (ví dụ: modal đang mở) nên không để lại listener khi đã đóng.
 */
export function useEscapeKey(onEscape: () => void, active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, active]);
}
