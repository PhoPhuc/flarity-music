import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1,
  Volume2, 
  VolumeX, 
  Mic2, 
  ListMusic, 
  Music,
  Tv,
  Sparkles,
  Disc
} from 'lucide-react';
import { formatTime } from '../utils/lrcParser';
import type { Track } from '../types';
import { analyzeTrackAudio } from '../utils/audioTech';
import { convertFileSrc } from '../utils/tauriBridge';

export const PlayerBar: React.FC<{ 
  onToggleQueue: () => void; 
  isQueueOpen: boolean;
  onOpenMv: () => void;
}> = ({ 
  onToggleQueue, 
  isQueueOpen,
  onOpenMv
}) => {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    nextTrack, 
    prevTrack, 
    currentTime, 
    duration, 
    seek, 
    volume, 
    setVolume, 
    isMuted, 
    toggleMute, 
    shuffle, 
    toggleShuffle, 
    repeat, 
    toggleRepeat,
    isLyricsOpen,
    setLyricsOpen,
    openAudioQualityModal
  } = usePlayer();

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const audioAnalysis = React.useMemo(() => analyzeTrackAudio(currentTrack), [currentTrack]);

  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);

  return (
    <>
      {/* 1. MOBILE FLOATING MINI PLAYER (Visible only on screens < md) */}
      {currentTrack && !isMobileExpanded && (
        <div
          onClick={() => setIsMobileExpanded(true)}
          className="md:hidden fixed bottom-16 left-3 right-3 z-30 bg-zinc-900/95 border border-white/10 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform select-none"
        >
          {/* Bottom Progress Line */}
          <div
            className="absolute bottom-0 left-3 right-3 h-[2px] bg-apple-pink rounded-full transition-all"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />

          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-neutral-800 overflow-hidden shrink-0 shadow border border-white/10">
              {currentTrack.picture ? (
                <img 
                  src={convertFileSrc(currentTrack.picture)} 
                  alt={currentTrack.title} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 bg-neutral-800">
                  <Music className="w-5 h-5 text-apple-pink" />
                </div>
              )}
            </div>
            <div className="flex flex-col truncate min-w-0">
              <span className="text-sm font-semibold text-white truncate">{currentTrack.title}</span>
              <span className="text-xs text-neutral-400 truncate">{currentTrack.artist}</span>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 bg-apple-pink rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button onClick={nextTrack} className="p-2 text-neutral-300 hover:text-white active:scale-95">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* 2. MOBILE FULLSCREEN PLAYER OVERLAY (Visible when expanded on < md) */}
      {currentTrack && isMobileExpanded && (
        <div className="md:hidden fixed inset-0 z-50 bg-zinc-950 flex flex-col justify-between p-6 select-none animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setIsMobileExpanded(false)} className="p-2 text-neutral-400 hover:text-white">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 bg-white/10 px-3 py-1.5 rounded-full">Thu nhỏ</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-widest text-apple-pink">Đang phát</span>
            <button
              onClick={() => setLyricsOpen(!isLyricsOpen)}
              className={`p-2 transition-colors rounded-full ${isLyricsOpen ? "text-apple-pink bg-apple-pink/20" : "text-neutral-400"}`}
            >
              <Mic2 className="w-6 h-6" />
            </button>
          </div>

          {/* Main Display: Album Cover */}
          <div className="flex-1 flex items-center justify-center my-6">
            <div className="w-72 h-72 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
              {currentTrack.picture ? (
                <img 
                  src={convertFileSrc(currentTrack.picture)} 
                  alt={currentTrack.title} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                  <Music className="w-20 h-20 text-apple-pink" />
                </div>
              )}
            </div>
          </div>

          {/* Controls & Progress */}
          <div className="space-y-6 pb-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-black text-white truncate">{currentTrack.title}</h2>
              <p className="text-base text-neutral-400 truncate">{currentTrack.artist}</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {audioAnalysis.badges.map((b) => (
                  <button
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      openAudioQualityModal(currentTrack, b.id);
                    }}
                    className={`px-2.5 py-1 rounded-lg border font-black text-[11px] uppercase tracking-wider shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all ${b.style}`}
                    title="Nhấn để xem chi tiết chuẩn âm thanh"
                  >
                    {b.isDolby ? <Sparkles className="w-3.5 h-3.5 animate-pulse" /> : <Disc className="w-3.5 h-3.5" />}
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seekbar */}
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeekChange}
                className="w-full h-2 bg-neutral-800 accent-apple-pink rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-neutral-400 font-medium">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Buttons */}
            <div className="flex items-center justify-around">
              <button onClick={toggleShuffle} className={`p-2 ${shuffle ? 'text-apple-pink' : 'text-neutral-400'}`}>
                <Shuffle className="w-6 h-6" />
              </button>
              <button onClick={prevTrack} className="p-3 text-white active:scale-90 transition-transform">
                <SkipBack className="w-8 h-8 fill-current" />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 bg-apple-pink rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition-transform"
              >
                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
              </button>
              <button onClick={nextTrack} className="p-3 text-white active:scale-90 transition-transform">
                <SkipForward className="w-8 h-8 fill-current" />
              </button>
              <button onClick={toggleRepeat} className={`p-2 ${repeat !== 'off' ? 'text-apple-pink' : 'text-neutral-400'}`}>
                {repeat === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DESKTOP PLAYER BAR (Visible on screens >= md) */}
      <footer className="hidden md:flex h-20 bg-[#0c0c0e]/98 backdrop-blur-2xl border-t border-white/10 px-4 sm:px-6 items-center justify-between select-none z-30 fixed bottom-0 left-0 right-0 gap-2 sm:gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-1/4 min-w-[150px] max-w-[260px] shrink-0">
          {currentTrack ? (
            <>
              <div className="w-12 h-12 rounded-lg bg-neutral-800 overflow-hidden shrink-0 shadow-md relative group">
                {currentTrack.picture ? (
                  <img 
                    src={convertFileSrc(currentTrack.picture)} 
                    alt={currentTrack.title} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-800/80 p-2">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" loading="lazy" />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-white truncate hover:underline cursor-pointer">
                  {currentTrack.title}
                </span>
                <span className="text-xs text-neutral-400 truncate hover:underline cursor-pointer">
                  {currentTrack.artist}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 opacity-60">
              <div className="w-12 h-12 rounded-lg bg-neutral-800/80 p-2.5 border border-white/5 flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs text-neutral-400 font-medium">Chưa chọn bài hát</span>
            </div>
          )}
        </div>

        {/* Main Playback Controls & Seekbar */}
        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-xl min-w-[200px] px-2">
          <div className="flex items-center gap-4 sm:gap-5">
            <button 
              onClick={toggleShuffle}
              className={`transition-colors ${shuffle ? 'text-apple-pink' : 'text-neutral-400 hover:text-white'}`}
              title="Phát ngẫu nhiên"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button 
              onClick={prevTrack} 
              className="text-neutral-200 hover:text-white transition-all active:scale-95"
              title="Bài trước đó"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button 
              onClick={togglePlayPause} 
              className="w-9 h-9 rounded-full bg-white hover:scale-105 text-black flex items-center justify-center transition-all shadow-md active:scale-95"
              title={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button 
              onClick={nextTrack} 
              className="text-neutral-200 hover:text-white transition-all active:scale-95"
              title="Bài kế tiếp"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button 
              onClick={toggleRepeat}
              className={`transition-colors ${repeat !== 'off' ? 'text-apple-pink' : 'text-neutral-400 hover:text-white'}`}
              title={repeat === 'one' ? 'Lặp lại 1 bài' : repeat === 'all' ? 'Lặp lại tất cả' : 'Không lặp lại'}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full">
            <span className="text-[11px] font-medium text-neutral-400 tabular-nums w-8 sm:w-9 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
              <div className="w-full h-1.5 bg-white/10 group-hover:h-2 rounded-full overflow-hidden transition-all duration-150 relative">
                <div 
                  className="h-full bg-apple-pink rounded-full transition-all duration-75"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <input 
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeekChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
            <span className="text-[11px] font-medium text-neutral-400 tabular-nums w-8 sm:w-9 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-2.5 w-1/4 min-w-[180px] max-w-[300px] shrink-0">
          {currentTrack && (
            <div className="flex items-center gap-1.5 shrink-0">
              {audioAnalysis.badges.map((b) => (
                <button
                  key={b.id}
                  onClick={() => openAudioQualityModal(currentTrack, b.id)}
                  className={`px-2 py-0.5 rounded-lg border font-black text-[10px] uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer transition-all duration-200 hover:scale-105 hover:brightness-125 active:scale-95 animate-in fade-in ${b.style}`}
                  title={`Nhấn để xem chi tiết chuẩn âm thanh ${b.label}`}
                >
                  {b.isDolby ? (
                    <Sparkles className="w-3 h-3 text-purple-300 animate-pulse" />
                  ) : (
                    <Disc className="w-3 h-3" />
                  )}
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          )}

          {currentTrack?.hasMv && (
            <button
              onClick={onOpenMv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-apple-pink/20 text-apple-pink hover:bg-apple-pink hover:text-white font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
              title="Xem Music Video (MV)"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>MV</span>
            </button>
          )}

          <button
            onClick={() => setLyricsOpen(!isLyricsOpen)}
            className={`p-2 rounded-xl transition-all ${
              isLyricsOpen 
                ? 'bg-apple-pink/20 text-apple-pink' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Lời bài hát"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleQueue}
            className={`p-2 rounded-xl transition-all ${
              isQueueOpen 
                ? 'bg-apple-pink/20 text-apple-pink' 
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Danh sách chờ"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 group min-w-[110px]">
            <button onClick={toggleMute} className="text-neutral-400 hover:text-white p-1">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <div className="relative flex-1 flex items-center h-4 cursor-pointer">
              <div className="w-full h-1.5 bg-white/10 group-hover:h-2 rounded-full overflow-hidden transition-all duration-150">
                <div 
                  className="h-full bg-white group-hover:bg-apple-pink rounded-full transition-all duration-75"
                  style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                />
              </div>
              <input 
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};
