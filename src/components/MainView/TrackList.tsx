import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Track } from '../../types';
import { usePlayer } from '../../context/PlayerContext';
import { Play, Music, Mic2, Tv, FileVideo, Search, X } from 'lucide-react';
import { formatTime } from '../../utils/lrcParser';
import { convertFileSrc } from '../../utils/tauriBridge';
import { SoundWave } from '../SoundWave';

interface TrackListProps {
  tracks: Track[];
  title?: string;
  showAlbumCover?: boolean;
  onOpenMvForTrack?: (track: Track) => void;
  onContextMenu?: (e: React.MouseEvent, track: Track) => void;
  onFetchNextPage?: () => void;
  hasNextPage?: boolean;
}

export const TrackList: React.FC<TrackListProps> = React.memo(({
  tracks,
  title,
  showAlbumCover = true,
  onOpenMvForTrack,
  onContextMenu,
  onFetchNextPage,
  hasNextPage,
}) => {
  const { currentTrack, isPlaying, playTrack, setLyricsOpen, attachMvToTrack, attachLrcToTrack } = usePlayer();
  const [contextMenuTrack, setContextMenuTrack] = useState<{ trackId: string; x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    const q = searchQuery.toLowerCase().trim();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );
  }, [tracks, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: filteredTracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // 56px approximate row height
    overscan: 10,
  });

  // Automatically trigger lazy loading of next page when scrolling near the end
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  if (lastItem && lastItem.index >= filteredTracks.length - 5 && hasNextPage && onFetchNextPage) {
    onFetchNextPage();
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e, track);
    } else {
      setContextMenuTrack({ trackId: track.id, x: e.clientX, y: e.clientY });
    }
  }, [onContextMenu]);

  const handleContainerClick = useCallback(() => setContextMenuTrack(null), []);

  if (tracks.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <Music className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Danh sách bài hát trống.</p>
      </div>
    );
  }

  // Use virtualized scrolling if list has more than 20 items
  const useVirtual = filteredTracks.length > 20;

  return (
    <div className="p-6 space-y-4 relative" onClick={handleContainerClick}>
      {/* Header & Dedicated Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        <div>
          {title && <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>}
          <p className="text-xs font-semibold text-neutral-400 mt-0.5">
            {searchQuery ? `${filteredTracks.length} / ${tracks.length}` : `${tracks.length}`} bài hát
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên bài, nghệ sĩ, album..."
            className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 focus:border-apple-pink/50 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5 rounded-md hover:bg-white/10 transition-colors"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-xs font-medium">Không tìm thấy bài hát nào phù hợp với "{searchQuery}"</p>
        </div>
      ) : useVirtual ? (
        <div ref={parentRef} className="max-h-[calc(100vh-220px)] overflow-auto custom-scrollbar">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const track = filteredTracks[virtualRow.index];
              return (
                <div
                  key={track.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <TrackRow
                    track={track}
                    index={virtualRow.index}
                    tracks={filteredTracks}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying && currentTrack?.id === track.id}
                    showAlbumCover={showAlbumCover}
                    onOpenMvForTrack={onOpenMvForTrack}
                    onContextMenu={handleContextMenu}
                    playTrack={playTrack}
                    setLyricsOpen={setLyricsOpen}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {filteredTracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              tracks={filteredTracks}
              isCurrent={currentTrack?.id === track.id}
              isPlaying={isPlaying && currentTrack?.id === track.id}
              showAlbumCover={showAlbumCover}
              onOpenMvForTrack={onOpenMvForTrack}
              onContextMenu={handleContextMenu}
              playTrack={playTrack}
              setLyricsOpen={setLyricsOpen}
            />
          ))}
        </div>
      )}

      {/* Context Menu nhỏ fallback cho Attach MV & LRC thủ công */}
      {contextMenuTrack && (
        <div
          style={{ top: contextMenuTrack.y, left: contextMenuTrack.x }}
          className="fixed z-50 bg-neutral-900 border border-white/10 rounded-xl p-1.5 shadow-2xl animate-in fade-in duration-100 min-w-[200px] space-y-1"
        >
          <button
            onClick={() => {
              attachLrcToTrack(contextMenuTrack.trackId);
              setContextMenuTrack(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white hover:bg-apple-pink rounded-lg transition-colors"
          >
            <Mic2 className="w-4 h-4 text-emerald-400" />
            <span>Gán file Lời (.lrc)...</span>
          </button>

          <button
            onClick={() => {
              attachMvToTrack(contextMenuTrack.trackId);
              setContextMenuTrack(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-white hover:bg-apple-pink rounded-lg transition-colors"
          >
            <FileVideo className="w-4 h-4 text-purple-400" />
            <span>Gán file MV (Video)...</span>
          </button>
        </div>
      )}
    </div>
  );
});

TrackList.displayName = 'TrackList';

// TrackRow tách riêng + memoized để tránh re-render toàn danh sách khi bài đang phát thay đổi
interface TrackRowProps {
  track: Track;
  index: number;
  tracks: Track[];
  isCurrent: boolean;
  isPlaying: boolean;
  showAlbumCover: boolean;
  onOpenMvForTrack?: (track: Track) => void;
  onContextMenu: (e: React.MouseEvent, track: Track) => void;
  playTrack: (track: Track, list?: Track[]) => void;
  setLyricsOpen: (open: boolean) => void;
}

const TrackRow: React.FC<TrackRowProps> = React.memo(({
  track,
  index,
  tracks,
  isCurrent,
  isPlaying,
  showAlbumCover,
  onOpenMvForTrack,
  onContextMenu,
  playTrack,
  setLyricsOpen,
}) => {
  const { newTrackIds, updatedTrackIds } = usePlayer();
  const isNew = newTrackIds.has(track.id);
  const isUpdated = updatedTrackIds.has(track.id);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'track', trackId: track.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => playTrack(track, tracks)}
      onContextMenu={e => onContextMenu(e, track)}
      className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 ${
        isCurrent ? 'bg-apple-pink/10' : ''
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        {/* Index / Play indicator */}
        <span className="w-6 text-center text-sm font-medium text-neutral-500 group-hover:hidden flex items-center justify-center">
          {isCurrent && isPlaying ? (
            <SoundWave />
          ) : (
            index + 1
          )}
        </span>
        <button className="w-6 hidden group-hover:flex items-center justify-center text-white">
          <Play className="w-4 h-4 fill-current" />
        </button>

        {/* Cover */}
        {showAlbumCover && (
          <div className="w-10 h-10 rounded-lg bg-neutral-800 overflow-hidden shrink-0 shadow">
            {track.picture ? (
              <img
                src={convertFileSrc(track.picture)}
                alt={track.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                <Music className="w-5 h-5" />
              </div>
            )}
          </div>
        )}

        {/* Track info */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold truncate ${
              isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
            }`}>
              {track.title}
            </span>
            {isNew && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider shrink-0 animate-in fade-in duration-200">
                Bài mới
              </span>
            )}
            {!isNew && isUpdated && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider shrink-0 animate-in fade-in duration-200">
                Đã sửa
              </span>
            )}
            {track.hasMv && (
              <span className="px-1.5 py-0.5 rounded bg-apple-pink/20 text-apple-pink font-extrabold text-[10px] uppercase tracking-wider shrink-0">
                MV
              </span>
            )}
          </div>
          <span className="text-xs text-neutral-400 truncate">{track.artist}</span>
        </div>
      </div>

      {/* Extras & Duration */}
      <div className="flex items-center gap-3 shrink-0">
        {track.hasMv && onOpenMvForTrack && (
          <span
            onClick={e => {
              e.stopPropagation();
              playTrack(track, tracks);
              onOpenMvForTrack(track);
            }}
            className="p-1 rounded text-neutral-400 hover:text-apple-pink hover:bg-white/10 transition-colors"
            title="Phát Music Video (MV)"
          >
            <Tv className="w-3.5 h-3.5 text-apple-pink" />
          </span>
        )}
        {track.hasLyric && (
          <span
            onClick={e => {
              e.stopPropagation();
              playTrack(track, tracks);
              setLyricsOpen(true);
            }}
            className="p-1 rounded text-neutral-400 hover:text-apple-pink hover:bg-white/10 transition-colors"
            title="Có lời bài hát"
          >
            <Mic2 className="w-3.5 h-3.5" />
          </span>
        )}
        <span className="text-xs text-neutral-400 font-medium tabular-nums w-12 text-right">
          {formatTime(track.duration)}
        </span>
      </div>
    </div>
  );
});

TrackRow.displayName = 'TrackRow';
