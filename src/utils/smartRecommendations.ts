import type { Track } from '../types';
import {
  FastVectorIndex,
  calculateHybridSimilarity,
  type DetailedAudioAnalysis,
} from './audioClassifierEngine';
import { getAllStoredAnalyses } from './audioFeatureStore';
import { tauriAPI } from './tauriBridge';

export type RecommendationCategory = 'all' | 'artist' | 'energy' | 'chill';

export interface RecommendedTrackItem {
  track: Track;
  score: number;
  percentage: number;
  matchReason: string;
  bpm: number;
  energyPercent: number;
  mood: string;
  genre: string;
  traitBadges: string[];
  analysis?: DetailedAudioAnalysis;
}

interface CacheEntry {
  items: RecommendedTrackItem[];
  timestamp: number;
  key: string;
}

// Bounded LRU Cache (Memory Guardian: Tối đa 20 bản ghi, tự hủy sau 5 phút)
const recCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 20;

// Singleton Vector Index trong RAM cho truy vấn tốc độ < 0.2ms
const vectorIndex = new FastVectorIndex();
let lastAnalysisCount = -1;

/**
 * Lấy danh sách bài hát gợi ý thông minh dựa trên bài hát hiện tại
 * Kết hợp Hybrid: 7D Acoustic Vectors + Metadata Affinity + SQLite Markov Transition Habit
 * Giới hạn nghiêm ngặt: TỐI ĐA 14 BÀI HÁT
 */
export async function getSmartQueueRecommendations(
  currentTrack: Track,
  allTracks: Track[],
  excludeTrackIds: Set<string> = new Set(),
  maxLimit: number = 14,
  category: RecommendationCategory = 'all'
): Promise<RecommendedTrackItem[]> {
  const limit = Math.max(1, Math.min(14, maxLimit));
  if (!currentTrack || allTracks.length === 0) return [];

  const cacheKey = `${currentTrack.id}_${allTracks.length}_${category}`;
  const cached = recCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    // Lọc bỏ các bài đã được thêm vào hàng đợi
    return cached.items.filter((item) => !excludeTrackIds.has(item.track.id)).slice(0, limit);
  }

  // 1. Tải bộ nhớ đệm phân tích âm học 7D
  let analyses: Record<string, DetailedAudioAnalysis> = {};
  try {
    analyses = await getAllStoredAnalyses();
    const currentCount = Object.keys(analyses).length;
    if (currentCount !== lastAnalysisCount && currentCount > 0) {
      vectorIndex.buildIndex(analyses);
      lastAnalysisCount = currentCount;
    }
  } catch (err) {
    console.warn('[SmartRec] Failed to load analyses for index:', err);
  }

  const currentAnalysis = analyses[currentTrack.id];
  const trackMap = new Map<string, Track>();
  for (const t of allTracks) {
    trackMap.set(t.id, t);
  }

  const recommendationMap = new Map<string, RecommendedTrackItem>();

  const createItem = (
    candTrack: Track,
    candAnalysis: DetailedAudioAnalysis | undefined,
    score: number,
    percentage: number,
    matchReason: string
  ): RecommendedTrackItem => {
    const bpm = candTrack.bpm || candAnalysis?.bpm || 110;
    const energyPercent = candAnalysis ? Math.round(candAnalysis.vector.energy * 100) : 60;
    const mood = candAnalysis?.primaryMood || 'Chill / Ambient';
    const genre = candTrack.genre || candAnalysis?.primaryGenre || 'Pop / Commercial';
    const traitBadges = candAnalysis?.traitBadges || [genre, `${bpm} BPM`];

    return {
      track: candTrack,
      score,
      percentage,
      matchReason,
      bpm,
      energyPercent,
      mood,
      genre,
      traitBadges,
      analysis: candAnalysis,
    };
  };

  // 2. Client-side Fast Vector Similarity (nếu bài hiện tại đã được phân tích âm học)
  if (currentAnalysis) {
    const similarVectorResults = vectorIndex.querySimilar(currentTrack.id, 28, 0.40);
    for (const item of similarVectorResults) {
      if (item.trackId === currentTrack.id || excludeTrackIds.has(item.trackId)) continue;
      const candTrack = trackMap.get(item.trackId);
      if (!candTrack) continue;

      const candAnalysis = analyses[item.trackId];
      const hybridDetail = calculateHybridSimilarity(
        currentAnalysis.vector,
        candAnalysis?.vector,
        {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          genre: currentTrack.genre,
          year: currentTrack.year,
        },
        {
          title: candTrack.title,
          artist: candTrack.artist,
          album: candTrack.album,
          genre: candTrack.genre,
          year: candTrack.year,
        }
      );

      recommendationMap.set(
        candTrack.id,
        createItem(candTrack, candAnalysis, hybridDetail.score, hybridDetail.percentage, hybridDetail.reason)
      );

      if (recommendationMap.size >= limit * 2) break;
    }
  }

  // 3. Backend SQLite Markov Transition & Metadata Query
  try {
    const backendCandidates = await tauriAPI.getSmartRecommendationsBatch(
      currentTrack.id,
      currentTrack.artist,
      currentTrack.genre || '',
      currentTrack.year,
      currentTrack.bpm || currentAnalysis?.bpm || 0,
      14
    );

    if (backendCandidates && Array.isArray(backendCandidates)) {
      for (const rawTrack of backendCandidates) {
        const tId = rawTrack.id;
        if (!tId || tId === currentTrack.id || excludeTrackIds.has(tId)) continue;

        const matchedTrack = trackMap.get(tId) || rawTrack;
        const candAnalysis = analyses[tId];

        if (recommendationMap.has(tId)) {
          const existing = recommendationMap.get(tId)!;
          existing.score = Math.min(0.99, existing.score + 0.08);
          existing.percentage = Math.min(99, Math.round(existing.score * 100));
        } else {
          const hybridDetail = calculateHybridSimilarity(
            currentAnalysis?.vector,
            candAnalysis?.vector,
            {
              title: currentTrack.title,
              artist: currentTrack.artist,
              album: currentTrack.album,
              genre: currentTrack.genre,
              year: currentTrack.year,
            },
            {
              title: matchedTrack.title,
              artist: matchedTrack.artist,
              album: matchedTrack.album,
              genre: matchedTrack.genre,
              year: matchedTrack.year,
            }
          );

          recommendationMap.set(
            tId,
            createItem(matchedTrack, candAnalysis, hybridDetail.score, hybridDetail.percentage, hybridDetail.reason)
          );
        }
      }
    }
  } catch (err) {
    console.warn('[SmartRec] Backend batch query error:', err);
  }

  // 4. Fallback đa dạng hóa nếu số lượng gợi ý chưa đủ
  if (recommendationMap.size < limit) {
    const candidates = allTracks.filter(
      (t) => t.id !== currentTrack.id && !excludeTrackIds.has(t.id) && !recommendationMap.has(t.id)
    );

    const sameArtist = candidates.filter((t) => t.artist.toLowerCase() === currentTrack.artist.toLowerCase());
    const remaining = candidates.filter((t) => !sameArtist.includes(t)).sort(() => Math.random() - 0.5);

    for (const t of [...sameArtist, ...remaining]) {
      const candAnalysis = analyses[t.id];
      const hybridDetail = calculateHybridSimilarity(
        currentAnalysis?.vector,
        candAnalysis?.vector,
        {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          genre: currentTrack.genre,
          year: currentTrack.year,
        },
        {
          title: t.title,
          artist: t.artist,
          album: t.album,
          genre: t.genre,
          year: t.year,
        }
      );

      recommendationMap.set(
        t.id,
        createItem(t, candAnalysis, hybridDetail.score, hybridDetail.percentage, hybridDetail.reason)
      );

      if (recommendationMap.size >= limit) break;
    }
  }

  let allResults = Array.from(recommendationMap.values()).sort((a, b) => b.score - a.score);

  // 5. Áp dụng bộ lọc Category (All / Same Artist / High Energy / Chill)
  if (category === 'artist') {
    const artistLower = currentTrack.artist.toLowerCase();
    allResults = allResults.filter(
      (item) => item.track.artist.toLowerCase().includes(artistLower) || artistLower.includes(item.track.artist.toLowerCase())
    );
  } else if (category === 'energy') {
    allResults = allResults.filter((item) => item.energyPercent >= 60 || item.bpm >= 120);
  } else if (category === 'chill') {
    allResults = allResults.filter(
      (item) => item.energyPercent <= 50 || item.mood.includes('Chill') || item.mood.includes('Melancholy')
    );
  }

  // Khống chế CHÍNH XÁC tối đa 14 bài
  const finalResults = allResults.slice(0, limit);

  // Lưu Bounded LRU Cache
  if (recCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = recCache.keys().next().value;
    if (oldestKey) recCache.delete(oldestKey);
  }
  recCache.set(cacheKey, { items: finalResults, timestamp: now, key: cacheKey });

  return finalResults;
}
