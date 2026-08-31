import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { searchLrcLibLyrics } from '../utils/lrclibService';
import { formatTime } from '../utils/lrcParser';
import { convertFileSrc } from '../utils/tauriBridge';
import type { Track } from '../types';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Sparkles,
  Layers,
  ThumbsUp,
  ShieldCheck,
  Music,
} from 'lucide-react';

interface BatchLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TrackStatus = 'waiting' | 'searching' | 'saved' | 'not_found' | 'skipped';

interface TrackProgressState {
  status: TrackStatus;
  message?: string;
  matchScore?: number;
}

// Khoảng nghỉ an toàn giữa mỗi bài hát chưa có lời (1800ms) để không bị chạm Rate Limit của LRCLIB
const SAFE_API_DELAY_MS = 1800;

export const BatchLyricsModal: React.FC<BatchLyricsModalProps> = ({ isOpen, onClose }) => {
  const { batchLyricsAlbum, saveAndApplyLyrics, tracks } = usePlayer();

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [statusMap, setStatusMap] = useState<Record<string, TrackProgressState>>({});
  
  const isCancelledRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Lấy danh sách track mới nhất của Album từ context tracks
  const albumTracks: Track[] = React.useMemo(() => {
    if (!batchLyricsAlbum) return [];
    return tracks.filter((t) => t.album === batchLyricsAlbum.name);
  }, [batchLyricsAlbum, tracks]);

  // Khởi tạo trạng thái ban đầu khi mở Modal
  useEffect(() => {
    if (isOpen && albumTracks.length > 0) {
      const initialMap: Record<string, TrackProgressState> = {};
      albumTracks.forEach((t) => {
        if (t.hasLyric) {
          initialMap[t.id] = { status: 'skipped', message: 'Đã có lời (.lrc)' };
        } else {
          initialMap[t.id] = { status: 'waiting', message: 'Đang chờ quét...' };
        }
      });
      setStatusMap(initialMap);
      setCurrentIndex(0);
      setIsProcessing(false);
      setIsPaused(false);
      isCancelledRef.current = false;
      isPausedRef.current = false;
    }
  }, [isOpen, albumTracks.length, batchLyricsAlbum?.name]);

  // Thống kê tiến độ
  const stats = React.useMemo(() => {
    let saved = 0;
    let notFound = 0;
    let skipped = 0;
    let waiting = 0;
    let total = albumTracks.length;

    albumTracks.forEach((t) => {
      const s = statusMap[t.id]?.status;
      if (s === 'saved') saved++;
      else if (s === 'not_found') notFound++;
      else if (s === 'skipped') skipped++;
      else waiting++;
    });

    return { total, saved, notFound, skipped, waiting };
  }, [albumTracks, statusMap]);

  const percentComplete = stats.total > 0 
    ? Math.round(((stats.saved + stats.notFound + stats.skipped) / stats.total) * 100) 
    : 0;

  // Xử lý quét hàng loạt
  const runBatchScan = useCallback(async () => {
    setIsProcessing(true);
    setIsPaused(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    for (let i = 0; i < albumTracks.length; i++) {
      if (isCancelledRef.current) break;

      // Kiểm tra trạng thái tạm dừng
      while (isPausedRef.current) {
        if (isCancelledRef.current) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (isCancelledRef.current) break;

      const track = albumTracks[i];
      setCurrentIndex(i);

      // Nếu bài hát đã có lời từ trước, bỏ qua
      if (track.hasLyric || statusMap[track.id]?.status === 'saved' || statusMap[track.id]?.status === 'skipped') {
        setStatusMap((prev) => ({
          ...prev,
          [track.id]: { status: 'skipped', message: 'Đã có lời (.lrc)' },
        }));
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }

      // Đánh dấu đang tìm kiếm
      setStatusMap((prev) => ({
        ...prev,
        [track.id]: { status: 'searching', message: 'Đang kết nối LRCLIB Cloud...' },
      }));

      try {
        const results = await searchLrcLibLyrics({ track, mode: 'auto' });

        if (isCancelledRef.current) break;

        // Chọn kết quả khớp nhất
        const best =
          results.find((r) => r.isBestMatch) ||
          results.find((r) => r.matchScore >= 70 && r.hasSynced) ||
          results.find((r) => r.hasSynced) ||
          results[0];

        if (best && (best.syncedLyrics || best.plainLyrics)) {
          const lrcToSave = best.syncedLyrics || best.plainLyrics!;
          await saveAndApplyLyrics(track.id, lrcToSave);

          setStatusMap((prev) => ({
            ...prev,
            [track.id]: {
              status: 'saved',
              message: `Đã lưu .lrc (${best.matchScore}%)`,
              matchScore: best.matchScore,
            },
          }));
        } else {
          setStatusMap((prev) => ({
            ...prev,
            [track.id]: { status: 'not_found', message: 'Không tìm thấy lời phù hợp' },
          }));
        }
      } catch (err) {
        console.warn(`[BatchLyrics] Error scanning track ${track.title}:`, err);
        setStatusMap((prev) => ({
          ...prev,
          [track.id]: { status: 'not_found', message: 'Lỗi mạng hoặc hết thời gian chờ' },
        }));
      }

      // Khoảng nghỉ Delay an toàn 1.8s giữa các bài hát chưa có lời để chống Rate Limit LRCLIB
      if (i < albumTracks.length - 1 && !isCancelledRef.current) {
        await new Promise((resolve) => setTimeout(resolve, SAFE_API_DELAY_MS));
      }
    }

    setIsProcessing(false);
    setIsPaused(false);
  }, [albumTracks, saveAndApplyLyrics, statusMap]);

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      isPausedRef.current = false;
    } else {
      setIsPaused(true);
      isPausedRef.current = true;
    }
  };

  const handleStopAndClose = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen || !batchLyricsAlbum) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={handleStopAndClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[85vh] bg-neutral-900/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER & ALBUM INFO */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-neutral-900/60">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-800 shrink-0 border border-white/10 shadow-lg">
              {batchLyricsAlbum.picture ? (
                <img
                  src={convertFileSrc(batchLyricsAlbum.picture)}
                  alt={batchLyricsAlbum.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-apple-pink">
                  <Layers className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-apple-pink bg-apple-pink/15 px-2.5 py-0.5 rounded-md border border-apple-pink/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Quét Lời Hàng Loạt
                </span>
                <span className="text-xs font-semibold text-neutral-400">
                  {albumTracks.length} bài hát
                </span>
              </div>
              <h2 className="text-lg font-black text-white truncate mt-0.5">{batchLyricsAlbum.name}</h2>
              <p className="text-xs font-semibold text-neutral-400 truncate">{batchLyricsAlbum.artist}</p>
            </div>
          </div>

          <button
            onClick={handleStopAndClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. RATE LIMIT SHIELD & PROGRESS BAR */}
        <div className="p-4 border-b border-white/10 bg-neutral-900/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Cơ chế bảo vệ API: Tự động delay 1.8s giữa mỗi bài để chống chạm Rate Limit</span>
            </div>
            <span className="font-mono font-bold text-white tabular-nums">{percentComplete}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-apple-pink to-purple-500 transition-all duration-300 rounded-full"
              style={{ width: `${percentComplete}%` }}
            />
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-xs font-semibold text-neutral-400 flex-wrap">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã tải thành công: <strong>{stats.saved}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-neutral-400">
              <Clock className="w-3.5 h-3.5" />
              Đã có lời từ trước: <strong>{stats.skipped}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              Chưa tìm thấy: <strong>{stats.notFound}</strong>
            </span>
          </div>
        </div>

        {/* 3. TRACKS PROGRESS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[42vh] custom-scrollbar">
          {albumTracks.map((t, idx) => {
            const state = statusMap[t.id] || { status: 'waiting', message: 'Đang chờ...' };
            const isCurrent = isProcessing && currentIndex === idx;

            return (
              <div
                key={t.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-xs ${
                  isCurrent
                    ? 'bg-apple-pink/15 border-apple-pink/40 shadow-lg shadow-apple-pink/10'
                    : state.status === 'saved'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-neutral-200'
                    : state.status === 'skipped'
                    ? 'bg-white/5 border-white/5 opacity-70 text-neutral-400'
                    : state.status === 'not_found'
                    ? 'bg-rose-500/10 border-rose-500/20 text-neutral-300'
                    : 'bg-white/5 border-white/5 text-neutral-400'
                }`}
              >
                {/* Left info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="font-mono text-[11px] text-neutral-500 w-5 text-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white truncate">{t.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">{t.artist}</p>
                  </div>
                </div>

                {/* Right Status Badge */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {formatTime(t.duration || 0)}
                  </span>

                  {state.status === 'searching' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-apple-pink/20 text-apple-pink border border-apple-pink/30 font-bold animate-pulse">
                      <Search className="w-3 h-3 animate-spin" />
                      <span>{state.message}</span>
                    </span>
                  )}

                  {state.status === 'saved' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{state.message}</span>
                    </span>
                  )}

                  {state.status === 'skipped' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-neutral-400 border border-white/10">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{state.message}</span>
                    </span>
                  )}

                  {state.status === 'not_found' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      <AlertCircle className="w-3 h-3" />
                      <span>{state.message}</span>
                    </span>
                  )}

                  {state.status === 'waiting' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-neutral-500 border border-white/5">
                      <Clock className="w-3 h-3" />
                      <span>Chờ</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. FOOTER CONTROLS */}
        <div className="p-4 border-t border-white/10 bg-neutral-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isProcessing && stats.saved + stats.notFound + stats.skipped < stats.total && (
              <button
                onClick={runBatchScan}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-apple-pink hover:bg-apple-pinkHover text-white text-xs font-black transition-all shadow-lg shadow-apple-pink/25 cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Bắt Đầu Quét Tự Động</span>
              </button>
            )}

            {isProcessing && (
              <button
                onClick={handlePauseResume}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Tiếp Tục Quét' : 'Tạm Dừng'}</span>
              </button>
            )}

            {!isProcessing && stats.saved + stats.notFound + stats.skipped === stats.total && (
              <button
                onClick={runBatchScan}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-200 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Quét Lại Từ Đầu</span>
              </button>
            )}
          </div>

          <button
            onClick={handleStopAndClose}
            className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
          >
            {isProcessing ? 'Dừng & Đóng' : 'Xong'}
          </button>
        </div>
      </div>
    </div>
  );
};
