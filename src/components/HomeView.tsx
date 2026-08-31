import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Plus, 
  Check, 
  Music, 
  Disc, 
  User, 
  ListMusic, 
  Sparkles, 
  Search, 
  X, 
  Shuffle, 
  Clock,
  Radio,
  Heart,
  Flame,
  Zap,
  RefreshCw,
  TrendingUp,
  Compass,
  ChevronRight,
} from 'lucide-react';
import type { Track, Album, Playlist, ArtistProfile } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { tauriAPI, convertFileSrc } from '../utils/tauriBridge';
import { SoundWave } from './SoundWave';
import { SmartVibeHub } from './SmartVibeHub';
import { formatTime } from '../utils/lrcParser';

type CategoryFilter = 'all' | 'music' | 'albums' | 'artists';

// PRNG Lehmer Algorithm cho tính toán gợi ý ngẫu nhiên ổn định theo sessionSeed
const createPseudoRandom = (seed: number) => {
  let s = Math.abs(Math.floor(seed)) % 2147483647;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const HOME_REC_TTL_MS = 15 * 60 * 1000;
let cachedHomeRecommendedToday: { timestamp: number; tracks: Track[] } | null = null;
let cachedHomeGenreHubs: { timestamp: number; hubs: MusicGenreHub[] } | null = null;

interface MusicGenreHub {
  id: string;
  title: string;
  gradient: string;
  keywords: string[];
  coverArt?: string;
  matchingAlbums: Album[];
  matchingTracks: Track[];
}

// Component hiển thị ảnh bìa Playlist dạng lưới 2x2 Collage giống Spotify
const PlaylistCoverCollage: React.FC<{ playlist: Playlist; tracks: Track[] }> = ({ playlist, tracks }) => {
  const plTracksWithPic = useMemo(() => {
    const uniquePics: string[] = [];
    for (const id of playlist.trackIds) {
      const t = tracks.find(item => item.id === id);
      if (t?.picture && !uniquePics.includes(t.picture)) {
        uniquePics.push(t.picture);
      }
      if (uniquePics.length >= 4) break;
    }
    return uniquePics;
  }, [playlist.trackIds, tracks]);

  if (playlist.coverArt) {
    return <img src={convertFileSrc(playlist.coverArt)} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />;
  }

  if (plTracksWithPic.length >= 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full bg-neutral-900">
        {plTracksWithPic.slice(0, 4).map((pic, idx) => (
          <img
            key={idx}
            src={convertFileSrc(pic)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  if (plTracksWithPic.length > 0) {
    return <img src={convertFileSrc(plTracksWithPic[0])} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />;
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-neutral-800 text-neutral-600">
      <ListMusic className="w-10 h-10 text-apple-pink/50" />
    </div>
  );
};

export const HomeView: React.FC = () => {
  const { 
    tracks, 
    albums, 
    playlists, 
    currentTrack, 
    isPlaying, 
    playTrack, 
    togglePlayPause, 
    setSelectedAlbum, 
    setSelectedArtist, 
    setSelectedPlaylist, 
    setViewMode,
    addToQueue,
    artistProfiles,
    newTrackIds,
    newAlbumKeys
  } = usePlayer();

  const [selectedFilter, setSelectedFilter] = useState<CategoryFilter>('all');
  const [recentSongIds, setRecentSongIds] = useState<string[]>([]);
  const [isHeroAdded, setIsHeroAdded] = useState(false);
  const [isSongHeroAdded, setIsSongHeroAdded] = useState(false);
  const [selectedGenreHub, setSelectedGenreHub] = useState<MusicGenreHub | null>(null);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [genreModalSearchQuery, setGenreModalSearchQuery] = useState('');
  const [sessionSeed, setSessionSeed] = useState<number>(() => Date.now());

  const searchResults = useMemo(() => {
    if (!homeSearchQuery.trim()) return { tracks: [] as Track[], albums: [] as Album[], artists: [] as ArtistProfile[] };
    const q = homeSearchQuery.toLowerCase().trim();

    const matchedTracks = tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );

    const matchedAlbums = albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );

    const matchedArtists = artistProfiles.filter((a) => a.name.toLowerCase().includes(q));

    return {
      tracks: matchedTracks,
      albums: matchedAlbums,
      artists: matchedArtists,
    };
  }, [tracks, albums, artistProfiles, homeSearchQuery]);

  // ===================== DATA ENGINEERING: PRE-INDEXED LOOKUP MAPS =====================
  const trackMap = useMemo(() => new Map(tracks.map(t => [t.id, t])), [tracks]);
  const albumMap = useMemo(() => new Map(albums.map(a => [a.name.toLowerCase(), a])), [albums]);
  const tracksByArtistMap = useMemo(() => {
    const map = new Map<string, Track[]>();
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      const k = t.artist.toLowerCase();
      let arr = map.get(k);
      if (!arr) {
        arr = [];
        map.set(k, arr);
      }
      arr.push(t);
    }
    return map;
  }, [tracks]);

  // Lấy lịch sử phát từ database một lần duy nhất cho mỗi phiên mở trang chủ
  useEffect(() => {
    tauriAPI.getRecentlyPlayed(30)
      .then(ids => setRecentSongIds(ids || []))
      .catch(() => setRecentSongIds([]));
  }, [sessionSeed]);

  // 1. Danh sách bài hát nghe gần đây (O(1) Track Map Lookup)
  const recentTracks = useMemo(() => {
    if (recentSongIds.length > 0) {
      const list: Track[] = [];
      for (let i = 0; i < recentSongIds.length; i++) {
        const t = trackMap.get(recentSongIds[i]);
        if (t) list.push(t);
      }
      if (list.length > 0) return list;
    }
    return tracks.slice(0, 16);
  }, [recentSongIds, trackMap, tracks]);

  // 2. Lưới 8 mục nghe gần đây cố định ở đầu trang (2 hàng x 4 cột, O(1) Lookups)
  const quickAccessItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      cover?: string | null;
      type: 'track' | 'album';
      rawTrack?: Track;
      rawAlbum?: Album;
    }> = [];

    const seenKeys = new Set<string>();

    for (let i = 0; i < recentTracks.length && items.length < 8; i++) {
      const t = recentTracks[i];
      const key = `track-${t.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        items.push({
          id: key,
          title: t.title,
          cover: t.picture,
          type: 'track',
          rawTrack: t,
        });
      }
    }

    for (let i = 0; i < recentTracks.length && items.length < 8; i++) {
      const albName = recentTracks[i].album;
      if (albName) {
        const matchingAlbum = albumMap.get(albName.toLowerCase());
        if (matchingAlbum && !seenKeys.has(`album-${matchingAlbum.id}`)) {
          seenKeys.add(`album-${matchingAlbum.id}`);
          items.push({
            id: `album-${matchingAlbum.id}`,
            title: matchingAlbum.name,
            cover: matchingAlbum.picture,
            type: 'album',
            rawAlbum: matchingAlbum,
          });
        }
      }
    }

    for (let i = 0; i < albums.length && items.length < 8; i++) {
      const a = albums[i];
      const key = `album-${a.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        items.push({
          id: key,
          title: a.name,
          cover: a.picture,
          type: 'album',
          rawAlbum: a,
        });
      }
    }

    for (let i = 0; i < tracks.length && items.length < 8; i++) {
      const t = tracks[i];
      const key = `track-${t.id}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        items.push({
          id: key,
          title: t.title,
          cover: t.picture,
          type: 'track',
          rawTrack: t,
        });
      }
    }

    return items.slice(0, 8);
  }, [recentTracks, albumMap, albums, tracks]);

  // 3. Featured Hero: Bản phát hành mới nhất (Tự động cập nhật theo nhạc mới quét vào máy)
  const heroData = useMemo(() => {
    if (albums.length > 0) {
      // Ưu tiên album mới thêm gần đây qua newAlbumKeys hoặc năm phát hành mới nhất
      let targetAlbum: Album | undefined;
      if (newAlbumKeys && newAlbumKeys.size > 0) {
        targetAlbum = albums.find(a => newAlbumKeys.has(a.id) || newAlbumKeys.has(a.name));
      }

      if (!targetAlbum) {
        // Tìm album có năm cao nhất hoặc ở vị trí mới nhất
        const sortedAlbums = [...albums].sort((a, b) => (b.year || 0) - (a.year || 0));
        targetAlbum = sortedAlbums[0] || albums[0];
      }

      if (targetAlbum) {
        const artistObj = artistProfiles.find(a => a.name.toLowerCase() === targetAlbum!.artist.toLowerCase());
        return {
          artist: targetAlbum.artist,
          artistAvatar: artistObj?.picture || targetAlbum.picture,
          album: targetAlbum,
          title: targetAlbum.name,
          trackCount: targetAlbum.tracks.length,
          cover: targetAlbum.picture,
          tracks: targetAlbum.tracks,
        };
      }
    }

    if (tracks.length > 0) {
      let topTrack: Track | undefined;
      if (newTrackIds && newTrackIds.size > 0) {
        topTrack = tracks.find(t => newTrackIds.has(t.id));
      }
      if (!topTrack) {
        const sortedTracks = [...tracks].sort((a, b) => (b.year || 0) - (a.year || 0));
        topTrack = sortedTracks[0] || tracks[0];
      }

      if (topTrack) {
        const artistObj = artistProfiles.find(a => a.name.toLowerCase() === topTrack!.artist.toLowerCase());
        const artistTracks = tracks.filter(t => t.artist.toLowerCase() === topTrack!.artist.toLowerCase());
        return {
          artist: topTrack.artist,
          artistAvatar: artistObj?.picture || topTrack.picture,
          album: null,
          title: topTrack.album || topTrack.title,
          trackCount: artistTracks.length,
          cover: topTrack.picture,
          tracks: artistTracks,
        };
      }
    }

    return null;
  }, [albums, tracks, artistProfiles, newAlbumKeys, newTrackIds]);

  // 4. "Nghe lại" (Listen Again) - ĐẦY ĐỦ 6 BÀI HÁT TỐI ƯU KHOẢNG TRỐNG
  const listenAgainItems = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      subtitle: string;
      cover?: string | null;
      type: 'track' | 'artist';
      isArtist?: boolean;
      track?: Track;
      artistName?: string;
    }> = [];

    const seenTrackIds = new Set<string>();

    // Lấy từ danh sách nghe gần đây
    for (const t of recentTracks) {
      if (list.length >= 6) break;
      if (!seenTrackIds.has(t.id)) {
        seenTrackIds.add(t.id);
        list.push({
          id: `listen-track-${t.id}`,
          title: t.title,
          subtitle: t.artist,
          cover: t.picture,
          type: 'track',
          track: t,
        });
      }
    }

    // Nếu chưa đủ 6 bài, lấy thêm các bài hát trong thư viện
    if (list.length < 6) {
      for (const t of tracks) {
        if (list.length >= 6) break;
        if (!seenTrackIds.has(t.id)) {
          seenTrackIds.add(t.id);
          list.push({
            id: `listen-fill-${t.id}`,
            title: t.title,
            subtitle: t.artist,
            cover: t.picture,
            type: 'track',
            track: t,
          });
        }
      }
    }

    return list.slice(0, 6);
  }, [recentTracks, tracks]);

  // 5. GỢI Ý: Hero Banner "Nội dung giống [Bài hát cụ thể X mà bạn từng nghe]"
  const similarSongHeroData = useMemo(() => {
    if (tracks.length === 0) return null;
    const seedTrack = recentTracks[0] || tracks[0];
    if (!seedTrack) return null;

    // Tìm các bài hát có phong cách tương đồng (cùng thể loại, cùng nghệ sĩ hoặc cùng album)
    const matchingTracks = tracks.filter((t) => {
      if (t.id === seedTrack.id) return false;
      const sameArtist = t.artist.toLowerCase() === seedTrack.artist.toLowerCase();
      const sameGenre = t.genre && seedTrack.genre && t.genre.toLowerCase() === seedTrack.genre.toLowerCase();
      const sameAlbum = t.album && seedTrack.album && t.album.toLowerCase() === seedTrack.album.toLowerCase();
      return sameArtist || sameGenre || sameAlbum;
    });

    const candidatePool = matchingTracks.length >= 4 ? matchingTracks : tracks.filter((t) => t.id !== seedTrack.id);
    const rng = createPseudoRandom(sessionSeed + 11);
    const relatedList = [...candidatePool].sort(() => rng() - 0.5).slice(0, 6);

    return {
      seedTrack,
      relatedList,
    };
  }, [recentTracks, tracks, sessionSeed]);

  // 6. GỢI Ý: "Dành cho fan của [Nghệ Sĩ X]" (Random Artist từ thư viện, O(1) Artist Index)
  const forFansOfArtistData = useMemo(() => {
    if (artistProfiles.length === 0) return null;
    const qualifiedArtists = artistProfiles.filter((a) => a.trackCount >= 2);
    const pool = qualifiedArtists.length > 0 ? qualifiedArtists : artistProfiles;
    const rng = createPseudoRandom(sessionSeed + 22);
    const chosenIdx = Math.floor(rng() * pool.length);
    const chosenArtist = pool[chosenIdx];
    if (!chosenArtist) return null;

    const artistTracks = tracksByArtistMap.get(chosenArtist.name.toLowerCase()) || [];
    const otherTracks = tracks.filter((t) => !artistTracks.includes(t)).sort(() => rng() - 0.5);
    const combinedTracks = [...artistTracks, ...otherTracks].slice(0, 6);

    return {
      artist: chosenArtist,
      tracks: combinedTracks,
    };
  }, [artistProfiles, tracksByArtistMap, tracks, sessionSeed]);

  // 7. GỢI Ý: "Nội dung khác giống [Playlist / Album X]" (O(1) Track & Album Map)
  const moreLikeCollectionData = useMemo(() => {
    const rng = createPseudoRandom(sessionSeed + 33);

    if (playlists.length > 0) {
      const plIdx = Math.floor(rng() * playlists.length);
      const pl = playlists[plIdx];
      const plTracks = pl.trackIds.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t));
      const genreSet = new Set(plTracks.map((t) => t.genre).filter(Boolean));
      const matching = tracks.filter((t) => !pl.trackIds.includes(t.id) && genreSet.has(t.genre));
      const fallback = tracks.filter((t) => !pl.trackIds.includes(t.id)).sort(() => rng() - 0.5);
      const suggested = [...matching, ...fallback].slice(0, 6);

      return {
        title: `Nội dung tương tự danh sách phát "${pl.name}"`,
        subtitle: `Được tuyển tập từ phong cách ${pl.name}`,
        tracks: suggested,
      };
    }

    if (albums.length > 0) {
      const albIdx = Math.floor(rng() * albums.length);
      const alb = albums[albIdx];
      const matching = tracks.filter((t) => t.album !== alb.name && (t.artist === alb.artist || t.genre === alb.tracks[0]?.genre));
      const fallback = tracks.filter((t) => t.album !== alb.name).sort(() => rng() - 0.5);
      const suggested = [...matching, ...fallback].slice(0, 6);

      return {
        title: `Nội dung tương tự Album "${alb.name}"`,
        subtitle: `Gợi ý theo thể loại & phong cách của ${alb.artist}`,
        tracks: suggested,
      };
    }

    return null;
  }, [playlists, albums, tracks, trackMap, sessionSeed]);

  // 8. GỢI Ý: "Nghệ sĩ phổ biến dành cho bạn"
  const popularRandomArtists = useMemo(() => {
    if (artistProfiles.length === 0) return [];
    const rng = createPseudoRandom(sessionSeed + 44);
    return [...artistProfiles].sort(() => rng() - 0.5).slice(0, 6);
  }, [artistProfiles, sessionSeed]);

  // 9. GỢI Ý MỚI: "Mới phát hành cho bạn"
  const newReleasesForYou = useMemo(() => {
    const sorted = [...tracks].sort((a, b) => (b.year || 0) - (a.year || 0));
    return sorted.slice(0, 6);
  }, [tracks]);

  // 10. "Chủ đề & Không gian Thể loại Âm nhạc"
  const genreHubs = useMemo<MusicGenreHub[]>(() => {
    const now = Date.now();
    if (cachedHomeGenreHubs && now - cachedHomeGenreHubs.timestamp < HOME_REC_TTL_MS && cachedHomeGenreHubs.hubs.length > 0) {
      return cachedHomeGenreHubs.hubs;
    }

    if (tracks.length === 0) return [];

    const rawCategories = [
      {
        id: 'vpop',
        title: 'Nhạc Việt & V-Pop',
        gradient: 'from-rose-600 to-red-800',
        keywords: ['viet', 'vpop', 'rap viet', 'mck', 'binz', 'b ray', 'son tung', 'vũ', 'hvl', 'den'],
      },
      {
        id: 'hiphop',
        title: 'Hip-Hop & Urban Beat',
        gradient: 'from-amber-600 to-orange-800',
        keywords: ['rap', 'hip-hop', 'trap', 'hiphop', 'r&b', 'drill', 'underground', 'beat'],
      },
      {
        id: 'pop',
        title: 'Pop & Giai Điệu Bắt Tai',
        gradient: 'from-fuchsia-600 to-pink-800',
        keywords: ['pop', 'ballad', 'dance', 'love', 'sweet'],
      },
      {
        id: 'lossless',
        title: 'Hi-Res & Dynamic Master',
        gradient: 'from-purple-600 to-indigo-900',
        keywords: ['lossless', 'flac', 'hi-res', 'master', 'dsd', 'audiophile', 'wav'],
      },
      {
        id: 'acoustic',
        title: 'Indie, Lofi & Acoustic',
        gradient: 'from-emerald-600 to-teal-800',
        keywords: ['indie', 'acoustic', 'chill', 'lofi', 'guitar', 'piano', 'coffee'],
      },
      {
        id: 'edm',
        title: 'Electronic & High Energy',
        gradient: 'from-cyan-600 to-blue-800',
        keywords: ['edm', 'electro', 'house', 'remix', 'dance', 'club', 'dj'],
      },
      {
        id: 'intense',
        title: 'Rock, Metal & Heavy Pulse',
        gradient: 'from-rose-700 to-slate-950',
        keywords: ['rock', 'metal', 'hardcore', 'heavy', 'punk', 'alternative'],
      },
      {
        id: 'chillout',
        title: 'Deep Focus & Ambient Flow',
        gradient: 'from-blue-700 to-slate-900',
        keywords: ['ambient', 'focus', 'sleep', 'relax', 'deep', 'calm', 'night'],
      },
    ];

    const computed = rawCategories.map(cat => {
      const matchingTracks = tracks.filter(t => {
        const textStr = `${t.title} ${t.artist} ${t.genre || ''} ${t.album || ''} ${t.filePath}`.toLowerCase();
        return cat.keywords.some(kw => textStr.includes(kw));
      });

      const matchingAlbums = albums.filter(a => {
        const albTracks = a.tracks;
        const hasMatchingTrack = albTracks.some(t => matchingTracks.some(mt => mt.id === t.id));
        const textStr = `${a.name} ${a.artist}`.toLowerCase();
        return hasMatchingTrack || cat.keywords.some(kw => textStr.includes(kw));
      });

      const finalAlbums = matchingAlbums.length > 0 ? matchingAlbums : albums.slice(0, 3);
      const finalTracks = matchingTracks.length > 0 ? matchingTracks : tracks.slice(0, 8);
      const coverArt = finalAlbums[0]?.picture || finalTracks[0]?.picture || undefined;

      return {
        id: cat.id,
        title: cat.title,
        gradient: cat.gradient,
        keywords: cat.keywords,
        coverArt,
        matchingAlbums: finalAlbums,
        matchingTracks: finalTracks,
      };
    });

    cachedHomeGenreHubs = { timestamp: now, hubs: computed };
    return computed;
  }, [albums, tracks]);

  // Xử lý click Quick Access
  const handleQuickItemClick = useCallback((item: typeof quickAccessItems[0]) => {
    if (item.type === 'track' && item.rawTrack) {
      if (currentTrack?.id === item.rawTrack.id) {
        togglePlayPause();
      } else {
        playTrack(item.rawTrack, tracks);
      }
    } else if (item.type === 'album' && item.rawAlbum) {
      setSelectedAlbum(item.rawAlbum);
      setViewMode('album-detail');
    }
  }, [currentTrack?.id, togglePlayPause, playTrack, tracks, setSelectedAlbum, setViewMode]);

  const isHeroTrackPlaying = Boolean(heroData && heroData.tracks.length > 0 && currentTrack?.id === heroData.tracks[0].id && isPlaying);
  const isHeroTrackCurrent = Boolean(heroData && heroData.tracks.length > 0 && currentTrack?.id === heroData.tracks[0].id);

  const handleHeroPlay = () => {
    if (heroData && heroData.tracks.length > 0) {
      if (isHeroTrackCurrent) {
        togglePlayPause();
      } else {
        playTrack(heroData.tracks[0], heroData.tracks);
      }
    }
  };

  const handleHeroAdd = () => {
    if (heroData && heroData.tracks.length > 0) {
      heroData.tracks.forEach(t => addToQueue(t));
      setIsHeroAdded(true);
      setTimeout(() => setIsHeroAdded(false), 2000);
    }
  };

  const handleHeroShuffle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (heroData && heroData.tracks.length > 0) {
      const shuffled = [...heroData.tracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const handleOpenHeroAlbum = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (heroData?.album) {
      setSelectedAlbum(heroData.album);
      setViewMode('album-detail');
    } else if (heroData?.artist) {
      setSelectedArtist(heroData.artist);
      setViewMode('artist-detail');
    }
  };

  // ===================== SECTION RENDERERS =====================

  // Section 1: Hero Bản phát hành mới + Nghe lại (Đầy đủ 6 bài)
  const renderHeroAndListenAgainSection = () => (
    <section key="hero-listen-again" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Hero Card */}
      {heroData && (
        <div className="lg:col-span-6 space-y-3.5">
          {/* Header with Artist Profile Pill & Highlight Badge */}
          <div className="flex items-center justify-between">
            <div 
              onClick={() => {
                setSelectedArtist(heroData.artist);
                setViewMode('artist-detail');
              }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="relative">
                <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-800 border-2 border-white/20 shadow-lg group-hover:border-apple-pink group-hover:scale-105 transition-all shrink-0 flex items-center justify-center">
                  {heroData.artistAvatar ? (
                    <img 
                      src={convertFileSrc(heroData.artistAvatar)} 
                      alt={heroData.artist} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  ) : (
                    <User className="w-5 h-5 text-apple-pink" />
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-apple-pink border-2 border-[#121214] flex items-center justify-center shadow-sm">
                  <Sparkles className="w-2 h-2 text-white" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-apple-pink">
                  Bản phát hành mới của
                </p>
                <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-apple-pink transition-colors truncate flex items-center gap-1">
                  <span>{heroData.artist}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-apple-pink" />
                </h3>
              </div>
            </div>

            {/* Accent Badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-neutral-300 backdrop-blur-md shadow-sm">
              <Disc className="w-3.5 h-3.5 text-apple-pink animate-spin-slow" />
              <span>Tiêu Điểm</span>
            </span>
          </div>

          {/* Main Card with Glassmorphism & Vinyl Record Animation */}
          <div 
            onClick={handleOpenHeroAlbum}
            className="rounded-[2rem] bg-gradient-to-br from-white/[0.08] via-[#16161a]/95 to-[#0e0e12]/95 border border-white/15 p-6 sm:p-7 flex flex-col sm:flex-row gap-6 shadow-[0_20px_60px_rgba(0,0,0,0.75)] backdrop-blur-2xl hover:border-white/30 hover:shadow-[0_25px_70px_rgba(250,36,60,0.22)] transition-all duration-500 group relative overflow-hidden cursor-pointer"
          >
            {/* Ambient Multi-Color Gradient Lights */}
            <div className="absolute -top-16 -right-16 w-80 h-80 bg-gradient-to-br from-apple-pink/25 via-purple-600/20 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent pointer-events-none" />

            {/* Left Column: Sleeve + Vinyl Record Peek */}
            <div className="relative shrink-0 flex items-center justify-center self-center sm:self-auto group/vinyl">
              {/* Vinyl Disc Mechanism */}
              <div 
                className={`absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-[#111] border-2 border-neutral-800 shadow-[0_10px_30px_rgba(0,0,0,0.9)] flex items-center justify-center transition-all duration-500 z-0 ${
                  isHeroTrackPlaying
                    ? 'translate-x-9 sm:translate-x-12 animate-[spin_4s_linear_infinite]'
                    : 'translate-x-2 sm:translate-x-4 group-hover/vinyl:translate-x-8 group-hover:translate-x-8'
                }`}
              >
                {/* Vinyl Grooves */}
                <div className="w-[88%] h-[88%] rounded-full border border-white/5 flex items-center justify-center">
                  <div className="w-[72%] h-[72%] rounded-full border border-white/5 flex items-center justify-center">
                    <div className="w-[52%] h-[52%] rounded-full border border-white/10 flex items-center justify-center">
                      {/* Center Record Label */}
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-apple-pink/40 border border-white/30 flex items-center justify-center shadow-inner">
                        {heroData.cover ? (
                          <img src={convertFileSrc(heroData.cover)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Disc className="w-6 h-6 text-white" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Front Cover Sleeve */}
              <div className="relative z-10 w-40 h-40 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-neutral-900 shrink-0 shadow-[0_15px_35px_rgba(0,0,0,0.7)] border border-white/20 group-hover:border-white/40 group-hover:scale-[1.02] transition-all duration-300">
                {heroData.cover ? (
                  <img 
                    src={convertFileSrc(heroData.cover)} 
                    alt={heroData.title} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                    <Disc className="w-16 h-16 text-apple-pink/50" />
                  </div>
                )}

                {/* Hi-Res Lossless Tag */}
                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/20 text-[9px] font-black uppercase tracking-wider text-neutral-200 flex items-center gap-1 shadow-sm">
                  <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span>Hi-Res</span>
                </div>

                {/* Audio Playing Equalizer Wave Overlay */}
                {isHeroTrackPlaying && (
                  <div className="absolute inset-0 bg-black/65 flex items-center justify-center backdrop-blur-[2px] rounded-2xl">
                    <SoundWave className="scale-125" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Album Details & Creative Controls */}
            <div className="flex-1 min-w-0 flex flex-col justify-between space-y-4 text-center sm:text-left z-10">
              <div className="space-y-2">
                {/* Meta Badges */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-apple-pink text-white shadow-sm">
                    {heroData.album ? 'ALBUM' : 'SINGLE'}
                  </span>
                  <span className="text-xs font-bold text-neutral-300 truncate max-w-[160px]">
                    {heroData.artist}
                  </span>
                  <span className="text-neutral-600 hidden sm:inline">•</span>
                  <span className="text-[11px] font-medium text-emerald-400 hidden sm:inline-flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Studio Master
                  </span>
                </div>

                {/* Main Album Title */}
                <h2 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight line-clamp-2 transition-colors ${
                  isHeroTrackCurrent ? 'text-apple-pink' : 'text-white'
                }`}>
                  {heroData.title}
                </h2>

                {/* Track Count & Audio Format */}
                <p className="text-xs text-neutral-400 font-medium flex items-center justify-center sm:justify-start gap-2">
                  <span>{heroData.trackCount} bài hát trong thư viện</span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-neutral-400">FLAC Lossless</span>
                </p>
              </div>

              {/* Action Buttons Bar */}
              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1" onClick={(e) => e.stopPropagation()}>
                {/* Big Floating Play Button with Glowing Aura */}
                <button
                  onClick={handleHeroPlay}
                  className="h-12 px-6 rounded-full bg-gradient-to-r from-[#FA243C] to-[#E01E37] hover:brightness-110 text-white flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(250,36,60,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold text-xs"
                  title={isHeroTrackPlaying ? "Tạm dừng" : "Phát toàn bộ album"}
                >
                  {isHeroTrackPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Tạm dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                      <span>Phát ngay</span>
                    </>
                  )}
                </button>

                {/* Shuffle Button */}
                <button
                  onClick={handleHeroShuffle}
                  className="w-12 h-12 rounded-full border border-white/15 hover:border-white/30 text-neutral-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 bg-white/5 hover:bg-white/10 shadow-md backdrop-blur-md"
                  title="Phát ngẫu nhiên album"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                {/* Add to Queue Button */}
                <button
                  onClick={handleHeroAdd}
                  className={`w-12 h-12 rounded-full border transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-md backdrop-blur-md ${
                    isHeroAdded
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'border-white/15 hover:border-white/30 text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10'
                  }`}
                  title="Thêm vào hàng đợi"
                >
                  {isHeroAdded ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listen Again Grid: FULL 6 ITEMS (3 cols x 2 rows) */}
      <div className="lg:col-span-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Nghe lại</h2>
          <button 
            onClick={() => setViewMode('library-tracks')}
            className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Hiện tất cả
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
          {listenAgainItems.map((item) => {
            const isCurrent = Boolean(item.track && currentTrack?.id === item.track.id);
            const isThisPlaying = Boolean(isCurrent && isPlaying);

            const handlePlay = (e?: React.MouseEvent) => {
              if (e) e.stopPropagation();
              if (!item.track) return;
              if (isCurrent) {
                togglePlayPause();
              } else {
                playTrack(item.track, tracks);
              }
            };

            return (
              <div
                key={item.id}
                onClick={() => handlePlay()}
                className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                  isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                }`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative group">
                  {item.cover ? (
                    <img 
                      src={convertFileSrc(item.cover)} 
                      alt={item.title} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-neutral-600" />
                    </div>
                  )}

                  {isThisPlaying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                      <SoundWave className="scale-125" />
                    </div>
                  )}

                  <button
                    onClick={handlePlay}
                    className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all ${
                      isThisPlaying
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}
                    title={isThisPlaying ? "Tạm dừng" : "Phát"}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className={`text-sm font-bold transition-colors truncate ${
                    isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                  }`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-neutral-400 font-medium truncate">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  // Section 2: GỢI Ý MỚI - "Nội dung giống [Tên bài hát]" (Hero Banner To Lớn + Nút Play)
  const renderSimilarSongHeroSection = () => {
    if (!similarSongHeroData) return null;
    const { seedTrack, relatedList } = similarSongHeroData;

    const isSeedCurrent = currentTrack?.id === seedTrack.id;
    const isSeedPlaying = isSeedCurrent && isPlaying;

    const handleSeedPlay = () => {
      if (isSeedCurrent) {
        togglePlayPause();
      } else {
        playTrack(seedTrack, [seedTrack, ...relatedList]);
      }
    };

    return (
      <section key="similar-song-hero" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-apple-pink flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gợi ý dựa trên bài hát bạn từng nghe</span>
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Nội dung giống "{seedTrack.title}"
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Thẻ Hero Lớn của Bài Hát Gợi Ý */}
          <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-purple-900/40 via-neutral-900/90 to-neutral-950/95 border border-purple-500/20 p-6 flex flex-col justify-between gap-5 shadow-2xl backdrop-blur-apple hover:border-purple-500/40 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-neutral-800 shrink-0 shadow-2xl border border-white/15 relative group-hover:scale-105 transition-transform duration-300">
                {seedTrack.picture ? (
                  <img 
                    src={convertFileSrc(seedTrack.picture)} 
                    alt={seedTrack.title} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music className="w-10 h-10 text-purple-400" />
                  </div>
                )}

                {isSeedPlaying && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-2xl">
                    <SoundWave className="scale-125" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Bài hát tâm điểm
                </span>
                <h3 className={`text-lg sm:text-xl font-black tracking-tight line-clamp-2 transition-colors ${
                  isSeedCurrent ? 'text-apple-pink' : 'text-white'
                }`}>
                  {seedTrack.title}
                </h3>
                <p className="text-xs text-neutral-400 font-medium truncate">{seedTrack.artist}</p>
                {seedTrack.genre && (
                  <p className="text-[11px] text-purple-400/90 font-mono">Thể loại: {seedTrack.genre}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSeedPlay}
                  className="px-5 py-2.5 rounded-full bg-apple-pink hover:bg-apple-pinkHover text-white font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-apple-pink/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {isSeedPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Tạm Dừng</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Phát Ngay</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    addToQueue(seedTrack);
                    setIsSongHeroAdded(true);
                    setTimeout(() => setIsSongHeroAdded(false), 2000);
                  }}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 border border-white/10"
                  title="Thêm vào hàng đợi"
                >
                  {isSongHeroAdded ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              <span className="text-xs text-neutral-400 font-mono">
                {formatTime(seedTrack.duration)}
              </span>
            </div>
          </div>

          {/* Lưới các bài hát tương đồng bên cạnh */}
          <div className="lg:col-span-7 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
            {relatedList.map((trk) => {
              const isCurrent = currentTrack?.id === trk.id;
              const isThisPlaying = isCurrent && isPlaying;

              const handlePlay = (e?: React.MouseEvent) => {
                if (e) e.stopPropagation();
                if (isCurrent) {
                  togglePlayPause();
                } else {
                  playTrack(trk, relatedList);
                }
              };

              return (
                <div
                  key={trk.id}
                  onClick={() => handlePlay()}
                  className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                    isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                  }`}
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                    {trk.picture ? (
                      <img 
                        src={convertFileSrc(trk.picture)} 
                        alt={trk.title} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-8 h-8 text-neutral-500" />
                      </div>
                    )}

                    {isThisPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                        <SoundWave className="scale-125" />
                      </div>
                    )}

                    <button
                      onClick={handlePlay}
                      className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all ${
                        isThisPlaying
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                      }`}
                      title={isThisPlaying ? "Tạm dừng" : "Phát"}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h4 className={`text-sm font-bold transition-colors truncate ${
                      isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                    }`}>
                      {trk.title}
                    </h4>
                    <p className="text-xs text-neutral-400 font-medium truncate">{trk.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  // Section 3: GỢI Ý MỚI - "Dành cho fan của [Nghệ Sĩ X]"
  const renderForFansOfArtistSection = () => {
    if (!forFansOfArtistData) return null;
    const { artist, tracks: fanTracks } = forFansOfArtistData;

    return (
      <section key="for-fans-of-artist" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div 
            onClick={() => {
              setSelectedArtist(artist.name);
              setViewMode('artist-detail');
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 border border-white/10 shadow-md group-hover:scale-105 transition-transform flex items-center justify-center shrink-0">
              {artist.picture ? (
                <img src={convertFileSrc(artist.picture)} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <User className="w-5 h-5 text-apple-pink" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-apple-pink">Tuyển tập theo nghệ sĩ</p>
              <h2 className="text-2xl font-black text-white group-hover:text-apple-pink transition-colors tracking-tight">
                Dành cho fan của {artist.name}
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedArtist(artist.name);
              setViewMode('artist-detail');
            }}
            className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Xem nghệ sĩ
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
          {fanTracks.map((trk) => {
            const isCurrent = currentTrack?.id === trk.id;
            const isThisPlaying = isCurrent && isPlaying;

            const handlePlay = (e?: React.MouseEvent) => {
              if (e) e.stopPropagation();
              if (isCurrent) {
                togglePlayPause();
              } else {
                playTrack(trk, fanTracks);
              }
            };

            return (
              <div
                key={trk.id}
                onClick={() => handlePlay()}
                className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                  isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                }`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                  {trk.picture ? (
                    <img src={convertFileSrc(trk.picture)} alt={trk.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-neutral-500" />
                    </div>
                  )}

                  {isThisPlaying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                      <SoundWave className="scale-125" />
                    </div>
                  )}

                  <button
                    onClick={handlePlay}
                    className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all ${
                      isThisPlaying
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}
                    title={isThisPlaying ? "Tạm dừng" : "Phát"}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <h4 className={`text-sm font-bold transition-colors truncate ${
                    isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                  }`}>
                    {trk.title}
                  </h4>
                  <p className="text-xs text-neutral-400 font-medium truncate">{trk.artist}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // Section 4: GỢI Ý MỚI - "Nội dung khác giống [Playlist / Album]"
  const renderMoreLikeCollectionSection = () => {
    if (!moreLikeCollectionData) return null;
    const { title, subtitle, tracks: colTracks } = moreLikeCollectionData;

    return (
      <section key="more-like-collection" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{subtitle}</p>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">{title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
          {colTracks.map((trk) => {
            const isCurrent = currentTrack?.id === trk.id;
            const isThisPlaying = isCurrent && isPlaying;

            const handlePlay = (e?: React.MouseEvent) => {
              if (e) e.stopPropagation();
              if (isCurrent) {
                togglePlayPause();
              } else {
                playTrack(trk, colTracks);
              }
            };

            return (
              <div
                key={trk.id}
                onClick={() => handlePlay()}
                className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                  isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                }`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                  {trk.picture ? (
                    <img src={convertFileSrc(trk.picture)} alt={trk.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-neutral-500" />
                    </div>
                  )}

                  {isThisPlaying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                      <SoundWave className="scale-125" />
                    </div>
                  )}

                  <button
                    onClick={handlePlay}
                    className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all ${
                      isThisPlaying
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}
                    title={isThisPlaying ? "Tạm dừng" : "Phát"}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <h4 className={`text-sm font-bold transition-colors truncate ${
                    isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                  }`}>
                    {trk.title}
                  </h4>
                  <p className="text-xs text-neutral-400 font-medium truncate">{trk.artist}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // Section 5: GỢI Ý MỚI - "Nghệ sĩ phổ biến (Random)"
  const renderPopularArtistsSection = () => {
    if (popularRandomArtists.length === 0) return null;

    return (
      <section key="popular-artists" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Khám phá phong cách</p>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">Nghệ sĩ phổ biến dành cho bạn</h2>
          </div>
          <button
            onClick={() => {
              setSelectedFilter('artists');
            }}
            className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Hiện tất cả
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 sm:gap-4">
          {popularRandomArtists.map((artist) => (
            <div
              key={artist.name}
              onClick={() => {
                setSelectedArtist(artist.name);
                setViewMode('artist-detail');
              }}
              className="group flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm"
            >
              <div className="w-full max-w-[104px] aspect-square rounded-full overflow-hidden bg-neutral-800 border border-white/10 shadow-xl group-hover:scale-105 transition-transform flex items-center justify-center relative">
                {artist.picture ? (
                  <img src={convertFileSrc(artist.picture)} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-2xl font-bold text-apple-pink">{artist.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="w-full min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate w-full">
                  {artist.name}
                </p>
                <p className="text-xs text-neutral-400 font-medium truncate">
                  {artist.trackCount} bài hát
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 6: GỢI Ý MỚI - "Mới phát hành cho bạn"
  const renderNewReleasesForYouSection = () => {
    if (newReleasesForYou.length === 0) return null;

    return (
      <section key="new-releases-for-you" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Tuyển tập mới cập nhật</p>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">Mới phát hành cho bạn</h2>
          </div>
          <button
            onClick={() => setViewMode('library-tracks')}
            className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Hiện tất cả
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
          {newReleasesForYou.map((trk) => {
            const isCurrent = currentTrack?.id === trk.id;
            const isThisPlaying = isCurrent && isPlaying;

            const handlePlay = (e?: React.MouseEvent) => {
              if (e) e.stopPropagation();
              if (isCurrent) {
                togglePlayPause();
              } else {
                playTrack(trk, newReleasesForYou);
              }
            };

            return (
              <div
                key={trk.id}
                onClick={() => handlePlay()}
                className={`group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm ${
                  isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                }`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                  {trk.picture ? (
                    <img src={convertFileSrc(trk.picture)} alt={trk.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-neutral-500" />
                    </div>
                  )}

                  {isThisPlaying && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                      <SoundWave className="scale-125" />
                    </div>
                  )}

                  <button
                    onClick={handlePlay}
                    className={`absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl transition-all ${
                      isThisPlaying
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                    }`}
                    title={isThisPlaying ? "Tạm dừng" : "Phát"}
                  >
                    {isThisPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 space-y-0.5">
                  <h4 className={`text-sm font-bold transition-colors truncate ${
                    isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                  }`}>
                    {trk.title}
                  </h4>
                  <p className="text-xs text-neutral-400 font-medium truncate">{trk.artist}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // Section 7: Chủ đề & Thể loại
  const renderGenreHubSection = () => (
    <section key="genre-hub" className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-apple-pink">Khám phá không gian âm nhạc</p>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">Chủ đề & Thể loại</h2>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3.5">
        {genreHubs.map((genre) => (
          <div
            key={genre.id}
            onClick={() => setSelectedGenreHub(genre)}
            className={`h-36 sm:h-40 rounded-2xl p-4 sm:p-5 relative overflow-hidden cursor-pointer group shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-br ${genre.gradient} border border-white/10`}
          >
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-tight max-w-[65%] drop-shadow-md">
              {genre.title}
            </h3>

            <p className="text-[11px] font-semibold text-white/70 mt-1">
              {genre.matchingAlbums.length} Album · {genre.matchingTracks.length} Bài
            </p>

            <div className="absolute -right-3 -bottom-3 w-20 h-20 sm:w-24 sm:h-24 rounded-xl shadow-2xl overflow-hidden bg-neutral-900 border border-white/20 transform rotate-[25deg] group-hover:rotate-[18deg] group-hover:scale-105 transition-all duration-300 pointer-events-none">
              {genre.coverArt ? (
                <img src={convertFileSrc(genre.coverArt)} alt={genre.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/40">
                  <Music className="w-8 h-8 text-white/50" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  // Section 8: Album có bài hát bạn thích
  const renderFavoriteAlbumsSection = () => (
    albums.length > 0 ? (
      <section key="favorite-albums" className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white tracking-tight">Album có bài hát bạn thích</h2>
          <button
            onClick={() => setViewMode('library-albums')}
            className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            Hiện tất cả
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
          {albums.slice(0, 6).map((alb) => (
            <div
              key={alb.id}
              onClick={() => {
                setSelectedAlbum(alb);
                setViewMode('album-detail');
              }}
              className="group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                {alb.picture ? (
                  <img 
                    src={convertFileSrc(alb.picture)} 
                    alt={alb.name} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc className="w-8 h-8 text-neutral-600" />
                  </div>
                )}
                <button
                  className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                  title="Phát Album"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>

              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate">
                  {alb.name}
                </h4>
                <p className="text-xs text-neutral-400 font-medium truncate">{alb.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null
  );

  // Section 9: Danh sách phát của bạn
  const renderPlaylistsSection = () => (
    <section key="playlists" className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white tracking-tight">Danh sách phát của bạn</h2>
        <button
          onClick={() => {
            if (playlists.length > 0) {
              setSelectedPlaylist(playlists[0]);
              setViewMode('playlist-detail');
            }
          }}
          className="text-xs font-bold text-neutral-400 hover:text-white hover:underline transition-colors cursor-pointer"
        >
          Hiện tất cả
        </button>
      </div>

      {playlists.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
          {playlists.slice(0, 6).map((pl) => (
            <div
              key={pl.id}
              onClick={() => {
                setSelectedPlaylist(pl);
                setViewMode('playlist-detail');
              }}
              className="group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-sm"
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                <PlaylistCoverCollage playlist={pl} tracks={tracks} />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const plTracks = pl.trackIds.map(id => tracks.find(t => t.id === id)).filter((t): t is Track => Boolean(t));
                    if (plTracks.length > 0) playTrack(plTracks[0], plTracks);
                  }}
                  className="absolute right-2 bottom-2 w-9 h-9 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                  title="Phát Danh sách"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>

              <div className="min-w-0 space-y-0.5">
                <h4 className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate">
                  {pl.name}
                </h4>
                <p className="text-xs text-neutral-400 font-medium truncate">
                  Danh sách phát • {pl.trackIds.length} bài
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-neutral-500">
          <p className="text-sm">Chưa có danh sách phát nào. Hãy tạo danh sách phát ở thanh bên trái.</p>
        </div>
      )}
    </section>
  );

  // ===================== DYNAMIC SECTIONS =====================
  // Hiển thị đầy đủ tất cả các section gợi ý phong phú, giữ nguyên thứ tự ổn định trong suốt phiên mở
  const dynamicSections = useMemo(() => {
    const allAvailableSections = [
      renderHeroAndListenAgainSection,
      renderSimilarSongHeroSection,
      renderForFansOfArtistSection,
      renderMoreLikeCollectionSection,
      renderPopularArtistsSection,
      renderNewReleasesForYouSection,
      renderGenreHubSection,
      renderFavoriteAlbumsSection,
      renderPlaylistsSection,
    ];

    // Luôn bao gồm Hero & Listen Again ở đầu
    const firstSection = renderHeroAndListenAgainSection;
    const otherPool = allAvailableSections.filter(fn => fn !== firstSection);

    // Xáo trộn ổn định theo sessionSeed
    const rng = createPseudoRandom(sessionSeed + 55);
    const shuffledOthers = [...otherPool].sort(() => rng() - 0.5);

    // Hiển thị toàn bộ các section gợi ý phong phú (nhiều mục gợi ý hơn mỗi lần)
    return [firstSection, ...shuffledOthers];
  }, [
    sessionSeed,
    heroData,
    listenAgainItems,
    similarSongHeroData,
    forFansOfArtistData,
    moreLikeCollectionData,
    popularRandomArtists,
    newReleasesForYou,
    genreHubs,
    albums.length,
    playlists.length
  ]);

  const handleRefreshHomeDiscovery = () => {
    setSessionSeed(Date.now());
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-6 sm:p-8 space-y-9 select-none animate-in fade-in duration-300 pb-36">
      
      {/* 1. TOP CATEGORY FILTER PILLS & HOME SEARCH BAR & REFRESH FEED */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => { setSelectedFilter('all'); setHomeSearchQuery(''); }}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
              selectedFilter === 'all' && !homeSearchQuery
                ? 'bg-white text-black shadow-white/10'
                : 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => { setSelectedFilter('music'); setHomeSearchQuery(''); }}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
              selectedFilter === 'music' && !homeSearchQuery
                ? 'bg-white text-black shadow-white/10'
                : 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            Nhạc
          </button>
          <button
            onClick={() => { setSelectedFilter('albums'); setHomeSearchQuery(''); }}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
              selectedFilter === 'albums' && !homeSearchQuery
                ? 'bg-white text-black shadow-white/10'
                : 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            Albums
          </button>
          <button
            onClick={() => { setSelectedFilter('artists'); setHomeSearchQuery(''); }}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 ${
              selectedFilter === 'artists' && !homeSearchQuery
                ? 'bg-white text-black shadow-white/10'
                : 'bg-white/10 text-neutral-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            Nghệ sĩ
          </button>

          {selectedFilter === 'all' && (
            <button
              onClick={handleRefreshHomeDiscovery}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer ml-1 border border-white/5"
              title="Đổi bộ gợi ý ngẫu nhiên trên trang chủ"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dedicated Home Search Bar */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={homeSearchQuery}
            onChange={(e) => setHomeSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát, nghệ sĩ, album..."
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-apple-pink/50 rounded-full pl-9.5 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all shadow-inner"
          />
          {homeSearchQuery && (
            <button
              onClick={() => setHomeSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hiển thị kết quả tìm kiếm trên Trang chủ nếu có từ khóa */}
      {homeSearchQuery.trim() ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Kết quả tìm kiếm cho "{homeSearchQuery}"
            </h2>
            <p className="text-xs text-neutral-400 font-semibold">
              {searchResults.tracks.length} bài · {searchResults.albums.length} albums · {searchResults.artists.length} nghệ sĩ
            </p>
          </div>

          {searchResults.tracks.length === 0 && searchResults.albums.length === 0 && searchResults.artists.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
              <Search className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium">Không tìm thấy kết quả nào phù hợp với "{homeSearchQuery}"</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Matching Tracks */}
              {searchResults.tracks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Music className="w-4 h-4 text-apple-pink" />
                    Bài Hát ({searchResults.tracks.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
                    {searchResults.tracks.slice(0, 9).map((track) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isThisPlaying = isCurrent && isPlaying;

                      const handlePlay = (e?: React.MouseEvent) => {
                        if (e) e.stopPropagation();
                        if (isCurrent) {
                          togglePlayPause();
                        } else {
                          playTrack(track, searchResults.tracks);
                        }
                      };

                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlay()}
                          className={`flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border transition-all cursor-pointer group active:scale-95 ${
                            isCurrent ? 'bg-white/10 border-apple-pink/30 shadow-apple-pink/5' : 'border-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0 relative border border-white/10">
                              {track.picture ? (
                                <img 
                                  src={convertFileSrc(track.picture)} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                  <Music className="w-5 h-5" />
                                </div>
                              )}

                              {isThisPlaying && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                                  <SoundWave className="scale-90" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-bold truncate transition-colors ${
                                isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                              }`}>
                                {track.title}
                              </p>
                              <p className="text-xs text-neutral-400 truncate mt-0.5">{track.artist}</p>
                            </div>
                          </div>

                          {/* Play/Pause Button */}
                          <button
                            onClick={handlePlay}
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                              isThisPlaying
                                ? 'bg-apple-pink text-white opacity-100 scale-100 shadow-md shadow-apple-pink/40'
                                : 'bg-white/10 hover:bg-apple-pink hover:text-white text-neutral-300 opacity-0 group-hover:opacity-100 hover:scale-105'
                            }`}
                            title={isThisPlaying ? 'Tạm dừng' : 'Phát'}
                          >
                            {isThisPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Matching Albums */}
              {searchResults.albums.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Disc className="w-4 h-4 text-purple-400" />
                    Albums ({searchResults.albums.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(135px,1fr))] gap-3 sm:gap-4">
                    {searchResults.albums.slice(0, 6).map((album) => (
                      <div
                        key={album.id}
                        onClick={() => {
                          setSelectedAlbum(album);
                          setViewMode('album-detail');
                        }}
                        className="group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 shadow-lg relative">
                          {album.picture ? (
                            <img 
                              src={convertFileSrc(album.picture)} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                              <Disc className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate">
                            {album.name}
                          </p>
                          <p className="text-xs text-neutral-400 truncate mt-0.5">{album.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Artists */}
              {searchResults.artists.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    Nghệ Sĩ ({searchResults.artists.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 sm:gap-4">
                    {searchResults.artists.slice(0, 6).map((artist) => (
                      <div
                        key={artist.name}
                        onClick={() => {
                          setSelectedArtist(artist.name);
                          setViewMode('artist-detail');
                        }}
                        className="group flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95"
                      >
                        <div className="w-full max-w-[104px] aspect-square rounded-full overflow-hidden bg-neutral-800 border border-white/10 shadow-xl group-hover:scale-105 transition-transform flex items-center justify-center">
                          {artist.picture ? (
                            <img 
                              src={convertFileSrc(artist.picture)} 
                              alt={artist.name} 
                              className="w-full h-full object-cover" 
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xl font-bold text-apple-pink">{artist.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="w-full min-w-0">
                          <p className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate">
                            {artist.name}
                          </p>
                          <p className="text-xs text-neutral-400 font-medium truncate mt-0.5">
                            {artist.trackCount} bài hát
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* 2. CỐ ĐỊNH Ở ĐẦU TRANG: LƯỚI 8 MỤC NGHE GẦN ĐÂY (2 hàng x 4 cột = 8 items) */}
      {selectedFilter === 'all' && quickAccessItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {quickAccessItems.map((item) => {
            const isPlayingThis = item.type === 'track' && item.rawTrack && currentTrack?.id === item.rawTrack.id && isPlaying;
            const isThisTrack = item.type === 'track' && item.rawTrack && currentTrack?.id === item.rawTrack.id;

            return (
              <div
                key={item.id}
                onClick={() => handleQuickItemClick(item)}
                className={`group flex items-center h-16 sm:h-18 rounded-2xl bg-[#141416]/90 hover:bg-white/10 border transition-all duration-200 cursor-pointer overflow-hidden relative shadow-lg active:scale-[0.98] ${
                  isThisTrack ? 'bg-white/10 border-apple-pink/40 shadow-apple-pink/10' : 'border-white/5 hover:border-white/15'
                }`}
              >
                {/* Left Thumbnail */}
                <div className="w-16 h-16 sm:w-18 sm:h-18 bg-neutral-800 shrink-0 overflow-hidden relative flex items-center justify-center">
                  {item.cover ? (
                    <img 
                      src={convertFileSrc(item.cover)} 
                      alt={item.title} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Music className="w-6 h-6 text-neutral-500" />
                  )}

                  {isPlayingThis && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                      <SoundWave className="scale-110" />
                    </div>
                  )}
                </div>

                {/* Middle Title */}
                <div className="flex-1 min-w-0 px-4 flex items-center gap-2.5">
                  <p className={`text-sm sm:text-base font-extrabold truncate leading-snug transition-colors ${
                    isThisTrack ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                  }`}>
                    {item.title}
                  </p>
                </div>

                {/* Right Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickItemClick(item);
                  }}
                  className={`mr-3 w-10 h-10 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl shadow-apple-pink/40 shrink-0 transition-all duration-200 cursor-pointer ${
                    isPlayingThis 
                      ? 'opacity-100 scale-100' 
                      : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-105'
                  }`}
                  title={isPlayingThis ? "Tạm dừng" : "Phát"}
                >
                  {isPlayingThis ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. SMART ACOUSTIC VIBE & CLASSIFICATION HUB */}
      {(selectedFilter === 'all' || selectedFilter === 'music') && (
        <SmartVibeHub />
      )}

      {/* 4. DYNAMIC SECTIONS (Được chọn ngẫu nhiên 4 - 5 section và random vị trí mỗi lần mở) */}
      {selectedFilter === 'all' && (
        <div className="space-y-10">
          {dynamicSections.map((renderFn, idx) => (
            <React.Fragment key={idx}>
              {renderFn()}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Filter views khi chọn các pill cụ thể */}
      {selectedFilter === 'albums' && renderFavoriteAlbumsSection()}
      {selectedFilter === 'music' && (
        <div className="space-y-10">
          {renderSimilarSongHeroSection()}
          {renderForFansOfArtistSection()}
          {renderMoreLikeCollectionSection()}
          {renderNewReleasesForYouSection()}
        </div>
      )}
      {selectedFilter === 'artists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Nghệ sĩ trong thư viện</h2>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                {artistProfiles.length} nghệ sĩ (Tự động tách riêng các nghệ sĩ feat & kết hợp)
              </p>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 sm:gap-4">
            {artistProfiles.map((artist) => {
              return (
                <div
                  key={artist.name}
                  onClick={() => {
                    setSelectedArtist(artist.name);
                    setViewMode('artist-detail');
                  }}
                  className="group flex flex-col items-center text-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all cursor-pointer space-y-2.5 active:scale-95"
                >
                  <div className="w-full max-w-[104px] aspect-square rounded-full overflow-hidden bg-neutral-800 border border-white/10 shadow-xl group-hover:scale-105 transition-transform flex items-center justify-center">
                    {artist.picture ? (
                      <img 
                        src={convertFileSrc(artist.picture)} 
                        alt={artist.name} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-apple-pink">{artist.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="w-full min-w-0 space-y-0.5">
                    <p className="text-sm font-bold text-white group-hover:text-apple-pink transition-colors truncate w-full">
                      {artist.name}
                    </p>
                    <p className="text-xs text-neutral-400 font-medium truncate">
                      {artist.trackCount} bài hát
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* 5. MODAL CHI TIẾT KHÔNG GIAN THỂ LOẠI & CHỦ ĐỀ ÂM NHẠC */}
      {selectedGenreHub && (() => {
        const q = genreModalSearchQuery.toLowerCase().trim();
        const filteredTracks = q
          ? selectedGenreHub.matchingTracks.filter(
              (t) =>
                t.title.toLowerCase().includes(q) ||
                t.artist.toLowerCase().includes(q) ||
                (t.album && t.album.toLowerCase().includes(q))
            )
          : selectedGenreHub.matchingTracks;

        const filteredAlbums = q
          ? selectedGenreHub.matchingAlbums.filter(
              (a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
            )
          : selectedGenreHub.matchingAlbums;

        const totalSecs = selectedGenreHub.matchingTracks.reduce((s, t) => s + (t.duration || 0), 0);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const durationText = hours > 0 ? `${hours} giờ ${mins} phút` : `${mins} phút`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
              onClick={() => { setSelectedGenreHub(null); setGenreModalSearchQuery(''); }}
              className="absolute inset-0 bg-black/85 backdrop-blur-2xl transition-opacity"
            />

            {/* Modal Container */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-5xl lg:max-w-6xl bg-[#141416]/95 border border-white/15 rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
            >
              {/* Vibrant Hero Banner */}
              <div className={`p-6 sm:p-8 md:p-10 bg-gradient-to-br ${selectedGenreHub.gradient} relative overflow-hidden flex flex-col md:flex-row items-center md:items-end justify-between gap-6 border-b border-white/10 shadow-2xl`}>
                <div className="space-y-3 text-center md:text-left z-10">
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="text-xs uppercase font-black tracking-widest text-white/90 bg-black/30 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/10">
                      KHÔNG GIAN THỂ LOẠI
                    </span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                    {selectedGenreHub.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-white/80 font-medium">
                    {selectedGenreHub.matchingAlbums.length} Album · {selectedGenreHub.matchingTracks.length} Bài hát · {durationText}
                  </p>
                </div>

                {/* Actions & Search */}
                <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 z-10 shrink-0 w-full md:w-auto">
                  {selectedGenreHub.matchingTracks.length > 0 && (
                    <>
                      <button
                        onClick={() => {
                          playTrack(selectedGenreHub.matchingTracks[0], selectedGenreHub.matchingTracks);
                          setSelectedGenreHub(null);
                        }}
                        className="flex items-center gap-2 bg-white text-black font-extrabold py-3 px-6 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Phát tất cả</span>
                      </button>

                      <button
                        onClick={() => {
                          const shuffled = [...selectedGenreHub.matchingTracks].sort(() => Math.random() - 0.5);
                          playTrack(shuffled[0], shuffled);
                          setSelectedGenreHub(null);
                        }}
                        className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-bold py-3 px-5 rounded-full backdrop-blur-md border border-white/15 hover:scale-105 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm"
                      >
                        <Shuffle className="w-4 h-4" />
                        <span>Trộn bài</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setSelectedGenreHub(null); setGenreModalSearchQuery(''); }}
                    className="p-3 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title="Đóng"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* In-Modal Search Header */}
              <div className="px-6 py-3.5 bg-white/[0.02] border-b border-white/10 flex items-center justify-between gap-4">
                <p className="text-xs font-semibold text-neutral-400">
                  Hiển thị: <span className="text-white font-bold">{filteredTracks.length}</span> bài hát · <span className="text-white font-bold">{filteredAlbums.length}</span> albums
                </p>

                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={genreModalSearchQuery}
                    onChange={(e) => setGenreModalSearchQuery(e.target.value)}
                    placeholder="Lọc bài hát hoặc album..."
                    className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-apple-pink/50 rounded-xl pl-9.5 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
                  />
                  {genreModalSearchQuery && (
                    <button
                      onClick={() => setGenreModalSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Body: Albums & Tracks inside this Genre */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                {/* 1. Matching Albums */}
                {filteredAlbums.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Disc className="w-4 h-4 text-purple-400" />
                      <span>Albums thuộc thể loại này ({filteredAlbums.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filteredAlbums.map((alb) => (
                        <div
                          key={alb.id}
                          onClick={() => {
                            setSelectedGenreHub(null);
                            setSelectedAlbum(alb);
                            setViewMode('album-detail');
                          }}
                          className="group p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all cursor-pointer space-y-2.5 active:scale-95 shadow-md"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 border border-white/10 relative">
                            {alb.picture ? (
                              <img 
                                src={convertFileSrc(alb.picture)} 
                                alt={alb.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Disc className="w-8 h-8 text-neutral-600" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate group-hover:text-apple-pink transition-colors">
                              {alb.name}
                            </p>
                            <p className="text-xs text-neutral-400 truncate mt-0.5">{alb.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. "Bài hát tiêu biểu" */}
                {filteredTracks.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Music className="w-4 h-4 text-apple-pink" />
                        <span>Bài Hát Tiêu Biểu ({filteredTracks.length})</span>
                      </h3>
                    </div>

                    <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden shadow-xl">
                      {filteredTracks.map((t, idx) => {
                        const isCurrent = currentTrack?.id === t.id;
                        const isThisPlaying = isCurrent && isPlaying;

                        const handlePlay = (e?: React.MouseEvent) => {
                          if (e) e.stopPropagation();
                          if (isCurrent) {
                            togglePlayPause();
                          } else {
                            playTrack(t, selectedGenreHub.matchingTracks);
                          }
                        };

                        return (
                          <div
                            key={t.id}
                            onClick={() => handlePlay()}
                            className={`flex items-center justify-between p-3.5 sm:p-4 hover:bg-white/5 transition-all cursor-pointer group ${
                              isCurrent ? 'bg-white/10 border-l-4 border-l-apple-pink' : ''
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                              <span className={`w-6 text-center text-xs font-bold shrink-0 transition-colors ${
                                isCurrent ? 'text-apple-pink' : 'text-neutral-500 group-hover:text-apple-pink'
                              }`}>
                                {idx + 1}
                              </span>

                              <div className="w-11 h-11 rounded-xl overflow-hidden bg-neutral-800 shrink-0 border border-white/10 relative">
                                {t.picture ? (
                                  <img 
                                    src={convertFileSrc(t.picture)} 
                                    alt={t.title} 
                                    className="w-full h-full object-cover" 
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Music className="w-4 h-4 text-neutral-600" />
                                  </div>
                                )}

                                {isThisPlaying && (
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px] rounded-xl">
                                    <SoundWave className="scale-90" />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-bold truncate transition-colors ${
                                  isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                                }`}>
                                  {t.title}
                                </p>
                                <p className="text-xs text-neutral-400 truncate mt-0.5">
                                  {t.artist} {t.album ? `• ${t.album}` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Duration & Play Button */}
                            <div className="flex items-center gap-4 shrink-0 pl-3">
                              {t.duration && (
                                <span className="text-xs text-neutral-400 font-medium hidden sm:inline">
                                  {formatTime(t.duration)}
                                </span>
                              )}

                              <button
                                onClick={handlePlay}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                  isThisPlaying
                                    ? 'bg-apple-pink text-white opacity-100 scale-100 shadow-md shadow-apple-pink/40'
                                    : 'bg-white/10 hover:bg-apple-pink hover:text-white text-neutral-300 opacity-0 group-hover:opacity-100 hover:scale-105'
                                }`}
                                title={isThisPlaying ? 'Tạm dừng' : 'Phát'}
                              >
                                {isThisPlaying ? (
                                  <Pause className="w-3.5 h-3.5 fill-current" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-neutral-500 space-y-2">
                    <Search className="w-8 h-8 opacity-30" />
                    <p className="text-xs font-medium">Không tìm thấy bài hát hoặc album nào phù hợp trong thể loại này.</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
