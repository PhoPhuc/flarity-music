import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Compass,
  Search,
  Sparkles,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  Music2,
  Film,
  User,
  Clock,
  Loader2,
  X,
  Shuffle,
  ChevronRight,
  Check,
  Volume2,
  Trash2,
  FolderOpen,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useInvalidateMusicQueries } from '../hooks/useMusicQueries';
import { tauriAPI } from '../utils/tauriBridge';
import { discoveryRecLRU, discoveryStreamLRU } from '../utils/lruCache';
import { SoundWave } from './SoundWave';
import { extractCleanArtistAndTitle, detectVietnameseShow, normalizeCanonicalString } from '../utils/artistParser';
import type { Track, DiscoveryTrack, DownloadItem, ArtistProfile } from '../types';

let globalActiveRecommendations: { data: DiscoveryTrack[]; artists: string[]; exp: number } | null = null;

const DOWNLOAD_HISTORY_STORAGE_KEY = 'musicccc_download_history_v2';

const loadPersistentDownloadHistory = (): DownloadItem[] => {
  try {
    const raw = localStorage.getItem(DOWNLOAD_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[Discovery] Failed to load download history:', err);
    return [];
  }
};

const savePersistentDownloadHistory = (items: DownloadItem[]) => {
  try {
    const slice = items.slice(0, 300);
    localStorage.setItem(DOWNLOAD_HISTORY_STORAGE_KEY, JSON.stringify(slice));
  } catch (err) {
    console.warn('[Discovery] Failed to save download history:', err);
  }
};

export const MusicDiscoveryView: React.FC = () => {
  const { tracks, artistProfiles, playTrack, isPlaying, pauseAudio, refreshLibrary, openMv } = usePlayer();
  const { invalidateAll } = useInvalidateMusicQueries();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveryTrack[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [recommendedTracks, setRecommendedTracks] = useState<DiscoveryTrack[]>(() => globalActiveRecommendations?.data || []);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [sampledArtists, setSampledArtists] = useState<string[]>(() => globalActiveRecommendations?.artists || []);
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('random_all');

  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [artistModalSearch, setArtistModalSearch] = useState('');

  const [recSubCategory, setRecSubCategory] = useState<'all' | 'audio' | 'video'>('all');

  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isResolvingStream, setIsResolvingStream] = useState<boolean>(false);
  const [previewAudioProgress, setPreviewAudioProgress] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [downloadQueue, setDownloadQueue] = useState<DownloadItem[]>(() => loadPersistentDownloadHistory());
  const [activeTab, setActiveTab] = useState<'discovery' | 'downloads'>('discovery');

  useEffect(() => {
    savePersistentDownloadHistory(downloadQueue);
  }, [downloadQueue]);

  const releasePreviewAudio = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current.load();
      previewAudioRef.current = null;
    }
    setPreviewTrackId(null);
    setPreviewAudioProgress(0);
    setIsResolvingStream(false);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        releasePreviewAudio();
        discoveryRecLRU.pruneExpired();
        discoveryStreamLRU.pruneExpired();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releasePreviewAudio();
    };
  }, [releasePreviewAudio]);

  useEffect(() => {
    if (isPlaying && previewAudioRef.current) {
      releasePreviewAudio();
    }
  }, [isPlaying, releasePreviewAudio]);

  const handleTogglePreview = async (track: DiscoveryTrack) => {
    if (previewTrackId === track.id) {
      releasePreviewAudio();
      return;
    }

    if (isPlaying) pauseAudio();
    releasePreviewAudio();
    setPreviewTrackId(track.id);
    setIsResolvingStream(true);
    setPreviewAudioProgress(0);

    try {
      let directUrl = discoveryStreamLRU.get(track.id);
      if (!directUrl) {
        const resolved = await tauriAPI.getYoutubePreviewStreamUrl(track.youtubeUrl || track.id);
        if (resolved) {
          directUrl = resolved;
          discoveryStreamLRU.set(track.id, resolved);
        }
      }

      if (!directUrl) throw new Error('Preview stream failed');

      const audio = new Audio(directUrl);
      previewAudioRef.current = audio;
      setIsResolvingStream(false);
      audio.ontimeupdate = () => {
        if (audio.duration) setPreviewAudioProgress((audio.currentTime / audio.duration) * 100);
      };
      audio.onended = () => releasePreviewAudio();
      audio.onerror = () => releasePreviewAudio();
      await audio.play();
    } catch (err) {
      releasePreviewAudio();
    }
  };

  const normalizeCanonical = (str: string): string => {
    return normalizeCanonicalString(str);
  };

  const getPrimaryArtistNorm = (artistStr: string): string => {
    if (!artistStr) return '';
    const parts = artistStr.split(/\s*(?:feat\.?|ft\.?|featuring|with|x|X|vs\.?|presents?|prod\.?|by)\s+|\s+(?:-)\s+|[,;/|&+\\•·~]+\s*/i);
    return normalizeCanonicalString(parts[0] || artistStr);
  };

  const existingTrackMap = useMemo(() => {
    const map = new Map<string, Track>();
    for (const t of tracks) {
      const normTitle = normalizeCanonical(t.title);
      const normArtist = getPrimaryArtistNorm(t.artist);
      if (normTitle && normArtist) {
        map.set(`${normTitle}__${normArtist}`, t);
      }
    }
    return map;
  }, [tracks]);

  const getTrackInLibrary = useCallback(
    (title: string, artist: string): Track | null => {
      const normTitle = normalizeCanonical(title);
      const normArtist = getPrimaryArtistNorm(artist);
      if (!normTitle) return null;
      return existingTrackMap.get(`${normTitle}__${normArtist}`) || null;
    },
    [existingTrackMap]
  );

  const isMusicVideoTrack = (t: DiscoveryTrack): boolean => {
    const raw = `${t.title} ${t.artist}`.toLowerCase();
    return (
      raw.includes('official music video') || raw.includes('official video') ||
      raw.includes('music video') || raw.includes('mv') ||
      raw.includes('lyric video') || raw.includes('visualizer')
    );
  };

  const fetchSmartRecommendations = useCallback(
    async (forceRefresh = false, explicitArtist?: string) => {
      setIsLoadingRecs(true);
      const now = Date.now();
      const targetArtist = explicitArtist !== undefined ? explicitArtist : selectedArtistFilter;
      let artistsToQuery: string[] = [];

      if (targetArtist === 'random_all') {
        const topArtists = artistProfiles.slice(0, 15).map((a) => a.name);
        const shuffled = [...topArtists].sort(() => Math.random() - 0.5);
        artistsToQuery = shuffled.slice(0, Math.min(4, shuffled.length));
        if (artistsToQuery.length === 0) artistsToQuery = ['Sơn Tùng M-TP', 'Đen', 'Vũ.', 'Taylor Swift'];
      } else {
        artistsToQuery = [targetArtist];
      }

      setSampledArtists(artistsToQuery);
      const cacheKey = `recs:${targetArtist}:${artistsToQuery.sort().join(',')}`;

      if (!forceRefresh && globalActiveRecommendations && globalActiveRecommendations.exp > now) {
        if (targetArtist === 'random_all' || globalActiveRecommendations.artists.includes(targetArtist)) {
          setRecommendedTracks(globalActiveRecommendations.data);
          setIsLoadingRecs(false);
          return;
        }
      }

      try {
        const fetchedItems = await tauriAPI.getArtistDiscoveryRecommendations(
          artistsToQuery,
          targetArtist === 'random_all' ? 8 : 14
        );
        if (fetchedItems && fetchedItems.length > 0) {
          const seenCanonical = new Set<string>();
          const filteredResults = fetchedItems.filter((item: any) => {
            if ((item.duration || 0) > 420) return false;
            const cleanMeta = extractCleanArtistAndTitle(item.title, item.artist, targetArtist !== 'random_all' ? targetArtist : undefined);
            const canonicalKey = `${normalizeCanonical(cleanMeta.title)}__${getPrimaryArtistNorm(cleanMeta.artist)}`;
            if (existingTrackMap.has(canonicalKey) || seenCanonical.has(canonicalKey)) return false;
            seenCanonical.add(canonicalKey);
            return true;
          });

          const formatted: DiscoveryTrack[] = filteredResults.map((item: any) => {
            const cleanMeta = extractCleanArtistAndTitle(item.title, item.artist, targetArtist !== 'random_all' ? targetArtist : undefined);
            return {
              id: item.id || Math.random().toString(),
              title: cleanMeta.title,
              artist: cleanMeta.artist,
              album: cleanMeta.album || item.album || 'YouTube Music',
              duration: item.duration || 0,
              thumbnail: item.thumbnail,
              source: 'youtube',
              youtubeUrl: item.url,
              downloadStatus: 'idle',
            };
          });

          discoveryRecLRU.set(cacheKey, formatted);
          if (targetArtist === 'random_all') globalActiveRecommendations = { data: formatted, artists: artistsToQuery, exp: now + 15 * 60 * 1000 };
          setRecommendedTracks(formatted);
        } else {
          setRecommendedTracks([]);
        }
      } catch (err) {
        console.warn('[Discovery] Failed to fetch:', err);
      } finally {
        setIsLoadingRecs(false);
      }
    },
    [artistProfiles, selectedArtistFilter, existingTrackMap]
  );

  useEffect(() => {
    if (recommendedTracks.length === 0) fetchSmartRecommendations();
  }, [fetchSmartRecommendations, recommendedTracks.length]);

  const handleSelectArtistFromModal = (artistName: string) => {
    setSelectedArtistFilter(artistName);
    setIsArtistModalOpen(false);
    fetchSmartRecommendations(false, artistName);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const results = await tauriAPI.searchYouTubeMusic(searchQuery.trim(), 24);
      const formatted: DiscoveryTrack[] = results.map((item: any) => {
        const cleanMeta = extractCleanArtistAndTitle(item.title, item.artist);
        return {
          id: item.id || Math.random().toString(),
          title: cleanMeta.title,
          artist: cleanMeta.artist,
          album: cleanMeta.album || item.album || 'YouTube Music',
          duration: item.duration || 0,
          thumbnail: item.thumbnail,
          source: 'youtube',
          youtubeUrl: item.url,
          downloadStatus: 'idle',
        };
      });
      setSearchResults(formatted);
    } catch (err: any) {
      setSearchError(err?.toString() || 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (track: DiscoveryTrack, type: 'audio' | 'video' = 'audio') => {
    const downloadId = `${track.id}-${type}-${Date.now()}`;
    const estSizeMB = (type === 'video' ? Math.max(12, track.duration * 0.32) : Math.max(3.2, track.duration * 0.04)).toFixed(1);
    const cleanMeta = extractCleanArtistAndTitle(track.title, track.artist, selectedArtistFilter !== 'random_all' ? selectedArtistFilter : undefined);

    const newTask: DownloadItem = {
      id: downloadId,
      trackId: track.id,
      title: cleanMeta.title,
      artist: cleanMeta.artist,
      album: cleanMeta.album || track.album,
      thumbnail: track.thumbnail,
      downloadType: type,
      progress: 0,
      status: 'downloading',
      speed: 'Đang kết nối...',
      size: `${estSizeMB} MB`,
      startedAt: Date.now(),
      quality: type === 'video' ? '1080p MP4' : '320 kbps MP3',
    };

    setDownloadQueue((prev) => [newTask, ...prev]);

    const updateCardStatus = (status: 'downloading' | 'completed' | 'error') => {
      setSearchResults((prev) => prev.map((t) => (t.id === track.id ? { ...t, downloadStatus: status } : t)));
      setRecommendedTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, downloadStatus: status } : t)));
    };

    try {
      const downloadResult = await tauriAPI.downloadYouTubeTrack({
        url: track.youtubeUrl || track.id,
        title: cleanMeta.title,
        artist: cleanMeta.artist,
        downloadType: type,
        thumbnail: track.thumbnail,
      });

      if (downloadResult && downloadResult.success !== false) {
        setDownloadQueue((prev) => prev.map((item) => item.id === downloadId ? { ...item, status: 'completed', progress: 100, speed: 'Hoàn tất', completedAt: Date.now(), filePath: downloadResult.filePath || downloadResult.file_path } : item));
        updateCardStatus('completed');
        await refreshLibrary();
        invalidateAll();
      } else throw new Error('Download failed');
    } catch (err: any) {
      updateCardStatus('error');
      setDownloadQueue((prev) => prev.map((item) => item.id === downloadId ? { ...item, status: 'error', error: err?.toString() } : item));
    }
  };

  const handleRemoveFromHistory = (id: string) => setDownloadQueue((prev) => prev.filter((item) => item.id !== id));
  const handleClearAllHistory = () => setDownloadQueue([]);

  const filteredModalArtists = useMemo(() => {
    if (!artistModalSearch.trim()) return artistProfiles;
    const q = artistModalSearch.toLowerCase();
    return artistProfiles.filter((a) => a.name.toLowerCase().includes(q));
  }, [artistProfiles, artistModalSearch]);

  const unaddedRecommendations = useMemo(() => recommendedTracks.filter((t) => !getTrackInLibrary(t.title, t.artist)), [recommendedTracks, getTrackInLibrary]);

  const { audioRecommendations, mvRecommendations } = useMemo(() => {
    const audio: DiscoveryTrack[] = [];
    const mv: DiscoveryTrack[] = [];
    unaddedRecommendations.forEach((t) => (isMusicVideoTrack(t) ? mv.push(t) : audio.push(t)));
    return { audioRecommendations: audio, mvRecommendations: mv };
  }, [unaddedRecommendations]);

  const displayedRecommendations = useMemo(() => {
    if (recSubCategory === 'audio') return audioRecommendations;
    if (recSubCategory === 'video') return mvRecommendations;
    return unaddedRecommendations;
  }, [recSubCategory, audioRecommendations, mvRecommendations, unaddedRecommendations]);

  const totalDownloadStats = useMemo(() => {
    const completed = downloadQueue.filter((d) => d.status === 'completed');
    let totalMB = 0;
    for (const item of completed) {
      const match = item.size?.match(/([\d.]+)\s*MB/i);
      if (match) totalMB += parseFloat(match[1]);
    }
    return { completedCount: completed.length, totalMB: totalMB.toFixed(1) };
  }, [downloadQueue]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 max-w-7xl mx-auto select-none">
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-br from-neutral-900/90 via-neutral-900/60 to-purple-950/40 border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-apple-pink/20 text-apple-pink border border-apple-pink/30 shadow-sm"><Compass className="w-5 h-5" /></div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Khám Phá & Tải Nhạc</h1>
              </div>
              <p className="text-xs sm:text-sm text-neutral-300">Tìm kiếm, nghe thử và tải về thư viện với Metadata chuẩn.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full text-xs text-neutral-300 shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Engine Sẵn Sàng (320kbps / 1080p)</span>
            </div>
          </div>
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên bài hát, nghệ sĩ hoặc dán link YouTube để tìm & tải..."
              className="w-full bg-neutral-950/80 hover:bg-neutral-950 border border-white/15 focus:border-apple-pink rounded-2xl pl-12 pr-28 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); setHasSearched(false); }} className="absolute right-24 top-1/2 -translate-y-1/2 p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            )}
            <button type="submit" disabled={isSearching || !searchQuery.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-apple-pink hover:bg-apple-pinkHover text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-apple-pink/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer">
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Tìm Kiếm</span>
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveTab('discovery')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'discovery' ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20' : 'bg-white/5 text-neutral-400 hover:text-white'}`}>
            <Sparkles className="w-4 h-4" /> <span>Khám Phá & Gợi Ý</span>
          </button>
          <button onClick={() => setActiveTab('downloads')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 relative ${activeTab === 'downloads' ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20' : 'bg-white/5 text-neutral-400 hover:text-white'}`}>
            <DownloadCloud className="w-4 h-4" /> <span>Lịch Sử Tải Về</span>
            {downloadQueue.length > 0 && <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{downloadQueue.length}</span>}
          </button>
        </div>
        {activeTab === 'discovery' && (
          <button onClick={() => fetchSmartRecommendations(true)} disabled={isLoadingRecs || artistProfiles.length === 0} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-apple-pink transition-colors cursor-pointer disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRecs ? 'animate-spin' : ''}`} /> <span>Đổi Gợi Ý</span>
          </button>
        )}
      </div>

      {activeTab === 'discovery' && (
        <div className="space-y-10 animate-in fade-in duration-200">
          {hasSearched && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Search className="w-4 h-4 text-apple-pink" /> Kết Quả Tìm Kiếm: <span className="text-apple-pink">"{searchQuery}"</span></h3>
                <span className="text-xs text-neutral-400 font-mono">{searchResults.length} kết quả</span>
              </div>
              {isSearching ? <DiscoverySkeletonGrid count={12} /> : searchError ? <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3"><AlertCircle className="w-4 h-4" /> {searchError}</div> : searchResults.length === 0 ? <div className="p-8 text-center text-xs text-neutral-500 border border-white/5 rounded-2xl bg-white/[0.02]">Không tìm thấy.</div> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {searchResults.map((track) => (
                    <VerticalDiscoveryCard key={track.id} track={track} localTrack={getTrackInLibrary(track.title, track.artist)} isPreviewPlaying={previewTrackId === track.id} isResolvingStream={isResolvingStream && previewTrackId === track.id} previewProgress={previewTrackId === track.id ? previewAudioProgress : 0} onTogglePreview={() => handleTogglePreview(track)} onDownload={(type) => handleDownload(track, type)} onPlayLocal={(t) => playTrack(t)} onOpenMv={(t) => openMv(t)} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-apple-pink" /> Bài Mới Chưa Thêm Theo Nghệ Sĩ</h3>
              </div>
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 text-xs shrink-0">
                <button onClick={() => setRecSubCategory('all')} className={`px-3 py-1 rounded-lg font-medium transition-all ${recSubCategory === 'all' ? 'bg-apple-pink text-white' : 'text-neutral-400'}`}>Tất Cả ({unaddedRecommendations.length})</button>
                <button onClick={() => setRecSubCategory('audio')} className={`px-3 py-1 rounded-lg font-medium transition-all ${recSubCategory === 'audio' ? 'bg-apple-pink text-white' : 'text-neutral-400'}`}>Audio ({audioRecommendations.length})</button>
                <button onClick={() => setRecSubCategory('video')} className={`px-3 py-1 rounded-lg font-medium transition-all ${recSubCategory === 'video' ? 'bg-apple-pink text-white' : 'text-neutral-400'}`}>MV ({mvRecommendations.length})</button>
              </div>
            </div>
            {isLoadingRecs ? <DiscoverySkeletonGrid count={12} /> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayedRecommendations.map((track) => (
                  <VerticalDiscoveryCard key={track.id} track={track} localTrack={getTrackInLibrary(track.title, track.artist)} isPreviewPlaying={previewTrackId === track.id} isResolvingStream={isResolvingStream && previewTrackId === track.id} previewProgress={previewTrackId === track.id ? previewAudioProgress : 0} onTogglePreview={() => handleTogglePreview(track)} onDownload={(type) => handleDownload(track, type)} onPlayLocal={(t) => playTrack(t)} onOpenMv={(t) => openMv(t)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'downloads' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white/[0.02] border border-white/10">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DownloadCloud className="w-5 h-5 text-apple-pink" />
                Lịch Sử Tải Xuống
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Lưu trữ lâu dài danh sách bài hát đã tải về máy tính kèm thời gian và dung lượng thực tế.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 text-xs">
                <div className="flex items-center gap-1.5 text-neutral-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{totalDownloadStats.completedCount} bài hát</span>
                </div>
                <div className="w-1 h-3 bg-white/10 rounded-full" />
                <div className="flex items-center gap-1.5 text-neutral-300 font-mono">
                  <HardDrive className="w-3.5 h-3.5 text-apple-pink" />
                  <span>{totalDownloadStats.totalMB} MB</span>
                </div>
              </div>

              {downloadQueue.length > 0 && (
                <button
                  onClick={handleClearAllHistory}
                  className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-white/5 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Xóa toàn bộ lịch sử tải về"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa tất cả</span>
                </button>
              )}
            </div>
          </div>

          {downloadQueue.length === 0 ? (
            <div className="p-12 text-center text-neutral-500 border border-white/5 rounded-3xl bg-white/[0.02] space-y-2">
              <DownloadCloud className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-medium">Chưa có bài hát nào trong lịch sử tải.</p>
              <p className="text-[11px] text-neutral-600">
                Nhấn nút "Tải Audio" hoặc "Tải MV" trên bất kỳ bài hát nào để tải về máy tính.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {downloadQueue.map((item) => {
                const isCompleted = item.status === 'completed';
                const isError = item.status === 'error';
                const isDownloading = item.status === 'downloading';

                const displayDate = item.completedAt || item.startedAt
                  ? new Date(item.completedAt || item.startedAt!).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : 'Vừa xong';

                const localMatched = tracks.find(
                  (t) => normalizeCanonical(t.title) === normalizeCanonical(item.title)
                );

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-xl bg-neutral-800 shrink-0 overflow-hidden border border-white/10 shadow flex items-center justify-center">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Music2 className="w-5 h-5 text-neutral-600" />
                        )}
                        {isDownloading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                            <Loader2 className="w-4 h-4 text-apple-pink animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-apple-pink transition-colors">
                            {item.title}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              item.downloadType === 'video'
                                ? 'bg-purple-600/20 text-purple-300 border border-purple-600/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {item.downloadType === 'video' ? 'Video MV MP4' : 'Audio MP3 320k'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                          <span className="truncate font-medium text-neutral-300">{item.artist}</span>
                          <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                          <span className="flex items-center gap-1 shrink-0 font-mono text-neutral-400">
                            <Calendar className="w-3 h-3 text-neutral-500" />
                            {displayDate}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-neutral-600 shrink-0" />
                          <span className="flex items-center gap-1 shrink-0 font-mono font-bold text-neutral-300">
                            <HardDrive className="w-3 h-3 text-apple-pink" />
                            {item.size || '4.5 MB'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isDownloading && (
                        <span className="text-xs font-bold text-apple-pink flex items-center gap-1.5 px-3 py-1 rounded-xl bg-apple-pink/10 border border-apple-pink/20">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tải...</span>
                        </span>
                      )}

                      {isCompleted && (
                        <div className="flex items-center gap-2">
                          {localMatched && (
                            <button
                              onClick={() => playTrack(localMatched)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              title="Phát bài hát"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Phát</span>
                            </button>
                          )}

                          {item.downloadType === 'video' && localMatched && (
                            <button
                              onClick={() => openMv(localMatched)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                              title="Xem video MV"
                            >
                              <Film className="w-3 h-3" />
                              <span>MV</span>
                            </button>
                          )}

                          {item.filePath && (
                            <button
                              onClick={() => tauriAPI.showInExplorer(item.filePath!)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-white/5"
                              title="Mở thư mục chứa file"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      {isError && (
                        <span
                          className="text-xs font-bold text-rose-400 px-3 py-1 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-1"
                          title={item.error}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Lỗi tải</span>
                        </span>
                      )}

                      <button
                        onClick={() => handleRemoveFromHistory(item.id)}
                        className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Xóa khỏi lịch sử"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isArtistModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-neutral-900 border border-white/15 rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white">Chọn Nghệ Sĩ Khám Phá</h3>
              <button onClick={() => setIsArtistModalOpen(false)}><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <input type="text" value={artistModalSearch} onChange={(e) => setArtistModalSearch(e.target.value)} placeholder="Tìm..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white" />
            <div className="max-h-80 overflow-y-auto space-y-2">
              <button onClick={() => handleSelectArtistFromModal('random_all')} className="w-full p-3 rounded-2xl bg-white/[0.02] text-left text-xs text-white">Tất cả nghệ sĩ</button>
              {filteredModalArtists.map((artist) => (
                <button key={artist.name} onClick={() => handleSelectArtistFromModal(artist.name)} className="w-full p-3 rounded-2xl bg-white/[0.02] text-left text-xs text-white">{artist.name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DiscoverySkeletonGrid: React.FC<{ count?: number }> = ({ count = 12 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-3 rounded-2xl bg-neutral-900/60 border border-white/10 flex flex-col justify-between gap-3">
          <div className="aspect-square w-full rounded-xl bg-white/10" />
          <div className="space-y-2"><div className="h-3 w-4/5 bg-white/10 rounded-md" /><div className="h-2.5 w-1/2 bg-white/5 rounded-md" /></div>
          <div className="h-8 rounded-xl bg-white/5" />
        </div>
      ))}
    </div>
  );
};

interface VerticalDiscoveryCardProps {
  track: DiscoveryTrack;
  localTrack: Track | null;
  isPreviewPlaying: boolean;
  isResolvingStream: boolean;
  previewProgress: number;
  onTogglePreview: () => void;
  onDownload: (type: 'audio' | 'video') => void;
  onPlayLocal: (track: Track) => void;
  onOpenMv: (track: Track) => void;
}

const VerticalDiscoveryCard: React.FC<VerticalDiscoveryCardProps> = ({
  track,
  localTrack,
  isPreviewPlaying,
  isResolvingStream,
  previewProgress,
  onTogglePreview,
  onDownload,
  onPlayLocal,
  onOpenMv,
}) => {
  const isDownloading = track.downloadStatus === 'downloading';
  const isCompleted = track.downloadStatus === 'completed' || !!localTrack;
  const hasMvAvailable = !!localTrack?.hasMv && !!localTrack?.mvPath;
  const isMv = track.title.toLowerCase().includes('mv') || track.title.toLowerCase().includes('official music video') || track.title.toLowerCase().includes('official video') || track.title.toLowerCase().includes('music video');
  const showMeta = useMemo(() => detectVietnameseShow(track.title, track.artist), [track.title, track.artist]);

  return (
    <div className="group relative p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 hover:border-apple-pink/40 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between gap-3">
      {/* 1. Square 1:1 Thumbnail Container */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shrink-0 shadow-md">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600">
            <Music2 className="w-8 h-8" />
          </div>
        )}

        {/* Preview Overlay Button & Wave Indicator */}
        <button
          onClick={onTogglePreview}
          disabled={isResolvingStream}
          className={`absolute inset-0 transition-opacity flex items-center justify-center cursor-pointer ${
            isPreviewPlaying ? 'bg-black/60 backdrop-blur-[1px] opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'
          }`}
          title={isPreviewPlaying ? 'Dừng nghe thử' : 'Nghe thử 30s'}
        >
          {isResolvingStream ? (
            <div className="w-10 h-10 rounded-full bg-apple-pink/80 text-white flex items-center justify-center shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : isPreviewPlaying ? (
            <div className="flex flex-col items-center gap-1.5">
              <SoundWave className="scale-125" />
              <span className="text-[9px] font-bold text-apple-pink bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
                Đang nghe thử
              </span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transform hover:scale-110 active:scale-95 transition-all">
              <Play className="w-4 h-4 ml-0.5 fill-current" />
            </div>
          )}
        </button>

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1 flex-wrap max-w-[85%]">
          {showMeta.show && (
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-apple-pink to-purple-600 text-white text-[9px] font-black uppercase tracking-wider shadow backdrop-blur-sm truncate">
              {showMeta.show.shortCode || showMeta.show.canonicalName}
            </span>
          )}
          {isMv ? (
            <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider shadow backdrop-blur-sm">
              MV
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-neutral-200 text-[9px] font-bold uppercase tracking-wider shadow backdrop-blur-sm">
              Audio
            </span>
          )}
        </div>

        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-neutral-300 text-[9px] font-mono font-medium backdrop-blur-sm">
          {Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}
        </div>

        {/* Progress Bar when preview is active */}
        {isPreviewPlaying && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div
              className="h-full bg-apple-pink transition-all duration-150"
              style={{ width: `${previewProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* 2. Track Title & Clean Artist */}
      <div className="min-w-0 space-y-1 flex-1">
        <h4
          className="text-xs font-bold text-white group-hover:text-apple-pink transition-colors line-clamp-2 leading-snug min-h-[2rem]"
          title={track.title}
        >
          {track.title}
        </h4>
        <p className="text-[11px] text-neutral-400 truncate" title={track.artist}>
          {track.artist}
        </p>
      </div>

      {/* 3. Action Buttons */}
      <div className="pt-2 border-t border-white/5">
        {isCompleted && localTrack ? (
          <div className="w-full flex items-center gap-1.5">
            <button
              onClick={() => onPlayLocal(localTrack)}
              className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Phát</span>
            </button>

            {hasMvAvailable ? (
              <button
                onClick={() => onOpenMv(localTrack)}
                className="py-1.5 px-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/30 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                title="Mở Video MV Toàn Màn Hình"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Xem MV</span>
              </button>
            ) : (
              <button
                onClick={() => onDownload('video')}
                className="py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white border border-white/10 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                title="Tải Thêm Video MV (.mp4)"
              >
                <Film className="w-3.5 h-3.5" />
                <span>Tải MV</span>
              </button>
            )}
          </div>
        ) : isDownloading ? (
          <div className="w-full py-1.5 text-center text-xs font-bold text-apple-pink flex items-center justify-center gap-1.5 rounded-xl bg-apple-pink/15 border border-apple-pink/30 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Đang tải...</span>
          </div>
        ) : (
          <div className="w-full flex items-center gap-1.5">
            <button
              onClick={() => onDownload('audio')}
              className="flex-1 py-1.5 px-2 rounded-xl text-xs font-bold bg-apple-pink hover:bg-apple-pinkHover text-white shadow-sm shadow-apple-pink/20 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              title="Tải Bản Thu Âm Audio MP3"
            >
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Tải Audio</span>
            </button>

            <button
              onClick={() => onDownload('video')}
              className="py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white border border-white/10 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
              title="Tải Video MV (.mp4)"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Tải MV</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
