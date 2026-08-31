import type { Track, ArtistProfile } from '../types';
import {
  parseVietnameseMusicMetadata,
  parseArtistsStructured,
  detectVietnameseShow,
  groupTracksIntoUnifiedAlbums,
  calculateAlbumSimilarity,
  formatVietnameseTitleCase,
  removeDiacritics,
  normalizeCanonicalString,
  VIETNAMESE_SHOW_CATALOG,
} from './vietnameseMusicMetadataEngine';

// Re-export core metadata engine features for consumers
export {
  parseVietnameseMusicMetadata,
  parseArtistsStructured,
  detectVietnameseShow,
  groupTracksIntoUnifiedAlbums,
  calculateAlbumSimilarity,
  formatVietnameseTitleCase,
  removeDiacritics,
  normalizeCanonicalString,
  VIETNAMESE_SHOW_CATALOG,
};

/**
 * Regex phân tách danh sách nghệ sĩ thông minh:
 * - Dấu phẩy, chấm phẩy: , ;
 * - Gạch chéo, thanh đứng, dấu ngã: / | \ ~ • ·
 * - Ký tự kết nối: & +
 * - Ký hiệu feat: feat., feat, ft., ft, featuring, with, presents, prod., by
 * - Ký hiệu kết hợp: x, X, vs, vs., and, và (với khoảng trắng hai bên)
 * - Dấu gạch ngang CÓ KHOẢNG TRẮNG: " - " (tránh tách Sơn Tùng M-TP, Jay-Z)
 */
const ARTIST_SPLIT_REGEX = /\s*(?:feat\.?|ft\.?|featuring|with|x|X|vs\.?|vs|presents?|prod\.?\s*by|prod\.?|by|and|và)\s+|\s+(?:-)\s+|[,;/|&+\\•·~]+\s*/i;

/**
 * Trích xuất nghệ sĩ feat trong ngoặc đơn/ngoặc vuông của tiêu đề bài hát:
 * Ví dụ: "Chạy Ngay Đi (feat. Snoop Dogg)" -> "Snoop Dogg"
 * "Em Của Ngày Hôm Qua [ft. Touliver, SlimV]" -> ["Touliver", "SlimV"]
 */
const TITLE_FEAT_REGEX = /(?:[([{\s])(?:feat\.?|ft\.?|featuring|with|prod\.?)\s+([^()[\]{}]+)(?:[)\]}]|$)/gi;

/**
 * Tách một chuỗi nghệ sĩ thành danh sách các nghệ sĩ riêng lẻ chuẩn hóa
 */
export function parseArtistNames(rawArtistString?: string): string[] {
  if (!rawArtistString || !rawArtistString.trim()) {
    return ['Unknown Artist'];
  }

  const structured = parseArtistsStructured(rawArtistString);
  if (structured.allArtists.length > 0 && structured.allArtists[0] !== 'Nghệ sĩ chưa rõ') {
    return structured.allArtists;
  }

  const cleaned = rawArtistString.trim();
  const parts = cleaned.split(ARTIST_SPLIT_REGEX);

  const result: string[] = [];
  const seen = new Set<string>();

  for (let part of parts) {
    let name = part.trim();
    name = name.replace(/^[([{\-—~"'\s]+|[)\]}\-—~"'\s]+$/g, '').trim();

    if (name && name.length > 0) {
      const lower = name.toLowerCase();
      if (!seen.has(lower) && lower !== 'feat' && lower !== 'ft' && lower !== 'various artists' && lower !== 'unknown') {
        seen.add(lower);
        result.push(name);
      }
    }
  }

  return result.length > 0 ? result : [cleaned];
}

/**
 * Trích xuất tất cả nghệ sĩ tham gia trong một bài hát (Cả trường Artist lẫn Title feat, prod)
 */
export function getArtistsFromTrack(track: Track): string[] {
  const parsed = parseVietnameseMusicMetadata(track.title || '', track.artist || '');
  if (parsed.artists.length > 0 && parsed.artists[0] !== 'Nghệ sĩ chưa rõ') {
    return parsed.artists;
  }

  const artistsFromField = parseArtistNames(track.artist);
  const extraArtistsFromTitle: string[] = [];

  if (track.title) {
    const matches = Array.from(track.title.matchAll(TITLE_FEAT_REGEX));
    for (const match of matches) {
      if (match && match[1]) {
        const parsedFeat = parseArtistNames(match[1]);
        extraArtistsFromTitle.push(...parsedFeat);
      }
    }
  }

  const uniqueArtists: string[] = [];
  const seen = new Set<string>();

  for (const name of [...artistsFromField, ...extraArtistsFromTitle]) {
    const lower = name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueArtists.push(name);
    }
  }

  return uniqueArtists.length > 0 ? uniqueArtists : [track.artist || 'Unknown Artist'];
}

/**
 * Kiểm tra xem một bài hát có sự tham gia của một nghệ sĩ cụ thể hay không
 */
export function isTrackByArtist(track: Track, targetArtist: string): boolean {
  if (!targetArtist) return false;
  const targetNorm = normalizeCanonicalString(targetArtist);
  if (!targetNorm) return false;

  const trackArtists = getArtistsFromTrack(track);
  return trackArtists.some((a) => {
    const norm = normalizeCanonicalString(a);
    return norm === targetNorm || norm.includes(targetNorm) || targetNorm.includes(norm);
  });
}

/**
 * Tự động lấy bìa một bài hát ngẫu nhiên trong danh sách bài hát làm ảnh đại diện cho nghệ sĩ
 */
export function getRandomArtistCover(tracks: Track[]): string | undefined {
  const tracksWithPictures = tracks.filter((t) => t.picture);
  if (tracksWithPictures.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * tracksWithPictures.length);
  return tracksWithPictures[randomIndex].picture;
}

/**
 * Xây dựng danh sách Hồ sơ Nghệ sĩ (Artist Profiles) hoàn chỉnh từ thư viện nhạc
 * Mỗi nghệ sĩ độc lập sẽ có danh sách bài hát riêng và tự động lấy bìa bài hát ngẫu nhiên làm avatar
 */
export function extractArtistProfiles(tracks: Track[]): ArtistProfile[] {
  const artistMap = new Map<string, { name: string; tracks: Track[] }>();

  for (const track of tracks) {
    const artistList = getArtistsFromTrack(track);

    for (const artistName of artistList) {
      const key = normalizeCanonicalString(artistName);
      if (!key) continue;

      if (!artistMap.has(key)) {
        artistMap.set(key, {
          name: artistName,
          tracks: [track],
        });
      } else {
        const profile = artistMap.get(key)!;
        if (!profile.tracks.some((t) => t.id === track.id)) {
          profile.tracks.push(track);
        }
      }
    }
  }

  const profiles: ArtistProfile[] = [];
  for (const item of artistMap.values()) {
    const randomAvatar = getRandomArtistCover(item.tracks);

    profiles.push({
      name: item.name,
      trackCount: item.tracks.length,
      picture: randomAvatar,
      tracks: item.tracks,
    });
  }

  // Sắp xếp theo số lượng bài hát giảm dần, sau đó theo bảng chữ cái A-Z
  profiles.sort((a, b) => {
    if (b.trackCount !== a.trackCount) {
      return b.trackCount - a.trackCount;
    }
    return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
  });

  return profiles;
}

/**
 * Thuật toán thông minh lọc sạch Tên Bài Hát và Tên Nghệ Sĩ khi tải về từ YouTube / Khám phá:
 * Tích hợp toàn diện Vietnamese Music Metadata Engine (ATSH, ATVNCG, Rap Việt, TMS, Chị Đẹp, Our Song, OST...)
 */
export function extractCleanArtistAndTitle(
  rawTitle: string,
  rawArtist?: string,
  suggestedArtist?: string,
  channelName?: string
): {
  title: string;
  artist: string;
  artists: string[];
  album?: string;
  isRecognizedShow?: boolean;
  showStageRound?: string;
  primaryArtists?: string[];
  featuredArtists?: string[];
  producers?: string[];
} {
  const meta = parseVietnameseMusicMetadata(rawTitle, rawArtist, suggestedArtist, channelName);

  return {
    title: meta.title,
    artist: meta.artist,
    artists: meta.artists,
    album: meta.album,
    isRecognizedShow: meta.isRecognizedShow,
    showStageRound: meta.showStageRound,
    primaryArtists: meta.primaryArtists,
    featuredArtists: meta.featuredArtists,
    producers: meta.producers,
  };
}
