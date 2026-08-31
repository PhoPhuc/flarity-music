import React, { useState, useRef, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  Music2,
  Disc,
  User,
  FolderPlus,
  ListMusic,
  PlusCircle,
  BarChart3,
  House,
  Compass,
  Pencil,
  Trash2,
  Check,
  X,
  Sliders,
} from 'lucide-react';

interface PlaylistContextMenu {
  playlistId: string;
  playlistName: string;
  x: number;
  y: number;
}

export const Sidebar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    playlists,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    selectFolderAndScan,
    isScanning,
    setSelectedAlbum,
    selectedPlaylist,
    setSelectedPlaylist,
    openSettings,
  } = usePlayer();

  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistMenu, setPlaylistMenu] = useState<PlaylistContextMenu | null>(null);
  const [renameState, setRenameState] = useState<{ id: string; name: string } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ngoài
  useEffect(() => {
    if (!playlistMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPlaylistMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [playlistMenu]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowNewPlaylistModal(false);
    }
  };

  const handlePlaylistContextMenu = (e: React.MouseEvent, playlistId: string, playlistName: string) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (x + 180 > window.innerWidth) x = window.innerWidth - 192;
    if (y + 100 > window.innerHeight) y = window.innerHeight - 112;
    setPlaylistMenu({ playlistId, playlistName, x, y });
  };

  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameState || !renameState.name.trim()) return;
    await renamePlaylist(renameState.id, renameState.name.trim());
    setRenameState(null);
  };

  const handleDeletePlaylist = async (playlistId: string, playlistName: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa playlist "${playlistName}"?`)) {
      await deletePlaylist(playlistId);
    }
    setPlaylistMenu(null);
  };

  return (
    <aside className="w-56 lg:w-60 shrink-0 h-full bg-[#0c0c0e]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col justify-between p-3.5 select-none z-20">
      <div className="space-y-6">
        {/* Header - Nhấn vào để mở Cài đặt */}
        <div className="h-8 drag-region flex items-center justify-between">
          <button
            onClick={openSettings}
            className="flex items-center gap-2.5 px-2 py-1 -ml-1 rounded-xl font-bold tracking-tight text-lg text-white hover:bg-white/10 transition-all cursor-pointer group active:scale-95 no-drag"
            title="Cài đặt & Quản lý phân tích âm học"
          >
            <img
              src="/logo.png"
              alt="App Logo"
              className="w-7 h-7 object-contain rounded-lg shadow-md group-hover:scale-105 transition-transform"
            />
            <span className="group-hover:text-apple-pink transition-colors">Flarity Music</span>
            <Sliders className="w-3.5 h-3.5 text-neutral-500 opacity-0 group-hover:opacity-100 group-hover:text-apple-pink transition-all ml-0.5" />
          </button>
        </div>

        {/* Nút Import Nhạc */}
        <button
          onClick={selectFolderAndScan}
          disabled={isScanning}
          className="w-full flex items-center justify-center gap-2.5 bg-apple-pink hover:bg-apple-pinkHover text-white font-medium py-2.5 px-4 rounded-xl shadow-lg shadow-apple-pink/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
        >
          <FolderPlus className="w-4 h-4" />
          <span>{isScanning ? 'Đang quét nhạc...' : 'Thêm Thư Mục Nhạc'}</span>
        </button>

        {/* Thư Viện Navigation */}
        <div className="space-y-1">
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Thư Viện</h2>

          {[
            { mode: 'home' as const, icon: <House className="w-4 h-4" />, label: 'Trang Chủ', onClick: () => { setViewMode('home'); setSelectedAlbum(null); } },
            { mode: 'discovery' as const, icon: <Compass className="w-4 h-4" />, label: 'Khám Phá & Tải Nhạc', onClick: () => { setViewMode('discovery'); setSelectedAlbum(null); } },
            { mode: 'library-albums' as const, icon: <Disc className="w-4 h-4" />, label: 'Album', onClick: () => { setViewMode('library-albums'); setSelectedAlbum(null); } },
            { mode: 'library-tracks' as const, icon: <Music2 className="w-4 h-4" />, label: 'Bài Hát', onClick: () => { setViewMode('library-tracks'); setSelectedAlbum(null); } },
            { mode: 'library-artists' as const, icon: <User className="w-4 h-4" />, label: 'Nghệ Sĩ', onClick: () => { setViewMode('library-artists'); setSelectedAlbum(null); } },
            { mode: 'analytics' as const, icon: <BarChart3 className="w-4 h-4" />, label: 'Thống Kê', onClick: () => { setViewMode('analytics'); setSelectedAlbum(null); } },
          ].map(({ mode, icon, label, onClick }) => (
            <button
              key={mode}
              onClick={onClick}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === mode
                  ? 'bg-apple-pink/15 text-apple-pink'
                  : 'text-neutral-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Playlist Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Playlist</h2>
            <button
              onClick={() => setShowNewPlaylistModal(true)}
              className="text-neutral-400 hover:text-apple-pink transition-colors"
              title="Tạo Playlist mới"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
            {playlists.length === 0 ? (
              <p className="px-3 text-xs text-neutral-500 italic">Chưa có playlist nào</p>
            ) : (
              playlists.map(pl => (
                <div key={pl.id} className="relative group">
                  {renameState?.id === pl.id ? (
                    /* Inline rename form */
                    <form onSubmit={handleRenameConfirm} className="flex items-center gap-1 px-2 py-1">
                      <input
                        autoFocus
                        value={renameState.name}
                        onChange={e => setRenameState({ ...renameState, name: e.target.value })}
                        onKeyDown={e => e.key === 'Escape' && setRenameState(null)}
                        className="flex-1 bg-neutral-800 border border-apple-pink/50 rounded-lg px-2 py-1 text-xs text-white focus:outline-none min-w-0"
                      />
                      <button type="submit" className="text-apple-pink hover:text-white p-1 shrink-0" title="Xác nhận"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setRenameState(null)} className="text-neutral-500 hover:text-white p-1 shrink-0" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                    </form>
                  ) : (
                    <button
                      onContextMenu={e => handlePlaylistContextMenu(e, pl.id, pl.name)}
                      onClick={() => { setSelectedPlaylist(pl); setViewMode('playlist-detail'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium truncate transition-all ${
                        viewMode === 'playlist-detail' && selectedPlaylist?.id === pl.id
                          ? 'bg-apple-pink/15 text-apple-pink'
                          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <ListMusic className="w-4 h-4 shrink-0" />
                      <span className="truncate flex-1 text-left">{pl.name}</span>
                      <span className="text-[10px] text-neutral-600 shrink-0 group-hover:text-neutral-400 transition-colors">
                        {pl.trackIds.length}
                      </span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Tạo Playlist Mới */}
      {showNewPlaylistModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePlaylist}
            className="bg-neutral-800 border border-white/10 rounded-2xl p-5 w-80 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200"
          >
            <h3 className="text-base font-semibold text-white">Tạo Playlist Mới</h3>
            <input
              type="text"
              placeholder="Tên playlist..."
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              autoFocus
              className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-apple-pink"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewPlaylistModal(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-neutral-400 hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-sm bg-apple-pink text-white font-medium hover:bg-apple-pinkHover"
              >
                Tạo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlist Context Menu (chuột phải) */}
      {playlistMenu && (
        <div
          ref={menuRef}
          style={{ top: playlistMenu.y, left: playlistMenu.x }}
          className="fixed z-[60] w-44 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-0.5 text-sm animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            onClick={() => {
              setRenameState({ id: playlistMenu.playlistId, name: playlistMenu.playlistName });
              setPlaylistMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/10 text-neutral-200 transition-colors text-xs"
          >
            <Pencil className="w-3.5 h-3.5 text-blue-400" />
            <span>Đổi Tên</span>
          </button>
          <button
            onClick={() => handleDeletePlaylist(playlistMenu.playlistId, playlistMenu.playlistName)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Playlist</span>
          </button>
        </div>
      )}
    </aside>
  );
};
