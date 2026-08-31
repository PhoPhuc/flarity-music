import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  searchLrcLibLyrics,
  type LrcSearchMode,
  type LrcSearchResultItem,
} from '../utils/lrclibService';
import { formatTime, parseLrc } from '../utils/lrcParser';
import { convertFileSrc } from '../utils/tauriBridge';
import {
  X,
  Search,
  Sparkles,
  ThumbsUp,
  Music,
  Check,
  Eye,
  SlidersHorizontal,
  Clock,
  Mic2,
  FileText,
  AlertCircle,
  RefreshCw,
  FolderDown,
  Zap,
  Disc,
  User,
  Layers,
  Globe,
} from 'lucide-react';

interface LyricsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchModeConfig {
  id: LrcSearchMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SEARCH_MODES: SearchModeConfig[] = [
  { id: 'auto', label: 'Tự Động (Khuyên dùng)', icon: Zap },
  { id: 'title_only', label: 'Chỉ Tên Bài', icon: Music },
  { id: 'title_album', label: 'Tên + Album', icon: Disc },
  { id: 'artist_only', label: 'Chỉ Nghệ Sĩ', icon: User },
  { id: 'album_only', label: 'Chỉ Album', icon: Layers },
  { id: 'custom', label: 'Tìm Tự Do / Đa Ngôn Ngữ', icon: Globe },
];

export const LyricsSearchModal: React.FC<LyricsSearchModalProps> = ({ isOpen, onClose }) => {
  const { lyricsSearchTrack, saveAndApplyLyrics, currentTrack } = usePlayer();
  const track = lyricsSearchTrack || currentTrack;

  const [mode, setMode] = useState<LrcSearchMode>('auto');
  const [customQuery, setCustomQuery] = useState('');
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<LrcSearchResultItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Preview Drawer / Modal
  const [previewItem, setPreviewItem] = useState<LrcSearchResultItem | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [appliedSuccessId, setAppliedSuccessId] = useState<number | null>(null);

  // Tự động điền customQuery ban đầu
  useEffect(() => {
    if (track) {
      setCustomQuery(`${track.title || ''} ${track.artist || ''}`.trim());
    }
  }, [track]);

  // Thực hiện tìm kiếm
  const executeSearch = useCallback(
    async (overrideMode?: LrcSearchMode, overrideDeep?: boolean) => {
      if (!track) return;
      const targetMode = overrideMode || mode;
      const targetDeep = overrideDeep !== undefined ? overrideDeep : isDeepSearch;

      setIsSearching(true);
      setErrorMsg(null);
      setHasSearched(true);
      setPreviewItem(null);

      try {
        const items = await searchLrcLibLyrics({
          track,
          mode: targetMode,
          customQuery: customQuery.trim(),
          isDeepSearch: targetDeep,
        });
        setResults(items);
      } catch (err: any) {
        console.error('[LyricsSearch] Error fetching lyrics:', err);
        setErrorMsg('Không thể kết nối đến máy chủ LRCLIB. Vui lòng kiểm tra lại mạng.');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [track, mode, customQuery, isDeepSearch]
  );

  // Tự động tìm kiếm lần đầu khi mở modal
  useEffect(() => {
    if (isOpen && track) {
      setMode('auto');
      setIsDeepSearch(false);
      setAppliedSuccessId(null);
      executeSearch('auto', false);
    }
  }, [isOpen, track]);

  // Khi thay đổi Tab mode
  const handleModeChange = (newMode: LrcSearchMode) => {
    setMode(newMode);
    if (newMode !== 'custom') {
      executeSearch(newMode);
    }
  };

  // Toggle Deep Search
  const handleToggleDeepSearch = () => {
    const nextVal = !isDeepSearch;
    setIsDeepSearch(nextVal);
    executeSearch(mode, nextVal);
  };

  // Áp dụng lyrics
  const handleApplyLyrics = async (item: LrcSearchResultItem) => {
    if (!track) return;
    const lrcContent = item.syncedLyrics || item.plainLyrics;
    if (!lrcContent) return;

    setSavingId(item.id);
    try {
      await saveAndApplyLyrics(track.id, lrcContent);
      setAppliedSuccessId(item.id);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('[LyricsSearch] Error saving lyrics:', err);
      alert('Đã xảy ra lỗi khi lưu file lời bài hát!');
    } finally {
      setSavingId(null);
    }
  };

  // Parsed preview lines
  const previewLines = useMemo(() => {
    if (!previewItem) return [];
    if (previewItem.syncedLyrics) {
      return parseLrc(previewItem.syncedLyrics);
    }
    if (previewItem.plainLyrics) {
      return previewItem.plainLyrics.split('\n').map((text) => ({ time: 0, text }));
    }
    return [];
  }, [previewItem]);

  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-neutral-900/95 border border-white/15 rounded-3xl shadow-2xl overflow-hidden select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER & TRACK SUMMARY */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-neutral-900/60">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-800 shrink-0 border border-white/10 shadow-lg">
              {track.picture ? (
                <img 
                  src={convertFileSrc(track.picture)} 
                  alt={track.title} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-apple-pink">
                  <Music className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-apple-pink bg-apple-pink/15 px-2.5 py-0.5 rounded-md border border-apple-pink/30">
                  LRCLIB Cloud API
                </span>
                <span className="text-xs font-semibold text-neutral-400">
                  Thời lượng: {formatTime(track.duration || 0)}
                </span>
              </div>
              <h2 className="text-lg font-black text-white truncate mt-0.5">{track.title}</h2>
              <p className="text-xs font-semibold text-neutral-400 truncate">
                {track.artist} {track.album ? `• ${track.album}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. SEARCH TOOLBAR: TABS & DEEP SEARCH */}
        <div className="p-4 border-b border-white/10 bg-neutral-900/40 space-y-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {SEARCH_MODES.map((m) => {
              const IconComp = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    mode === m.id
                      ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20 scale-[1.02]'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input Bar (Khi ở tab custom hoặc muốn gõ) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch('custom')}
                placeholder="Nhập tên bài hát, nghệ sĩ hoặc từ khoá (Tiếng Việt, Anh, Hàn, Nhật, Trung...)..."
                className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-apple-pink/50 rounded-xl pl-10 pr-9 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
              />
              {customQuery && (
                <button
                  onClick={() => setCustomQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => executeSearch('custom')}
                disabled={isSearching || !customQuery.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-apple-pink hover:bg-apple-pinkHover disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              >
                {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Tìm kiếm</span>
              </button>

              {/* Deep Search Button */}
              <button
                onClick={handleToggleDeepSearch}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  isDeepSearch
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-500/10'
                    : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
                title="Bật chế độ tìm kiếm mở rộng nới lỏng từ khoá"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Tìm chuyên sâu</span>
                {isDeepSearch && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />}
              </button>
            </div>
          </div>
        </div>

        {/* 3. MAIN RESULTS AREA / PREVIEW */}
        <div className="flex-1 flex overflow-hidden min-h-[320px]">
          {/* Left Column: Results List */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar ${previewItem ? 'hidden md:block md:w-1/2' : 'w-full'}`}>
            {isSearching ? (
              <div className="h-64 flex flex-col items-center justify-center text-neutral-400 space-y-3">
                <div className="w-8 h-8 border-3 border-apple-pink/30 border-t-apple-pink rounded-full animate-spin" />
                <p className="text-xs font-bold text-neutral-300">Đang tra cứu cơ sở dữ liệu LRCLIB Cloud...</p>
                <p className="text-[11px] text-neutral-500">Tự động chấm điểm độ khớp & tìm Synced Lyrics</p>
              </div>
            ) : errorMsg ? (
              <div className="h-64 flex flex-col items-center justify-center text-rose-400 space-y-3 p-6 text-center">
                <AlertCircle className="w-10 h-10 opacity-70" />
                <p className="text-sm font-bold">{errorMsg}</p>
                <button
                  onClick={() => executeSearch()}
                  className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            ) : results.length === 0 && hasSearched ? (
              <div className="h-64 flex flex-col items-center justify-center text-neutral-500 space-y-2 text-center p-6">
                <FileText className="w-10 h-10 opacity-30" />
                <p className="text-sm font-bold text-neutral-300">Không tìm thấy lời bài hát nào phù hợp</p>
                <p className="text-xs text-neutral-500 max-w-sm">
                  Hãy thử chuyển sang tab <strong>Chỉ Tên Bài</strong>, <strong>Tìm Tự Do</strong> hoặc bật tính năng <strong>Tìm Chuyên Sâu</strong>.
                </p>
              </div>
            ) : (
              results.map((item) => {
                const isSelectedForPreview = previewItem?.id === item.id;
                const isSuccess = appliedSuccessId === item.id;
                const isSaving = savingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`relative p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      item.isBestMatch
                        ? 'bg-gradient-to-r from-apple-pink/15 via-purple-500/10 to-transparent border-apple-pink/40 shadow-lg shadow-apple-pink/10'
                        : isSelectedForPreview
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15'
                    }`}
                  >
                    {/* Best Match Ribbon / Like Badge */}
                    {item.isBestMatch && (
                      <div className="absolute -top-2.5 left-4 flex items-center gap-1.5 px-2.5 py-0.5 bg-gradient-to-r from-apple-pink to-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg border border-white/20 animate-in zoom-in-75">
                        <ThumbsUp className="w-3 h-3 fill-current" />
                        <span>Gợi Ý Phù Hợp Nhất ({item.matchScore}%)</span>
                      </div>
                    )}

                    {/* Left: Info & Badges */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.hasSynced ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                            <Mic2 className="w-3 h-3" />
                            <span>Synced (Karaoke)</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-700/50 text-neutral-400 border border-white/10 text-[10px] font-black uppercase tracking-wider">
                            <FileText className="w-3 h-3" />
                            <span>Lời văn bản</span>
                          </span>
                        )}

                        {/* Duration comparison */}
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(item.duration)}</span>
                          <span
                            className={
                              item.durationDiff <= 1.5
                                ? 'text-emerald-400 font-bold'
                                : item.durationDiff <= 4
                                ? 'text-amber-400'
                                : 'text-neutral-500'
                            }
                          >
                            ({item.durationDiff <= 1.0 ? 'Khớp 100%' : `Lệch ±${item.durationDiff.toFixed(1)}s`})
                          </span>
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-white truncate">{item.trackName || item.name}</h3>
                      <p className="text-xs font-medium text-neutral-300 truncate">
                        {item.artistName} {item.albumName ? `• ${item.albumName}` : ''}
                      </p>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPreviewItem(item)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelectedForPreview
                            ? 'bg-white/20 border-white/30 text-white'
                            : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
                        }`}
                        title="Xem trước nội dung lời bài hát"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem thử</span>
                      </button>

                      <button
                        onClick={() => handleApplyLyrics(item)}
                        disabled={isSaving || isSuccess}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer active:scale-95 ${
                          isSuccess
                            ? 'bg-emerald-600 text-white'
                            : item.isBestMatch
                            ? 'bg-apple-pink hover:bg-apple-pinkHover shadow-apple-pink/30'
                            : 'bg-neutral-800 hover:bg-apple-pink border border-white/10'
                        }`}
                        title="Tự động tải về, lưu file .lrc và áp dụng cho bài hát"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isSuccess ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <FolderDown className="w-3.5 h-3.5" />
                        )}
                        <span>{isSuccess ? 'Đã áp dụng!' : isSaving ? 'Đang lưu...' : 'Chọn & Áp dụng'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Preview Pane (Khi chọn xem thử) */}
          {previewItem && (
            <div className="w-full md:w-1/2 border-l border-white/10 bg-neutral-950/60 p-5 flex flex-col animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-apple-pink">Xem trước lời</span>
                  <h4 className="text-sm font-bold text-white truncate max-w-xs">{previewItem.trackName}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApplyLyrics(previewItem)}
                    className="flex items-center gap-1 px-3 py-1 bg-apple-pink hover:bg-apple-pinkHover text-white text-xs font-bold rounded-lg transition-all shadow cursor-pointer active:scale-95"
                  >
                    <FolderDown className="w-3.5 h-3.5" />
                    <span>Áp dụng ngay</span>
                  </button>
                  <button
                    onClick={() => setPreviewItem(null)}
                    className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
                    title="Đóng xem trước"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-y-auto py-4 space-y-2 font-medium text-xs leading-relaxed custom-scrollbar">
                {previewLines.length === 0 ? (
                  <p className="text-neutral-500 italic">Không có nội dung lời bài hát.</p>
                ) : (
                  previewLines.map((line, idx) => (
                    <div key={idx} className="flex items-baseline gap-3 py-0.5">
                      {line.time > 0 && (
                        <span className="text-[10px] font-mono text-apple-pink/80 tabular-nums shrink-0 w-10">
                          {formatTime(line.time)}
                        </span>
                      )}
                      <span className="text-neutral-200">{line.text || <Music className="w-3 h-3 text-neutral-500 inline opacity-60" />}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* 4. FOOTER NOTE */}
        <div className="p-3 px-5 border-t border-white/10 bg-neutral-900/80 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
            <span>File <strong>.lrc</strong> sẽ tự động được tạo cùng thư mục với file nhạc trên ổ cứng.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
