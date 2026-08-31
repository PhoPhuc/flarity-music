import type { Track } from '../types';

export interface LrcLibResponseItem {
  id: number;
  name?: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export type LrcSearchMode =
  | 'auto'          // Tự động (Đầy đủ thông tin bài hát)
  | 'title_only'    // Chỉ theo tên bài hát
  | 'title_album'   // Tên bài hát + Album
  | 'artist_only'   // Chỉ theo nghệ sĩ
  | 'album_only'    // Chỉ theo Album
  | 'custom';       // Tìm kiếm tự do / Đa ngôn ngữ (Free query)

export interface LrcSearchResultItem extends LrcLibResponseItem {
  hasSynced: boolean;
  matchScore: number; // 0 -> 100
  isBestMatch: boolean;
  durationDiff: number; // in seconds
  scoreBreakdown: {
    durationScore: number;
    titleScore: number;
    artistScore: number;
    albumScore: number;
    syncedScore: number;
  };
}

const LRCLIB_BASE_URL = 'https://lrclib.net/api';

/**
 * Helper fetch an toàn kèm Timeout tự hủy (AbortController)
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Chuẩn hóa chuỗi tìm kiếm tiếng Việt và đa ngôn ngữ (loại bỏ ký tự đặc biệt thừa)
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt khi so khớp độ tương đồng
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // Giữ lại chữ cái Unicode (Việt, Anh, Nhật, Hàn, Trung...)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính khoảng cách Levenshtein giữa 2 chuỗi
 */
function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Tính độ tương đồng giữa 2 chuỗi (0.0 -> 1.0)
 */
export function calculateStringSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeString(s1);
  const norm2 = normalizeString(s2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (minLen >= 3 && minLen / maxLen >= 0.5) return 0.9;
  }

  const dist = levenshtein(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Thuật toán tính điểm độ khớp Smart Match Score (0 -> 100 điểm)
 */
export function calculateLrcMatchScore(
  item: LrcLibResponseItem,
  track: Track
): {
  score: number;
  durationDiff: number;
  scoreBreakdown: {
    durationScore: number;
    titleScore: number;
    artistScore: number;
    albumScore: number;
    syncedScore: number;
  };
} {
  const hasSynced = Boolean(item.syncedLyrics && item.syncedLyrics.trim().length > 0);
  const targetDuration = track.duration || 0;
  const itemDuration = item.duration || 0;
  const durationDiff = targetDuration > 0 ? Math.abs(itemDuration - targetDuration) : 0;

  // 1. Điểm thời lượng bài hát (Tối đa 40 điểm)
  let durationScore = 0;
  if (targetDuration > 0 && itemDuration > 0) {
    if (durationDiff <= 1.0) durationScore = 40;
    else if (durationDiff <= 2.5) durationScore = 35;
    else if (durationDiff <= 4.0) durationScore = 25;
    else if (durationDiff <= 8.0) durationScore = 15;
    else if (durationDiff <= 15.0) durationScore = 5;
    else durationScore = -15; // Lệch quá 15s thường là bản remix hoặc bài khác
  } else {
    durationScore = 20; // fallback nếu không có duration
  }

  // 2. Điểm tên bài hát (Tối đa 25 điểm)
  const titleSim = calculateStringSimilarity(item.trackName || item.name || '', track.title || '');
  const titleScore = Math.round(titleSim * 25);

  // 3. Điểm nghệ sĩ (Tối đa 15 điểm)
  const artistSim = calculateStringSimilarity(item.artistName || '', track.artist || '');
  const artistScore = Math.round(artistSim * 15);

  // 4. Điểm Album (Tối đa 10 điểm)
  let albumScore = 0;
  if (track.album && item.albumName) {
    const albumSim = calculateStringSimilarity(item.albumName, track.album);
    albumScore = Math.round(albumSim * 10);
  }

  // 5. Điểm có Synced Lyrics (Tối đa 10 điểm)
  const syncedScore = hasSynced ? 10 : 0;

  let totalScore = durationScore + titleScore + artistScore + albumScore + syncedScore;
  totalScore = Math.max(0, Math.min(100, totalScore));

  return {
    score: totalScore,
    durationDiff,
    scoreBreakdown: {
      durationScore,
      titleScore,
      artistScore,
      albumScore,
      syncedScore,
    },
  };
}

/**
 * Làm sạch tên bài hát (bỏ các hậu tố như (Official Music Video), [Lyric Video], (Remastered)...)
 */
export function cleanTrackTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|mv|lyric\s*video|official\s*lyric\s*video)[\)\]]/gi, '')
    .replace(/\s*-\s*(official\s*(music\s*)?video|official\s*audio|mv|lyric\s*video).*$/gi, '')
    .trim();
}

/**
 * Danh sách ngoại lệ các Ban nhạc / Nghệ sĩ nguyên khối chứa ký tự đặc biệt (&, /, ,, x)
 */
const PRESERVED_ARTIST_NAMES = new Set([
  'ac/dc',
  'tyler, the creator',
  'earth, wind & fire',
  'simon & garfunkel',
  'crosby, stills, nash & young',
  'k/da',
  'nxworries',
  'lil nas x',
  'a$ap rocky',
  'sunn o)))',
  'm-tp',
  'the xx',
]);

/**
 * Lấy ca sĩ chính thông minh (Bảo toàn nghệ sĩ đặc biệt, chỉ tách feat/collab thực sự)
 */
export function cleanArtistName(artist: string): string {
  if (!artist) return '';
  const rawTrimmed = artist.trim();
  const lower = rawTrimmed.toLowerCase();

  // 1. Kiểm tra danh sách tên nguyên khối được bảo toàn
  if (PRESERVED_ARTIST_NAMES.has(lower)) {
    return rawTrimmed;
  }

  // 2. Tách theo Collaboration Keywords rõ ràng (feat, ft, featuring, with, prod. by)
  const featMatch = rawTrimmed.split(/\s+(?:feat\.?|ft\.?|featuring|with|presents?|prod\.?\s+by)\s+/i);
  if (featMatch.length > 1) {
    return featMatch[0].trim();
  }

  // 3. Tách theo ký tự kết hợp (x, vs) CÓ KHOẢNG TRẮNG CẢ HAI BÊN
  const collabMatch = rawTrimmed.split(/\s+(?:x|vs\.?)\s+/i);
  if (collabMatch.length > 1) {
    return collabMatch[0].trim();
  }

  // 4. Tách theo dấu gạch chéo / phẩy / dấu và (chỉ khi không phải tên độc quyền)
  const delimiterMatch = rawTrimmed.split(/\s*[,;/|&+\\•·~]\s*/);
  return delimiterMatch[0].trim();
}

/**
 * Gọi REST API tìm kiếm LRCLIB theo các chế độ
 */
export async function searchLrcLibLyrics(options: {
  track: Track;
  mode: LrcSearchMode;
  customQuery?: string;
  isDeepSearch?: boolean;
}): Promise<LrcSearchResultItem[]> {
  const { track, mode, customQuery, isDeepSearch } = options;
  const resultsMap = new Map<number, LrcLibResponseItem>();

  const headers = {
    'Lrclib-Client': 'FlarityMusic/1.0.0 (https://github.com/flarity/musicccc)',
  };

  const rawTitle = track.title || '';
  const cleanTitle = cleanTrackTitle(rawTitle);
  const rawArtist = track.artist || '';
  const cleanArtist = cleanArtistName(rawArtist);
  const rawAlbum = track.album || '';

  // 1. Chế độ Tự Động (Auto): Thử gọi GET /api/get trước (Exact match)
  if (mode === 'auto' && cleanTitle && cleanArtist) {
    try {
      const getParams = new URLSearchParams({
        track_name: cleanTitle,
        artist_name: cleanArtist,
      });
      if (rawAlbum && rawAlbum !== cleanTitle) {
        getParams.append('album_name', rawAlbum);
      }
      if (track.duration && track.duration > 0) {
        getParams.append('duration', Math.round(track.duration).toString());
      }

      const getRes = await fetchWithTimeout(`${LRCLIB_BASE_URL}/get?${getParams.toString()}`, { headers }, 7000);
      if (getRes.ok) {
        const exactData: LrcLibResponseItem = await getRes.json();
        if (exactData && (exactData.syncedLyrics || exactData.plainLyrics)) {
          resultsMap.set(exactData.id, exactData);
        }
      }
    } catch {
      // Bỏ qua lỗi exact get và tiếp tục tìm search
    }
  }

  // 2. Chuẩn bị query params cho GET /api/search
  const searchQueries: URLSearchParams[] = [];

  switch (mode) {
    case 'auto': {
      // Query 1: track_name + artist_name
      if (cleanTitle && cleanArtist) {
        searchQueries.push(new URLSearchParams({ track_name: cleanTitle, artist_name: cleanArtist }));
      }
      // Query 2: q = cleanTitle cleanArtist
      searchQueries.push(new URLSearchParams({ q: `${cleanTitle} ${cleanArtist}`.trim() }));
      // Nếu là Deep Search, thử thêm rawTitle
      if (isDeepSearch && rawTitle !== cleanTitle) {
        searchQueries.push(new URLSearchParams({ q: rawTitle }));
      }
      break;
    }
    case 'title_only': {
      if (cleanTitle) {
        searchQueries.push(new URLSearchParams({ track_name: cleanTitle }));
        searchQueries.push(new URLSearchParams({ q: cleanTitle }));
      }
      break;
    }
    case 'title_album': {
      if (cleanTitle && rawAlbum) {
        searchQueries.push(new URLSearchParams({ track_name: cleanTitle, album_name: rawAlbum }));
        searchQueries.push(new URLSearchParams({ q: `${cleanTitle} ${rawAlbum}` }));
      } else if (cleanTitle) {
        searchQueries.push(new URLSearchParams({ q: cleanTitle }));
      }
      break;
    }
    case 'artist_only': {
      if (cleanArtist) {
        searchQueries.push(new URLSearchParams({ artist_name: cleanArtist }));
        searchQueries.push(new URLSearchParams({ q: cleanArtist }));
      }
      break;
    }
    case 'album_only': {
      if (rawAlbum) {
        searchQueries.push(new URLSearchParams({ album_name: rawAlbum }));
        searchQueries.push(new URLSearchParams({ q: rawAlbum }));
      }
      break;
    }
    case 'custom': {
      const q = (customQuery || '').trim();
      if (q) {
        searchQueries.push(new URLSearchParams({ q }));
      }
      break;
    }
  }

  // Thực thi các truy vấn search
  for (const params of searchQueries) {
    try {
      const res = await fetchWithTimeout(`${LRCLIB_BASE_URL}/search?${params.toString()}`, { headers }, 8000);
      if (res.ok) {
        const list: LrcLibResponseItem[] = await res.json();
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.id && (item.syncedLyrics || item.plainLyrics)) {
              resultsMap.set(item.id, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[LrcLib] Search error with params:', params.toString(), e);
    }

    // Nếu không phải deep search và đã có >= 5 kết quả thì dừng sớm để tiết kiệm request
    if (!isDeepSearch && resultsMap.size >= 8) {
      break;
    }
  }

  // 3. Tính điểm độ khớp và phân loại Best Match
  const rawList = Array.from(resultsMap.values());
  const processedList: LrcSearchResultItem[] = rawList.map((item) => {
    const { score, durationDiff, scoreBreakdown } = calculateLrcMatchScore(item, track);
    const hasSynced = Boolean(item.syncedLyrics && item.syncedLyrics.trim().length > 0);

    return {
      ...item,
      hasSynced,
      matchScore: score,
      isBestMatch: false,
      durationDiff,
      scoreBreakdown,
    };
  });

  // Sắp xếp: Ưu tiên Synced Lyrics, sau đó theo matchScore giảm dần
  processedList.sort((a, b) => {
    if (a.hasSynced !== b.hasSynced) {
      return a.hasSynced ? -1 : 1;
    }
    return b.matchScore - a.matchScore;
  });

  // Đánh dấu Best Match cho bài hát điểm cao nhất (nếu điểm >= 65 và có Synced)
  if (processedList.length > 0 && processedList[0].matchScore >= 65 && processedList[0].hasSynced) {
    processedList[0].isBestMatch = true;
  }

  return processedList;
}
