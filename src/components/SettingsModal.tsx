import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Activity,
  HardDrive,
  Users,
  Disc,
  Music,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  FileAudio,
  Trash2,
  Search,
  ArrowUpDown,
  Volume2,
  FolderTree,
  Keyboard,
  ShieldCheck,
  Check,
  FolderPlus,
  Palette,
  SlidersHorizontal,
  FileText,
  Info,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Waves,
  Moon,
  Languages,
  Bot,
  Globe,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  RefreshCw,
  Download,
  ArrowUpCircle,
  Package,
  Calendar,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  audioScanner,
  clearAllStoredAnalyses,
  getAllStoredAnalyses,
  type AudioScannerState,
} from '../utils/audioFeatureStore';
import { convertFileSrc, tauriAPI } from '../utils/tauriBridge';
import { discoveryRecLRU, discoveryStreamLRU } from '../utils/lruCache';
import {
  type Track,
  type LyricCustomizationSettings,
  type TranslationSettings,
  type TranslationProvider,
  SUPPORTED_LANGUAGES,
  loadLyricSettings,
  saveLyricSettings,
  loadTranslationSettings,
  saveTranslationSettings,
  DEFAULT_LYRIC_SETTINGS,
  DEFAULT_TRANSLATION_SETTINGS,
} from '../types';
import { testTranslationProvider } from '../services/lyricsTranslationService';
import { useAppUpdater } from '../hooks/useAppUpdater';
import { openExternalLink, detectPlatform, GITHUB_RELEASES_PAGE } from '../services/updateService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'storage' | 'audio' | 'translation' | 'folders' | 'general' | 'shortcuts' | 'updates';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { tracks, albums, artistProfiles, selectFolderAndScan, isScanning } = usePlayer();
  const [activeTab, setActiveTab] = useState<SettingsTab>('storage');
  const {
    updateInfo,
    isChecking: isCheckingUpdate,
    checkNow: checkUpdateNow,
    autoCheckEnabled,
    toggleAutoCheck,
    currentVersion,
  } = useAppUpdater();

  // Scanner State & Telemetry
  const [scannerState, setScannerState] = useState<AudioScannerState>(audioScanner.getState());
  const [cachedCount, setCachedCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  // Storage Tab States
  const [storageSearch, setStorageSearch] = useState('');
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // RAM & LRU Discovery Cache States
  const [lruCacheBytes, setLruCacheBytes] = useState(() => discoveryRecLRU.getTotalBytes() + discoveryStreamLRU.getTotalBytes());
  const [isShrinkingRam, setIsShrinkingRam] = useState(false);
  const [shrinkSuccessMsg, setShrinkSuccessMsg] = useState<string | null>(null);

  const handleClearLruAndShrink = async () => {
    setIsShrinkingRam(true);
    setShrinkSuccessMsg(null);
    try {
      discoveryRecLRU.clear();
      discoveryStreamLRU.clear();
      setLruCacheBytes(0);
      const res = await tauriAPI.shrinkMemory();
      setShrinkSuccessMsg('Đã thu hồi tối đa Working Set RAM và dọn sạch Discovery Cache!');
      setTimeout(() => setShrinkSuccessMsg(null), 4000);
    } catch (e) {
      console.warn('[SettingsModal] shrinkMemory failed:', e);
    } finally {
      setIsShrinkingRam(false);
    }
  };

  // General & Audio Mock Settings
  const [crossfadeSec, setCrossfadeSec] = useState<number>(2);
  const [autoDownloadLyrics, setAutoDownloadLyrics] = useState<boolean>(true);
  const [highQualityAudio, setHighQualityAudio] = useState<boolean>(true);
  const [glassmorphismEffect, setGlassmorphismEffect] = useState<boolean>(true);
  const [lyricSettings, setLyricSettings] = useState<LyricCustomizationSettings>(loadLyricSettings);
  const [transSettings, setTransSettings] = useState<TranslationSettings>(loadTranslationSettings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testApiResult, setTestApiResult] = useState<{ success: boolean; message: string } | null>(null);

  const updateLyricSettings = (partial: Partial<LyricCustomizationSettings>) => {
    const updated = { ...lyricSettings, ...partial };
    setLyricSettings(updated);
    saveLyricSettings(updated);
  };

  const updateTransSettings = (partial: Partial<TranslationSettings>) => {
    const updated = { ...transSettings, ...partial };
    setTransSettings(updated);
    saveTranslationSettings(updated);
    setTestApiResult(null);
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setTestApiResult(null);
    try {
      const res = await testTranslationProvider(transSettings.provider, transSettings);
      setTestApiResult(res);
    } catch (e: any) {
      setTestApiResult({ success: false, message: e?.message || String(e) });
    } finally {
      setIsTestingApi(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setLruCacheBytes(discoveryRecLRU.getTotalBytes() + discoveryStreamLRU.getTotalBytes());

    getAllStoredAnalyses().then((cached) => {
      setCachedCount(Object.keys(cached).length);
    });

    const unsubscribe = audioScanner.subscribe((state) => {
      setScannerState(state);
      if (state.status === 'completed') {
        getAllStoredAnalyses().then((c) => setCachedCount(Object.keys(c).length));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // 1. Phân tích tệp âm thanh thư viện (Chỉ phụ thuộc mảng tracks)
  const trackAudioStats = useMemo(() => {
    let flacCount = 0, flacBytes = 0;
    let mp3Count = 0, mp3Bytes = 0;
    let wavCount = 0, wavBytes = 0;
    let aacCount = 0, aacBytes = 0;
    let otherCount = 0, otherBytes = 0;

    const trackSizeMap: Array<{
      track: Track;
      format: 'FLAC' | 'MP3' | 'WAV' | 'AAC' | 'OTHER';
      sizeBytes: number;
      bitrateKbps: number;
      fileName: string;
      searchLower: string;
    }> = tracks.map((t) => {
      const rawPath = t.filePath || (t as any).file_path || '';
      const parts = rawPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1] || t.title;
      const ext = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';
      const durationSec = t.duration || 180;
      let format: 'FLAC' | 'MP3' | 'WAV' | 'AAC' | 'OTHER' = 'OTHER';
      let bitrateKbps = 320;
      let sizeBytes = 0;

      if (ext === 'FLAC') {
        format = 'FLAC';
        bitrateKbps = 960; // Chuẩn 24bit/44.1kHz FLAC Lossless
        sizeBytes = Math.round((durationSec * bitrateKbps * 1000) / 8);
        flacCount++;
        flacBytes += sizeBytes;
      } else if (ext === 'WAV' || ext === 'AIFF') {
        format = 'WAV';
        bitrateKbps = 1411; // 16bit 44.1kHz Raw PCM
        sizeBytes = Math.round((durationSec * bitrateKbps * 1000) / 8);
        wavCount++;
        wavBytes += sizeBytes;
      } else if (ext === 'MP3') {
        format = 'MP3';
        bitrateKbps = 320; // 320kbps CBR
        sizeBytes = Math.round((durationSec * bitrateKbps * 1000) / 8);
        mp3Count++;
        mp3Bytes += sizeBytes;
      } else if (ext === 'M4A' || ext === 'AAC' || ext === 'OGG') {
        format = 'AAC';
        bitrateKbps = 256;
        sizeBytes = Math.round((durationSec * bitrateKbps * 1000) / 8);
        aacCount++;
        aacBytes += sizeBytes;
      } else {
        format = 'OTHER';
        bitrateKbps = 320;
        sizeBytes = Math.round((durationSec * bitrateKbps * 1000) / 8);
        otherCount++;
        otherBytes += sizeBytes;
      }

      const searchLower = `${t.title} ${t.artist} ${t.album || ''} ${fileName}`.toLowerCase();
      return { track: t, format, sizeBytes, bitrateKbps, fileName, searchLower };
    });

    const totalAudioBytes = flacBytes + mp3Bytes + wavBytes + aacBytes + otherBytes;

    const avgBitrate = tracks.length > 0 
      ? Math.round(trackSizeMap.reduce((acc, cur) => acc + cur.bitrateKbps, 0) / tracks.length) 
      : 0;

    return {
      flacCount,
      flacBytes,
      mp3Count,
      mp3Bytes,
      wavCount,
      wavBytes,
      aacCount,
      aacBytes,
      otherCount,
      otherBytes,
      totalAudioBytes,
      avgBitrate,
      trackSizeMap,
    };
  }, [tracks]);

  // 2. Tổng hợp dung lượng bao gồm Cache (Tính toán O(1))
  const storageAnalytics = useMemo(() => {
    const dspCacheBytes = cachedCount * 15 * 1024;
    const coverCacheBytes = albums.filter((a) => a.picture).length * 120 * 1024;
    const totalCacheBytes = dspCacheBytes + coverCacheBytes;
    const grandTotalBytes = trackAudioStats.totalAudioBytes + totalCacheBytes;

    return {
      ...trackAudioStats,
      dspCacheBytes,
      coverCacheBytes,
      totalCacheBytes,
      grandTotalBytes,
    };
  }, [trackAudioStats, cachedCount, albums]);

  // Bộ lọc và sắp xếp danh sách bài hát theo dung lượng (Tối ưu hóa tìm kiếm O(1) substring)
  const filteredAndSortedTracks = useMemo(() => {
    const q = storageSearch.trim().toLowerCase();
    return storageAnalytics.trackSizeMap
      .filter((item) => {
        if (selectedFormatFilter !== 'all' && item.format !== selectedFormatFilter) {
          return false;
        }
        if (!q) return true;
        return item.searchLower.includes(q);
      })
      .sort((a, b) => {
        return sortDirection === 'desc' ? b.sizeBytes - a.sizeBytes : a.sizeBytes - b.sizeBytes;
      });
  }, [storageAnalytics.trackSizeMap, selectedFormatFilter, storageSearch, sortDirection]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSeconds = (sec: number) => {
    if (sec <= 0) return '0s';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const handleStartScan = async () => {
    const existing = await getAllStoredAnalyses();
    audioScanner.start(tracks, existing);
  };

  const handlePauseScan = () => audioScanner.pause();
  const handleResumeScan = () => audioScanner.resume();
  const handleCancelScan = () => audioScanner.cancel();

  const handleExecuteClearCache = async () => {
    setIsClearing(true);
    audioScanner.cancel();
    await clearAllStoredAnalyses();
    setCachedCount(0);
    setIsClearing(false);
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-apple transition-opacity" />

      {/* Main Glass Window */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-5xl h-[88vh] bg-[#141416]/95 border border-white/15 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Top Title Bar */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-apple-pink/15 border border-apple-pink/30 flex items-center justify-center shadow-md">
              <Sliders className="w-4 h-4 text-apple-pink" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Cài Đặt & Cấu Hình Hệ Thống
              </h2>
              <p className="text-[11px] text-neutral-400 font-medium">
                Flarity Music Desktop · Studio High-Fidelity Audio Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Đóng cửa sổ (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Body Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Master Sidebar Tabs */}
          <aside className="w-60 border-r border-white/10 bg-black/20 p-3 flex flex-col justify-between shrink-0">
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('storage')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'storage'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 shrink-0" />
                  <span>Quản Lý Bộ Nhớ</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                  activeTab === 'storage' ? 'bg-white/20 text-white' : 'bg-white/10 text-neutral-400'
                }`}>
                  {formatBytes(storageAnalytics.grandTotalBytes).split(' ')[0]}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('audio')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'audio'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>Âm Thanh & DSP</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  activeTab === 'audio' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {cachedCount}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('translation')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'translation'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Languages className="w-4 h-4 shrink-0" />
                  <span>Dịch Thuật & AI</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md uppercase font-mono ${
                  activeTab === 'translation' ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {transSettings.provider === 'google' ? 'AUTO' : transSettings.provider}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('folders')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'folders'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FolderTree className="w-4 h-4 shrink-0" />
                <span>Thư Mục & Thư Viện</span>
              </button>

              <button
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>Chung & Giao Diện</span>
              </button>

              <button
                onClick={() => setActiveTab('shortcuts')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'shortcuts'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Keyboard className="w-4 h-4 shrink-0" />
                <span>Phím Tắt & Trợ Năng</span>
              </button>

              <button
                onClick={() => setActiveTab('updates')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'updates'
                    ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Cập Nhật & Giới Thiệu</span>
                </div>
                {updateInfo?.hasUpdate ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-black uppercase bg-rose-500 text-white animate-pulse">
                    Mới
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-white/10 text-neutral-400">
                    v{currentVersion}
                  </span>
                )}
              </button>
            </div>

            {/* Sidebar Bottom System Health Info */}
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hệ Thống Tối Ưu</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                SQLite WAL 32MB & IndexedDB 7D Vectors duy trì tốc độ 60FPS.
              </p>
            </div>
          </aside>

          {/* Right Detail Content Viewport */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/10">
            {/* ===================== TAB: STORAGE & MEMORY MANAGEMENT ===================== */}
            {activeTab === 'storage' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* Header Subtitle */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-apple-pink/20 text-apple-pink border border-apple-pink/30 flex items-center gap-1.5">
                      <HardDrive className="w-3 h-3" />
                      STORAGE TELEMETRY
                    </span>
                    <span className="text-xs font-medium text-neutral-400">
                      Phân tích dung lượng & Quản trị tệp âm thanh
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Quản Lý Bộ Nhớ & Tệp Âm Thanh
                  </h3>
                </div>

                {/* Visual Storage Bar (macOS Style Multi-Segment Bar) */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-apple-pink" />
                      Phân Bổ Dung Lượng Bộ Nhớ Thư Viện
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-300">
                      Tổng: <span className="text-white">{formatBytes(storageAnalytics.grandTotalBytes)}</span>
                    </span>
                  </div>

                  {/* Multi-segment Progress Bar */}
                  <div className="w-full h-4 bg-neutral-900 rounded-xl overflow-hidden flex p-0.5 border border-white/10">
                    {storageAnalytics.grandTotalBytes > 0 ? (
                      <>
                        {/* FLAC Segment */}
                        {storageAnalytics.flacBytes > 0 && (
                          <div
                            style={{
                              width: `${(storageAnalytics.flacBytes / storageAnalytics.grandTotalBytes) * 100}%`,
                            }}
                            className="h-full bg-blue-500 hover:brightness-125 transition-all rounded-l-lg"
                            title={`FLAC Lossless: ${formatBytes(storageAnalytics.flacBytes)} (${storageAnalytics.flacCount} bài)`}
                          />
                        )}
                        {/* WAV Segment */}
                        {storageAnalytics.wavBytes > 0 && (
                          <div
                            style={{
                              width: `${(storageAnalytics.wavBytes / storageAnalytics.grandTotalBytes) * 100}%`,
                            }}
                            className="h-full bg-emerald-500 hover:brightness-125 transition-all"
                            title={`WAV PCM: ${formatBytes(storageAnalytics.wavBytes)} (${storageAnalytics.wavCount} bài)`}
                          />
                        )}
                        {/* MP3 Segment */}
                        {storageAnalytics.mp3Bytes > 0 && (
                          <div
                            style={{
                              width: `${(storageAnalytics.mp3Bytes / storageAnalytics.grandTotalBytes) * 100}%`,
                            }}
                            className="h-full bg-amber-500 hover:brightness-125 transition-all"
                            title={`MP3 320k: ${formatBytes(storageAnalytics.mp3Bytes)} (${storageAnalytics.mp3Count} bài)`}
                          />
                        )}
                        {/* AAC / M4A Segment */}
                        {storageAnalytics.aacBytes > 0 && (
                          <div
                            style={{
                              width: `${(storageAnalytics.aacBytes / storageAnalytics.grandTotalBytes) * 100}%`,
                            }}
                            className="h-full bg-purple-500 hover:brightness-125 transition-all"
                            title={`AAC/M4A: ${formatBytes(storageAnalytics.aacBytes)} (${storageAnalytics.aacCount} bài)`}
                          />
                        )}
                        {/* Cache Segment */}
                        {storageAnalytics.totalCacheBytes > 0 && (
                          <div
                            style={{
                              width: `${(storageAnalytics.totalCacheBytes / storageAnalytics.grandTotalBytes) * 100}%`,
                            }}
                            className="h-full bg-apple-pink hover:brightness-125 transition-all rounded-r-lg"
                            title={`Bộ nhớ đệm (Covers + DSP): ${formatBytes(storageAnalytics.totalCacheBytes)}`}
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full bg-neutral-800 rounded-lg flex items-center justify-center text-[10px] text-neutral-500">
                        Chưa có dữ liệu âm thanh
                      </div>
                    )}
                  </div>

                  {/* Format Legend Badges */}
                  <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="font-semibold text-neutral-300">FLAC Lossless</span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {formatBytes(storageAnalytics.flacBytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-neutral-300">WAV Master</span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {formatBytes(storageAnalytics.wavBytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="font-semibold text-neutral-300">MP3</span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {formatBytes(storageAnalytics.mp3Bytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <span className="font-semibold text-neutral-300">AAC / M4A</span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {formatBytes(storageAnalytics.aacBytes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-apple-pink" />
                      <span className="font-semibold text-neutral-300">Bộ Nhớ Đệm</span>
                      <span className="text-neutral-500 font-mono text-[11px]">
                        {formatBytes(storageAnalytics.totalCacheBytes)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4 Storage Telemetry Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                      Tổng Dung Lượng Nhạc
                    </span>
                    <p className="text-xl font-black text-white font-mono">
                      {formatBytes(storageAnalytics.totalAudioBytes)}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-emerald-400" />
                      Tổng Số Bài Hát
                    </span>
                    <p className="text-xl font-black text-white font-mono">{tracks.length}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Bitrate Trung Bình
                    </span>
                    <p className="text-xl font-black text-amber-400 font-mono">
                      {storageAnalytics.avgBitrate} <span className="text-xs text-neutral-400 font-normal">kbps</span>
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
                      Dung Lượng Cache
                    </span>
                    <p className="text-xl font-black text-apple-pink font-mono">
                      {formatBytes(storageAnalytics.totalCacheBytes)}
                    </p>
                  </div>
                </div>

                {/* Cache Management Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-apple-pink" />
                        Quản Lý Bộ Nhớ Đệm & Tính Năng Âm Học
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Dọn dẹp an toàn bộ nhớ đệm giải phóng dung lượng đĩa cứng mà không bao giờ ảnh hưởng tới tệp nhạc gốc.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowClearConfirm(true)}
                      disabled={isClearing || (cachedCount === 0 && storageAnalytics.totalCacheBytes === 0)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dọn Dẹp Bộ Nhớ Đệm</span>
                    </button>
                  </div>

                  {/* Cache Detail Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-apple-pink/15 flex items-center justify-center text-apple-pink">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Vector Âm Học (7D DSP)</p>
                          <p className="text-[11px] text-neutral-400">
                            {cachedCount} bài đã phân tích nhịp & sắc thái
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-neutral-300">
                        {formatBytes(storageAnalytics.dspCacheBytes)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                          <Disc className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Ảnh Bìa Album Cache</p>
                          <p className="text-[11px] text-neutral-400">
                            {albums.filter((a) => a.picture).length} ảnh bìa được trích xuất cục bộ
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-neutral-300">
                        {formatBytes(storageAnalytics.coverCacheBytes)}
                      </span>
                    </div>
                  </div>

                  {/* Confirmation Sub-Modal / Banner */}
                  {showClearConfirm && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-3 animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-rose-200">
                            Xác nhận dọn dẹp toàn bộ bộ nhớ đệm phân tích âm học?
                          </p>
                          <p className="text-[11px] text-rose-300/80 mt-0.5">
                            Các vector DSP (BPM, Mood, Energy) sẽ được xóa an toàn. Ứng dụng sẽ phân tích lại khi bạn quét thư viện.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          onClick={handleExecuteClearCache}
                          disabled={isClearing}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg transition-all cursor-pointer active:scale-95"
                        >
                          {isClearing ? 'Đang xóa...' : 'Đồng ý xóa'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RAM & LRU Discovery Cache Management Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <Zap className="w-4 h-4" />
                        </div>
                        <h4 className="text-base font-bold text-white">
                          Tối Ưu Bộ Nhớ RAM & Thu Hồi Working Set
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-400">
                        LRU Discovery Cache: <span className="text-white font-mono font-bold">{discoveryRecLRU.size} danh sách</span>, <span className="text-white font-mono font-bold">{discoveryStreamLRU.size} streams</span> ({formatBytes(lruCacheBytes)}). Kích hoạt thu hồi RAM Native Win32 / SQLite shrink memory.
                      </p>
                    </div>

                    <button
                      onClick={handleClearLruAndShrink}
                      disabled={isShrinkingRam}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40 shrink-0"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isShrinkingRam ? 'animate-spin' : ''}`} />
                      <span>{isShrinkingRam ? 'Đang giải phóng...' : 'Giải Phóng RAM Ngay'}</span>
                    </button>
                  </div>

                  {shrinkSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-200 flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{shrinkSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Storage Breakdown Table: Sort by Size */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <FileAudio className="w-4 h-4 text-blue-400" />
                      Chi Tiết Độ Nặng Từng Bài Hát
                    </h4>

                    {/* Filter & Search Controls */}
                    <div className="flex items-center gap-2">
                      {/* Format Filter Chips */}
                      <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 text-xs">
                        {['all', 'FLAC', 'WAV', 'MP3', 'AAC'].map((fmt) => (
                          <button
                            key={fmt}
                            onClick={() => setSelectedFormatFilter(fmt)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              selectedFormatFilter === fmt
                                ? 'bg-apple-pink text-white shadow-sm'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            {fmt === 'all' ? 'Tất cả' : fmt}
                          </button>
                        ))}
                      </div>

                      {/* Search Bar */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={storageSearch}
                          onChange={(e) => setStorageSearch(e.target.value)}
                          placeholder="Tìm bài hát..."
                          className="w-36 bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-apple-pink/50 transition-all"
                        />
                      </div>

                      {/* Sort Toggle Button */}
                      <button
                        onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-all cursor-pointer"
                        title={sortDirection === 'desc' ? 'Đang xếp từ lớn nhất xuống' : 'Đang xếp từ nhỏ nhất lên'}
                      >
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tracks List Table */}
                  <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden shadow-lg">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/10 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                      <div className="col-span-6 sm:col-span-5">Bài Hát / Nghệ Sĩ</div>
                      <div className="col-span-2 text-center">Định Dạng</div>
                      <div className="col-span-2 text-center">Thời Lượng</div>
                      <div className="col-span-2 sm:col-span-3 text-right">Dung Lượng Tệp</div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-white/5 custom-scrollbar">
                      {filteredAndSortedTracks.length > 0 ? (
                        filteredAndSortedTracks.slice(0, 100).map(({ track, format, sizeBytes, bitrateKbps, fileName }) => (
                          <div
                            key={track.id}
                            className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-white/[0.04] transition-colors text-xs"
                          >
                            <div className="col-span-6 sm:col-span-5 flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                                {track.picture ? (
                                  <img
                                    src={convertFileSrc(track.picture)}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                    <Music className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-white truncate">{track.title}</p>
                                <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                              </div>
                            </div>

                            <div className="col-span-2 flex justify-center">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                  format === 'FLAC'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                    : format === 'WAV'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : format === 'MP3'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                }`}
                              >
                                {format}
                              </span>
                            </div>

                            <div className="col-span-2 text-center font-mono text-neutral-400 text-[11px]">
                              {formatSeconds(track.duration || 0)}
                            </div>

                            <div className="col-span-2 sm:col-span-3 text-right">
                              <span className="font-mono font-bold text-white">{formatBytes(sizeBytes)}</span>
                              <span className="text-[10px] text-neutral-500 ml-1.5 hidden sm:inline">
                                ({bitrateKbps} kbps)
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-xs text-neutral-500">
                          Không tìm thấy bài hát nào phù hợp với bộ lọc.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB: AUDIO & DSP ENGINE ===================== */}
            {activeTab === 'audio' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-apple-pink/20 text-apple-pink border border-apple-pink/30 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      AI ACOUSTIC SCANNER
                    </span>
                    <span className="text-xs font-medium text-neutral-400">DSP 7D Vectorization</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Quét & Phân Tích Âm Học Chủ Động
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Trích xuất BPM, năng lượng, độ nảy và sắc thái cảm xúc để gợi ý bài hát thông minh.
                  </p>
                </div>

                {/* Audio Scanner Card */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Tiến Độ Phân Tích Thư Viện</p>
                      <p className="text-xs text-neutral-400">
                        {scannerState.status === 'scanning' || scannerState.status === 'paused'
                          ? scannerState.completed
                          : cachedCount}{' '}
                        / {tracks.length} bài hát
                      </p>
                    </div>

                    {/* Status Badges */}
                    <div>
                      {scannerState.status === 'scanning' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5 animate-pulse">
                          <Activity className="w-3.5 h-3.5 animate-spin" />
                          Đang phân tích...
                        </span>
                      )}
                      {scannerState.status === 'paused' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Tạm dừng
                        </span>
                      )}
                      {scannerState.status === 'completed' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Hoàn tất 100%
                        </span>
                      )}
                      {scannerState.status === 'idle' && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-neutral-300 border border-white/15 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          Sẵn sàng
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-apple-pink to-purple-500 transition-all duration-300 rounded-full"
                        style={{
                          width: `${
                            tracks.length > 0
                              ? ((scannerState.status === 'scanning' || scannerState.status === 'paused'
                                  ? scannerState.completed
                                  : cachedCount) /
                                  tracks.length) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-2">
                    {scannerState.status !== 'scanning' && scannerState.status !== 'paused' && (
                      <button
                        onClick={handleStartScan}
                        disabled={tracks.length === 0}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-apple-pink hover:bg-apple-pinkHover text-white shadow-lg shadow-apple-pink/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Bắt đầu quét phân tích</span>
                      </button>
                    )}

                    {scannerState.status === 'scanning' && (
                      <>
                        <button
                          onClick={handlePauseScan}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Tạm dừng</span>
                        </button>

                        <button
                          onClick={handleCancelScan}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Hủy quét</span>
                        </button>
                      </>
                    )}

                    {scannerState.status === 'paused' && (
                      <>
                        <button
                          onClick={handleResumeScan}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Tiếp tục quét</span>
                        </button>

                        <button
                          onClick={handleCancelScan}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Hủy quét</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Real-time Telemetry Monitor when Scanning */}
                {(scannerState.status === 'scanning' || scannerState.status === 'paused') && scannerState.currentTrack && (
                  <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <span className="flex items-center gap-1.5 text-white font-semibold">
                        <Activity className="w-3.5 h-3.5 text-apple-pink" />
                        Giám sát phân tích thời gian thực
                      </span>
                      <span>
                        Tốc độ: <strong className="text-white">{scannerState.speedPerSec} bài/s</strong> · Còn lại:{' '}
                        <strong className="text-white">{formatSeconds(scannerState.etaSeconds)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                        {scannerState.currentTrack.picture ? (
                          <img
                            src={convertFileSrc(scannerState.currentTrack.picture)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Music className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{scannerState.currentTrack.title}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{scannerState.currentTrack.artist}</p>
                      </div>
                      {scannerState.currentAnalysis && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            {scannerState.currentAnalysis.bpm} BPM
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                            {scannerState.currentAnalysis.primaryMood}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===================== TAB: TRANSLATION & AI ===================== */}
            {activeTab === 'translation' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                      <Languages className="w-3 h-3" />
                      AI & LYRICS TRANSLATION
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Dịch thuật ngữ cảnh & Tích hợp mô hình AI</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Dịch Lời Bài Hát & Tích Hợp AI Engines
                  </h3>
                </div>

                {/* 1. Chế Độ Dịch Lời Bài Hát (Thủ Công vs Tự Động) */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-apple-pink" />
                      <span>Chế Độ Dịch Lời Bài Hát</span>
                    </h4>
                    <span className="text-[11px] text-neutral-400">
                      Hiện tại: <strong className="text-apple-pink">{transSettings.autoTranslate ? 'Tự Động Khi Mở' : 'Thủ Công (Mặc định)'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Chế độ 1: Thủ công (Mặc định) */}
                    <button
                      onClick={() => updateTransSettings({ autoTranslate: false })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        !transSettings.autoTranslate
                          ? 'bg-apple-pink/15 border-apple-pink text-white shadow-lg shadow-apple-pink/10 ring-1 ring-apple-pink/40'
                          : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Languages className="w-4 h-4 text-apple-pink" />
                          <span className="text-sm font-bold text-white">Dịch Thủ Công</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-white/10">
                          Mặc Định
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Chỉ dịch khi bạn bấm nút <strong>"Dịch"</strong> trên giao diện lời bài hát. Tiết kiệm lưu lượng mạng và API tokens.
                      </p>
                      {!transSettings.autoTranslate && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-apple-pink pt-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đang áp dụng</span>
                        </div>
                      )}
                    </button>

                    {/* Chế độ 2: Tự động dịch khi mở */}
                    <button
                      onClick={() => updateTransSettings({ autoTranslate: true, enabled: true })}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        transSettings.autoTranslate
                          ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-500/15 ring-1 ring-purple-500/40'
                          : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-400" />
                          <span className="text-sm font-bold text-white">Tự Động Dịch Khi Mở</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Tự Động
                        </span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Tự động nhận diện và dịch toàn bộ lời bài hát sang ngôn ngữ đích ngay khi bạn mở bài hát mới.
                      </p>
                      {transSettings.autoTranslate && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 pt-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đang kích hoạt</span>
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* 2. Chọn Trình Sẽ Dịch Tự Động (Auto-Translate Provider Engine) */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Bot className="w-4 h-4 text-apple-pink" />
                        <span>Chọn Trình Sẽ Dịch Tự Động</span>
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Trình dịch được chỉ định thực hiện dịch tự động khi mở bài hát
                      </p>
                    </div>
                    <span className="text-xs font-bold text-apple-pink bg-apple-pink/10 px-3 py-1 rounded-full border border-apple-pink/20 uppercase tracking-wider">
                      {transSettings.autoTranslateProvider || transSettings.provider}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'google' as const, title: 'Google Dịch (Auto)', desc: 'Miễn phí, tự động & Không cần Key', tag: 'Phổ biến' },
                      { id: 'gemini' as const, title: 'Google Gemini AI', desc: '1.5 Flash / 2.0 Flash thi vị', tag: 'AI Cảm Xúc' },
                      { id: 'openai' as const, title: 'OpenAI (ChatGPT)', desc: 'GPT-4o / GPT-4o-mini chuẩn nhịp', tag: 'Chính xác' },
                      { id: 'openrouter' as const, title: 'OpenRouter', desc: 'Cổng đa mô hình mở thế giới', tag: 'Linh hoạt' },
                      { id: 'claude' as const, title: 'Anthropic Claude', desc: 'Claude 3.5 / 3.7 Sonnet sâu sắc', tag: 'Văn Phong' },
                      { id: 'custom' as const, title: 'Custom Endpoint', desc: 'OpenAI-compatible / Ollama riêng', tag: 'Tự Lưu Trữ' },
                    ].map((engine) => {
                      const isSelected = (transSettings.autoTranslateProvider || transSettings.provider) === engine.id;
                      return (
                        <button
                          key={engine.id}
                          onClick={() => updateTransSettings({ autoTranslateProvider: engine.id, provider: engine.id })}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                            isSelected
                              ? 'bg-apple-pink/20 border-apple-pink text-white shadow-md ring-1 ring-apple-pink/40'
                              : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-white">{engine.title}</span>
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 text-apple-pink shrink-0" />
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-neutral-400">{engine.tag}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400 leading-snug">{engine.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Cấu hình Ngôn ngữ đích & Hiển thị */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-apple-pink" />
                    <span>Cấu Hình Hiển Thị & Ngôn Ngữ Đích</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bật/Tắt hiển thị lời dịch */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div>
                        <span className="text-xs font-bold text-neutral-200">Hiển thị lời dịch song ngữ</span>
                        <p className="text-[11px] text-neutral-400">Hiện dòng chữ phụ dưới từng câu hát</p>
                      </div>
                      <button
                        onClick={() => updateTransSettings({ enabled: !transSettings.enabled })}
                        className={`w-11 h-6 rounded-full transition-all relative cursor-pointer ${
                          transSettings.enabled ? 'bg-apple-pink' : 'bg-neutral-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-all transform absolute top-1 ${
                            transSettings.enabled ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Ngôn ngữ đích */}
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                        <span>Ngôn ngữ đích mặc định</span>
                        <span className="text-[10px] font-bold text-apple-pink uppercase">{transSettings.targetLanguage}</span>
                      </label>
                      <select
                        value={transSettings.targetLanguage}
                        onChange={(e) => updateTransSettings({ targetLanguage: e.target.value })}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-apple-pink cursor-pointer"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code} className="bg-neutral-900 text-white">
                            {lang.name} ({lang.native})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 4. Tùy biến Giao diện Sub-Text Lời Dịch (Apple Music, Spotify, Minimal...) */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Palette className="w-4 h-4 text-apple-pink" />
                      <span>Tùy Biến Giao Diện Sub-Text Lời Dịch</span>
                    </h4>
                    <span className="text-[11px] text-neutral-400">Phong cách hiển thị & Màu sắc</span>
                  </div>

                  {/* Phong cách mẫu (Style Presets) */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-200">Phong cách mẫu hiển thị</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        {
                          id: 'apple' as const,
                          name: 'Apple Music',
                          desc: 'Chữ mềm mại, phát sáng dịu',
                          badge: 'Thanh lịch',
                        },
                        {
                          id: 'spotify' as const,
                          name: 'Spotify',
                          desc: 'Sans-serif đậm, nổi bật',
                          badge: 'Hiện đại',
                        },
                        {
                          id: 'minimal' as const,
                          name: 'Tối Giản Cinema',
                          desc: 'Nhỏ gọn, xám bạc tinh tế',
                          badge: 'Subtle',
                        },
                        {
                          id: 'duet-glow' as const,
                          name: 'Song Ca Neon',
                          desc: 'Hào quang neon rực rỡ',
                          badge: 'Glow Pulse',
                        },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            const newColor = st.id === 'spotify' ? '#1DB954' : st.id === 'apple' ? '#FA243C' : transSettings.color;
                            updateTransSettings({ style: st.id, color: newColor });
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            transSettings.style === st.id
                              ? 'bg-apple-pink/20 border-apple-pink/60 text-white shadow-md shadow-apple-pink/15'
                              : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{st.name}</span>
                            {transSettings.style === st.id && <Check className="w-3.5 h-3.5 text-apple-pink" />}
                          </div>
                          <span className="text-[10px] text-neutral-400 mt-1">{st.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kích thước & Độ mờ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Kích thước sub-text */}
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                      <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                        <span>Kích thước Sub-Text</span>
                        <span className="text-[11px] text-apple-pink font-semibold uppercase">
                          {transSettings.fontSize === 'tiny' ? 'Nhỏ xinh (Compact)' : transSettings.fontSize === 'small' ? 'Vừa vặn (Standard)' : 'Rõ nét (Medium)'}
                        </span>
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'tiny' as const, label: 'Nhỏ xinh' },
                          { id: 'small' as const, label: 'Vừa vặn' },
                          { id: 'medium' as const, label: 'Rõ nét' },
                        ].map((sz) => (
                          <button
                            key={sz.id}
                            onClick={() => updateTransSettings({ fontSize: sz.id })}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              transSettings.fontSize === sz.id
                                ? 'bg-apple-pink text-white border-apple-pink'
                                : 'bg-neutral-900/80 text-neutral-400 border-white/5 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mờ khi chưa hát tới */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div>
                        <span className="text-xs font-bold text-neutral-200">Mờ nhẹ khi chưa phát đến</span>
                        <p className="text-[11px] text-neutral-400">Tạo chiều sâu không gian như Apple Music</p>
                      </div>
                      <button
                        onClick={() => updateTransSettings({ dimInactive: !transSettings.dimInactive })}
                        className={`w-11 h-6 rounded-full transition-all relative cursor-pointer ${
                          transSettings.dimInactive ? 'bg-apple-pink' : 'bg-neutral-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-all transform absolute top-1 ${
                            transSettings.dimInactive ? 'left-6' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Bảng màu sắc Sub-text */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
                    <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                      <span>Màu sắc hiển thị của Sub-Text</span>
                      <span className="font-mono text-[11px] text-neutral-400 uppercase">{transSettings.color || '#FA243C'}</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { color: '#FA243C', name: 'Apple Pink' },
                        { color: '#1DB954', name: 'Spotify Green' },
                        { color: '#06B6D4', name: 'Electric Cyan' },
                        { color: '#F59E0B', name: 'Sunset Gold' },
                        { color: '#A855F7', name: 'Soft Purple' },
                        { color: '#FFFFFF', name: 'Pure White' },
                        { color: '#9CA3AF', name: 'Subtle Silver' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          onClick={() => updateTransSettings({ color: c.color })}
                          className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            transSettings.color.toLowerCase() === c.color.toLowerCase()
                              ? 'border-white ring-2 ring-white/30 scale-105 shadow-md'
                              : 'border-white/10 hover:border-white/30'
                          }`}
                          style={{ backgroundColor: `${c.color}22`, color: c.color }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                          <span>{c.name}</span>
                        </button>
                      ))}

                      {/* Color Picker tùy chỉnh */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                        <label className="text-[11px] text-neutral-400 font-semibold cursor-pointer">Tùy chọn:</label>
                        <input
                          type="color"
                          value={transSettings.color || '#FA243C'}
                          onChange={(e) => updateTransSettings({ color: e.target.value })}
                          className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Live Preview Box */}
                  <div className="rounded-xl bg-black/40 border border-white/10 p-4 space-y-2">
                    <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">
                      Xem Trước Trực Tiếp (Live Lyric Preview)
                    </span>
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1">
                      <p className="text-sm md:text-base font-black text-white tracking-tight">
                        Because you're with me, every moment is a melody
                      </p>
                      <p
                        style={{
                          color: transSettings.color || '#FA243C',
                        }}
                        className={`mt-0.5 transition-all ${
                          transSettings.fontSize === 'tiny'
                            ? 'text-[11px] md:text-xs'
                            : transSettings.fontSize === 'small'
                            ? 'text-xs md:text-sm'
                            : 'text-sm md:text-base'
                        } ${
                          transSettings.style === 'apple'
                            ? 'font-bold opacity-100 drop-shadow-[0_2px_10px_rgba(250,36,60,0.35)]'
                            : transSettings.style === 'spotify'
                            ? 'font-black tracking-wide opacity-100'
                            : transSettings.style === 'minimal'
                            ? 'font-medium text-neutral-200 opacity-90'
                            : 'font-black drop-shadow-[0_0_10px_currentColor] animate-pulse'
                        }`}
                      >
                        Vì có người bên cạnh, từng khoảnh khắc đều hóa thành khúc ngân nga
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Chi tiết Cấu hình API Engine */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-4 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-apple-pink" />
                    <span>Cấu Hình Chi Tiết: {transSettings.provider.toUpperCase()}</span>
                  </h4>

                  {/* Google Translate Notice */}
                  {transSettings.provider === 'google' && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Google Dịch đang hoạt động ở chế độ tự động miễn phí.</p>
                        <p className="text-[11px] text-emerald-300/80 mt-1">
                          Không yêu cầu API Key hay tài khoản. Ứng dụng sẽ tự động chia nhỏ và đồng bộ lời bài hát với độ trễ cực thấp.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gemini Config */}
                  {transSettings.provider === 'gemini' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                          <span>Google Gemini API Key</span>
                          <button
                            type="button"
                            onClick={() => openExternalLink('https://aistudio.google.com/app/apikey')}
                            className="text-[11px] text-apple-pink hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Lấy API Key tại Google AI Studio</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={transSettings.geminiApiKey}
                            onChange={(e) => updateTransSettings({ geminiApiKey: e.target.value })}
                            placeholder="AIzaSy..."
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                          <span>Mô hình (Model Gemini)</span>
                          <span className="text-[10px] text-apple-pink font-semibold">Cho phép nhập tùy chỉnh</span>
                        </label>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={transSettings.geminiModel}
                            onChange={(e) => updateTransSettings({ geminiModel: e.target.value })}
                            placeholder="gemini-3.5-flash-lite hoặc gemini-3.7-flash"
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {[
                              { id: 'gemini-3.5-flash-lite', label: '3.5 Flash Lite (Mặc định)' },
                              { id: 'gemini-3.7-flash', label: '3.7 Flash' },
                              { id: 'gemini-2.0-flash', label: '2.0 Flash' },
                              { id: 'gemini-2.0-pro-exp-02-05', label: '2.0 Pro Exp' },
                              { id: 'gemini-1.5-pro', label: '1.5 Pro' },
                              { id: 'gemini-1.5-flash', label: '1.5 Flash' },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => updateTransSettings({ geminiModel: m.id })}
                                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                                  transSettings.geminiModel === m.id
                                    ? 'bg-apple-pink/20 text-apple-pink border-apple-pink/50 shadow-sm'
                                    : 'bg-white/5 text-neutral-300 border-white/5 hover:bg-white/15 hover:text-white'
                                }`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OpenAI Config */}
                  {transSettings.provider === 'openai' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                          <span>OpenAI API Key</span>
                          <button
                            type="button"
                            onClick={() => openExternalLink('https://platform.openai.com/api-keys')}
                            className="text-[11px] text-apple-pink hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Lấy API Key tại OpenAI Platform</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={transSettings.openaiApiKey}
                            onChange={(e) => updateTransSettings({ openaiApiKey: e.target.value })}
                            placeholder="sk-proj-..."
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200">Mô hình (Model)</label>
                        <select
                          value={transSettings.openaiModel}
                          onChange={(e) => updateTransSettings({ openaiModel: e.target.value })}
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-pink cursor-pointer"
                        >
                          <option value="gpt-4o">GPT-4o (Toàn năng, thi ca vượt trội)</option>
                          <option value="gpt-4o-mini">GPT-4o mini (Nhanh, thông minh, tiết kiệm)</option>
                          <option value="o3-mini">o3-mini (Suy luận chuyên sâu)</option>
                          <option value="gpt-4.5-preview">GPT-4.5 Preview (Thế hệ mới nhất)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* OpenRouter Config */}
                  {transSettings.provider === 'openrouter' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                          <span>OpenRouter API Key</span>
                          <button
                            type="button"
                            onClick={() => openExternalLink('https://openrouter.ai/keys')}
                            className="text-[11px] text-apple-pink hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Lấy API Key tại OpenRouter</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={transSettings.openrouterApiKey}
                            onChange={(e) => updateTransSettings({ openrouterApiKey: e.target.value })}
                            placeholder="sk-or-v1-..."
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200">Mô hình OpenRouter (Model ID)</label>
                        <input
                          type="text"
                          value={transSettings.openrouterModel}
                          onChange={(e) => updateTransSettings({ openrouterModel: e.target.value })}
                          placeholder="anthropic/claude-3.7-sonnet hoặc google/gemini-2.0-flash-001"
                          className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {[
                            'anthropic/claude-3.7-sonnet',
                            'google/gemini-2.0-flash-001',
                            'google/gemini-2.0-pro-exp-02-05',
                            'deepseek/deepseek-chat',
                            'meta-llama/llama-3.3-70b-instruct',
                          ].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => updateTransSettings({ openrouterModel: m })}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/15 text-neutral-300 transition-colors cursor-pointer"
                            >
                              {m.split('/')[1]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Claude Config */}
                  {transSettings.provider === 'claude' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200 flex items-center justify-between">
                          <span>Anthropic Claude API Key</span>
                          <button
                            type="button"
                            onClick={() => openExternalLink('https://console.anthropic.com/')}
                            className="text-[11px] text-apple-pink hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Lấy API Key tại Anthropic Console</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={transSettings.claudeApiKey}
                            onChange={(e) => updateTransSettings({ claudeApiKey: e.target.value })}
                            placeholder="sk-ant-..."
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl pl-3 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200">Mô hình (Model)</label>
                        <select
                          value={transSettings.claudeModel}
                          onChange={(e) => updateTransSettings({ claudeModel: e.target.value })}
                          className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-pink cursor-pointer"
                        >
                          <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Flagship 3.7 mới nhất, tư duy Hybrid)</option>
                          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Chất lượng văn học cao cấp)</option>
                          <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Nhanh, chi phí thấp)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Custom Endpoint Config */}
                  {transSettings.provider === 'custom' && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-neutral-200">URL Endpoint (OpenAI Compatible)</label>
                        <input
                          type="text"
                          value={transSettings.customEndpointUrl}
                          onChange={(e) => updateTransSettings({ customEndpointUrl: e.target.value })}
                          placeholder="http://localhost:11434/v1 hoặc https://api.mycustomai.com/v1"
                          className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-neutral-200">API Key (Tùy chọn)</label>
                          <input
                            type="password"
                            value={transSettings.customApiKey}
                            onChange={(e) => updateTransSettings({ customApiKey: e.target.value })}
                            placeholder="Bearer token hoặc để trống"
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-neutral-200">Tên Model</label>
                          <input
                            type="text"
                            value={transSettings.customModel}
                            onChange={(e) => updateTransSettings({ customModel: e.target.value })}
                            placeholder="llama3:latest hoặc gpt-3.5-turbo"
                            className="w-full bg-neutral-900 border border-white/10 focus:border-apple-pink rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test API Button & Feedback */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      onClick={handleTestApi}
                      disabled={isTestingApi}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isTestingApi ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang kiểm tra kết nối...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
                          <span>Thử nghiệm kết nối API</span>
                        </>
                      )}
                    </button>

                    {testApiResult && (
                      <div
                        className={`p-2.5 rounded-xl text-xs flex items-center gap-2 max-w-md ${
                          testApiResult.success
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {testApiResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span className="truncate">{testApiResult.message}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Quy chuẩn dịch thuật ngữ cảnh và thi ca */}
                <div className="border border-white/10 rounded-2xl bg-white/[0.02] p-5 space-y-3 shadow-xl">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Quy Chuẩn Dịch Thuật Ngữ Cảnh & Văn Hóa Nghệ Thuật</span>
                  </h4>
                  <div className="space-y-2 text-xs text-neutral-300 leading-relaxed">
                    <p>
                      • <strong>Thấu cảm tác giả:</strong> Hệ thống tự động truyền tải thông tin nghệ sĩ, album, ngữ cảnh và tâm trạng bài hát vào System Prompt của AI.
                    </p>
                    <p>
                      • <strong>Phong hóa & Thi ca:</strong> Các thuật ngữ tiếng lóng, lối chơi chữ, ẩn dụ văn hóa được chuyển thể thoát ý tự nhiên, văn minh và giữ trọn nhạc tính.
                    </p>
                    <p>
                      • <strong>Đồng bộ thời gian 1:1:</strong> Giữ nguyên nhịp điệu và dòng khớp chính xác với karaoke timeline khi bài hát đang phát.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB: FOLDERS & LIBRARY ===================== */}
            {activeTab === 'folders' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                      <FolderTree className="w-3 h-3" />
                      LIBRARY MANAGEMENT
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Thư mục nguồn & Quét tệp</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Quản Lý Thư Mục & Thư Viện Nhạc
                  </h3>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Quét Thư Mục Nhạc Trên Máy Tính</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Chọn một thư mục chứa các file FLAC, MP3, WAV, AAC để đồng bộ hóa vào thư viện Flarity.
                      </p>
                    </div>

                    <button
                      onClick={selectFolderAndScan}
                      disabled={isScanning}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-apple-pink hover:bg-apple-pinkHover text-white shadow-lg shadow-apple-pink/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>{isScanning ? 'Đang quét...' : 'Chọn thư mục mới'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5" />
                        Bài Hát
                      </span>
                      <p className="text-2xl font-black text-white">{tracks.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-apple-pink" />
                        Nghệ Sĩ
                      </span>
                      <p className="text-2xl font-black text-white">{artistProfiles.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Disc className="w-3.5 h-3.5 text-purple-400" />
                        Albums
                      </span>
                      <p className="text-2xl font-black text-white">{albums.length}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        Đã Phân Tích
                      </span>
                      <p className="text-2xl font-black text-emerald-400">{cachedCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB: GENERAL & UI ===================== */}
            {activeTab === 'general' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                      <Palette className="w-3 h-3" />
                      PREFERENCES
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Giao diện & Trải nghiệm</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Cài Đặt Chung & Giao Diện
                  </h3>
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  {/* Option 1: Glassmorphism */}
                  <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <div>
                      <p className="text-sm font-bold text-white">Hiệu Ứng Nền Kính Mờ (Liquid Glassmorphism)</p>
                      <p className="text-xs text-neutral-400">Kích hoạt chuyển động gradient đổi màu sống động theo bìa bài hát</p>
                    </div>
                    <button
                      onClick={() => setGlassmorphismEffect(!glassmorphismEffect)}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                        glassmorphismEffect ? 'bg-apple-pink' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          glassmorphismEffect ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Option 2: Lyrics Auto Save */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-bold text-white">Tự Động Lưu File Lời (.lrc) Cục Bộ</p>
                      <p className="text-xs text-neutral-400">Tải lời bài hát từ LRCLIB và lưu vào cùng thư mục file nhạc</p>
                    </div>
                    <button
                      onClick={() => setAutoDownloadLyrics(!autoDownloadLyrics)}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                        autoDownloadLyrics ? 'bg-apple-pink' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          autoDownloadLyrics ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Spicetify Community Lyrics Section */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-apple-pink" />
                      <div>
                        <p className="text-sm font-bold text-white">Hiệu Ứng Lời Bài Hát (Spicetify Lyrics Effects)</p>
                        <p className="text-[11px] text-neutral-400">Tùy biến chuyển động ca từ & hiệu ứng nền thị giác thời gian thực</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLyricSettings(DEFAULT_LYRIC_SETTINGS);
                        saveLyricSettings(DEFAULT_LYRIC_SETTINGS);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Khôi phục mặc định ban đầu"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Mặc định</span>
                    </button>
                  </div>

                  {/* 1. Style selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
                      <span>Kiểu Hoạt Họa Ca Từ (Typography Style)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { id: 'apple', label: 'Apple Music Focus', desc: 'Làm mờ ngoài tiêu điểm, phóng to mượt mà' },
                        { id: 'karaoke', label: 'Karaoke Sweep', desc: 'Quét màu phát sáng theo thời gian thực' },
                        { id: 'neon', label: 'Neon Cyberpunk', desc: 'Ánh sáng neon đa tầng nhịp nhàng' },
                        { id: 'perspective3d', label: '3D Perspective Stage', desc: 'Không gian 3D uốn cong chiều sâu' },
                        { id: 'spotify', label: 'Spotify Modern Bold', desc: 'Chữ đậm tương phản cao dứt khoát' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => updateLyricSettings({ style: item.id as any })}
                          className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                            lyricSettings.style === item.id
                              ? 'bg-apple-pink/15 border-apple-pink text-white shadow-lg shadow-apple-pink/10 ring-1 ring-apple-pink'
                              : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <p className="text-xs font-black">{item.label}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Visualizer background selector */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-purple-400" />
                      <span>Hiệu Ứng Nền Thị Giác (Visualizer Background)</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'mesh', label: 'Fluid Dynamic Mesh' },
                        { id: 'cosmic', label: 'Cosmic Starfield' },
                        { id: 'aurora', label: 'Aurora Borealis' },
                        { id: 'vinyl', label: 'Vinyl Spin & Aura' },
                        { id: 'spectrum', label: 'Spectrum Frequency' },
                        { id: 'dark', label: 'OLED Pure Dark' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => updateLyricSettings({ bgEffect: item.id as any })}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            lyricSettings.bgEffect === item.id
                              ? 'bg-purple-600/20 border-purple-500 text-white shadow-md ring-1 ring-purple-500'
                              : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Typography & Alignment */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Font Size */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Cỡ Chữ Ca Từ</span>
                      </label>
                      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                        {[
                          { id: 'medium', label: 'Vừa' },
                          { id: 'large', label: 'Lớn' },
                          { id: 'xlarge', label: 'Rất Lớn' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => updateLyricSettings({ fontSize: f.id as any })}
                            className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                              lyricSettings.fontSize === f.id
                                ? 'bg-apple-pink text-white shadow-md font-black'
                                : 'text-neutral-400 hover:text-white'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Alignment */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <AlignLeft className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Căn Lề Ca Từ</span>
                      </label>
                      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                        {[
                          { id: 'left', label: 'Trái', icon: AlignLeft },
                          { id: 'center', label: 'Giữa', icon: AlignCenter },
                          { id: 'right', label: 'Phải', icon: AlignRight },
                        ].map((a) => {
                          const Icon = a.icon;
                          return (
                            <button
                              key={a.id}
                              onClick={() => updateLyricSettings({ textAlign: a.id as any })}
                              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-bold transition-all text-xs cursor-pointer ${
                                lyricSettings.textAlign === a.id
                                  ? 'bg-apple-pink text-white shadow-md font-black'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{a.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. Quick Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                      <div>
                        <p className="text-xs font-black text-white">Làm mờ câu ngoài tiêu điểm</p>
                        <p className="text-[10px] text-neutral-400">Giảm độ tương phản câu chưa hát</p>
                      </div>
                      <button
                        onClick={() => updateLyricSettings({ blurInactive: !lyricSettings.blurInactive })}
                        className={`w-10 h-5 rounded-full transition-colors p-0.5 cursor-pointer relative ${
                          lyricSettings.blurInactive ? 'bg-apple-pink' : 'bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            lyricSettings.blurInactive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/5">
                      <div>
                        <p className="text-xs font-black text-white">Hiện lời song ngữ / phiên âm</p>
                        <p className="text-[10px] text-neutral-400">Hiển thị lời dịch tiếng Việt hoặc Romaji</p>
                      </div>
                      <button
                        onClick={() => updateLyricSettings({ showTranslation: !lyricSettings.showTranslation })}
                        className={`w-10 h-5 rounded-full transition-colors p-0.5 cursor-pointer relative ${
                          lyricSettings.showTranslation ? 'bg-apple-pink' : 'bg-neutral-700'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            lyricSettings.showTranslation ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB: SHORTCUTS ===================== */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                      <Keyboard className="w-3 h-3" />
                      KEYBOARD SHORTCUTS
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Thao tác nhanh bàn phím</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Danh Sách Phím Tắt Tiện Dụng
                  </h3>
                </div>

                <div className="border border-white/10 rounded-2xl bg-white/[0.02] overflow-hidden divide-y divide-white/5 shadow-xl">
                  <div className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                    <span className="text-xs text-neutral-300 font-semibold">Phát / Tạm dừng phát nhạc</span>
                    <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">Space</kbd>
                  </div>

                  <div className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                    <span className="text-xs text-neutral-300 font-semibold">Tăng / Giảm âm lượng</span>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">↑</kbd>
                      <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">↓</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                    <span className="text-xs text-neutral-300 font-semibold">Tua nhanh / Lùi 5 giây</span>
                    <div className="flex items-center gap-1">
                      <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">←</kbd>
                      <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">→</kbd>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                    <span className="text-xs text-neutral-300 font-semibold">Bật / Tắt chế độ Lời bài hát Karaoke</span>
                    <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">L</kbd>
                  </div>

                  <div className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                    <span className="text-xs text-neutral-300 font-semibold">Đóng cửa sổ hoặc Thoát toàn màn hình</span>
                    <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">Esc</kbd>
                  </div>
                </div>
              </div>
            )}

            {/* ===================== TAB: UPDATES & ABOUT ===================== */}
            {activeTab === 'updates' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-apple-pink/20 text-apple-pink border border-apple-pink/30 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      APP RELEASES & UPDATES
                    </span>
                    <span className="text-xs font-medium text-neutral-400">Phiên bản & Tự động cập nhật</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight mt-1">
                    Cập Nhật Ứng Dụng & Giới Thiệu
                  </h3>
                </div>

                {/* 1. App Identity Card */}
                <div className="p-5 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-center p-2.5 shadow-lg shadow-apple-pink/10 shrink-0">
                      <img src="/logo.png" alt="Flarity Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-white">Flarity Music</h4>
                        <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-white/10 border border-white/15 text-neutral-200">
                          v{currentVersion}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Rust Tauri v2 • React 19 • Tailwind v4 • Web Audio Studio DSP
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Hệ điều hành: {detectPlatform() === 'windows' ? 'Windows x64' : detectPlatform() === 'macos' ? 'macOS Universal' : 'Cross-Platform'} · Mã nguồn mở MIT
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => checkUpdateNow()}
                    disabled={isCheckingUpdate}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-60 shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingUpdate ? 'animate-spin text-apple-pink' : ''}`} />
                    <span>{isCheckingUpdate ? 'Đang kiểm tra...' : 'Kiểm tra bản mới'}</span>
                  </button>
                </div>

                {/* 2. Update Status Card */}
                {isCheckingUpdate ? (
                  <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center gap-3 text-neutral-300 shadow-md">
                    <Loader2 className="w-5 h-5 animate-spin text-apple-pink" />
                    <span className="text-xs font-semibold">Đang kết nối máy chủ GitHub Releases để kiểm tra phiên bản mới...</span>
                  </div>
                ) : updateInfo?.hasUpdate ? (
                  <div className="p-6 rounded-3xl bg-apple-pink/10 border border-apple-pink/40 space-y-4 shadow-xl ring-1 ring-apple-pink/30 animate-in fade-in duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-apple-pink/20 border border-apple-pink/40 flex items-center justify-center text-apple-pink">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-apple-pink text-white">
                              Có Bản Cập Nhật Mới
                            </span>
                            <span className="text-xs font-mono font-bold text-white">
                              v{updateInfo.latestVersion}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-white mt-1">
                            {updateInfo.releaseTitle || `Flarity Music v${updateInfo.latestVersion}`}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (updateInfo.recommendedAsset?.downloadUrl) {
                            openExternalLink(updateInfo.recommendedAsset.downloadUrl);
                          } else {
                            openExternalLink(updateInfo.releaseUrl);
                          }
                        }}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-apple-pink to-rose-600 hover:brightness-110 text-white shadow-lg shadow-apple-pink/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải Bản Cập Nhật Ngay</span>
                      </button>
                    </div>

                    {updateInfo.releaseNotes && (
                      <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs text-neutral-300 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar font-sans leading-relaxed">
                        {updateInfo.releaseNotes}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-300">Ứng dụng đã được cập nhật mới nhất!</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Bạn đang trải nghiệm phiên bản Flarity Music v{currentVersion} đầy đủ tính năng và ổn định nhất.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => openExternalLink(GITHUB_RELEASES_PAGE)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Xem Lịch Sử Bản Phát Hành</span>
                    </button>
                  </div>
                )}

                {/* 3. Auto-Check Preference */}
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Tự Động Kiểm Tra Bản Cập Nhật Mới</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Kiểm tra định kỳ trong nền khi khởi động ứng dụng và hiển thị thông báo khi có phiên bản mới.
                      </p>
                    </div>
                    <button
                      onClick={() => toggleAutoCheck(!autoCheckEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                        autoCheckEnabled ? 'bg-apple-pink' : 'bg-neutral-800'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          autoCheckEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 4. Project Info & External Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => openExternalLink('https://github.com/PhoPhuc/flarity-music')}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-white">Kho Lưu Trữ Mã Nguồn GitHub</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">github.com/PhoPhuc/flarity-music</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                  </button>

                  <button
                    onClick={() => openExternalLink('https://github.com/PhoPhuc/flarity-music/issues')}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                      <div>
                        <p className="text-xs font-bold text-white">Báo Cáo Lỗi & Đóng Góp Tính Năng</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">GitHub Issues & Feature Requests</p>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-neutral-500 group-hover:text-white transition-colors" />
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer Bar */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
          <span className="text-xs text-neutral-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Cấu hình & Dữ liệu lưu trữ an toàn trong SQLite và IndexedDB
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer active:scale-95 shadow-md"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
};
