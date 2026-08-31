import React from 'react';
import {
  Sparkles,
  Play,
  Pause,
  Activity,
  Radio,
  Disc,
  Music,
} from 'lucide-react';
import type { Track } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useSmartMusicRecommendations } from '../hooks/useSmartMusicRecommendations';
import { convertFileSrc } from '../utils/tauriBridge';
import { SoundWave } from './SoundWave';

export const SmartVibeHub: React.FC = () => {
  const { tracks, currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const {
    analysisMap,
    isScanning,
    scanProgress,
    analyzedCount,
    totalTracksCount,
    similarTracks,
    startLibraryAnalysis,
  } = useSmartMusicRecommendations(tracks, currentTrack);

  const currentAnalysis = currentTrack ? analysisMap[currentTrack.id] : null;

  return (
    <div className="space-y-8 my-6">
      {/* 1. Header & AI Analysis Status Bar */}
      <div className="bg-[#141416]/90 border border-white/10 rounded-3xl p-6 backdrop-blur-apple shadow-2xl relative overflow-hidden">
        {/* Apple-style background glow accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-apple-pink/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-apple-pink/20 text-apple-pink border border-apple-pink/30 flex items-center gap-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                AI ACOUSTIC INTELLIGENCE
              </span>
              <span className="text-xs font-semibold text-neutral-400">DSP 7D Vectorization</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              Phân Loại & Gợi Ý Vibe Thông Minh
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl font-medium leading-relaxed">
              Trích xuất nhịp điệu (BPM), năng lượng (RMS), độ sáng âm phổ để phân nhóm nhạc theo cảm xúc và đề xuất các bài hát tương đồng.
            </p>
          </div>

          {/* Action Button & Progress */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <div className="text-xs text-neutral-400 font-medium">
              Đã phân tích: <span className="text-white font-bold">{analyzedCount}</span> / {totalTracksCount} bài
            </div>

            {analyzedCount < totalTracksCount && (
              <button
                onClick={startLibraryAnalysis}
                disabled={isScanning}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-apple-pink hover:bg-apple-pinkHover text-white shadow-xl shadow-apple-pink/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Activity className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning
                  ? `Đang quét (${scanProgress.current}/${scanProgress.total})...`
                  : 'Quét toàn bộ thư viện'}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar if scanning */}
        {isScanning && (
          <div className="mt-5 space-y-1 relative z-10">
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-apple-pink to-purple-500 transition-all duration-300 rounded-full"
                style={{
                  width: `${scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Currently Playing Track Acoustic Radar */}
      {currentTrack && currentAnalysis && (
        <div className="bg-[#141416]/80 border border-white/10 rounded-2xl p-5 backdrop-blur-apple shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-neutral-800 overflow-hidden flex-shrink-0 border border-white/10 relative shadow-md">
                {currentTrack.picture ? (
                  <img
                    src={convertFileSrc(currentTrack.picture)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    <Disc className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-apple-pink font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  Chỉ số âm học bài đang phát
                </div>
                <div className="text-base font-bold text-white truncate">{currentTrack.title}</div>
                <div className="text-xs text-neutral-400 font-medium truncate">{currentTrack.artist}</div>
              </div>
            </div>

            {/* Badges Matrix */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Tempo:</span>{' '}
                <span className="text-amber-400 font-bold">{currentAnalysis.bpm} BPM</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Năng lượng:</span>{' '}
                <span className="text-emerald-400 font-bold">
                  {Math.round(currentAnalysis.vector.energy * 100)}%
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Độ mộc:</span>{' '}
                <span className="text-teal-300 font-bold">
                  {Math.round(currentAnalysis.vector.acousticness * 100)}%
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Độ nảy:</span>{' '}
                <span className="text-blue-400 font-bold">
                  {Math.round(currentAnalysis.vector.danceability * 100)}%
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Vibe:</span>{' '}
                <span className="text-purple-300 font-bold">{currentAnalysis.primaryMood}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold shadow-sm">
                <span className="text-neutral-400 font-normal">Thể loại:</span>{' '}
                <span className="text-pink-400 font-bold">{currentAnalysis.primaryGenre}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Similar Tracks */}
      {currentTrack && similarTracks.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-400">Độ tương đồng giai điệu và cảm xúc &gt; 70%</p>
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Gợi Ý Cùng Vibe Với "{currentTrack.title}"
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {similarTracks.slice(0, 6).map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const isThisPlaying = isCurrent && isPlaying;

              const handlePlay = (e?: React.MouseEvent) => {
                if (e) e.stopPropagation();
                if (isCurrent) {
                  togglePlayPause();
                } else {
                  playTrack(track, similarTracks);
                }
              };

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlay()}
                  className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                    isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                  }`}
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                    {track.picture ? (
                      <img
                        src={convertFileSrc(track.picture)}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500">
                        <Music className="w-8 h-8" />
                      </div>
                    )}

                    {isThisPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                        <SoundWave className="scale-125" />
                      </div>
                    )}

                    <button
                      onClick={handlePlay}
                      className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                        isThisPlaying
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                      }`}
                      title={isThisPlaying ? "Tạm dừng" : "Phát bài hát"}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h4 className={`text-sm font-bold transition-colors truncate ${
                      isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                    }`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium truncate">{track.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
