import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Mic2, 
  X, 
  Tv, 
  PictureInPicture2,
  Music
} from 'lucide-react';
import { formatTime } from '../utils/lrcParser';
import { convertFileSrc } from '../utils/tauriBridge';

export const MvPlayerView: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { 
    currentTrack, 
    currentTime, 
    seek, 
    volume, 
    setVolume, 
    isMuted, 
    toggleMute,
    lyrics,
    currentLyricIndex,
    nextTrack,
    prevTrack,
    pauseAudio,
    closeMv
  } = usePlayer();

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [videoTime, setVideoTime] = useState<number>(currentTime || 0);
  const [duration, setDuration] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showLyrics, setShowLyrics] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<any>(null);

  // Đóng MV hoàn toàn an toàn: Đồng bộ thời gian, ngắt video và quyết định phát/dừng audio
  const handleClose = useCallback((resumeIfPlaying?: boolean) => {
    const video = videoRef.current;
    const wasPlaying = resumeIfPlaying !== undefined ? resumeIfPlaying : (video ? !video.paused : isPlaying);
    const finalTime = video ? video.currentTime : videoTime;

    // 1. Dừng triệt để thẻ video và giải phóng tài nguyên
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (err) {
        console.warn("Lỗi giải phóng video:", err);
      }
    }

    // 2. Đồng bộ mốc thời gian sang audio
    seek(finalTime);

    // 3. Đóng MV qua context (sẽ chỉ resume audio nếu trước đó video đang phát)
    closeMv(wasPlaying);

    if (onClose) onClose();
  }, [closeMv, isPlaying, onClose, seek, videoTime]);

  // Luôn tạm dừng audio nền khi MvPlayerView hiển thị
  useEffect(() => {
    pauseAudio();

    if (videoRef.current) {
      videoRef.current.currentTime = currentTime || 0;
      videoRef.current.volume = isMuted ? 0 : volume;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
    }

    return () => {
      // Khi component unmount (ví dụ người dùng tắt MV), giải phóng video
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Xử lý khi bài hát thay đổi (Next/Prev bài hát trong MV)
  useEffect(() => {
    pauseAudio();

    const video = videoRef.current;
    if (video && currentTrack?.mvPath) {
      const src = convertFileSrc(currentTrack.mvPath);
      video.src = src;
      video.currentTime = 0;
      video.volume = isMuted ? 0 : volume;
      video.play().then(() => setIsPlaying(true)).catch(console.warn);
    }
  }, [currentTrack?.id, currentTrack?.mvPath, pauseAudio, isMuted, volume]);

  // Lắng nghe phím Escape và Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Tự động ẩn thanh điều khiển sau 3 giây không di chuyển chuột
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      video.pause();
      setIsPlaying(false);
      pauseAudio();
    } else {
      pauseAudio();
      video.play().then(() => setIsPlaying(true)).catch(console.warn);
    }
  };

  const handleVideoSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
    setVideoTime(val);
    seek(val);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("Lỗi bật Picture-in-Picture:", err);
    }
  };

  if (!currentTrack || !currentTrack.mvPath) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center space-y-5 text-white p-6 select-none animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-white/10 flex items-center justify-center">
          <Tv className="w-8 h-8 text-neutral-500" />
        </div>
        <div className="text-center space-y-1.5 max-w-sm">
          <p className="text-base font-bold">Bài hát hiện tại chưa có file MV</p>
          <p className="text-xs text-neutral-400">
            {currentTrack?.title ? `"${currentTrack.title}"` : 'Bài hát'} không có video hoặc đã chuyển sang bài không có MV.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleClose(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-apple-pink hover:bg-apple-pinkHover text-white font-bold text-xs shadow-lg active:scale-95 transition-all"
          >
            <Music className="w-4 h-4" />
            <span>Chuyển sang nghe Audio</span>
          </button>
          <button
            onClick={() => handleClose(false)}
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-xs active:scale-95 transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  const videoSrc = convertFileSrc(currentTrack.mvPath);

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 bg-black z-50 flex items-center justify-center overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        playsInline
        onError={(e) => {
          console.warn("Lỗi load video:", e);
        }}
        onPlay={() => {
          setIsPlaying(true);
          pauseAudio();
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setVideoTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.volume = isMuted ? 0 : volume;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          nextTrack();
        }}
        onClick={togglePlayPause}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Overlay Lyrics Panel (Nếu người dùng bật Lời bài hát) */}
      {showLyrics && lyrics.length > 0 && (
        <div className="absolute right-8 top-20 bottom-28 w-96 bg-black/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 overflow-y-auto no-scrollbar space-y-6 z-20 shadow-2xl animate-in fade-in duration-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-apple-pink">Lời Bài Hát Đồng Bộ</h4>
          {lyrics.map((line, idx) => (
            <p 
              key={idx}
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime = line.time;
              }}
              className={`text-lg font-bold cursor-pointer transition-all ${
                idx === currentLyricIndex ? 'text-apple-pink scale-105' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {line.text}
            </p>
          ))}
        </div>
      )}

      {/* Top Header Bar (Tự ẩn) */}
      <div className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-20 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-apple-pink/20 text-apple-pink shadow-md">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{currentTrack.title}</h3>
            <p className="text-xs text-neutral-300">{currentTrack.artist} • Music Video</p>
          </div>
        </div>

        {/* Nút Đóng */}
        <button
          onClick={() => handleClose()}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 border border-white/10 shadow-lg"
          title="Thoát màn hình MV (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Controls Bar (Tự ẩn) */}
      <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-4 transition-opacity duration-300 z-20 ${
        showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}>
        
        {/* Progress Bar */}
        <div className="flex items-center gap-3 w-full">
          <span className="text-xs font-semibold text-neutral-300 tabular-nums w-10 text-right">
            {formatTime(videoTime)}
          </span>
          <div className="relative flex-1 flex items-center group h-4 cursor-pointer">
            <div className="w-full h-1.5 bg-white/20 group-hover:h-2 rounded-full overflow-hidden transition-all">
              <div 
                className="h-full bg-apple-pink rounded-full"
                style={{ width: `${duration > 0 ? (videoTime / duration) * 100 : 0}%` }}
              />
            </div>
            <input 
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={videoTime}
              onChange={handleVideoSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
          </div>
          <span className="text-xs font-semibold text-neutral-300 tabular-nums w-10">
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback Controls & Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={prevTrack} className="text-white hover:text-apple-pink transition-colors active:scale-95" title="Bài trước">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={togglePlayPause} 
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shadow-lg active:scale-95"
              title={isPlaying ? "Tạm dừng" : "Phát"}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button onClick={nextTrack} className="text-white hover:text-apple-pink transition-colors active:scale-95" title="Bài kế tiếp">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Lyric Toggle */}
            {lyrics.length > 0 && (
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className={`p-2 rounded-xl transition-all ${showLyrics ? 'bg-apple-pink text-white shadow-lg' : 'text-neutral-300 hover:text-white hover:bg-white/10'}`}
                title="Hiện Lời Bài Hát"
              >
                <Mic2 className="w-4 h-4" />
              </button>
            )}

            {/* Picture-in-Picture Toggle */}
            <button 
              onClick={togglePictureInPicture}
              className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-all"
              title="Chế độ cửa sổ thu nhỏ (Picture-in-Picture)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group">
              <button onClick={toggleMute} className="text-neutral-300 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <div className="relative w-24 flex items-center h-4 cursor-pointer">
                <div className="w-full h-1.5 bg-white/20 group-hover:h-2 rounded-full overflow-hidden transition-all">
                  <div 
                    className="h-full bg-apple-pink rounded-full transition-all"
                    style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                  />
                </div>
                <input 
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (videoRef.current) videoRef.current.volume = val;
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
              </div>
            </div>

            {/* Fullscreen Toggle */}
            <button 
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10 transition-all"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
