import {
  extractRepresentativeDualPCM,
  extractRepresentativePCM,
  analyzeAudioSignal,
  type DetailedAudioAnalysis,
} from './audioClassifierEngine';
import { convertFileSrc, tauriAPI } from './tauriBridge';
import type { Track } from '../types';

const DB_NAME = 'musicccc_audio_intel';
const DB_VERSION = 5;
const STORE_NAME = 'acoustic_features';

let dbInstance: IDBDatabase | null = null;

/**
 * Khởi tạo IndexedDB lưu trữ vector âm học
 */
function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (e.oldVersion < 5 && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Lấy toàn bộ phân tích đã lưu trong IndexedDB
 */
export async function getAllStoredAnalyses(): Promise<Record<string, DetailedAudioAnalysis>> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: DetailedAudioAnalysis[] = request.result || [];
        const map: Record<string, DetailedAudioAnalysis> = {};
        for (const item of records) {
          map[item.trackId] = item;
        }
        resolve(map);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[AudioFeatureStore] Failed to load cached analyses:', err);
    return {};
  }
}

/**
 * Lưu kết quả phân tích của 1 bài hát vào IndexedDB
 */
export async function saveTrackAnalysis(analysis: DetailedAudioAnalysis): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(analysis);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AudioFeatureStore] Failed to save analysis for', analysis.trackId, err);
  }
}

/**
 * Xóa sạch bộ nhớ đệm phân tích âm học trong IndexedDB
 */
export async function clearAllStoredAnalyses(): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[AudioFeatureStore] Failed to clear analyses cache:', err);
  }
}

/**
 * Phân tích 1 bài hát đơn lẻ (Just-In-Time / On-Demand với Hybrid Metadata)
 */
export async function analyzeSingleTrack(track: Track): Promise<DetailedAudioAnalysis | null> {
  try {
    const rawPath = track.filePath || (track as any).file_path || '';
    const audioUrl = convertFileSrc(rawPath);
    if (!audioUrl) return null;

    // Trích xuất các phân đoạn âm thanh độc lập
    const dualPcm = await extractRepresentativeDualPCM(audioUrl, 12);
    const analysis = analyzeAudioSignal(dualPcm, track.id, 16000, {
      title: track.title,
      artist: track.artist,
      album: track.album,
      genre: track.genre,
      year: track.year,
      duration: track.duration,
    });

    // Memory Guardian: Thu hồi ngay lập tức bộ nhớ đệm PCM
    (dualPcm as any).segmentA = null;
    (dualPcm as any).segmentB = null;
    (dualPcm as any).segmentC = null;

    await saveTrackAnalysis(analysis);
    return analysis;
  } catch (err) {
    console.warn(`[AudioFeatureStore] Analysis failed for ${track.title}:`, err);
    return null;
  }
}

export interface ScanLogEntry {
  id: string;
  trackTitle: string;
  artistName: string;
  bpm: number;
  energyPercent: number;
  mood: string;
  genre: string;
  durationMs: number;
  timestamp: number;
}

export interface AudioScannerState {
  status: 'idle' | 'scanning' | 'paused' | 'completed' | 'cancelled';
  completed: number;
  total: number;
  percent: number;
  currentTrack: Track | null;
  currentAnalysis: DetailedAudioAnalysis | null;
  processingTimeMs: number;
  etaSeconds: number;
  speedPerSec: number;
  recentLogs: ScanLogEntry[];
}

type ScannerListener = (state: AudioScannerState) => void;

/**
 * Singleton Audio Scanner Controller có khả năng Tạm dừng (Pause), Tiếp tục (Resume)
 * và phát tiến độ chi tiết theo thời gian thực (Real-time Telemetry Stream)
 */
class AudioScannerController {
  private state: AudioScannerState = {
    status: 'idle',
    completed: 0,
    total: 0,
    percent: 0,
    currentTrack: null,
    currentAnalysis: null,
    processingTimeMs: 0,
    etaSeconds: 0,
    speedPerSec: 0,
    recentLogs: [],
  };

  private listeners = new Set<ScannerListener>();
  private pendingQueue: Track[] = [];
  private queueIndex = 0;
  private isPaused = false;
  private isCancelled = false;
  private isProcessing = false;
  private startTime = 0;
  private completedInSession = 0;
  private lastNotifyTime = 0;
  private throttleTimer: any = null;

  public subscribe(listener: ScannerListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  private notifyThrottled(force = false) {
    const now = performance.now();
    if (force || now - this.lastNotifyTime >= 120) {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
      this.lastNotifyTime = now;
      this.notify();
    } else if (!this.throttleTimer) {
      const remaining = 120 - (now - this.lastNotifyTime);
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null;
        this.lastNotifyTime = performance.now();
        this.notify();
      }, remaining);
    }
  }

  public getState(): AudioScannerState {
    return { ...this.state };
  }

  public async start(tracks: Track[], existingMap: Record<string, DetailedAudioAnalysis>) {
    if (this.isProcessing) return;

    this.isCancelled = false;
    this.isPaused = false;
    this.startTime = Date.now();

    const unanalyzed = tracks.filter((t) => !existingMap[t.id]);
    this.pendingQueue = [...unanalyzed];
    this.queueIndex = 0;
    this.completedInSession = 0;

    this.state = {
      ...this.state,
      status: unanalyzed.length === 0 ? 'completed' : 'scanning',
      completed: tracks.length - unanalyzed.length,
      total: tracks.length,
      percent: tracks.length > 0 ? Math.round(((tracks.length - unanalyzed.length) / tracks.length) * 100) : 100,
      currentTrack: null,
      currentAnalysis: null,
    };
    this.notifyThrottled(true);

    if (unanalyzed.length === 0) {
      this.isProcessing = false;
      return;
    }

    await this.processQueue();
  }

  public pause() {
    if (this.state.status === 'scanning') {
      this.isPaused = true;
      this.state.status = 'paused';
      this.notifyThrottled(true);
    }
  }

  public resume() {
    if (this.state.status === 'paused') {
      this.isPaused = false;
      this.state.status = 'scanning';
      this.notifyThrottled(true);
      if (!this.isProcessing) {
        this.processQueue();
      }
    }
  }

  public cancel() {
    this.isCancelled = true;
    this.isPaused = false;
    this.pendingQueue = [];
    this.queueIndex = 0;
    this.isProcessing = false;
    this.state.status = 'cancelled';
    this.state.currentTrack = null;
    this.notifyThrottled(true);
  }

  private async processQueue() {
    this.isProcessing = true;

    while (this.queueIndex < this.pendingQueue.length) {
      if (this.isCancelled) break;

      if (this.isPaused) {
        this.isProcessing = false;
        return;
      }

      const track = this.pendingQueue[this.queueIndex++];
      if (!track) break;

      const trackStartTime = performance.now();
      this.state.currentTrack = track;
      this.notifyThrottled(false);

      try {
        const rawPath = track.filePath || (track as any).file_path || '';
        const audioUrl = convertFileSrc(rawPath);

        if (audioUrl) {
          const dualPcm = await extractRepresentativeDualPCM(audioUrl, 12);
          const analysis = analyzeAudioSignal(dualPcm, track.id, 16000, {
            title: track.title,
            artist: track.artist,
            album: track.album,
            genre: track.genre,
            year: track.year,
            duration: track.duration,
          });

          // Memory Guardian: Thu hồi ngay lập tức bộ nhớ PCM Float32Array
          (dualPcm as any).segmentA = null;
          (dualPcm as any).segmentB = null;
          (dualPcm as any).segmentC = null;

          await saveTrackAnalysis(analysis);

          const trackDurationMs = Math.round(performance.now() - trackStartTime);
          this.completedInSession++;
          this.state.completed++;
          this.state.percent = Math.min(100, Math.round((this.state.completed / Math.max(1, this.state.total)) * 100));
          this.state.currentAnalysis = analysis;
          this.state.processingTimeMs = trackDurationMs;

          // Thu hồi Working Set RAM định kỳ mỗi 20 bài quét
          if (this.completedInSession % 20 === 0) {
            void tauriAPI.shrinkMemory();
          }

          // Tính toán ETA và tốc độ
          const elapsedSec = (Date.now() - this.startTime) / 1000;
          const speed = elapsedSec > 0 ? this.completedInSession / elapsedSec : 0;
          this.state.speedPerSec = Number(speed.toFixed(1));
          const remainingTracks = this.pendingQueue.length - this.queueIndex;
          this.state.etaSeconds = speed > 0 ? Math.ceil(remainingTracks / speed) : 0;

          // Thêm nhật ký phân tích gần nhất
          const logEntry: ScanLogEntry = {
            id: track.id,
            trackTitle: track.title,
            artistName: track.artist,
            bpm: analysis.bpm,
            energyPercent: Math.round(analysis.vector.energy * 100),
            mood: analysis.primaryMood,
            genre: analysis.primaryGenre,
            durationMs: trackDurationMs,
            timestamp: Date.now(),
          };

          this.state.recentLogs = [logEntry, ...this.state.recentLogs.slice(0, 15)];
          this.notifyThrottled(false);
        }
      } catch (err) {
        console.warn(`[AudioScanner] Skip track ${track.title}:`, err);
        this.completedInSession++;
        this.state.completed++;
        this.notifyThrottled(false);
      }

      // Memory Guardian: Heap Memory Watchdog & Adaptive GC Throttling
      let gcPauseMs = 45;
      const mem = (performance as any).memory;
      if (mem && mem.usedJSHeapSize) {
        const heapUsageMb = Math.round(mem.usedJSHeapSize / (1024 * 1024));
        if (heapUsageMb > 130) {
          gcPauseMs = 80; // Kéo dài chu kỳ nghỉ để V8 dọn dẹp Heap
          void tauriAPI.shrinkMemory();
        }
      }

      // Nghỉ thích ứng để giải phóng CPU & GC
      await new Promise((res) => setTimeout(res, gcPauseMs));
    }

    this.isProcessing = false;
    if (!this.isCancelled && !this.isPaused) {
      this.state.status = 'completed';
      this.state.currentTrack = null;
      this.notifyThrottled(true);
    }
  }
}

export const audioScanner = new AudioScannerController();

export type ProgressCallback = (completed: number, total: number, latest?: DetailedAudioAnalysis) => void;

/**
 * Hàm phân tích hàng loạt tương thích ngược
 */
export async function batchAnalyzeTracks(
  tracks: Track[],
  existingMap: Record<string, DetailedAudioAnalysis>,
  onProgress?: ProgressCallback
): Promise<Record<string, DetailedAudioAnalysis>> {
  const updatedMap = { ...existingMap };

  return new Promise((resolve) => {
    const unsub = audioScanner.subscribe((state) => {
      onProgress?.(state.completed, state.total, state.currentAnalysis || undefined);
      if (state.currentAnalysis) {
        updatedMap[state.currentAnalysis.trackId] = state.currentAnalysis;
      }
      if (state.status === 'completed' || state.status === 'cancelled') {
        unsub();
        resolve(updatedMap);
      }
    });

    audioScanner.start(tracks, existingMap);
  });
}
