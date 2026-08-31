import React, { useState, useMemo } from 'react';
import type { Album } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { Search, X, Disc, ArrowRight, CheckCircle2 } from 'lucide-react';
import { convertFileSrc } from '../utils/tauriBridge';

interface MoveAlbumModalProps {
  sourceAlbum: Album;
  onClose: () => void;
}

export const MoveAlbumModal: React.FC<MoveAlbumModalProps> = ({ sourceAlbum, onClose }) => {
  const { albums, mergeAlbum } = usePlayer();
  const [search, setSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Lọc danh sách album – bỏ album nguồn, lọc theo search
  const filteredAlbums = useMemo(() => {
    const q = search.toLowerCase().trim();
    return albums.filter(a => a.id !== sourceAlbum.id && (
      !q || a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    ));
  }, [albums, sourceAlbum.id, search]);

  const handleConfirm = async () => {
    if (!selectedTarget) return;
    setIsLoading(true);
    try {
      await mergeAlbum(sourceAlbum, selectedTarget);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Di Chuyển Album</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Chọn album đích để gộp bài hát từ{' '}
              <span className="text-apple-pink font-semibold">"{sourceAlbum.name}"</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source → Target indicator */}
        <div className="px-5 py-3 bg-white/[0.03] border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-apple-pink/10 text-apple-pink px-2.5 py-1.5 rounded-lg max-w-[35%]">
              <Disc className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{sourceAlbum.name}</span>
              <span className="text-apple-pink/60 shrink-0">({sourceAlbum.tracks.length} bài)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0" />
            {selectedTarget ? (
              <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 px-2.5 py-1.5 rounded-lg max-w-[45%]">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span className="truncate font-medium">{selectedTarget.name}</span>
              </div>
            ) : (
              <span className="text-neutral-500 italic">Chọn album bên dưới...</span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Tìm album..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-neutral-800 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-apple-pink/50 transition-colors"
            />
          </div>
        </div>

        {/* Album list */}
        <div className="overflow-y-auto flex-1 px-3 pb-3 space-y-0.5">
          {filteredAlbums.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 py-8">Không tìm thấy album nào</p>
          ) : (
            filteredAlbums.map(album => (
              <button
                key={album.id}
                onClick={() => setSelectedTarget(prev => prev?.id === album.id ? null : album)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                  selectedTarget?.id === album.id
                    ? 'bg-apple-pink/15 border border-apple-pink/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                {/* Cover */}
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-800 border border-white/5">
                  {album.picture ? (
                    <img
                      src={convertFileSrc(album.picture)}
                      alt={album.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc className="w-4 h-4 text-neutral-600" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${selectedTarget?.id === album.id ? 'text-apple-pink' : 'text-white'}`}>
                    {album.name}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">{album.artist} • {album.tracks.length} bài</p>
                </div>
                {selectedTarget?.id === album.id && (
                  <CheckCircle2 className="w-4 h-4 text-apple-pink shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTarget || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-apple-pink text-white font-medium hover:bg-apple-pinkHover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {isLoading ? (
              <span className="animate-pulse">Đang chuyển...</span>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Di Chuyển</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
