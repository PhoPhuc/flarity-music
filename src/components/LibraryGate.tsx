import React from 'react';
import { Compass, FolderPlus, Loader2, Music2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

/** Khung xương hiển thị trong lúc thư viện đang được nạp từ cơ sở dữ liệu. */
const LibrarySkeleton: React.FC = () => (
  <div role="status" aria-label="Đang tải thư viện" className="p-6 space-y-6">
    <div className="h-8 w-56 rounded-xl bg-white/5 animate-pulse" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-[72px] rounded-2xl bg-white/5 animate-pulse" />
      ))}
    </div>
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded-2xl bg-white/[0.03] animate-pulse" />
      ))}
    </div>
    <span className="sr-only">Đang tải thư viện...</span>
  </div>
);

/**
 * Thay cho các màn hình thư viện khi chưa có bài hát nào:
 * - đang nạp: hiện khung xương để không bị nhầm với thư viện trống
 * - thư viện trống: hướng dẫn bắt đầu kèm nút hành động
 */
export const LibraryGate: React.FC = () => {
  const { hasLoadedLibrary, isScanning, selectFolderAndScan, setViewMode } = usePlayer();

  if (!hasLoadedLibrary) return <LibrarySkeleton />;

  return (
    <div className="h-full min-h-[420px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-3xl bg-apple-pink/10 border border-apple-pink/20 flex items-center justify-center">
          <Music2 className="w-10 h-10 text-apple-pink" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Thư viện của bạn đang trống</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Chọn thư mục chứa nhạc để bắt đầu. Hỗ trợ mp3, flac, wav, m4a, aac, ogg. File lời (.lrc) và MV cùng tên sẽ
            được tự động ghép.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void selectFolderAndScan()}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-apple-pink text-white text-sm font-bold hover:brightness-110 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
          >
            {isScanning ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <FolderPlus className="w-4 h-4" aria-hidden="true" />
            )}
            {isScanning ? 'Đang quét thư mục...' : 'Thêm thư mục nhạc'}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('discovery')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/15 cursor-pointer"
          >
            <Compass className="w-4 h-4" aria-hidden="true" />
            Khám phá & tải nhạc
          </button>
        </div>
        {isScanning && (
          <p role="status" className="text-xs text-neutral-500">
            Đang đọc thông tin bài hát, quá trình có thể mất vài phút với thư viện lớn.
          </p>
        )}
      </div>
    </div>
  );
};
