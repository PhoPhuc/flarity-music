import React, { useMemo } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { Play, Music, ArrowLeft, Shuffle, Clock, Disc, Sparkles } from 'lucide-react';
import { TrackList } from './TrackList';
import { convertFileSrc } from '../../utils/tauriBridge';

export const AlbumDetail: React.FC = () => {
  const { selectedAlbum, goBack, playTrack, openBatchLyricsForAlbum } = usePlayer();

  const totalDurationSecs = useMemo(() => {
    if (!selectedAlbum) return 0;
    return selectedAlbum.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  }, [selectedAlbum]);

  const formattedDuration = useMemo(() => {
    if (!totalDurationSecs || totalDurationSecs <= 0) return '0 phút';
    const hours = Math.floor(totalDurationSecs / 3600);
    const minutes = Math.floor((totalDurationSecs % 3600) / 60);
    const seconds = Math.floor(totalDurationSecs % 60);

    if (hours > 0) {
      return `${hours} giờ ${minutes} phút${seconds > 0 ? ` ${seconds} giây` : ''}`;
    }
    if (minutes > 0) {
      return `${minutes} phút${seconds > 0 ? ` ${seconds} giây` : ''}`;
    }
    return `${seconds} giây`;
  }, [totalDurationSecs]);

  if (!selectedAlbum) return null;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      {/* Back Button */}
      <button 
        onClick={goBack}
        className="flex items-center gap-2 text-xs font-bold text-neutral-400 hover:text-white transition-colors group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại</span>
      </button>

      {/* Album Header Banner */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 pb-6 border-b border-white/10">
        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden shadow-2xl bg-neutral-800 shrink-0 border border-white/10 relative group">
          {selectedAlbum.picture ? (
            <img 
              src={convertFileSrc(selectedAlbum.picture)} 
              alt={selectedAlbum.name} 
              className="w-full h-full object-cover" 
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600">
              <Music className="w-16 h-16 text-apple-pink/60" />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3 flex-1 min-w-0">
          <span className="text-xs uppercase font-black tracking-widest text-apple-pink bg-apple-pink/10 border border-apple-pink/20 px-2.5 py-0.5 rounded-full">
            ALBUM
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight truncate w-full">
            {selectedAlbum.name}
          </h1>
          <p className="text-base font-semibold text-neutral-300 truncate w-full">
            {selectedAlbum.artist} {selectedAlbum.year ? `• ${selectedAlbum.year}` : ''}
          </p>

          {/* Album Metadata: Số bài hát & Tổng thời lượng */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs font-semibold text-neutral-400 pt-1">
            <span className="flex items-center gap-1.5 text-neutral-300">
              <Disc className="w-3.5 h-3.5 text-neutral-400" />
              <span>{selectedAlbum.tracks.length} bài hát</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-neutral-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-apple-pink" />
              <span>Thời lượng: <strong className="text-white font-bold">{formattedDuration}</strong></span>
            </span>
          </div>

          <div className="pt-3 flex gap-3 flex-wrap">
            <button
              onClick={() => playTrack(selectedAlbum.tracks[0], selectedAlbum.tracks)}
              className="flex items-center gap-2 bg-apple-pink hover:bg-apple-pinkHover text-white font-bold py-2.5 px-6 rounded-full shadow-lg shadow-apple-pink/20 transition-all active:scale-95 text-sm cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Phát Album</span>
            </button>
            <button
              onClick={() => {
                const shuffled = [...selectedAlbum.tracks].sort(() => Math.random() - 0.5);
                if (shuffled.length) playTrack(shuffled[0], shuffled);
              }}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold py-2.5 px-5 rounded-full transition-all active:scale-95 text-sm cursor-pointer border border-white/10"
            >
              <Shuffle className="w-4 h-4" />
              <span>Ngẫu nhiên</span>
            </button>
            <button
              onClick={() => openBatchLyricsForAlbum(selectedAlbum)}
              className="flex items-center gap-2 bg-gradient-to-r from-apple-pink/20 to-purple-500/20 hover:from-apple-pink/30 hover:to-purple-500/30 text-apple-pink hover:text-white font-bold py-2.5 px-5 rounded-full transition-all active:scale-95 text-sm cursor-pointer border border-apple-pink/30 shadow-md"
              title="Tự động quét và tải lời bài hát (.lrc) cho toàn bộ bài trong Album từ LRCLIB Cloud"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tự Động Tìm Lời Album</span>
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <TrackList tracks={selectedAlbum.tracks} showAlbumCover={false} />
    </div>
  );
};
