import React, { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  House,
  Disc,
  Music2,
  User,
  BarChart3,
  Compass,
  ListMusic,
} from 'lucide-react';

export const NavigationHeader: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    selectedAlbum,
    selectedArtist,
    selectedPlaylist,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    refreshLibrary,
    isReloading,
  } = usePlayer();

  // Lắng nghe phím tắt toàn cục & nút bấm chuột Back/Forward
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // 1. Phím Tải Lại: F5 hoặc Ctrl+R / Cmd+R
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        refreshLibrary();
        return;
      }

      // 2. Phím Quay Lại: Alt + Mũi tên Trái HOẶC Backspace (ngoài ô nhập liệu)
      if ((e.altKey && e.key === 'ArrowLeft') || (!isInput && e.key === 'Backspace')) {
        if (canGoBack) {
          e.preventDefault();
          goBack();
        }
        return;
      }

      // 3. Phím Tiến Tới: Alt + Mũi tên Phải
      if (e.altKey && e.key === 'ArrowRight') {
        if (canGoForward) {
          e.preventDefault();
          goForward();
        }
        return;
      }
    };

    // Nút phụ trên chuột (Nút số 3 = Back, Nút số 4 = Forward)
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        // Mouse Back
        if (canGoBack) {
          e.preventDefault();
          goBack();
        }
      } else if (e.button === 4) {
        // Mouse Forward
        if (canGoForward) {
          e.preventDefault();
          goForward();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [canGoBack, canGoForward, goBack, goForward, refreshLibrary]);

  return (
    <header className="sticky top-0 z-30 h-13 px-4 sm:px-6 bg-[#0c0c0e]/80 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between select-none shrink-0">
      {/* Cụm nút điều hướng: Quay Lại, Tiến Tới, Tải Lại */}
      <div className="flex items-center gap-1.5">
        {/* Nút Quay Lại (Back) */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          title="Quay lại trang trước (Alt + ← hoặc Backspace)"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${
            canGoBack
              ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 active:scale-90 cursor-pointer shadow-sm'
              : 'bg-white/[0.03] text-neutral-600 border-transparent cursor-not-allowed opacity-40'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Nút Tiến Tới (Forward) */}
        <button
          onClick={goForward}
          disabled={!canGoForward}
          title="Tiến tới trang sau (Alt + →)"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${
            canGoForward
              ? 'bg-white/10 hover:bg-white/20 text-white border-white/10 active:scale-90 cursor-pointer shadow-sm'
              : 'bg-white/[0.03] text-neutral-600 border-transparent cursor-not-allowed opacity-40'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Nút Tải Lại Thư Viện (Reload / Refresh) */}
        <button
          onClick={() => refreshLibrary()}
          disabled={isReloading}
          title="Tải lại & làm mới thư viện nhạc (F5 / Ctrl + R)"
          className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-neutral-300 hover:text-white border border-white/10 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-sm ml-1"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${
              isReloading ? 'animate-spin text-apple-pink' : 'text-neutral-300'
            }`}
          />
        </button>
      </div>

      {/* Breadcrumb / Vị trí hiển thị hiện tại */}
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 overflow-hidden max-w-[65%] sm:max-w-md">
        {viewMode === 'home' && (
          <div className="flex items-center gap-1.5 text-white">
            <House className="w-3.5 h-3.5 text-apple-pink" />
            <span className="truncate">Trang Chủ</span>
          </div>
        )}

        {viewMode === 'discovery' && (
          <div className="flex items-center gap-1.5 text-white">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">Khám Phá Âm Nhạc</span>
          </div>
        )}

        {viewMode === 'library-albums' && (
          <div className="flex items-center gap-1.5 text-white">
            <Disc className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate">Thư Viện Albums</span>
          </div>
        )}

        {viewMode === 'library-tracks' && (
          <div className="flex items-center gap-1.5 text-white">
            <Music2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate">Tất Cả Bài Hát</span>
          </div>
        )}

        {viewMode === 'library-artists' && (
          <div className="flex items-center gap-1.5 text-white">
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate">Danh Sách Nghệ Sĩ</span>
          </div>
        )}

        {viewMode === 'analytics' && (
          <div className="flex items-center gap-1.5 text-white">
            <BarChart3 className="w-3.5 h-3.5 text-apple-pink" />
            <span className="truncate">Bảng Xếp Hạng & Thống Kê</span>
          </div>
        )}

        {viewMode === 'album-detail' && selectedAlbum && (
          <div className="flex items-center gap-1.5 truncate">
            <button
              onClick={() => setViewMode('library-albums')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Disc className="w-3 h-3 text-purple-400" />
              <span>Albums</span>
            </button>
            <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            <span className="text-white truncate font-bold">{selectedAlbum.name}</span>
          </div>
        )}

        {viewMode === 'artist-detail' && selectedArtist && (
          <div className="flex items-center gap-1.5 truncate">
            <button
              onClick={() => setViewMode('library-artists')}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <User className="w-3 h-3 text-amber-400" />
              <span>Nghệ Sĩ</span>
            </button>
            <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            <span className="text-white truncate font-bold">{selectedArtist}</span>
          </div>
        )}

        {viewMode === 'playlist-detail' && selectedPlaylist && (
          <div className="flex items-center gap-1.5 truncate">
            <div className="flex items-center gap-1 shrink-0">
              <ListMusic className="w-3 h-3 text-apple-pink" />
              <span>Playlist</span>
            </div>
            <ChevronRight className="w-3 h-3 text-neutral-600 shrink-0" />
            <span className="text-white truncate font-bold">{selectedPlaylist.name}</span>
          </div>
        )}
      </div>

      {/* Hiệu ứng trạng thái khi đang tải lại */}
      <div className="flex items-center">
        {isReloading && (
          <span className="text-[11px] font-semibold text-apple-pink flex items-center gap-1.5 animate-pulse bg-apple-pink/10 px-2.5 py-0.5 rounded-full border border-apple-pink/20">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-pink animate-ping" />
            <span>Đang tải lại...</span>
          </span>
        )}
      </div>
    </header>
  );
};
