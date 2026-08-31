import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tauriAPI } from '../utils/tauriBridge';
import type { Track, Playlist } from '../types';

export const QUERY_KEYS = {
  tracks: ['tracks'] as const,
  infiniteTracks: ['infiniteTracks'] as const,
  playlists: ['playlists'] as const,
  analytics: (range: string) => ['analytics', range] as const,
  topListened: (limit: number) => ['topListened', limit] as const,
  recentlyPlayed: (limit: number) => ['recentlyPlayed', limit] as const,
};

export function useTracksQuery() {
  return useQuery<Track[]>({
    queryKey: QUERY_KEYS.tracks,
    queryFn: async () => {
      const res = await tauriAPI.getSavedTracks();
      return res || [];
    },
  });
}

export function useInfiniteTracksQuery(pageSize: number = 50) {
  return useInfiniteQuery<Track[]>({
    queryKey: QUERY_KEYS.infiniteTracks,
    queryFn: async ({ pageParam = 0 }) => {
      const offset = (pageParam as number) * pageSize;
      const res = await tauriAPI.getSavedTracks(pageSize, offset);
      return res || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) {
        return undefined; // All pages loaded
      }
      return allPages.length;
    },
  });
}

export function usePlaylistsQuery() {
  return useQuery<Playlist[]>({
    queryKey: QUERY_KEYS.playlists,
    queryFn: async () => {
      const res = await tauriAPI.getPlaylists();
      return res || [];
    },
  });
}

export function useAnalyticsQuery(range: string = 'today') {
  return useQuery({
    queryKey: QUERY_KEYS.analytics(range),
    queryFn: async () => {
      const res = await tauriAPI.getAnalyticsStats(range);
      return res || { overview: { totalDurationSeconds: 0, totalValidPlays: 0, totalUniqueSongs: 0 }, topSongs: [], topArtists: [] };
    },
    staleTime: 1000 * 30, // 30 seconds stale time for leaderboard/tracking
  });
}

export function useTopListenedTracksQuery(limit: number = 20) {
  return useQuery({
    queryKey: QUERY_KEYS.topListened(limit),
    queryFn: async () => {
      const res = await tauriAPI.getTopListenedTracks(limit);
      return res || [];
    },
    staleTime: 1000 * 30,
  });
}

export function useRecentlyPlayedQuery(limit: number = 12) {
  return useQuery<string[]>({
    queryKey: QUERY_KEYS.recentlyPlayed(limit),
    queryFn: async () => {
      const res = await tauriAPI.getRecentlyPlayed(limit);
      return res || [];
    },
  });
}

export function useInvalidateMusicQueries() {
  const queryClient = useQueryClient();
  return {
    invalidateTracks: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tracks }),
    invalidatePlaylists: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists }),
    invalidateAnalytics: () => queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
