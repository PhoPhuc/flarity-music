import React, { useState, useEffect, useMemo } from 'react';
import type { Track } from '../types';
import {
  AUDIO_STANDARDS,
  AudioStandardId,
  analyzeTrackAudio,
  AudioStandard,
} from '../utils/audioTech';
import {
  X,
  Sparkles,
  Disc,
  Headphones,
  Info,
  Zap,
  Waves,
  Radio,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface AudioQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  initialSelectedId?: string;
}

export const AudioQualityModal: React.FC<AudioQualityModalProps> = ({
  isOpen,
  onClose,
  track,
  initialSelectedId,
}) => {
  const analysis = useMemo(() => analyzeTrackAudio(track), [track]);

  const [selectedStandardId, setSelectedStandardId] = useState<AudioStandardId>(
    (initialSelectedId as AudioStandardId) ||
      (analysis.activeStandardIds[0] as AudioStandardId) ||
      'lossless'
  );

  useEffect(() => {
    if (initialSelectedId && AUDIO_STANDARDS[initialSelectedId as AudioStandardId]) {
      setSelectedStandardId(initialSelectedId as AudioStandardId);
    } else if (analysis.activeStandardIds[0]) {
      setSelectedStandardId(analysis.activeStandardIds[0]);
    }
  }, [track, initialSelectedId, analysis]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStandard: AudioStandard =
    AUDIO_STANDARDS[selectedStandardId] || AUDIO_STANDARDS['lossless'];

  const standardList = Object.values(AUDIO_STANDARDS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-opacity duration-300"
      />

      {/* Main Glass Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl bg-neutral-900/95 border border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
      >
        {/* Dynamic Subtle Glow in background */}
        <div
          className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: currentStandard.colorTheme.accentColor }}
        />

        {/* 1. CLEAN HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border shadow-md transition-colors"
              style={{
                backgroundColor: `${currentStandard.colorTheme.accentColor}20`,
                borderColor: `${currentStandard.colorTheme.accentColor}40`,
                color: currentStandard.colorTheme.accentColor,
              }}
            >
              {selectedStandardId === 'dolby-atmos' ? (
                <Sparkles className="w-4 h-4 animate-pulse" />
              ) : selectedStandardId === 'hi-res-lossless' ? (
                <Zap className="w-4 h-4" />
              ) : selectedStandardId === 'lossless' ? (
                <Disc className="w-4 h-4" />
              ) : selectedStandardId === 'hifi' ? (
                <Waves className="w-4 h-4" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
            </div>

            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                Chuẩn Âm Thanh
              </h2>
              {track ? (
                <p className="text-xs text-neutral-400 truncate max-w-sm">
                  Đang phát: <span className="text-white font-semibold">{track.title}</span> • {track.artist}
                </p>
              ) : (
                <p className="text-xs text-neutral-400">
                  Thông tin các định dạng & trải nghiệm âm thanh
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-all active:scale-95 border border-white/10"
            title="Đóng (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. BODY: TWO COLUMNS (LEFT: FORMATS, RIGHT: SIMPLE DESCRIPTION) */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          
          {/* LEFT COLUMN: DANH SÁCH CÁC LOẠI */}
          <div className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto p-3 space-y-1.5 bg-black/30">
            <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400 px-3 py-1.5">
              Các Chuẩn Âm Thanh
            </p>

            {standardList.map((std) => {
              const isSongActive = analysis.activeStandardIds.includes(std.id);
              const isSelected = selectedStandardId === std.id;

              return (
                <button
                  key={std.id}
                  onClick={() => setSelectedStandardId(std.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col gap-1 relative ${
                    isSelected
                      ? `bg-white/10 ${std.colorTheme.borderClass} shadow-md`
                      : 'bg-white/[0.02] border-transparent hover:bg-white/[0.06] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider border shadow-sm ${std.colorTheme.badgeClass}`}
                    >
                      {std.badgeLabel}
                    </span>

                    {/* Huy hiệu nếu bài hát đang phát đạt chuẩn này */}
                    {isSongActive && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Đang phát
                      </span>
                    )}
                  </div>

                  <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                    {std.name}
                  </span>

                  <span className="text-[10px] text-neutral-400 truncate">
                    {std.shortTag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT COLUMN: MIÊU TẢ ĐƠN GIẢN, TRỰC QUAN */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-transparent to-black/20">
            
            {/* Title & Tagline Banner */}
            <div className="space-y-1.5 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-lg border font-black text-[11px] uppercase tracking-wider shadow-sm ${currentStandard.colorTheme.badgeClass}`}>
                  {currentStandard.badgeLabel}
                </span>
                {analysis.activeStandardIds.includes(currentStandard.id) && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Bài hát hiện tại đạt chuẩn này
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                {currentStandard.name}
              </h3>
              <p className="text-xs text-neutral-400 font-medium">
                {currentStandard.specs}
              </p>
            </div>

            {/* 1. Khái niệm đơn giản */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
                <Info className="w-4 h-4 text-apple-pink" />
                <span>Khái niệm</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-neutral-200 leading-relaxed">
                {currentStandard.concept}
              </div>
            </div>

            {/* 2. Trải nghiệm thực tế */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
                <Headphones className="w-4 h-4 text-emerald-400" />
                <span>Trải nghiệm khi nghe</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-neutral-200 leading-relaxed">
                {currentStandard.experience}
              </div>
            </div>

            {/* 3. Thông số kỹ thuật & Thiết bị tóm gọn */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Thông số & Mẹo thiết bị</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                    Mẫu: <strong className="text-white">{currentStandard.sampleRate}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                    Độ sâu: <strong className="text-white">{currentStandard.bitDepth}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-neutral-300">
                    Bitrate: <strong className="text-white">{currentStandard.bitrate}</strong>
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-normal pt-1">
                  <span className="font-semibold text-white/90">Gợi ý:</span> <span className="text-neutral-300">{currentStandard.equipmentTip}</span>
                </p>
              </div>
            </div>

          </div>

        </div>

        {/* 3. CLEAN FOOTER */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/10 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-apple-pink hover:bg-apple-pinkHover text-white font-bold text-xs shadow-lg shadow-apple-pink/20 active:scale-95 transition-all cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>

      </div>
    </div>
  );
};
