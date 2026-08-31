import type { DiscoveryTrack, Track, ArtistProfile } from '../types';
import { parseVietnameseMusicMetadata, extractCleanArtistAndTitle } from './artistParser';

/**
 * Helper fetch an toàn với AbortController timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Trích xuất YouTube Video ID từ URL bất kỳ
 */
export function extractYouTubeId(urlOrText: string): string | null {
  if (!urlOrText) return null;
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
  const match = urlOrText.match(regExp);
  return match && match[1] ? match[1] : null;
}

/**
 * Phân tách Tên Nghệ Sĩ và Tên Bài Hát từ tiêu đề YouTube thô sử dụng Vietnamese Music Metadata Engine
 */
export function parseYouTubeTitle(rawTitle: string, authorName = ''): {
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  isRecognizedShow?: boolean;
} {
  const meta = parseVietnameseMusicMetadata(rawTitle, undefined, undefined, authorName);
  return {
    title: meta.title,
    artist: meta.artist,
    artists: meta.artists,
    album: meta.album,
    isRecognizedShow: meta.isRecognizedShow,
  };
}

/**
 * Lấy thông tin bài hát từ link YouTube qua oEmbed API kết hợp Vietnamese Metadata Parser
 */
export async function fetchYouTubeMetadata(youtubeUrl: string): Promise<DiscoveryTrack | null> {
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) return null;

  try {
    const oembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetchWithTimeout(oembedUrl, {}, 6000);
    if (!res.ok) throw new Error('Failed to fetch oembed');
    const data = await res.json();

    const parsed = parseVietnameseMusicMetadata(data.title || 'YouTube Audio', undefined, undefined, data.author_name);
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      id: `yt_${videoId}`,
      title: parsed.title,
      artist: parsed.artist,
      album: parsed.album || 'YouTube Stream / Single',
      duration: 240, // Mặc định 4:00 nếu chưa lấy được chính xác
      thumbnail: data.thumbnail_url || thumbnail,
      source: 'youtube',
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      quality: '320 kbps HQ Audio',
      releaseDate: new Date().getFullYear().toString(),
      genre: parsed.showCatalogItem?.defaultGenre || 'YouTube Direct',
      downloadStatus: 'idle',
    };
  } catch (err) {
    console.warn('[DiscoveryService] YouTube oEmbed fallback:', err);
    // Fallback cơ bản nếu oEmbed bị chặn mạng
    return {
      id: `yt_${videoId}`,
      title: `YouTube Video (${videoId})`,
      artist: 'YouTube Music',
      album: 'YouTube Single',
      duration: 210,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      source: 'youtube',
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      quality: '320 kbps HQ Audio',
      genre: 'YouTube Direct',
      downloadStatus: 'idle',
    };
  }
}

/**
 * Tìm kiếm bài hát qua iTunes Search API (Chất lượng cao, không cần key)
 */
export async function searchTracksOnline(query: string, limit = 24): Promise<DiscoveryTrack[]> {
  if (!query.trim()) return [];

  // Nếu là link YouTube trực tiếp
  const ytId = extractYouTubeId(query);
  if (ytId) {
    const ytTrack = await fetchYouTubeMetadata(query);
    return ytTrack ? [ytTrack] : [];
  }

  try {
    const encoded = encodeURIComponent(query.trim());
    const itunesUrl = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=${limit}&country=VN`;
    const res = await fetchWithTimeout(itunesUrl, {}, 8000);
    
    if (!res.ok) {
      // Thử fallback sang global nếu quốc gia VN không phản hồi
      const fallbackUrl = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=${limit}`;
      const fallbackRes = await fetchWithTimeout(fallbackUrl, {}, 8000);
      if (!fallbackRes.ok) throw new Error('iTunes API error');
      const data = await fallbackRes.json();
      return mapItunesResults(data.results || []);
    }

    const data = await res.json();
    let results = mapItunesResults(data.results || []);

    // Nếu không có kết quả với country=VN, thử tìm toàn cầu
    if (results.length === 0) {
      const fallbackUrl = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=${limit}`;
      const fallbackRes = await fetchWithTimeout(fallbackUrl, {}, 8000);
      if (fallbackRes.ok) {
        const globalData = await fallbackRes.json();
        results = mapItunesResults(globalData.results || []);
      }
    }

    return results;
  } catch (err) {
    console.error('[DiscoveryService] iTunes search failed:', err);
    return [];
  }
}

function mapItunesResults(rawResults: any[]): DiscoveryTrack[] {
  return rawResults.map((item: any) => {
    // Lấy ảnh bìa độ phân giải cao (thay 100x100 -> 600x600)
    let hdCover = item.artworkUrl100 || '';
    if (hdCover) {
      hdCover = hdCover.replace('100x100bb', '600x600bb');
    }

    const durationSecs = item.trackTimeMillis ? Math.round(item.trackTimeMillis / 1000) : 210;

    return {
      id: `itunes_${item.trackId}`,
      title: item.trackName || 'Bài hát chưa đặt tên',
      artist: item.artistName || 'Nghệ sĩ chưa rõ',
      album: item.collectionName || item.trackName,
      duration: durationSecs,
      thumbnail: hdCover || '',
      source: 'itunes',
      previewUrl: item.previewUrl || undefined,
      quality: 'Lossless Hi-Res / 320 kbps',
      releaseDate: item.releaseDate ? item.releaseDate.substring(0, 4) : undefined,
      genre: item.primaryGenreName || 'Pop / General',
      downloadStatus: 'idle',
    };
  });
}

/**
 * Lấy bài hát gợi ý nổi bật theo tên nghệ sĩ (tối ưu giới hạn 4-6 bài)
 */
export async function fetchArtistFeaturedRecommendations(artistName: string, limit = 5): Promise<DiscoveryTrack[]> {
  if (!artistName.trim()) return [];
  try {
    const encoded = encodeURIComponent(artistName.trim());
    const itunesUrl = `https://itunes.apple.com/search?term=${encoded}&entity=song&limit=${limit}&attribute=artistTerm`;
    const res = await fetchWithTimeout(itunesUrl, {}, 7000);
    if (!res.ok) return [];
    const data = await res.json();
    return mapItunesResults(data.results || []).slice(0, limit);
  } catch (err) {
    console.warn(`[DiscoveryService] Failed to fetch recommendations for artist "${artistName}":`, err);
    return [];
  }
}

/**
 * Chọn ngẫu nhiên 3-5 nghệ sĩ từ thư viện bài hát local
 */
export function pickRandomLibraryArtists(
  artistProfiles: ArtistProfile[],
  tracks: Track[],
  count = 4
): { name: string; avatar?: string; localCount: number }[] {
  // Lấy các nghệ sĩ có tên hợp lệ
  const validArtists: { name: string; avatar?: string; localCount: number }[] = [];

  if (artistProfiles.length > 0) {
    for (const art of artistProfiles) {
      if (art.name && art.name !== 'Nghệ sĩ chưa biết' && art.name !== 'Unknown Artist') {
        validArtists.push({
          name: art.name,
          avatar: art.picture,
          localCount: art.trackCount,
        });
      }
    }
  } else if (tracks.length > 0) {
    const map = new Map<string, { count: number; pic?: string }>();
    for (const t of tracks) {
      if (t.artist && t.artist !== 'Nghệ sĩ chưa biết') {
        const cur = map.get(t.artist) || { count: 0, pic: t.picture };
        map.set(t.artist, { count: cur.count + 1, pic: cur.pic || t.picture });
      }
    }
    map.forEach((val, name) => {
      validArtists.push({ name, avatar: val.pic, localCount: val.count });
    });
  }

  // Nếu không có nghệ sĩ nào trong thư viện, đề xuất danh sách nghệ sĩ mặc định nổi tiếng
  if (validArtists.length === 0) {
    const defaultPopular = [
      { name: 'Sơn Tùng M-TP', localCount: 0 },
      { name: 'Đen Vâu', localCount: 0 },
      { name: 'Vũ.', localCount: 0 },
      { name: 'Taylor Swift', localCount: 0 },
      { name: 'The Weeknd', localCount: 0 },
      { name: 'Charlie Puth', localCount: 0 },
    ];
    return defaultPopular.sort(() => Math.random() - 0.5).slice(0, count);
  }

  // Shuffle và lấy count nghệ sĩ
  const shuffled = [...validArtists].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
