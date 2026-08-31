import { useMemo, useCallback } from 'react';
import type { Track } from '../types';

export interface VibeHub {
  id: string;
  title: string;
  subtitle: string;
  iconName: 'zap' | 'moon' | 'coffee' | 'flame' | 'sparkles';
  gradient: string;
  badgeColor: string;
  tracks: Track[];
  accentColor: string;
}

// Bộ nhớ đệm cấp Module (RAM) với chu kỳ 15 phút (900.000ms)
const REC_CACHE_TTL_MS = 15 * 60 * 1000;
let cachedRecommendations: { timestamp: number; seedTrackId: string | null; tracks: Track[] } | null = null;
let cachedVibeHubs: { timestamp: number; hubs: VibeHub[] } | null = null;

export function useSmartMusicRecommendations(
  tracks: Track[],
  currentTrack: Track | null
) {
  // 1. Tự động nhóm Vibe Hubs thuần túy dựa trên Metadata (Genre, Keywords, Album, Title) - Cache 15 phút
  const vibeHubs: VibeHub[] = useMemo(() => {
    const now = Date.now();
    if (cachedVibeHubs && now - cachedVibeHubs.timestamp < REC_CACHE_TTL_MS && cachedVibeHubs.hubs.length > 0) {
      return cachedVibeHubs.hubs;
    }

    if (tracks.length === 0) return [];

    const energeticTracks: Track[] = [];
    const chillTracks: Track[] = [];
    const focusTracks: Track[] = [];
    const intenseTracks: Track[] = [];

    for (const track of tracks) {
      const searchStr = `${track.title} ${track.artist} ${track.album || ''} ${track.genre || ''}`.toLowerCase();

      // Energetic / Dance / Pop
      if (
        searchStr.includes('dance') ||
        searchStr.includes('remix') ||
        searchStr.includes('edm') ||
        searchStr.includes('party') ||
        searchStr.includes('pop') ||
        searchStr.includes('house')
      ) {
        energeticTracks.push(track);
      }
      // Chill / Acoustic / Lofi / Ballad
      else if (
        searchStr.includes('chill') ||
        searchStr.includes('acoustic') ||
        searchStr.includes('lofi') ||
        searchStr.includes('ballad') ||
        searchStr.includes('night') ||
        searchStr.includes('rain')
      ) {
        chillTracks.push(track);
      }
      // Focus / Classical / Ambient / Jazz
      else if (
        searchStr.includes('piano') ||
        searchStr.includes('guitar') ||
        searchStr.includes('jazz') ||
        searchStr.includes('focus') ||
        searchStr.includes('study') ||
        searchStr.includes('ambient')
      ) {
        focusTracks.push(track);
      }
      // Rock / Metal / Rap / Hip-hop / Intense
      else {
        intenseTracks.push(track);
      }
    }

    // Đảm bảo mỗi hub luôn có tối thiểu bài hát hiển thị
    const hubs: VibeHub[] = [
      {
        id: 'vibe-energetic',
        title: 'High Energy & Party',
        subtitle: 'Bốc lửa, nhịp dồn dập, tiếp thêm năng lượng',
        iconName: 'zap',
        gradient: 'from-amber-500/25 via-orange-600/15 to-red-600/10',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        accentColor: '#f59e0b',
        tracks: energeticTracks.length > 0 ? energeticTracks : tracks.slice(0, 8),
      },
      {
        id: 'vibe-chill',
        title: 'Late Night Chill',
        subtitle: 'Âm sắc trầm ấm, thư giãn tâm hồn',
        iconName: 'moon',
        gradient: 'from-purple-600/25 via-indigo-600/15 to-blue-600/10',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        accentColor: '#a855f7',
        tracks: chillTracks.length > 0 ? chillTracks : tracks.slice(0, 8),
      },
      {
        id: 'vibe-focus',
        title: 'Deep Focus & Flow',
        subtitle: 'Nhạc êm dịu, tăng cường sự tập trung học tập & làm việc',
        iconName: 'coffee',
        gradient: 'from-emerald-600/25 via-teal-600/15 to-cyan-600/10',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        accentColor: '#10b981',
        tracks: focusTracks.length > 0 ? focusTracks : tracks.slice(0, 8),
      },
      {
        id: 'vibe-intense',
        title: 'Heavy Beats & Pulse',
        subtitle: 'Dải tương phản động mạnh mẽ, bùng nổ âm trường',
        iconName: 'flame',
        gradient: 'from-rose-600/25 via-pink-600/15 to-neutral-900/40',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        accentColor: '#f43f5e',
        tracks: intenseTracks.length > 0 ? intenseTracks : tracks.slice(0, 8),
      },
    ];

    cachedVibeHubs = { timestamp: now, hubs };
    return hubs;
  }, [tracks]);

  // 2. Gợi ý bài hát tương đồng (Similar Tracks) chỉ quét metadata: Cùng Artist, Album, Genre (< 0.01ms)
  const similarTracks = useMemo(() => {
    if (!currentTrack || tracks.length === 0) return [];

    const now = Date.now();
    if (
      cachedRecommendations &&
      cachedRecommendations.seedTrackId === currentTrack.id &&
      now - cachedRecommendations.timestamp < REC_CACHE_TTL_MS
    ) {
      return cachedRecommendations.tracks;
    }

    const sameArtist = tracks.filter(t => t.id !== currentTrack.id && t.artist.toLowerCase() === currentTrack.artist.toLowerCase());
    const sameAlbum = tracks.filter(t => t.id !== currentTrack.id && t.album && t.album.toLowerCase() === currentTrack.album?.toLowerCase() && !sameArtist.includes(t));
    const sameGenre = tracks.filter(t => t.id !== currentTrack.id && t.genre && t.genre.toLowerCase() === currentTrack.genre?.toLowerCase() && !sameArtist.includes(t) && !sameAlbum.includes(t));
    const otherTracks = tracks.filter(t => t.id !== currentTrack.id && !sameArtist.includes(t) && !sameAlbum.includes(t) && !sameGenre.includes(t));

    const result = [...sameArtist, ...sameAlbum, ...sameGenre, ...otherTracks].slice(0, 12);
    cachedRecommendations = { timestamp: now, seedTrackId: currentTrack.id, tracks: result };
    return result;
  }, [currentTrack, tracks]);

  // 3. Smart DJ Queue Replenishment nhẹ 100%: Dựa vào Artist / Album / Genre
  const getSmartQueueReplenishment = useCallback(
    (
      anchorTrack: Track,
      currentQueue: Track[],
      libraryTracks: Track[],
      count = 8
    ): Track[] => {
      const activeQueueIds = new Set(currentQueue.map((t) => t.id));
      let candidatePool = libraryTracks.filter((t) => !activeQueueIds.has(t.id));
      if (candidatePool.length === 0) {
        candidatePool = libraryTracks.filter((t) => t.id !== anchorTrack.id);
      }
      if (candidatePool.length === 0) return [];

      const sameArtist = candidatePool.filter(t => t.artist.toLowerCase() === anchorTrack.artist.toLowerCase());
      const sameAlbum = candidatePool.filter(t => t.album && t.album.toLowerCase() === anchorTrack.album?.toLowerCase() && !sameArtist.includes(t));
      const others = candidatePool.filter(t => !sameArtist.includes(t) && !sameAlbum.includes(t));

      return [...sameArtist, ...sameAlbum, ...others].slice(0, count);
    },
    []
  );

  return {
    analysisMap: {} as Record<string, any>,
    isLoaded: true,
    isScanning: false,
    scanProgress: { current: tracks.length, total: tracks.length },
    analyzedCount: tracks.length,
    totalTracksCount: tracks.length,
    similarTracks,
    vibeHubs,
    startLibraryAnalysis: () => {},
    getSmartQueueReplenishment,
  };
}
