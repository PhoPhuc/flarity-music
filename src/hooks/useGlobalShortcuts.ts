import { useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';

const VOLUME_STEP = 0.05;
const SEEK_STEP_SECONDS = 5;

/** Người dùng đang gõ chữ hoặc đang thao tác trên điều khiển có phím riêng. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type;
    // Thanh trượt tự xử lý phím mũi tên; các ô nhập chữ cần giữ phím cho việc gõ
    return type !== 'checkbox' && type !== 'radio' && type !== 'button';
  }
  return false;
}

/** Có hộp thoại/modal đang mở thì không bắt phím toàn cục. */
function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * Phím tắt toàn cục khớp với danh sách trong Cài đặt:
 * Space phát/tạm dừng, ↑/↓ âm lượng, ←/→ tua 5 giây, L mở/đóng lời bài hát.
 */
export function useGlobalShortcuts(): void {
  const player = usePlayer();
  // Luôn đọc giá trị mới nhất mà không phải gắn lại listener mỗi lần currentTime thay đổi
  const latest = useRef(player);
  latest.current = player;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const p = latest.current;
      if (p.isMvOpen) return; // Màn MV có bộ phím riêng
      if (isEditableTarget(e.target) || isModalOpen()) return;

      const target = e.target as HTMLElement | null;
      const onInteractive = !!target?.closest?.('button, a[href], [role="button"], [role="menuitem"]');

      switch (e.code) {
        case 'Space':
          // Space trên nút/liên kết đang focus phải kích hoạt chính nút đó
          if (onInteractive) return;
          e.preventDefault();
          p.togglePlayPause();
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const delta = e.code === 'ArrowUp' ? VOLUME_STEP : -VOLUME_STEP;
          p.setVolume(Math.min(1, Math.max(0, Math.round((p.volume + delta) * 100) / 100)));
          break;
        }
        case 'ArrowLeft':
        case 'ArrowRight': {
          if (!p.currentTrack) return;
          e.preventDefault();
          const delta = e.code === 'ArrowRight' ? SEEK_STEP_SECONDS : -SEEK_STEP_SECONDS;
          const max = Number.isFinite(p.duration) && p.duration > 0 ? p.duration : Infinity;
          p.seek(Math.min(max, Math.max(0, p.currentTime + delta)));
          break;
        }
        case 'KeyL':
          if (!p.currentTrack) return;
          e.preventDefault();
          p.setLyricsOpen(!p.isLyricsOpen);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
