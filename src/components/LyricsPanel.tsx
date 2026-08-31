import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, X, Search, Languages } from 'lucide-react';
import { LyricView } from './LyricView';
import { usePlayer } from '../context/PlayerContext';
import { setNativeFullscreen } from '../utils/tauriBridge';
import { LyricsTranslationPopover } from './LyricsTranslationPopover';
import { loadTranslationSettings } from '../types';

export const LyricsPanel: React.FC = () => {
  const { setLyricsOpen, openLyricsSearch, currentTrack } = usePlayer();
  const [width, setWidth] = useState(() => Math.min(360, Math.max(260, Math.floor(window.innerWidth * 0.32))));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransPopoverOpen, setIsTransPopoverOpen] = useState(false);
  const [transVersion, setTransVersion] = useState(0);
  const draggingRef = useRef(false);

  const toggleFullscreen = useCallback(async (enable: boolean) => {
    setIsFullscreen(enable);
    await setNativeFullscreen(enable);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        void toggleFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, toggleFullscreen]);

  useEffect(() => {
    const handleResize = () => {
      setWidth(prev => Math.min(Math.floor(window.innerWidth * 0.45), Math.max(250, prev)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      // Đảm bảo trả lại trạng thái cửa sổ ban đầu khi unmount
      void setNativeFullscreen(false);
    };
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!draggingRef.current) return;
      const maxAllowed = Math.max(280, Math.floor(window.innerWidth * 0.45));
      setWidth(Math.min(maxAllowed, Math.max(250, window.innerWidth - event.clientX)));
    };
    const up = () => { draggingRef.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const transSettings = loadTranslationSettings();

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-black w-screen h-screen overflow-hidden animate-in fade-in duration-300">
        <button
          onClick={() => void toggleFullscreen(false)}
          className="absolute top-6 right-6 z-[110] rounded-full bg-black/50 backdrop-blur-md p-3.5 text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all border border-white/10 shadow-2xl group cursor-pointer"
          title="Thoát toàn màn hình (Phím Esc)"
        >
          <Minimize2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
        <LyricView key={transVersion} />
      </div>
    );
  }

  return (
    <aside style={{ width }} className="relative flex h-full shrink-0 border-l border-white/10 bg-neutral-950 z-20">
      <div onMouseDown={() => { draggingRef.current = true; document.body.style.cursor = 'col-resize'; }} className="absolute -left-1 top-0 h-full w-2 cursor-col-resize hover:bg-apple-pink/60" title="Kéo để đổi kích thước" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">Lời bài hát</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsTransPopoverOpen(!isTransPopoverOpen)}
              className={`rounded-lg p-2 transition-colors cursor-pointer ${
                isTransPopoverOpen || transSettings.enabled
                  ? 'bg-apple-pink/20 text-apple-pink'
                  : 'text-neutral-400 hover:bg-white/10 hover:text-apple-pink'
              }`}
              title="Dịch lời bài hát (Google Dịch, Gemini, OpenAI, Claude...)"
            >
              <Languages className="w-4 h-4" />
            </button>
            <button
              onClick={() => openLyricsSearch(currentTrack)}
              className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-apple-pink transition-colors cursor-pointer"
              title="Tìm lời bài hát trực tuyến (LRCLIB)"
            >
              <Search className="w-4 h-4" />
            </button>
            <button onClick={() => void toggleFullscreen(true)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer" title="Toàn màn hình (True Native Fullscreen)"><Maximize2 className="w-4 h-4" /></button>
            <button onClick={() => setLyricsOpen(false)} className="rounded-lg p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer" title="Đóng lời bài hát"><X className="w-4 h-4" /></button>
          </div>

          <LyricsTranslationPopover
            isOpen={isTransPopoverOpen}
            onClose={() => setIsTransPopoverOpen(false)}
            onTranslationUpdated={() => setTransVersion((v) => v + 1)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-visible">
          <LyricView compact key={transVersion} />
        </div>
      </div>
    </aside>
  );
};
