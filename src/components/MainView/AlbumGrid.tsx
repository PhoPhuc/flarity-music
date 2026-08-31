import React, { useCallback, useState, useMemo } from 'react';
import type { Album } from '../../types';
import { Music, Play, Layers, Sparkles, RefreshCw, Search, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { convertFileSrc } from '../../utils/tauriBridge';

interface AlbumGridProps {
  albums: Album[];
  onSelectAlbum: (album: Album) => void;
  onContextMenu?: (e: React.MouseEvent, album: Album) => void;
}

export const AlbumGrid: React.FC<AlbumGridProps> = React.memo(({ albums, onSelectAlbum, onContextMenu }) => {
  const { playTrack, mergeAlbum, updateTrackMetadata } = usePlayer();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    const q = searchQuery.toLowerCase().trim();
    return albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, searchQuery]);

  const handlePlayClick = useCallback((e: React.MouseEvent, album: Album) => {
    e.stopPropagation();
    if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
  }, [playTrack]);

  const handleDropOnAlbum = useCallback(async (targetAlbum: Album, dragDataJson: string) => {
    try {
      const data = JSON.parse(dragDataJson);
      if (data.type === 'album') {
        const sourceAlbum = albums.find(a => a.id === data.albumId);
        if (sourceAlbum && sourceAlbum.id !== targetAlbum.id) {
          if (confirm(`Bạn có muốn di chuyển toàn bộ bài hát từ Album "${sourceAlbum.name}" sang Album "${targetAlbum.name}"?`)) {
            await mergeAlbum(sourceAlbum, targetAlbum);
          }
        }
      } else if (data.type === 'track') {
        if (data.trackId) {
          await updateTrackMetadata(data.trackId, {
            album: targetAlbum.name,
            artist: targetAlbum.artist
          });
        }
      }
    } catch (e) {
      console.error('Lỗi khi drop vào album:', e);
    }
  }, [albums, mergeAlbum, updateTrackMetadata]);

  if (albums.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-neutral-500 space-y-2">
        <Music className="w-12 h-12 opacity-30" />
        <p className="text-sm font-medium">Chưa có Album nào. Hãy bấm "Thêm Thư Mục Nhạc" ở sidebar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 pt-0">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-4 pb-2">
        <p className="text-xs font-semibold text-neutral-400">
          {searchQuery ? `${filteredAlbums.length} / ${albums.length}` : `${albums.length}`} albums
        </p>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên album, nghệ sĩ..."
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

      {filteredAlbums.length === 0 ? (
        <div className="h-48 flex flex-col items-center justify-center text-neutral-500 space-y-2">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-xs font-medium">Không tìm thấy album nào phù hợp với "{searchQuery}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-4 sm:gap-5">
          {filteredAlbums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onSelectAlbum={onSelectAlbum}
              onContextMenu={onContextMenu}
              onPlayClick={handlePlayClick}
              onDropOnAlbum={handleDropOnAlbum}
            />
          ))}
        </div>
      )}
    </div>
  );
});

AlbumGrid.displayName = 'AlbumGrid';

// Tách AlbumCard thành component riêng với React.memo để tránh re-render toàn bộ grid
interface AlbumCardProps {
  album: Album;
  onSelectAlbum: (album: Album) => void;
  onContextMenu?: (e: React.MouseEvent, album: Album) => void;
  onPlayClick: (e: React.MouseEvent, album: Album) => void;
  onDropOnAlbum: (targetAlbum: Album, dragDataJson: string) => void;
}

const AlbumCard: React.FC<AlbumCardProps> = React.memo(({ album, onSelectAlbum, onContextMenu, onPlayClick, onDropOnAlbum }) => {
  const { newAlbumKeys, updatedAlbumKeys } = usePlayer();
  const [isDragOver, setIsDragOver] = useState(false);

  const isNew = newAlbumKeys.has(album.id);
  const isUpdated = updatedAlbumKeys.has(album.id);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'album', albumId: album.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dataJson = e.dataTransfer.getData('application/json');
    if (dataJson) {
      onDropOnAlbum(album, dataJson);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onSelectAlbum(album)}
      onContextMenu={e => onContextMenu && onContextMenu(e, album)}
      className={`group cursor-pointer flex flex-col space-y-3 p-3 rounded-2xl transition-all duration-300 ${
        isDragOver
          ? 'bg-apple-pink/20 border-2 border-dashed border-apple-pink scale-105 shadow-2xl'
          : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      {/* Cover Art Box */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-neutral-800 shadow-lg border border-white/5 transition-transform duration-300 group-hover:scale-[1.02]">
        {album.picture ? (
          <img
            src={convertFileSrc(album.picture)}
            alt={album.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800 p-8">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain opacity-70" loading="lazy" />
          </div>
        )}

        {/* Dynamic Status Badges */}
        {isNew && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-xs flex items-center gap-1 animate-in zoom-in-75 duration-200">
            <Sparkles className="w-3 h-3" />
            <span>Album mới</span>
          </span>
        )}
        {!isNew && isUpdated && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-xs flex items-center gap-1 animate-in zoom-in-75 duration-200">
            <RefreshCw className="w-3 h-3" />
            <span>Đã đổi / Gộp</span>
          </span>
        )}

        {/* Quick Play Button Overlay */}
        <button
          onClick={e => onPlayClick(e, album)}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-apple-pink text-white flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 active:scale-95"
          title="Phát Album"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>

        {/* Drag Over Overlay Hint */}
        {isDragOver && (
          <div className="absolute inset-0 bg-apple-pink/60 backdrop-blur-xs flex flex-col items-center justify-center text-white font-bold text-xs p-2 text-center space-y-1 animate-in fade-in duration-150">
            <Layers className="w-6 h-6 animate-bounce" />
            <span>Thả để di chuyển vào album này</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold text-white truncate group-hover:text-apple-pink transition-colors">
          {album.name}
        </h3>
        <p className="text-xs text-neutral-400 truncate font-medium">{album.artist} • {album.tracks.length} bài</p>
      </div>
    </div>
  );
});

AlbumCard.displayName = 'AlbumCard';
