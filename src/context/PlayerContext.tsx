import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { Track, Album, Playlist, ViewMode, LyricLine, ArtistProfile } from '../types';
import { parseLrc } from '../utils/lrcParser';
import { convertFileSrc, tauriAPI } from '../utils/tauriBridge';
import { useAudioTelemetry } from '../hooks/useAudioTelemetry';
import { useTracksQuery, usePlaylistsQuery, useInvalidateMusicQueries } from '../hooks/useMusicQueries';
import { extractArtistProfiles, groupTracksIntoUnifiedAlbums } from '../utils/artistParser';
import { BoundedExpiringSet } from '../utils/boundedExpiringSet';
import { getSmartQueueRecommendations } from '../utils/smartRecommendations';

interface PlayerContextType {
  tracks: Track[];
  albums: Album[];
  playlists: Playlist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  lyrics: LyricLine[];
  currentLyricIndex: number;
  viewMode: ViewMode;
  selectedAlbum: Album | null;
  selectedArtist: string | null;
  selectedPlaylist: Playlist | null;
  queue: Track[];
  isScanning: boolean;
  isLoadingLibrary: boolean;
  isLyricsOpen: boolean;
  newTrackIds: Set<string>;
  updatedTrackIds: Set<string>;
  newAlbumKeys: Set<string>;
  updatedAlbumKeys: Set<string>;
  clearNewBadges: () => void;
  clearUpdatedBadges: () => void;
  dismissAlbumBadges: (albumKey: string) => void;
  triggerMemoryShrink: () => Promise<void>;

  // Audio Quality Modal
  isAudioQualityModalOpen: boolean;
  audioQualityModalTrack: Track | null;
  audioQualityModalInitialStandardId?: string;
  openAudioQualityModal: (track?: Track | null, standardId?: string) => void;
  closeAudioQualityModal: () => void;

  // Settings Modal
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  // Multi-Artist Profiles
  artistProfiles: ArtistProfile[];

  // MV Video Mode
  isMvOpen: boolean;
  openMv: (track?: Track) => void;
  closeMv: (shouldResumeAudio?: boolean) => void;

  // Lyrics Search Modal
  isLyricsSearchOpen: boolean;
  lyricsSearchTrack: Track | null;
  openLyricsSearch: (track?: Track | null) => void;
  closeLyricsSearch: () => void;
  saveAndApplyLyrics: (trackId: string, lrcContent: string) => Promise<void>;

  // Live Lyric Time-Offset
  lyricOffset: number;
  adjustLyricOffset: (deltaSeconds: number) => void;
  resetLyricOffset: () => void;

  // Batch Lyrics Modal
  isBatchLyricsOpen: boolean;
  batchLyricsAlbum: Album | null;
  openBatchLyricsForAlbum: (album: Album) => void;
  closeBatchLyrics: () => void;

  // Navigation & Reload System
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  navigateTo: (entry: {
    viewMode: ViewMode;
    selectedAlbum?: Album | null;
    selectedArtist?: string | null;
    selectedPlaylist?: Playlist | null;
  }) => void;
  isReloading: boolean;

  // Actions
  selectFolderAndScan: () => Promise<void>;
  playTrack: (track: Track, trackList?: Track[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setViewMode: (mode: ViewMode) => void;
  setLyricsOpen: (open: boolean) => void;
  setSelectedAlbum: (album: Album | null) => void;
  setSelectedArtist: (artist: string | null) => void;
  setSelectedPlaylist: (playlist: Playlist | null) => void;
  createPlaylist: (name: string, description?: string, coverArt?: string) => Promise<void>;
  addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  addAlbumToPlaylist: (playlistId: string, album: Album) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  renamePlaylist: (playlistId: string, newName: string) => Promise<void>;
  mergeAlbum: (sourceAlbum: Album, targetAlbum: Album) => Promise<void>;
  playNext: (track: Track) => void;
  addToQueue: (track: Track) => void;
  addMultipleToQueue: (tracks: Track[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  showInExplorer: (filePath: string) => Promise<void>;
  deleteTrack: (trackId: string, filePath: string, permanentDelete: boolean) => Promise<void>;
  deleteAlbum: (album: Album, permanentDelete: boolean) => Promise<void>;
  updateTrackMetadata: (trackId: string, updates: any) => Promise<void>;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  refreshLibrary: () => Promise<void>;
  attachMvToTrack: (trackId: string) => Promise<void>;
  attachLrcToTrack: (trackId: string) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Extend Window declaration cho Typescript Electron API
declare global {
  interface Window {
    electronAPI?: {
      selectMusicFolder: () => Promise<string | null>;
      scanFolder: (folderPath: string) => Promise<Track[]>;
      getSavedTracks: () => Promise<Track[]>;
      readLrcFile: (lrcPath: string) => Promise<string | null>;
      selectMvFile: () => Promise<string | null>;
      selectLrcFile: () => Promise<string | null>;
      attachLrcFile: (trackId: string, lrcPath: string) => Promise<Track[]>;
      saveAndAttachLrc: (trackId: string, lrcContent: string) => Promise<Track[]>;
      attachMvFile: (trackId: string, mvPath: string) => Promise<Track[]>;
      logPlayRecord: (input: {
        songId: string;
        songTitle: string;
        artistName: string;
        albumArt?: string;
        durationListened: number;
        isValidPlay: boolean;
      }) => Promise<boolean>;
      getAnalyticsStats: (range: string) => Promise<any>;
      onAnalyticsUpdated: (callback: () => void) => () => void;
      getPlaylists: () => Promise<Playlist[]>;
      createPlaylist: (name: string, description?: string, coverArt?: string) => Promise<Playlist>;
      addTrackToPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
      removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<Playlist[]>;
      deletePlaylist: (playlistId: string) => Promise<Playlist[]>;
      renamePlaylist: (playlistId: string, newName: string) => Promise<Playlist[]>;
      mergeAlbum: (sourceAlbumName: string, sourceArtist: string, targetAlbumName: string, targetArtist: string) => Promise<Track[]>;
      showInExplorer: (filePath: string) => Promise<boolean>;
      deleteTrackFile: (trackId: string, filePath: string, permanentDelete: boolean) => Promise<boolean>;
      updateTrackMetadata: (trackId: string, updates: any) => Promise<boolean>;
      recordTrackTransition?: (fromId: string, toId: string) => Promise<boolean>;
      getSmartRecommendation?: (
        currentId: string,
        artist: string,
        genre?: string,
        year?: number,
        bpm?: number
      ) => Promise<Track | null>;
    };
  }
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState<number>(-1);
  const [viewMode, setViewModeState] = useState<ViewMode>('home');
  const [selectedAlbum, setSelectedAlbumState] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtistState] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylistState] = useState<Playlist | null>(null);

  // Navigation History Stack
  const [history, setHistory] = useState<Array<{
    viewMode: ViewMode;
    selectedAlbum: Album | null;
    selectedArtist: string | null;
    selectedPlaylist: Playlist | null;
  }>>([
    { viewMode: 'home', selectedAlbum: null, selectedArtist: null, selectedPlaylist: null }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const historyIndexRef = useRef<number>(0);
  const historyRef = useRef<Array<{
    viewMode: ViewMode;
    selectedAlbum: Album | null;
    selectedArtist: string | null;
    selectedPlaylist: Playlist | null;
  }>>([
    { viewMode: 'home', selectedAlbum: null, selectedArtist: null, selectedPlaylist: null }
  ]);
  const [isReloading, setIsReloading] = useState<boolean>(false);

  const [queue, setQueue] = useState<Track[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(true);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);

  // Khởi tạo Bounded Expiring Sets trong Refs để tránh re-render liên tục và chống leak RAM
  const newTracksSetRef = useRef(new BoundedExpiringSet({ maxSize: 64, ttlMs: 5 * 60 * 1000 }));
  const updatedTracksSetRef = useRef(new BoundedExpiringSet({ maxSize: 64, ttlMs: 5 * 60 * 1000 }));
  const newAlbumsSetRef = useRef(new BoundedExpiringSet({ maxSize: 32, ttlMs: 5 * 60 * 1000 }));
  const updatedAlbumsSetRef = useRef(new BoundedExpiringSet({ maxSize: 32, ttlMs: 5 * 60 * 1000 }));

  // Đồng bộ ra State Set<string> cho UI render
  const [newTrackIds, setNewTrackIds] = useState<Set<string>>(() => new Set());
  const [updatedTrackIds, setUpdatedTrackIds] = useState<Set<string>>(() => new Set());
  const [newAlbumKeys, setNewAlbumKeys] = useState<Set<string>>(() => new Set());
  const [updatedAlbumKeys, setUpdatedAlbumKeys] = useState<Set<string>>(() => new Set());

  const syncBadgesState = useCallback(() => {
    setNewTrackIds(newTracksSetRef.current.toSet());
    setUpdatedTrackIds(updatedTracksSetRef.current.toSet());
    setNewAlbumKeys(newAlbumsSetRef.current.toSet());
    setUpdatedAlbumKeys(updatedAlbumsSetRef.current.toSet());
  }, []);

  const clearNewBadges = useCallback(() => {
    newTracksSetRef.current.clear();
    newAlbumsSetRef.current.clear();
    syncBadgesState();
  }, [syncBadgesState]);

  const clearUpdatedBadges = useCallback(() => {
    updatedTracksSetRef.current.clear();
    updatedAlbumsSetRef.current.clear();
    syncBadgesState();
  }, [syncBadgesState]);

  const dismissAlbumBadges = useCallback((albumKey: string) => {
    newAlbumsSetRef.current.delete(albumKey);
    updatedAlbumsSetRef.current.delete(albumKey);
    syncBadgesState();
  }, [syncBadgesState]);

  // Bộ dọn dẹp định kỳ (Prune Timer mỗi 60s)
  useEffect(() => {
    const timer = setInterval(() => {
      newTracksSetRef.current.prune();
      updatedTracksSetRef.current.prune();
      newAlbumsSetRef.current.prune();
      updatedAlbumsSetRef.current.prune();
      syncBadgesState();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [syncBadgesState]);

  // ===================== TÍCH HỢP VISIBILITYCHANGE & MEMORY SHRINK =====================
  const triggerMemoryShrink = useCallback(async () => {
    try {
      newTracksSetRef.current.prune();
      updatedTracksSetRef.current.prune();
      syncBadgesState();
      await tauriAPI.shrinkMemory();
    } catch (err) {
      console.warn('[PlayerContext] shrinkMemory invocation:', err);
    }
  }, [syncBadgesState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Người dùng đã thu nhỏ cửa sổ app xuống Taskbar hoặc chuyển sang app khác
        triggerMemoryShrink();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerMemoryShrink]);
  // Audio Quality Modal State
  const [isAudioQualityModalOpen, setIsAudioQualityModalOpen] = useState<boolean>(false);
  const [audioQualityModalTrack, setAudioQualityModalTrack] = useState<Track | null>(null);
  const [audioQualityModalInitialStandardId, setAudioQualityModalInitialStandardId] = useState<string | undefined>(undefined);

  const openAudioQualityModal = useCallback((track?: Track | null, standardId?: string) => {
    setAudioQualityModalTrack(track !== undefined ? track : activeTrackRef.current);
    setAudioQualityModalInitialStandardId(standardId);
    setIsAudioQualityModalOpen(true);
  }, []);

  const closeAudioQualityModal = useCallback(() => {
    setIsAudioQualityModalOpen(false);
  }, []);

  // Lyrics Search Modal State
  const [isLyricsSearchOpen, setIsLyricsSearchOpen] = useState<boolean>(false);
  const [lyricsSearchTrack, setLyricsSearchTrack] = useState<Track | null>(null);

  const openLyricsSearch = useCallback((track?: Track | null) => {
    setLyricsSearchTrack(track !== undefined ? track : activeTrackRef.current);
    setIsLyricsSearchOpen(true);
  }, []);

  const closeLyricsSearch = useCallback(() => {
    setIsLyricsSearchOpen(false);
    setLyricsSearchTrack(null);
  }, []);

  // Live Lyric Time-Offset (giây, vd +0.5s hoặc -0.2s)
  const [lyricOffset, setLyricOffset] = useState<number>(0);
  const adjustLyricOffset = useCallback((deltaSeconds: number) => {
    setLyricOffset(prev => Math.round((prev + deltaSeconds) * 10) / 10);
  }, []);
  const resetLyricOffset = useCallback(() => {
    setLyricOffset(0);
  }, []);

  // Batch Album Lyrics Fetcher Modal
  const [isBatchLyricsOpen, setIsBatchLyricsOpen] = useState<boolean>(false);
  const [batchLyricsAlbum, setBatchLyricsAlbum] = useState<Album | null>(null);
  const openBatchLyricsForAlbum = useCallback((album: Album) => {
    setBatchLyricsAlbum(album);
    setIsBatchLyricsOpen(true);
  }, []);
  const closeBatchLyrics = useCallback(() => {
    setIsBatchLyricsOpen(false);
    setBatchLyricsAlbum(null);
  }, []);

  // Reset offset khi chuyển bài hát
  useEffect(() => {
    setLyricOffset(0);
  }, [currentTrack?.id]);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  // MV Video Mode State
  const [isMvOpen, setIsMvOpen] = useState<boolean>(false);
  const isMvOpenRef = useRef<boolean>(false);

  useEffect(() => {
    isMvOpenRef.current = isMvOpen;
  }, [isMvOpen]);

  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const activeTrackRef = useRef<Track | null>(null);
  const { flushTelemetry } = useAudioTelemetry({
    audio: audioRef.current,
    track: currentTrack,
  });

  // Ref để tránh re-render khi timeupdate - chỉ setState khi cần thiết
  const currentTimeRef = useRef<number>(0);
  const lyricsRef = useRef<LyricLine[]>([]);
  const repeatRef = useRef<'off' | 'all' | 'one'>('off');
  const queueRef = useRef<Track[]>([]);
  const shuffleRef = useRef<boolean>(false);
  const hasFetchedRecommendationRef = useRef<boolean>(false);

  // Đồng bộ refs với state để tránh stale closures trong audio listeners
  useEffect(() => { lyricsRef.current = lyrics; }, [lyrics]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

  // Tính albums bằng useMemo thay vì state riêng – sử dụng >= 95% Fuzzy Similarity & Multi-Artist Unification Engine
  const albums = useMemo<Album[]>(() => {
    if (tracks.length === 0) return [];
    return groupTracksIntoUnifiedAlbums(tracks);
  }, [tracks]);

  // Tính danh sách Hồ sơ Nghệ sĩ (hỗ trợ phân tách feat/nhiều nghệ sĩ)
  const artistProfiles = useMemo<ArtistProfile[]>(() => {
    if (tracks.length === 0) return [];
    return extractArtistProfiles(tracks);
  }, [tracks]);

  const { data: fetchedTracks, isLoading: isTracksLoading } = useTracksQuery();
  const { data: fetchedPlaylists, isLoading: isPlaylistsLoading } = usePlaylistsQuery();
  const { invalidateTracks, invalidatePlaylists, invalidateAll } = useInvalidateMusicQueries();

  // Đồng bộ bài hát từ CSDL vào RAM và lập tức giải phóng màn hình chờ
  useEffect(() => {
    if (fetchedTracks !== undefined) {
      setTracks(fetchedTracks);
      setIsLoadingLibrary(false);
    }
  }, [fetchedTracks]);

  // Đồng bộ Playlist từ CSDL
  useEffect(() => {
    if (fetchedPlaylists !== undefined) {
      setPlaylists(fetchedPlaylists);
    }
  }, [fetchedPlaylists]);

  // Safety fallback: Tối đa 300ms bắt buộc giải phóng Splash Screen, không bao giờ kẹt loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingLibrary(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // ===================== NAVIGATION HISTORY ENGINE =====================
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const navigateTo = useCallback((entry: {
    viewMode: ViewMode;
    selectedAlbum?: Album | null;
    selectedArtist?: string | null;
    selectedPlaylist?: Playlist | null;
  }) => {
    const newEntry = {
      viewMode: entry.viewMode,
      selectedAlbum: entry.selectedAlbum ?? null,
      selectedArtist: entry.selectedArtist ?? null,
      selectedPlaylist: entry.selectedPlaylist ?? null,
    };

    const curIdx = historyIndexRef.current;
    const curHistory = historyRef.current;
    const current = curHistory[curIdx];

    const isSame = current &&
      current.viewMode === newEntry.viewMode &&
      current.selectedAlbum?.id === newEntry.selectedAlbum?.id &&
      current.selectedArtist === newEntry.selectedArtist &&
      current.selectedPlaylist?.id === newEntry.selectedPlaylist?.id;

    if (!isSame) {
      const updated = [...curHistory.slice(0, curIdx + 1), newEntry];
      if (updated.length > 50) {
        updated.shift();
      }
      const newIdx = updated.length - 1;
      historyRef.current = updated;
      historyIndexRef.current = newIdx;
      setHistory(updated);
      setHistoryIndex(newIdx);
    }

    setViewModeState(newEntry.viewMode);
    setSelectedAlbumState(newEntry.selectedAlbum);
    setSelectedArtistState(newEntry.selectedArtist);
    setSelectedPlaylistState(newEntry.selectedPlaylist);
  }, []);

  const goBack = useCallback(() => {
    const curIdx = historyIndexRef.current;
    const curHistory = historyRef.current;
    if (curIdx > 0) {
      const newIdx = curIdx - 1;
      const target = curHistory[newIdx];
      if (target) {
        historyIndexRef.current = newIdx;
        setHistoryIndex(newIdx);
        setViewModeState(target.viewMode);
        setSelectedAlbumState(target.selectedAlbum ?? null);
        setSelectedArtistState(target.selectedArtist ?? null);
        setSelectedPlaylistState(target.selectedPlaylist ?? null);
      }
    }
  }, []);

  const goForward = useCallback(() => {
    const curIdx = historyIndexRef.current;
    const curHistory = historyRef.current;
    if (curIdx < curHistory.length - 1) {
      const newIdx = curIdx + 1;
      const target = curHistory[newIdx];
      if (target) {
        historyIndexRef.current = newIdx;
        setHistoryIndex(newIdx);
        setViewModeState(target.viewMode);
        setSelectedAlbumState(target.selectedAlbum ?? null);
        setSelectedArtistState(target.selectedArtist ?? null);
        setSelectedPlaylistState(target.selectedPlaylist ?? null);
      }
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    navigateTo({
      viewMode: mode,
      selectedAlbum: mode === 'album-detail' ? selectedAlbum : null,
      selectedArtist: mode === 'artist-detail' ? selectedArtist : null,
      selectedPlaylist: mode === 'playlist-detail' ? selectedPlaylist : null,
    });
  }, [navigateTo, selectedAlbum, selectedArtist, selectedPlaylist]);

  const setSelectedAlbum = useCallback((album: Album | null) => {
    if (album) {
      navigateTo({
        viewMode: 'album-detail',
        selectedAlbum: album,
        selectedArtist: null,
        selectedPlaylist: null,
      });
    } else {
      setSelectedAlbumState(null);
    }
  }, [navigateTo]);

  const setSelectedArtist = useCallback((artist: string | null) => {
    if (artist) {
      navigateTo({
        viewMode: 'artist-detail',
        selectedAlbum: null,
        selectedArtist: artist,
        selectedPlaylist: null,
      });
    } else {
      setSelectedArtistState(null);
    }
  }, [navigateTo]);

  const setSelectedPlaylist = useCallback((playlist: Playlist | null) => {
    if (playlist) {
      navigateTo({
        viewMode: 'playlist-detail',
        selectedAlbum: null,
        selectedArtist: null,
        selectedPlaylist: playlist,
      });
    } else {
      setSelectedPlaylistState(null);
    }
  }, [navigateTo]);

  const refreshLibrary = useCallback(async () => {
    setIsReloading(true);
    try {
      const res = await tauriAPI.getSavedTracks();
      if (res && res.length > 0) {
        setTracks(res);
      }
      const plRes = await tauriAPI.getPlaylists();
      if (plRes && plRes.length > 0) {
        setPlaylists(plRes);
      }
      invalidateAll();
    } catch (e) {
      console.warn('[PlayerContext] refreshLibrary failed:', e);
    } finally {
      setTimeout(() => {
        setIsReloading(false);
      }, 500);
    }
  }, [invalidateAll]);

  // Lắng nghe sự kiện tải nhạc hoàn tất từ Backend Rust để cập nhật danh sách bài hát ngay tức thì
  useEffect(() => {
    let unlistenTrack: (() => void) | null = null;
    let unlistenLib: (() => void) | null = null;

    if (typeof window !== 'undefined') {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<Track>('track-downloaded', (event) => {
          const newTrack = event.payload;
          if (newTrack && newTrack.id) {
            setTracks((prev) => {
              const exists = prev.some((t) => t.id === newTrack.id);
              if (exists) {
                return prev.map((t) => (t.id === newTrack.id ? newTrack : t));
              }
              return [newTrack, ...prev];
            });
            newTracksSetRef.current.add(newTrack.id);
            syncBadgesState();
            invalidateTracks();
          }
        }).then((u) => {
          unlistenTrack = u;
        });

        listen('library-updated', () => {
          tauriAPI.getSavedTracks().then((res) => {
            if (res && res.length > 0) {
              setTracks(res);
            }
          });
          invalidateTracks();
        }).then((u) => {
          unlistenLib = u;
        });
      });
    }

    return () => {
      if (unlistenTrack) unlistenTrack();
      if (unlistenLib) unlistenLib();
    };
  }, [invalidateTracks, syncBadgesState]);

  // Quét folder chọn từ Electron IPC - Tự động phát hiện Bài Mới & Album Mới
  const selectFolderAndScan = useCallback(async () => {
    if (!window.electronAPI) {
      alert('Tính năng quét thư mục chỉ khả dụng khi chạy trên ứng dụng Electron!');
      return;
    }
    const folder = await window.electronAPI.selectMusicFolder();
    if (!folder) return;

    const oldTrackIds = new Set(tracks.map(t => t.id));
    const oldAlbumKeys = new Set(albums.map(a => `${a.name}-${a.artist}`));

    setIsScanning(true);
    const updatedLibrary = await window.electronAPI.scanFolder(folder);
    setIsScanning(false);

    if (updatedLibrary && updatedLibrary.length > 0) {
      for (const t of updatedLibrary) {
        if (!oldTrackIds.has(t.id)) newTracksSetRef.current.add(t.id);
        const key = `${t.album}-${t.artist}`;
        if (!oldAlbumKeys.has(key)) newAlbumsSetRef.current.add(key);
      }

      syncBadgesState();
      setTracks(updatedLibrary);
    }
  }, [tracks, albums, syncBadgesState]);

  // PLAYLIST ACTIONS
  const createPlaylist = useCallback(async (name: string, description?: string, coverArt?: string) => {
    if (!window.electronAPI) return;
    await window.electronAPI.createPlaylist(name, description, coverArt);
    const updatedPlaylists = await window.electronAPI.getPlaylists();
    setPlaylists(updatedPlaylists);
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    if (!window.electronAPI) return;
    const updatedPlaylists = await window.electronAPI.addTrackToPlaylist(playlistId, trackId);
    setPlaylists(updatedPlaylists);
  }, []);

  const addAlbumToPlaylist = useCallback(async (playlistId: string, album: Album) => {
    if (!window.electronAPI) return;
    // Thêm tuần tự để giữ thứ tự bài hát
    for (const track of album.tracks) {
      await window.electronAPI.addTrackToPlaylist(playlistId, track.id);
    }
    const updatedPlaylists = await window.electronAPI.getPlaylists();
    setPlaylists(updatedPlaylists);
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, trackId: string) => {
    if (!window.electronAPI) return;
    const updatedPlaylists = await window.electronAPI.removeTrackFromPlaylist(playlistId, trackId);
    setPlaylists(updatedPlaylists);
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    if (!window.electronAPI) return;
    const updatedPlaylists = await window.electronAPI.deletePlaylist(playlistId);
    setPlaylists(updatedPlaylists);
    setSelectedPlaylistState(prev => {
      if (prev?.id === playlistId) {
        setViewMode('library-tracks');
        return null;
      }
      return prev;
    });
  }, [setViewMode]);

  const renamePlaylist = useCallback(async (playlistId: string, newName: string) => {
    if (!window.electronAPI) return;
    const updatedPlaylists = await window.electronAPI.renamePlaylist(playlistId, newName);
    setPlaylists(updatedPlaylists);
    // Cập nhật selectedPlaylist nếu đang xem playlist đó
    setSelectedPlaylistState(prev => {
      if (prev?.id === playlistId) return { ...prev, name: newName };
      return prev;
    });
  }, []);

  const mergeAlbum = useCallback(async (sourceAlbum: Album, targetAlbum: Album) => {
    if (!window.electronAPI) return;
    const freshTracks = await window.electronAPI.mergeAlbum(
      sourceAlbum.name,
      sourceAlbum.artist,
      targetAlbum.name,
      targetAlbum.artist
    );
    setTracks(freshTracks);

    const targetKey = `${targetAlbum.name}-${targetAlbum.artist}`;
    setUpdatedAlbumKeys(prev => new Set([...prev, targetKey]));
    const sourceTrackIds = sourceAlbum.tracks.map(t => t.id);
    setUpdatedTrackIds(prev => new Set([...prev, ...sourceTrackIds]));

    // Cập nhật selectedAlbum nếu đang mở album nguồn hoặc album đích
    setSelectedAlbumState(prev => {
      if (!prev) return null;
      if (prev.id === sourceAlbum.id) {
        setViewMode('library-albums');
        return null;
      }
      if (prev.id === targetAlbum.id) {
        const updatedTargetTracks = freshTracks.filter((t: Track) => `${t.album}-${t.artist}` === targetKey || t.album === targetAlbum.name);
        return {
          ...targetAlbum,
          tracks: updatedTargetTracks
        };
      }
      return prev;
    });
  }, [setViewMode]);

  // QUEUE ACTIONS
  const playNext = useCallback((track: Track) => {
    setQueue(prev => {
      if (!activeTrackRef.current) return prev;
      const currentIndex = prev.findIndex(t => t.id === activeTrackRef.current!.id);
      const newQueue = [...prev];
      newQueue.splice(currentIndex + 1, 0, track);
      return newQueue;
    });
  }, []);




  // EXPLORER, METADATA & FILE DELETE ACTIONS
  const showInExplorer = useCallback(async (filePath: string) => {
    if (window.electronAPI) await window.electronAPI.showInExplorer(filePath);
  }, []);

  const deleteTrack = useCallback(async (trackId: string, filePath: string, permanentDelete: boolean) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteTrackFile(trackId, filePath, permanentDelete);
    const freshTracks = await window.electronAPI.getSavedTracks();
    setTracks(freshTracks);
    setQueue(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const deleteAlbum = useCallback(async (album: Album, permanentDelete: boolean) => {
    if (!window.electronAPI) return;
    for (const t of album.tracks) {
      await window.electronAPI.deleteTrackFile(t.id, t.filePath, permanentDelete);
    }
    const freshTracks = await window.electronAPI.getSavedTracks();
    setTracks(freshTracks);
    const trackIds = new Set(album.tracks.map(t => t.id));
    setQueue(prev => prev.filter(t => !trackIds.has(t.id)));
    setSelectedAlbumState(prev => {
      if (prev?.id === album.id) {
        setViewMode('library-albums');
        return null;
      }
      return prev;
    });
  }, [setViewMode]);

  const updateTrackMetadata = useCallback(async (trackId: string, updates: any) => {
    if (!window.electronAPI) return;
    await window.electronAPI.updateTrackMetadata(trackId, updates);
    const freshTracks = await window.electronAPI.getSavedTracks();
    setTracks(freshTracks);
    setUpdatedTrackIds(prev => new Set([...prev, trackId]));
    if (updates.album || updates.artist) {
      const targetKey = `${updates.album || ''}-${updates.artist || ''}`;
      if (targetKey !== '-') setUpdatedAlbumKeys(prev => new Set([...prev, targetKey]));
    }
  }, []);

  // Audio Event Listeners – dùng refs để tránh re-register khi state thay đổi
  // nextTrack cần được define trước
  const nextTrackRef = useRef<() => void>(() => {});

  const playTrack = useCallback((track: Track, trackList?: Track[]) => {
    if (activeTrackRef.current && activeTrackRef.current.id !== track.id) {
      void flushTelemetry('track_change');
      void window.electronAPI?.recordTrackTransition?.(activeTrackRef.current.id, track.id);
    }

    hasFetchedRecommendationRef.current = false;
    activeTrackRef.current = track;
    setCurrentTrack(track);
    const audio = audioRef.current;

    // Kiểm tra xem danh sách truyền vào có phải là Album, Playlist hay Collection cụ thể hay không
    const isExplicitCollection = Boolean(
      trackList &&
      trackList.length > 0 &&
      trackList !== tracks &&
      trackList !== queueRef.current
    );

    const isPlayingWithinQueue = Boolean(
      trackList &&
      trackList === queueRef.current &&
      queueRef.current.some(t => t.id === track.id)
    );

    let newQueue: Track[] = [];

    if (isExplicitCollection) {
      // Khi phát Album hoặc Playlist: Giữ nguyên toàn bộ danh sách bài hát trong Album/Playlist đó
      if (shuffleRef.current) {
        const rest = trackList!.filter(t => t.id !== track.id);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        newQueue = [track, ...rest];
      } else {
        newQueue = [...trackList!];
        const targetIdx = newQueue.findIndex(t => t.id === track.id);
        if (targetIdx > 0) {
          const [selected] = newQueue.splice(targetIdx, 1);
          newQueue.unshift(selected);
        } else if (targetIdx === -1) {
          newQueue.unshift(track);
        }
      }
      setQueue(newQueue);
      queueRef.current = newQueue;
    } else if (isPlayingWithinQueue) {
      // Khi người dùng bấm vào một bài hát nằm trong Danh sách chờ hiện tại -> giữ nguyên queue
    } else {
      // Khi phát bài hát đơn lẻ (từ thư viện/tìm kiếm/home/v.v.):
      // Danh sách chờ và 14 bài gợi ý là 1 (14 bài gợi ý thay thế trực tiếp cho danh sách chờ)
      newQueue = [track];
      setQueue(newQueue);
      queueRef.current = newQueue;

      // Tự động tính toán 14 bài gợi ý thông minh kế tiếp cho bài hát này
      getSmartQueueRecommendations(track, tracks, new Set([track.id]), 14)
        .then((recs) => {
          if (activeTrackRef.current?.id === track.id) {
            const recommendedTracks = recs.map(r => r.track);
            const unifiedQueue = [track, ...recommendedTracks];
            setQueue(unifiedQueue);
            queueRef.current = unifiedQueue;
          }
        })
        .catch((err) => {
          console.warn('[PlayerContext] getSmartQueueRecommendations error:', err);
        });
    }

    const rawPath = track.filePath || (track as any).filePath || (track as any).file_path || '';
    const fileUrl = convertFileSrc(rawPath);

    audio.pause();
    audio.src = fileUrl;
    audio.volume = isMuted ? 0 : volume;
    audio.load();

    // Nếu đang trong chế độ MV và bài hát có MV: Thẻ video sẽ phát âm thanh, tuyệt đối không phát audio nền
    if (isMvOpenRef.current && track.hasMv && track.mvPath) {
      setIsPlaying(true);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error("Lỗi phát audio:", err, "URL:", fileUrl);
          setIsPlaying(false);
        });
    }
  }, [flushTelemetry, isMuted, volume, tracks]);

  const openMv = useCallback((track?: Track) => {
    // Tạm dừng ngay lập tức thẻ audio chính
    audioRef.current.pause();
    setIsPlaying(false);

    setIsMvOpen(true);
    isMvOpenRef.current = true;

    if (track && (!activeTrackRef.current || activeTrackRef.current.id !== track.id)) {
      playTrack(track);
    }
    // Chắc chắn audio đã dừng
    audioRef.current.pause();
  }, [playTrack]);

  const closeMv = useCallback((shouldResumeAudio = true) => {
    setIsMvOpen(false);
    isMvOpenRef.current = false;

    if (shouldResumeAudio && activeTrackRef.current) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(console.error);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Tự động bổ sung bài hát vào hàng đợi khi bật Shuffle và sắp hết bài
  const replenishShuffleQueueIfNeeded = useCallback((currentQueue: Track[], currentTrackId?: string): Track[] => {
    if (!shuffleRef.current || tracks.length === 0) return currentQueue;
    
    const currentIndex = currentTrackId ? currentQueue.findIndex(t => t.id === currentTrackId) : -1;
    const remainingCount = currentIndex !== -1 ? currentQueue.length - 1 - currentIndex : currentQueue.length;

    // Khi danh sách chờ chỉ còn <= 3 bài
    if (remainingCount <= 3) {
      const remainingTrackIds = new Set(currentQueue.slice(Math.max(0, currentIndex)).map(t => t.id));
      
      // Lấy các bài hát trong thư viện ngoài danh sách đang chờ
      let candidates = tracks.filter(t => !remainingTrackIds.has(t.id));
      if (candidates.length === 0) {
        candidates = tracks.filter(t => t.id !== currentTrackId);
      }

      if (candidates.length > 0) {
        const anchorTrack = currentTrackId ? tracks.find(t => t.id === currentTrackId) : null;
        let selectedCandidates: Track[] = [];

        if (anchorTrack) {
          const sameArtist = candidates.filter(t => t.artist.toLowerCase() === anchorTrack.artist.toLowerCase());
          const sameAlbum = candidates.filter(t => t.album && t.album.toLowerCase() === anchorTrack.album?.toLowerCase() && !sameArtist.includes(t));
          const others = candidates.filter(t => !sameArtist.includes(t) && !sameAlbum.includes(t)).sort(() => Math.random() - 0.5);

          selectedCandidates = [...sameArtist, ...sameAlbum, ...others].slice(0, 14); // Khống chế tối đa 14 bài
        } else {
          selectedCandidates = [...candidates].sort(() => Math.random() - 0.5).slice(0, 14);
        }

        const updatedQueue = [...currentQueue, ...selectedCandidates];
        setQueue(updatedQueue);
        queueRef.current = updatedQueue;
        return updatedQueue;
      }
    }
    return currentQueue;
  }, [tracks]);

  const nextTrack = useCallback(() => {
    let q = queueRef.current;
    if (q.length === 0) return;
    let currentIndex = q.findIndex(t => t.id === activeTrackRef.current?.id);

    // Kiểm tra và tự động bổ sung bài hát ngoài album/playlist nếu shuffle bật và còn <= 5 bài
    if (shuffleRef.current) {
      q = replenishShuffleQueueIfNeeded(q, activeTrackRef.current?.id);
      currentIndex = q.findIndex(t => t.id === activeTrackRef.current?.id);
    }

    let nextIndex = 0;

    if (currentIndex !== -1 && currentIndex < q.length - 1) {
      nextIndex = currentIndex + 1;
    } else if (repeatRef.current === 'all') {
      nextIndex = 0;
    } else if (shuffleRef.current) {
      // Khi đã phát hết album/playlist ở chế độ random: tự động thêm nhạc từ thư viện
      const remainingTracks = tracks.filter(t => t.id !== activeTrackRef.current?.id);
      if (remainingTracks.length > 0) {
        const randomTracks = [...remainingTracks].sort(() => Math.random() - 0.5).slice(0, 10);
        q = [...q, ...randomTracks];
        setQueue(q);
        queueRef.current = q;
        nextIndex = (currentIndex !== -1 ? currentIndex : 0) + 1;
        if (nextIndex >= q.length) nextIndex = 0;
      } else {
        nextIndex = Math.floor(Math.random() * q.length);
      }
    } else {
      setIsPlaying(false);
      return;
    }

    if (q[nextIndex]) {
      playTrack(q[nextIndex], q);
    }
  }, [playTrack, replenishShuffleQueueIfNeeded, tracks]);

  // Giữ ref nextTrack cập nhật để audio listener dùng
  useEffect(() => {
    nextTrackRef.current = nextTrack;
  }, [nextTrack]);

  // Đăng ký audio event listeners một lần duy nhất - Đồng bộ chuẩn hóa State từ HTML5 Audio Events
  useEffect(() => {
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      const dur = audio.duration;
      currentTimeRef.current = t;
      setCurrentTime(t);

      // Lyric sync
      const lyrs = lyricsRef.current;
      if (lyrs.length > 0) {
        let index = -1;
        for (let i = 0; i < lyrs.length; i++) {
          if (t >= lyrs[i].time) index = i;
          else break;
        }
        setCurrentLyricIndex(index);
      }

      // Pre-fetching Smart Auto-Play: Khi bài hiện tại > 80% thời lượng và hàng đợi sắp hết bài
      if (
        dur > 0 &&
        t > dur * 0.8 &&
        !hasFetchedRecommendationRef.current &&
        activeTrackRef.current
      ) {
        const q = queueRef.current;
        const currentIndex = q.findIndex(track => track.id === activeTrackRef.current?.id);
        const isAtQueueEnd = currentIndex === -1 || currentIndex >= q.length - 1;

        if (isAtQueueEnd) {
          hasFetchedRecommendationRef.current = true;
          const cur = activeTrackRef.current;
          window.electronAPI?.getSmartRecommendation?.(
            cur.id,
            cur.artist,
            cur.genre || '',
            cur.year,
            cur.bpm || 0
          ).then(recTrack => {
            if (recTrack) {
              setQueue(prev => {
                if (prev.some(t => t.id === recTrack.id)) return prev;
                const updated = [...prev, recTrack];
                queueRef.current = updated;
                return updated;
              });
            }
          }).catch(console.error);
        }
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => setDuration(audio.duration);

    const handleStalledOrWaiting = () => {
      // Khi audio bi bufer hoac ngat nhip, khong cho phep timeline chay ma giu nguyen
    };

    const handleEnded = () => {
      void flushTelemetry('pause');
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        const prevTrack = activeTrackRef.current;
        nextTrackRef.current();
        const nextTr = activeTrackRef.current;
        if (prevTrack && nextTr && prevTrack.id !== nextTr.id) {
          void window.electronAPI?.recordTrackTransition?.(prevTrack.id, nextTr.id);
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('stalled', handleStalledOrWaiting);
    audio.addEventListener('waiting', handleStalledOrWaiting);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('stalled', handleStalledOrWaiting);
      audio.removeEventListener('waiting', handleStalledOrWaiting);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [flushTelemetry]); // Chỉ re-register khi telemetry handler thay đổi

  // Load Lyric file khi đổi bài hát
  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      lyricsRef.current = [];
      return;
    }

    const targetLrcPath = currentTrack.lrcPath;
    if (!targetLrcPath) {
      if (!currentTrack.hasLyric) {
        setLyrics([]);
        lyricsRef.current = [];
      }
      return;
    }

    let isCancelled = false;
    window.electronAPI?.readLrcFile(targetLrcPath).then((lrcContent: string | null) => {
      if (isCancelled) return;
      if (lrcContent && lrcContent.trim().length > 0) {
        const parsed = parseLrc(lrcContent);
        setLyrics(parsed);
        lyricsRef.current = parsed;
      } else if (!currentTrack.hasLyric) {
        setLyrics([]);
        lyricsRef.current = [];
      }
    }).catch(() => {
      if (!isCancelled && !currentTrack.hasLyric) {
        setLyrics([]);
        lyricsRef.current = [];
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.lrcPath]);

  const pauseAudio = useCallback(() => {
    audioRef.current.pause();
    setIsPlaying(false);
  }, []);

  const resumeAudio = useCallback(() => {
    if (currentTrack) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [currentTrack]);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!activeTrackRef.current) {
      if (queueRef.current.length > 0) playTrack(queueRef.current[0]);
      return;
    }
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [playTrack]);

  const prevTrack = useCallback(() => {
    const q = queueRef.current;
    const audio = audioRef.current;
    if (q.length === 0) return;

    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const currentIndex = q.findIndex(t => t.id === activeTrackRef.current?.id);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : q.length - 1;
    playTrack(q[prevIndex], q);
  }, [playTrack]);

  const seek = useCallback((seconds: number) => {
    void flushTelemetry('seeking');
    audioRef.current.currentTime = seconds;
    setCurrentTime(seconds);
  }, [flushTelemetry]);

  // Synchronize Web MediaSession API for Android / OriginOS lockscreen & notifications
  useEffect(() => {
    if (!currentTrack || typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const coverUrl = currentTrack.picture ? convertFileSrc(currentTrack.picture) : undefined;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: coverUrl
        ? [{ src: coverUrl, sizes: '512x512', type: 'image/png' }]
        : [],
    });

    try {
      navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          seek(details.seekTime);
        }
      });
    } catch (e) {
      console.warn("MediaSession action handler setting failed:", e);
    }
  }, [currentTrack, togglePlayPause, prevTrack, nextTrack, seek]);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    audioRef.current.volume = val;
    if (val > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      audioRef.current.volume = next ? 0 : volume;
      return next;
    });
  }, [volume]);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      queueRef.current = result;
      return result;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const nextShuffle = !prev;
      shuffleRef.current = nextShuffle;
      if (nextShuffle) {
        const current = activeTrackRef.current;
        if (queueRef.current.length > 1) {
          const rest = queueRef.current.filter(t => t.id !== current?.id);
          for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
          }
          let newQueue = current ? [current, ...rest] : rest;
          newQueue = replenishShuffleQueueIfNeeded(newQueue, current?.id);
          setQueue(newQueue);
          queueRef.current = newQueue;
        } else if (current) {
          const newQueue = replenishShuffleQueueIfNeeded(queueRef.current, current.id);
          setQueue(newQueue);
          queueRef.current = newQueue;
        }
      }
      return nextShuffle;
    });
  }, [replenishShuffleQueueIfNeeded]);

  const toggleRepeat = useCallback(() => {
    setRepeat(r => r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');
  }, []);

  const attachMvToTrack = useCallback(async (trackId: string) => {
    if (!window.electronAPI) return;
    const mvFilePath = await window.electronAPI.selectMvFile();
    if (!mvFilePath) return;

    if (window.electronAPI.attachMvFile) {
      const updatedTracks = await window.electronAPI.attachMvFile(trackId, mvFilePath);
      setTracks(updatedTracks);
    } else {
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, hasMv: true, mvPath: mvFilePath } : t
      ));
    }

    setCurrentTrack(prev =>
      prev?.id === trackId ? { ...prev, hasMv: true, mvPath: mvFilePath } : prev
    );
    setUpdatedTrackIds(prev => new Set([...prev, trackId]));
  }, []);

  const attachLrcToTrack = useCallback(async (trackId: string) => {
    if (!window.electronAPI) return;
    const lrcFilePath = await window.electronAPI.selectLrcFile();
    if (!lrcFilePath) return;

    let updatedList: Track[] = [];
    if (window.electronAPI.attachLrcFile) {
      updatedList = await window.electronAPI.attachLrcFile(trackId, lrcFilePath);
      setTracks(updatedList);
    } else {
      setTracks(prev => prev.map(t =>
        t.id === trackId ? { ...t, hasLyric: true, lrcPath: lrcFilePath } : t
      ));
    }
    setUpdatedTrackIds(prev => new Set([...prev, trackId]));

    const updatedTrack = updatedList.find(t => t.id === trackId) || { hasLyric: true, lrcPath: lrcFilePath };

    setCurrentTrack(prev => {
      if (prev?.id === trackId) {
        const next = { ...prev, hasLyric: true, lrcPath: lrcFilePath };
        // Nếu bài này đang phát, tự động nạp lyrics mới
        window.electronAPI?.readLrcFile(lrcFilePath).then((rawLrc: string | null) => {
          if (rawLrc) setLyrics(parseLrc(rawLrc));
        });
        return next;
      }
      return prev;
    });
  }, []);

  const saveAndApplyLyrics = useCallback(async (trackId: string, lrcContent: string) => {
    if (!window.electronAPI) return;

    // 1. Phân tích nội dung lyrics và gán ngay lập tức
    const parsed = parseLrc(lrcContent);
    if (activeTrackRef.current?.id === trackId) {
      setLyrics(parsed);
      lyricsRef.current = parsed;
    }

    // 2. Lưu file .lrc qua IPC và cập nhật database
    let updatedTracks: Track[] = [];
    if (window.electronAPI.saveAndAttachLrc) {
      updatedTracks = await window.electronAPI.saveAndAttachLrc(trackId, lrcContent);
      if (updatedTracks && updatedTracks.length > 0) {
        setTracks(updatedTracks);
      }
    }

    setUpdatedTrackIds(prev => new Set([...prev, trackId]));

    const updatedTrack = updatedTracks.find(t => t.id === trackId);

    // 3. Cập nhật currentTrack và activeTrackRef với track mới có đầy đủ lrcPath và hasLyric = true
    if (activeTrackRef.current?.id === trackId) {
      setLyrics(parsed);
      lyricsRef.current = parsed;
      if (updatedTrack) {
        activeTrackRef.current = updatedTrack;
        setCurrentTrack(updatedTrack);
      } else {
        setCurrentTrack(prev => prev ? { ...prev, hasLyric: true } : prev);
      }
    }
  }, []);

  const addToQueueOrPlay = useCallback((track: Track) => {
    if (queueRef.current.length === 0 && !activeTrackRef.current) {
      playTrack(track);
    } else {
      setQueue(prev => {
        if (prev.some(t => t.id === track.id)) return prev;
        const updated = [...prev, track];
        queueRef.current = updated;
        return updated;
      });
    }
  }, [playTrack]);

  const addMultipleToQueue = useCallback((newTracks: Track[]) => {
    if (!newTracks || newTracks.length === 0) return;
    setQueue(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const toAdd = newTracks.filter(t => !existingIds.has(t.id)).slice(0, 14); // Khống chế tối đa 14 bài
      const updated = [...prev, ...toAdd];
      queueRef.current = updated;
      return updated;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      queueRef.current = updated;
      return updated;
    });
  }, []);

  const clearQueue = useCallback(() => {
    if (activeTrackRef.current) {
      const current = [activeTrackRef.current];
      setQueue(current);
      queueRef.current = current;
    } else {
      setQueue([]);
      queueRef.current = [];
    }
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        tracks,
        albums,
        playlists,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        shuffle,
        repeat,
        lyrics,
        currentLyricIndex,
        viewMode,
        selectedAlbum,
        selectedArtist,
        selectedPlaylist,
        queue,
        isScanning,
        isLoadingLibrary,
        isLyricsOpen,
        newTrackIds,
        updatedTrackIds,
        newAlbumKeys,
        updatedAlbumKeys,
        clearNewBadges,
        clearUpdatedBadges,
        dismissAlbumBadges,
        triggerMemoryShrink,
        isAudioQualityModalOpen,
        audioQualityModalTrack,
        audioQualityModalInitialStandardId,
        openAudioQualityModal,
        closeAudioQualityModal,
        isSettingsOpen,
        openSettings,
        closeSettings,
        isLyricsSearchOpen,
        lyricsSearchTrack,
        openLyricsSearch,
        closeLyricsSearch,
        saveAndApplyLyrics,
        lyricOffset,
        adjustLyricOffset,
        resetLyricOffset,
        isBatchLyricsOpen,
        batchLyricsAlbum,
        openBatchLyricsForAlbum,
        closeBatchLyrics,
        artistProfiles,
        isMvOpen,
        openMv,
        closeMv,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        navigateTo,
        isReloading,
        pauseAudio,
        resumeAudio,
        refreshLibrary,
        selectFolderAndScan,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        setViewMode,
        setLyricsOpen: setIsLyricsOpen,
        setSelectedAlbum,
        setSelectedArtist,
        setSelectedPlaylist,
        createPlaylist,
        reorderQueue,
        addTrackToPlaylist,
        addAlbumToPlaylist,
        removeTrackFromPlaylist,
        deletePlaylist,
        renamePlaylist,
        mergeAlbum,
        playNext,
        addToQueue: addToQueueOrPlay,
        addMultipleToQueue,
        removeFromQueue,
        clearQueue,
        showInExplorer,
        deleteTrack,
        deleteAlbum,
        updateTrackMetadata,
        attachMvToTrack,
        attachLrcToTrack,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer phải được sử dụng trong PlayerProvider');
  return context;
};
