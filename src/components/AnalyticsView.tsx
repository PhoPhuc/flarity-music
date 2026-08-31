import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Clock, 
  Flame, 
  Music, 
  User, 
  Headphones, 
  TrendingUp, 
  Sparkles,
  Calendar
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { useAnalyticsQuery } from '../hooks/useMusicQueries';
import { useQueryClient } from '@tanstack/react-query';
import { formatDurationInMinutes } from '../utils/lrcParser';
import { SoundWave } from './SoundWave';
import { parseArtistNames, isTrackByArtist, getRandomArtistCover } from '../utils/artistParser';
import { convertFileSrc } from '../utils/tauriBridge';

type TimeRange = '1h' | 'today' | 'week' | 'month' | 'all';

interface OverviewStats {
  totalDurationSeconds: number;
  totalValidPlays: number;
  totalUniqueSongs: number;
}

interface TopTrackStat {
  songId: string;
  title: string;
  artist: string;
  picture?: string;
  playCount: number;
  totalDuration: number;
}

interface TopArtistStat {
  artist: string;
  playCount: number;
  totalDuration: number;
  picture?: string;
}

export const AnalyticsView: React.FC = () => {
  const { playTrack, tracks, currentTrack, isPlaying } = usePlayer();
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useAnalyticsQuery(timeRange);

  const overview: OverviewStats = data?.overview || {
    totalDurationSeconds: 0,
    totalValidPlays: 0,
    totalUniqueSongs: 0,
  };
  const topSongs: TopTrackStat[] = data?.topSongs || [];

  // Tách và cộng dồn dữ liệu cho từng nghệ sĩ riêng biệt (không gộp chung khi feat hay dùng dấu /)
  const topArtists: TopArtistStat[] = useMemo(() => {
    const artistMap = new Map<string, { artist: string; playCount: number; totalDuration: number; picture?: string }>();

    // 1. Phân tích chi tiết từng nghệ sĩ từ danh sách bài hát đã nghe
    for (const song of topSongs) {
      const parsed = parseArtistNames(song.artist);
      for (const name of parsed) {
        const cleanName = name.trim();
        const key = cleanName.toLowerCase();
        if (!key || key === 'unknown artist' || key === 'unknown') continue;

        const existing = artistMap.get(key);
        if (existing) {
          existing.playCount += song.playCount;
          existing.totalDuration += song.totalDuration;
          if (!existing.picture && song.picture) {
            existing.picture = song.picture;
          }
        } else {
          artistMap.set(key, {
            artist: cleanName,
            playCount: song.playCount,
            totalDuration: song.totalDuration,
            picture: song.picture,
          });
        }
      }
    }

    // 2. Bổ sung từ dữ liệu thô nếu có nghệ sĩ chưa xuất hiện trong topSongs
    for (const raw of (data?.topArtists || [])) {
      const parsed = parseArtistNames(raw.artist);
      for (const name of parsed) {
        const cleanName = name.trim();
        const key = cleanName.toLowerCase();
        if (!key || key === 'unknown artist' || key === 'unknown') continue;

        if (!artistMap.has(key)) {
          artistMap.set(key, {
            artist: cleanName,
            playCount: raw.playCount,
            totalDuration: raw.totalDuration,
          });
        }
      }
    }

    // 3. Tự động lấy bìa một bài hát ngẫu nhiên làm bìa đại diện cho nghệ sĩ nếu chưa có ảnh
    const list = Array.from(artistMap.values()).map((item) => {
      if (!item.picture && tracks && tracks.length > 0) {
        const artistTracks = tracks.filter((t) => isTrackByArtist(t, item.artist));
        item.picture = getRandomArtistCover(artistTracks);
      }
      return item;
    });

    // Sắp xếp theo tổng thời lượng nghe giảm dần, sau đó theo số lượt nghe
    list.sort((a, b) => {
      if (b.totalDuration !== a.totalDuration) {
        return b.totalDuration - a.totalDuration;
      }
      return b.playCount - a.playCount;
    });

    return list.slice(0, 30);
  }, [topSongs, data?.topArtists, tracks]);

  // Đăng ký nhận IPC Event Realtime khi có lượt nghe vừa đạt chuẩn
  useEffect(() => {
    if (window.electronAPI) {
      const removeListener = window.electronAPI.onAnalyticsUpdated(() => {
        queryClient.invalidateQueries({ queryKey: ['analytics'] });
      });
      return () => removeListener();
    }
  }, [queryClient]);

  // Helper đổi tổng giây thành đơn vị thông minh (Phút / Giờ / Ngày)
  const formatDurationSmart = (totalSeconds: number) => {
    if (totalSeconds < 60) return `${totalSeconds} Giây`;
    if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)} Phút`;
    const hours = (totalSeconds / 3600).toFixed(1);
    if (parseFloat(hours) < 24) return `${hours} Giờ`;
    const days = (totalSeconds / (3600 * 24)).toFixed(1);
    return `${days} Ngày`;
  };

  const handlePlayTopTrack = (topTrack: TopTrackStat) => {
    const matchedTrack = tracks.find(t => t.id === topTrack.songId);
    if (matchedTrack) {
      playTrack(matchedTrack);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* Header & Huy hiệu Live Tracking */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Thống Kê Realtime</h1>
            
            {/* Live Tracking Badge */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Live Tracking</span>
            </div>
          </div>
          <p className="text-sm text-neutral-400 mt-1">Phân tích hành vi nghe nhạc offline được tự động đồng bộ theo thời gian thực</p>
        </div>

        {/* Time Range Tabs */}
        <div className="flex items-center bg-neutral-900/80 p-1.5 rounded-2xl border border-white/10 shrink-0">
          {(
            [
              { id: '1h', label: '1 Giờ Qua' },
              { id: 'today', label: 'Hôm Nay' },
              { id: 'week', label: 'Tuần Này' },
              { id: 'month', label: 'Tháng Này' },
              { id: 'all', label: 'Tất Cả' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                timeRange === tab.id
                  ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Overview Cards (3 thẻ tổng quan) */}
      {isLoading ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Tổng thời gian đã nghe */}
        <div className="bg-neutral-900/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-apple-pink/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Tổng Thời Gian Nghe</span>
            <div className="p-2.5 rounded-xl bg-apple-pink/10 text-apple-pink">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {formatDurationInMinutes(overview.totalDurationSeconds)}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Được tính từ các mốc phát nhạc thực tế</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-apple-pink/5 rounded-full blur-xl group-hover:bg-apple-pink/10 transition-all" />
        </div>

        {/* Card 2: Lượt nghe hợp lệ */}
        <div className="bg-neutral-900/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Lượt Nghe Hợp Lệ</span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Headphones className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {overview.totalValidPlays.toLocaleString()} <span className="text-lg font-normal text-neutral-400">lần</span>
            </div>
            <p className="text-xs text-emerald-400/80 mt-1">Chỉ tính khi nghe &ge; 30s hoặc &ge; 50% bài</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
        </div>

        {/* Card 3: Số bài hát khác nhau */}
        <div className="bg-neutral-900/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Bài Hát Đã Nghe</span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Music className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {overview.totalUniqueSongs.toLocaleString()} <span className="text-lg font-normal text-neutral-400">bài</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">Bài hát duy nhất từng được phát</p>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all" />
        </div>
      </div>

      {/* 2. Grid Bảng xếp hạng Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top Bài Hát Leaderboard */}
        <div className="bg-neutral-900/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-apple-pink fill-apple-pink" />
              <h2 className="text-lg font-bold text-white tracking-tight">Top Bài Hát Nghe Nhiều Nhất</h2>
            </div>
            <span className="text-xs text-neutral-500">Realtime</span>
          </div>

          {topSongs.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
              <Music className="w-10 h-10 opacity-30" />
              <p className="text-xs">Chưa có dữ liệu lượt nghe hợp lệ trong khoảng thời gian này</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topSongs.map((song, index) => {
                const isCurrent = currentTrack?.id === song.songId && isPlaying;
                return (
                  <div
                    key={song.songId}
                    onClick={() => handlePlayTopTrack(song)}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group ${
                      isCurrent ? 'bg-apple-pink/15 border border-apple-pink/30' : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Rank Badge */}
                      <span className={`w-6 text-center text-sm font-extrabold ${
                        index === 0 ? 'text-amber-400 text-base' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-neutral-500'
                      }`}>
                        #{index + 1}
                      </span>

                      {/* Picture & Equalizer */}
                      <div className="relative w-11 h-11 rounded-lg bg-neutral-800 overflow-hidden shrink-0 shadow border border-white/5 flex items-center justify-center">
                        {song.picture ? (
                          <img 
                            src={convertFileSrc(song.picture)} 
                            alt={song.title} 
                            className="w-full h-full object-cover" 
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Music className="w-5 h-5 text-neutral-600" />
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                            <SoundWave />
                          </div>
                        )}
                      </div>

                      {/* Title & Artist */}
                      <div className="min-w-0 flex flex-col">
                        <span className={`text-sm font-semibold truncate ${isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'}`}>
                          {song.title}
                        </span>
                        <span className="text-xs text-neutral-400 truncate">{song.artist}</span>
                      </div>
                    </div>

                    {/* Play Count & Duration */}
                    <div className="flex flex-col items-end shrink-0 ml-4">
                      <span className="text-xs font-bold text-apple-pink bg-apple-pink/10 px-2.5 py-0.5 rounded-full">
                        {song.playCount} lượt
                      </span>
                      <span className="text-[11px] text-neutral-400 mt-1">
                        {formatDurationInMinutes(song.totalDuration)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Nghệ Sĩ Leaderboard */}
        <div className="bg-neutral-900/60 backdrop-blur-apple border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Top Nghệ Sĩ Được Yêu Thích</h2>
            </div>
            <span className="text-xs text-neutral-500">Realtime</span>
          </div>

          {topArtists.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
              <User className="w-10 h-10 opacity-30" />
              <p className="text-xs">Chưa có dữ liệu nghệ sĩ trong khoảng thời gian này</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topArtists.map((artist, index) => (
                <div
                  key={artist.artist}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className={`w-6 text-center text-sm font-extrabold ${
                      index === 0 ? 'text-amber-400 text-base' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-neutral-500'
                    }`}>
                      #{index + 1}
                    </span>

                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-bold text-apple-pink border border-white/10 shadow overflow-hidden shrink-0 relative">
                      {artist.picture ? (
                        <img
                          src={convertFileSrc(artist.picture)}
                          alt={artist.artist}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        artist.artist.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex flex-col">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-apple-pink transition-colors">
                        {artist.artist}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {formatDurationSmart(artist.totalDuration)} đã nghe
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full shrink-0">
                    {artist.playCount} lượt nghe
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )}
</div>
  );
};

const AnalyticsSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-neutral-900/60 border border-white/10 rounded-2xl p-6" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-96 bg-neutral-900/60 border border-white/10 rounded-3xl p-6" />
        <div className="h-96 bg-neutral-900/60 border border-white/10 rounded-3xl p-6" />
      </div>
    </div>
  );
};
