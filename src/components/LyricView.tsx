import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Music, FileText, LocateFixed, Sparkles, Disc, Search, Volume2, Languages } from 'lucide-react';
import { LyricsVisualizerBg } from './LyricsVisualizerBg';
import { SoundWave } from './SoundWave';
import { analyzeTrackAudio } from '../utils/audioTech';
import { convertFileSrc } from '../utils/tauriBridge';
import {
  type LyricCustomizationSettings,
  type TranslationSettings,
  type LyricLine,
  loadLyricSettings,
  loadTranslationSettings,
} from '../types';
import {
  getCachedTranslation,
  translateLyrics,
  stripLineIndexPrefix,
  shouldDisplayTranslation,
} from '../services/lyricsTranslationService';

interface LyricViewProps {
  colors?: string[];
  compact?: boolean;
}

export const LyricView: React.FC<LyricViewProps> = ({ colors, compact = false }) => {
  const {
    currentTrack,
    lyrics,
    currentLyricIndex,
    currentTime,
    isPlaying,
    seek,
    openAudioQualityModal,
    openLyricsSearch,
  } = usePlayer();

  const [settings, setSettings] = useState<LyricCustomizationSettings>(loadLyricSettings);
  const [transSettings, setTransSettings] = useState<TranslationSettings>(loadTranslationSettings);
  const [translatedLinesMap, setTranslatedLinesMap] = useState<Record<number, string>>({});

  // Lắng nghe sự kiện cập nhật cấu hình lời bài hát từ Cài Đặt (Settings) theo thời gian thực
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<LyricCustomizationSettings>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      } else {
        setSettings(loadLyricSettings());
      }
    };

    const handleTransUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<TranslationSettings>;
      if (customEvent.detail) {
        setTransSettings(customEvent.detail);
      } else {
        setTransSettings(loadTranslationSettings());
      }
    };

    window.addEventListener('lyric-settings-updated', handleUpdate);
    window.addEventListener('lyrics-translation-settings-updated', handleTransUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('storage', handleTransUpdate);
    return () => {
      window.removeEventListener('lyric-settings-updated', handleUpdate);
      window.removeEventListener('lyrics-translation-settings-updated', handleTransUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('storage', handleTransUpdate);
    };
  }, []);

  // Tải bản dịch cho bài hát hiện tại:
  // - Nếu đã có bản dịch trong cache: hiển thị ngay lập tức
  // - Nếu chưa có: CHỈ tự động gọi API dịch nếu người dùng ĐÃ BẬT "Tự động dịch" trong Cài Đặt (mặc định là Thủ công)
  useEffect(() => {
    if (!currentTrack || lyrics.length === 0) {
      setTranslatedLinesMap({});
      return;
    }

    const trackKey = currentTrack.id || `${currentTrack.title}_${currentTrack.artist}`;
    const activeProvider = transSettings.autoTranslate
      ? (transSettings.autoTranslateProvider || transSettings.provider)
      : transSettings.provider;

    const cached =
      getCachedTranslation(trackKey, transSettings.targetLanguage, activeProvider) ||
      getCachedTranslation(trackKey, transSettings.targetLanguage, transSettings.provider) ||
      getCachedTranslation(trackKey, transSettings.targetLanguage, 'google');

    if (cached && cached.length === lyrics.length) {
      const map: Record<number, string> = {};
      cached.forEach((text, idx) => {
        const orig = lyrics[idx]?.text || '';
        if (text && shouldDisplayTranslation(orig, text, transSettings.targetLanguage)) {
          map[idx] = text;
        }
      });
      setTranslatedLinesMap(map);
    } else if (transSettings.enabled && transSettings.autoTranslate) {
      // Tự động dịch ngầm với trình dịch đã được người dùng chỉ định trong Cài Đặt
      let isCancelled = false;
      translateLyrics(
        lyrics,
        {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          trackId: currentTrack.id,
        },
        {
          ...transSettings,
          provider: transSettings.autoTranslateProvider || transSettings.provider,
        }
      )
        .then((translated) => {
          if (isCancelled) return;
          const map: Record<number, string> = {};
          translated.forEach((l, idx) => {
            const orig = lyrics[idx]?.text || '';
            if (l.translation && shouldDisplayTranslation(orig, l.translation, transSettings.targetLanguage)) {
              map[idx] = l.translation;
            }
          });
          setTranslatedLinesMap(map);
        })
        .catch((err) => {
          console.warn('[LyricView] Auto translation failed:', err);
        });

      return () => {
        isCancelled = true;
      };
    } else {
      // Mặc định chế độ Thủ Công: Không tự động chạy dịch khi chưa yêu cầu
      setTranslatedLinesMap({});
    }
  }, [
    currentTrack?.id,
    lyrics,
    transSettings.enabled,
    transSettings.autoTranslate,
    transSettings.autoTranslateProvider,
    transSettings.targetLanguage,
    transSettings.provider,
  ]);

  const audioAnalysis = useMemo(() => analyzeTrackAudio(currentTrack), [currentTrack]);
  const lyricContainerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const userScrollTimeoutRef = useRef<number | null>(null);

  // Nhận diện bài hát Instrumental (Không lời)
  const isInstrumental = useMemo(() => {
    if (!currentTrack) return false;
    const title = (currentTrack.title || '').toLowerCase();
    const genre = (currentTrack.genre || '').toLowerCase();
    return (
      title.includes('instrumental') ||
      title.includes('(beat)') ||
      title.includes('karaoke') ||
      title.includes('backing track') ||
      title.includes('solo piano') ||
      title.includes('acoustic guitar') ||
      genre.includes('instrumental') ||
      genre.includes('classical') ||
      genre.includes('soundtrack') ||
      genre.includes('ambient') ||
      genre.includes('lo-fi')
    );
  }, [currentTrack]);

  // Cuộn dòng lyric hiện tại vào giữa khung nhìn với tọa độ bounding box chính xác
  const scrollToActiveLine = useCallback((smooth = true) => {
    const container = lyricContainerRef.current;
    const activeLine = activeLineRef.current;
    if (container && activeLine) {
      isAutoScrollingRef.current = true;
      const activeRect = activeLine.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = relativeTop - (container.clientHeight / 2) + (activeRect.height / 2);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? 'smooth' : 'auto',
      });

      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 450);
    }
  }, []);

  // Mỗi lần mở LyricView hoặc khi chuyển bài hát: Luôn tự động bật đồng bộ và cuộn ngay đến câu đang phát
  useEffect(() => {
    setIsUserScrolled(false);
    const t1 = window.setTimeout(() => scrollToActiveLine(false), 50);
    const t2 = window.setTimeout(() => scrollToActiveLine(true), 250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [currentTrack?.id, scrollToActiveLine]);

  // Tự động cuộn theo từng câu hát khi bài hát đang phát
  useEffect(() => {
    if (!isUserScrolled && currentLyricIndex >= 0) {
      scrollToActiveLine(true);
    }
  }, [currentLyricIndex, isUserScrolled, scrollToActiveLine]);

  // Nhận biết khi người dùng tự cuộn để đọc lời trước: Tự động đồng bộ lại sau 4 giây không thao tác
  const handleScroll = () => {
    if (isAutoScrollingRef.current) return;
    setIsUserScrolled(true);

    if (userScrollTimeoutRef.current !== null) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserScrolled(false);
      scrollToActiveLine(true);
    }, 4000);
  };

  // Nhấn nút Đồng bộ hóa thủ công
  const handleSyncToCurrent = () => {
    if (userScrollTimeoutRef.current !== null) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    setIsUserScrolled(false);
    scrollToActiveLine(true);
  };

  // Mapping kích thước chữ dựa trên cấu hình cài đặt
  const fontSizeClasses = useMemo(() => {
    const compactMap = {
      medium: 'text-sm sm:text-base leading-relaxed',
      large: 'text-base sm:text-lg leading-relaxed font-bold',
      xlarge: 'text-lg sm:text-xl leading-relaxed font-black',
    };
    const fullMap = {
      medium: 'text-2xl md:text-3xl leading-snug',
      large: 'text-3xl md:text-4xl lg:text-[40px] leading-snug',
      xlarge: 'text-4xl md:text-5xl lg:text-[50px] leading-tight font-black',
    };
    return (compact ? compactMap : fullMap)[settings.fontSize] || fullMap.large;
  }, [compact, settings.fontSize]);

  // Mapping căn lề
  const alignClass = useMemo(() => {
    const map = {
      left: 'text-left items-start origin-left',
      center: 'text-center items-center origin-center',
      right: 'text-right items-end origin-right',
    };
    return map[settings.textAlign] || map.left;
  }, [settings.textAlign]);

  if (!currentTrack) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-neutral-500 space-y-3 select-none">
        <Music className="w-16 h-16 opacity-30" />
        <p className="text-base font-extrabold">Chưa có bài hát nào được chọn</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden select-none flex items-center justify-center font-extrabold transform-gpu">
      {/* Spicetify Visualizer Background Modes */}
      <LyricsVisualizerBg 
        effect={settings.bgEffect}
        colors={colors} 
        imageUrl={convertFileSrc(currentTrack.picture)} 
        isPlaying={isPlaying}
      />

      {/* Main Lyric Container */}
      <div className={`relative z-10 w-full h-full flex flex-col ${compact ? 'p-3' : 'md:flex-row items-center justify-between p-6 md:p-12 md:pl-16 md:pr-12 gap-8 md:gap-14'}`}>
        
        {/* Album Art & Track Info (Trái) */}
        {!compact && (
          <div className="flex flex-col items-center md:items-start text-center md:text-left shrink-0 space-y-5 w-full md:w-80 lg:w-96 transform-gpu">
            <div className="w-64 h-64 md:w-80 md:h-80 lg:w-88 lg:h-88 rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
              {currentTrack.picture ? (
                <img 
                  src={convertFileSrc(currentTrack.picture)} 
                  alt={currentTrack.title} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-600">
                  <Music className="w-20 h-20" />
                </div>
              )}
            </div>
            <div className="w-full">
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-md">
                {currentTrack.title}
              </h2>
              <p className="text-lg font-black text-neutral-200/90 mt-1.5">{currentTrack.artist}</p>
              <p className="text-sm font-bold text-neutral-400/80 mt-0.5">{currentTrack.album}</p>

              {/* Audio Quality Badges */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {audioAnalysis.badges.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => openAudioQualityModal(currentTrack, b.id)}
                    className={`px-2.5 py-1 rounded-xl border font-black text-[11px] uppercase tracking-wider shadow-md flex items-center gap-1.5 cursor-pointer hover:scale-105 hover:brightness-125 active:scale-95 transition-all ${b.style}`}
                    title={`Nhấn để xem chi tiết chuẩn âm thanh ${b.label}`}
                  >
                    {b.isDolby ? <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" /> : <Disc className="w-3.5 h-3.5" />}
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Lyrics List (Phải) */}
        <div className="relative w-full h-full min-h-0 flex-1 flex flex-col">
          {/* Nút Đồng bộ hóa (chỉ hiện khi người dùng tự cuộn rời khỏi câu đang phát) */}
          {isUserScrolled && lyrics.length > 0 && (
            <div className="absolute top-4 right-4 z-30 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={handleSyncToCurrent}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-apple-pink text-white text-xs font-black shadow-xl hover:bg-apple-pinkHover hover:scale-105 active:scale-95 transition-all border border-white/20 cursor-pointer"
                title="Đồng bộ lại với lời bài hát đang phát"
              >
                <LocateFixed className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Đồng bộ theo nhạc</span>
              </button>
            </div>
          )}

          <div 
            ref={lyricContainerRef}
            onScroll={handleScroll}
            className={`w-full h-full overflow-y-auto ${compact ? 'px-4 py-16 space-y-3' : 'px-8 md:px-14 py-28 space-y-5'} no-scrollbar scroll-smooth overflow-x-visible transform-gpu ${settings.style === 'perspective3d' ? 'perspective-stage' : ''}`}
          >
            {lyrics.length === 0 ? (
              isInstrumental ? (
                /* Chế độ Instrumental Ambient Visualizer */
                <div className="h-full flex flex-col items-center justify-center text-neutral-300 space-y-4 p-6 text-center animate-in fade-in duration-300">
                  <div className="w-20 h-20 rounded-3xl bg-apple-pink/15 border border-apple-pink/30 flex items-center justify-center text-apple-pink shadow-2xl shadow-apple-pink/20 animate-pulse">
                    <Volume2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <span className="px-3 py-1 rounded-full bg-apple-pink/20 text-apple-pink border border-apple-pink/30 text-xs font-black uppercase tracking-wider">
                      Bản Nhạc Không Lời (Instrumental)
                    </span>
                    <h3 className="text-xl font-black text-white pt-2">Thưởng thức giai điệu hòa tấu</h3>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      Bài hát được nhận diện là bản thu không lời hoặc khí nhạc.
                    </p>
                  </div>

                  <div className="flex justify-center py-4">
                    <SoundWave className="h-7 w-12" />
                  </div>

                  <button
                    onClick={() => openLyricsSearch(currentTrack)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Tìm lời bài hát nếu có</span>
                  </button>
                </div>
              ) : (
                /* Trạng thái chưa có lời bài hát */
                <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-3 p-6 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-apple-pink shadow-xl">
                    <FileText className="w-8 h-8 opacity-60" />
                  </div>
                  <p className="text-xl font-black text-white">Chưa có lời bài hát (.lrc)</p>
                  <p className="text-xs font-semibold text-neutral-400 max-w-sm">
                    Tra cứu lời bài hát đồng bộ thời gian (Karaoke) trực tuyến từ kho lưu trữ LRCLIB hoặc gán file từ máy tính.
                  </p>
                  <button
                    onClick={() => openLyricsSearch(currentTrack)}
                    className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-apple-pink hover:bg-apple-pinkHover text-white text-xs font-black shadow-xl shadow-apple-pink/25 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
                  >
                    <Search className="w-4 h-4" />
                    <span>Tìm Lời Bài Hát Trực Tuyến</span>
                  </button>
                </div>
              )
            ) : (
              lyrics.map((line, index) => {
                const isActive = index === currentLyricIndex;
                const distance = index - currentLyricIndex;

                // Tính toán tiến độ Karaoke Sweep theo thời gian thực (ước lượng nhịp chữ)
                let karaokeProgress = 0;
                if (isActive && settings.style === 'karaoke') {
                  const nextTime = lyrics[index + 1]?.time || (currentTrack?.duration || line.time + 4);
                  const lineDuration = Math.max(0.5, nextTime - line.time);
                  const elapsed = Math.max(0, currentTime - line.time);
                  karaokeProgress = Math.min(100, Math.max(0, (elapsed / lineDuration) * 100));
                }

                // Phong cách 3D Perspective Rotation
                let perspectiveStyle = {};
                if (settings.style === 'perspective3d') {
                  const clampedDist = Math.max(-4, Math.min(4, distance));
                  const rotX = clampedDist * 10;
                  const scale = Math.max(0.78, 1 - Math.abs(clampedDist) * 0.06);
                  perspectiveStyle = {
                    transform: `perspective(750px) rotateX(${-rotX}deg) scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.35s cubic-bezier(0.2, 0, 0, 1), opacity 0.3s ease',
                  };
                }

                // Tính toán độ mờ nhòe chiều sâu (Depth of field blur)
                const blurStyle = settings.blurInactive && !isActive
                  ? { filter: `blur(${Math.min(3, Math.abs(distance) * 0.7)}px)` }
                  : {};

                const rawTrans = translatedLinesMap[index] || (settings.showTranslation ? line.translation : undefined);
                const cleanTrans = rawTrans ? stripLineIndexPrefix(rawTrans) : undefined;
                const isVisibleTrans = cleanTrans && shouldDisplayTranslation(line.text, cleanTrans, transSettings.targetLanguage);
                const translatedText = isVisibleTrans ? cleanTrans : undefined;

                return (
                  <div
                    key={index}
                    style={{ ...perspectiveStyle, ...blurStyle }}
                    className={`w-full overflow-visible py-1 transform-gpu flex flex-col ${alignClass}`}
                  >
                    <p
                      ref={isActive ? activeLineRef : null}
                      onClick={() => {
                        seek(line.time);
                        setIsUserScrolled(false);
                        scrollToActiveLine(true);
                      }}
                      className={`inline-block w-full px-4 py-1 -mx-4 overflow-visible ${fontSizeClasses} font-black tracking-tight cursor-pointer transition-all duration-300 transform select-none will-change-transform ${
                        isActive
                          ? settings.style === 'neon'
                            ? 'text-white scale-105 opacity-100 animate-neon-pulse drop-shadow-[0_0_20px_rgba(250,36,60,0.8)]'
                            : settings.style === 'karaoke'
                            ? 'scale-105 opacity-100 drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]'
                            : settings.style === 'spotify'
                            ? 'text-white scale-105 opacity-100 drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)]'
                            : 'text-white scale-105 opacity-100 [text-shadow:0_0_18px_rgba(255,255,255,0.4),0_0_36px_rgba(255,255,255,0.2)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                          : 'text-neutral-300/40 hover:text-neutral-100 hover:opacity-90 scale-100'
                      }`}
                      style={
                        isActive && settings.style === 'karaoke'
                          ? {
                              background: `linear-gradient(90deg, #ffffff 0%, #ffffff ${karaokeProgress}%, rgba(255,255,255,0.3) ${Math.min(100, karaokeProgress + 4)}%, rgba(255,255,255,0.3) 100%)`,
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                            }
                          : undefined
                      }
                    >
                      {line.text}
                    </p>

                    {/* Dòng phụ Song ngữ / Phiên âm nếu có & bật hiển thị */}
                    {translatedText && (() => {
                      const subFontSize = transSettings.fontSize || 'tiny';
                      const subStyle = transSettings.style || 'apple';
                      const customSubColor = transSettings.color || '#FA243C';

                      let subFontSizeClass = 'text-[11px] md:text-xs leading-snug';
                      if (subFontSize === 'small') subFontSizeClass = 'text-xs md:text-sm leading-normal';
                      if (subFontSize === 'medium') subFontSizeClass = 'text-sm md:text-base leading-normal';

                      let subStyleClass = '';
                      let subInlineStyle: React.CSSProperties = {};

                      if (isActive) {
                        if (subStyle === 'apple') {
                          subStyleClass = 'font-bold tracking-tight opacity-100 drop-shadow-[0_2px_12px_rgba(250,36,60,0.35)] transform scale-[1.02]';
                          subInlineStyle = { color: customSubColor };
                        } else if (subStyle === 'spotify') {
                          subStyleClass = 'font-black tracking-wide opacity-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]';
                          subInlineStyle = { color: customSubColor };
                        } else if (subStyle === 'minimal') {
                          subStyleClass = 'font-medium tracking-normal text-neutral-200 opacity-90';
                        } else if (subStyle === 'duet-glow') {
                          subStyleClass = 'font-black tracking-tight drop-shadow-[0_0_12px_currentColor] animate-pulse opacity-100';
                          subInlineStyle = { color: customSubColor };
                        }
                      } else {
                        if (subStyle === 'apple') {
                          subStyleClass = transSettings.dimInactive ? 'font-medium' : 'font-medium';
                          subInlineStyle = { color: customSubColor, opacity: transSettings.dimInactive ? 0.5 : 0.75 };
                        } else if (subStyle === 'spotify') {
                          subStyleClass = transSettings.dimInactive ? 'font-bold text-neutral-400 opacity-40' : 'font-bold text-neutral-300 opacity-65';
                        } else if (subStyle === 'minimal') {
                          subStyleClass = 'font-normal text-neutral-400 opacity-40';
                        } else if (subStyle === 'duet-glow') {
                          subStyleClass = 'font-bold';
                          subInlineStyle = { color: customSubColor, opacity: transSettings.dimInactive ? 0.35 : 0.6 };
                        }
                      }

                      return (
                        <p
                          style={subInlineStyle}
                          className={`${subFontSizeClass} ${subStyleClass} mt-0.5 transition-all duration-300`}
                        >
                          {translatedText}
                        </p>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
