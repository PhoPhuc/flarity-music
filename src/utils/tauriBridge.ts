import { invoke, convertFileSrc as tauriConvertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauriAvailable = (): boolean => {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    '__TAURI_IPC__' in window
  );
};

export const convertFileSrc = (filePath?: string | null): string => {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
    return filePath;
  }
  if (!isTauriAvailable()) {
    return filePath;
  }
  try {
    return tauriConvertFileSrc(filePath);
  } catch {
    return filePath;
  }
};

export const setNativeFullscreen = async (enable: boolean) => {
  if (isTauriAvailable()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setFullscreen(enable);
    } catch (err) {
      console.warn('[Tauri] setFullscreen failed:', err);
    }
  } else {
    try {
      if (enable && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (!enable && document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('HTML5 Fullscreen API failed:', err);
    }
  }
};

const safeInvoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauriAvailable()) {
    console.warn(`[Tauri] safeInvoke('${cmd}') called outside Tauri environment.`);
    if (cmd === 'get_saved_tracks' || cmd === 'get_playlists' || cmd === 'scan_folder') {
      return [] as unknown as T;
    }
    if (cmd === 'get_analytics_stats') {
      return {
        overview: { totalDurationSeconds: 0, totalValidPlays: 0, totalUniqueSongs: 0 },
        topSongs: [],
        topArtists: []
      } as unknown as T;
    }
    return null as unknown as T;
  }
  return invoke<T>(cmd, args);
};

export const tauriAPI = {
  selectMusicFolder: () => safeInvoke<string | null>('select_music_folder'),
  scanFolder: (folderPath: string) => safeInvoke<any[]>('scan_folder', { folderPath }),
  getSavedTracks: (limit?: number, offset?: number) => safeInvoke<any[]>('get_saved_tracks', { limit, offset }),
  readLrcFile: (lrcPath: string) => safeInvoke<string | null>('read_lrc_file', { lrcPath }),
  selectMvFile: () => safeInvoke<string | null>('select_mv_file'),
  selectLrcFile: () => safeInvoke<string | null>('select_lrc_file'),
  attachLrcFile: (trackId: string, lrcPath: string) => safeInvoke<any[]>('attach_lrc_file', { trackId, lrcPath }),
  saveAndAttachLrc: (trackId: string, lrcContent: string) => safeInvoke<any[]>('save_and_attach_lrc', { trackId, lrcContent }),
  attachMvFile: (trackId: string, mvPath: string) => safeInvoke<any[]>('attach_mv_file', { trackId, mvPath }),
  logPlayRecord: (input: any) => safeInvoke<boolean>('log_play_record', { input }),
  recordTelemetryHeartbeat: (payload: { trackId: string; deltaSeconds: number; playbackSpeed: number; timestamp: number }) =>
    safeInvoke<boolean>('record_telemetry_heartbeat', { payload }),
  telemetryOnPlay: () => safeInvoke<boolean>('telemetry_on_play'),
  telemetryOnPause: () => safeInvoke<boolean>('telemetry_on_pause'),
  telemetryOnTrackChange: (track: { songId: string; title: string; artist: string; albumArt?: string; trackDuration: number } | null) =>
    safeInvoke<boolean>('telemetry_on_track_change', { track }),
  telemetryOnRateChange: (newRate: number) => safeInvoke<boolean>('telemetry_on_rate_change', { newRate }),
  telemetryOnAppExit: () => safeInvoke<boolean>('telemetry_on_app_exit'),
  getAnalyticsStats: (range: string) => safeInvoke<any>('get_analytics_stats', { range }),
  getTopListenedTracks: (limit = 20) =>
    safeInvoke<{ songId: string; totalDuration: number; playCount: number }[]>('get_top_listened_tracks', { limit }),
  getRecentlyPlayed: (limit = 12) => safeInvoke<string[]>('get_recently_played', { limit }),
  onAnalyticsUpdated: (callback: () => void) => {
    if (!isTauriAvailable()) return () => {};
    let unlistenFn: (() => void) | null = null;
    listen('analytics-updated', () => callback()).then((unlisten: () => void) => {
      unlistenFn = unlisten;
    });
    return () => {
      if (unlistenFn) unlistenFn();
    };
  },
  // Playlist API
  getPlaylists: () => safeInvoke<any[]>('get_playlists'),
  createPlaylist: (name: string, description?: string, coverArt?: string) =>
    safeInvoke<any>('create_playlist', { name, description, coverArt }),
  addTrackToPlaylist: (playlistId: string, trackId: string) =>
    safeInvoke<any[]>('add_to_playlist', { playlistId, trackId }),
  removeTrackFromPlaylist: (playlistId: string, trackId: string) =>
    safeInvoke<any[]>('remove_from_playlist', { playlistId, trackId }),
  deletePlaylist: (playlistId: string) => safeInvoke<any[]>('delete_playlist', { playlistId }),

  // File System & Metadata API
  showInExplorer: (filePath: string) => safeInvoke<boolean>('show_in_explorer', { filePath }),
  deleteTrackFile: (trackId: string, filePath: string, permanentDelete: boolean) =>
    safeInvoke<boolean>('delete_track_file', { trackId, filePath, permanentDelete }),
  updateTrackMetadata: (trackId: string, updates: any) =>
    safeInvoke<boolean>('update_track_metadata', { trackId, updates }),
  renamePlaylist: (playlistId: string, newName: string) =>
    safeInvoke<any[]>('rename_playlist', { playlistId, newName }),
  mergeAlbum: (sourceAlbumName: string, sourceArtist: string, targetAlbumName: string, targetArtist: string) =>
    safeInvoke<any[]>('merge_album', { sourceAlbumName, sourceArtist, targetAlbumName, targetArtist }),

  // Smart Auto-Play & Transition API
  recordTrackTransition: (fromId: string, toId: string) =>
    safeInvoke<boolean>('record_track_transition', { fromId, toId }),
  getSmartRecommendation: (currentId: string, artist: string, genre?: string, year?: number, bpm?: number) =>
    safeInvoke<any>('get_smart_recommendation', { currentId, artist, genre, year, bpm }),
  getSmartRecommendationsBatch: (currentId: string, artist: string, genre?: string, year?: number, bpm?: number, limit = 14) =>
    safeInvoke<any[]>('get_smart_recommendations_batch', { currentId, artist, genre, year, bpm, limit: Math.min(14, limit) }),

  // YouTube Music Downloader & Discovery API
  checkDownloaderTools: () =>
    safeInvoke<{ isYtDlpAvailable: boolean; isFfmpegAvailable: boolean; ytDlpVersion?: string }>('check_downloader_tools'),
  searchYouTubeMusic: (query: string, limit?: number) =>
    safeInvoke<any[]>('search_youtube_music', { query, limit }),
  getArtistDiscoveryRecommendations: (artists: string[], limitPerArtist?: number) =>
    safeInvoke<any[]>('get_artist_discovery_recommendations', { artists, limitPerArtist }),
  getRandomLibraryArtists: (limit?: number) =>
    safeInvoke<string[]>('get_random_library_artists', { limit }),
  getYoutubePreviewStreamUrl: (urlOrId: string) =>
    safeInvoke<string>('get_youtube_preview_stream_url', { urlOrId }),
  downloadYouTubeTrack: (params: {
    url: string;
    title: string;
    artist: string;
    album?: string;
    outputDir?: string;
    downloadType?: 'audio' | 'video' | 'both';
    thumbnail?: string;
  }) => safeInvoke<any>('download_youtube_track', params),
  shrinkMemory: () => safeInvoke<any>('shrink_memory'),
};

// Auto attach to window for backwards compatibility with existing UI code
if (typeof window !== 'undefined') {
  (window as any).electronAPI = tauriAPI;
  (window as any).tauriAPI = tauriAPI;
}
