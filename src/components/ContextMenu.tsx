import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Play,
  ListPlus,
  PlusCircle,
  Folder,
  Edit3,
  Trash2,
  Music,
  ArrowRightLeft,
  ChevronRight,
  Disc,
  Mic2,
  FileVideo,
  Search,
  Sparkles,
} from 'lucide-react';
import type { Track, Album } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { MoveAlbumModal } from './MoveAlbumModal';

export interface ContextMenuTarget {
  x: number;
  y: number;
  type: 'track' | 'album';
  data: Track | Album;
}

interface ContextMenuProps {
  target: ContextMenuTarget | null;
  onClose: () => void;
  onOpenEditModal: (type: 'track' | 'album', data: any) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ target, onClose, onOpenEditModal }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [showAlbumPlaylistSubmenu, setShowAlbumPlaylistSubmenu] = useState(false);
  const [showMoveAlbumModal, setShowMoveAlbumModal] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');
  const [submenuAlign, setSubmenuAlign] = useState<'top' | 'bottom'>('top');

  const {
    playlists,
    playTrack,
    playNext,
    addToQueue,
    addTrackToPlaylist,
    addAlbumToPlaylist,
    showInExplorer,
    deleteTrack,
    deleteAlbum,
    createPlaylist,
    attachLrcToTrack,
    attachMvToTrack,
    openLyricsSearch,
    openBatchLyricsForAlbum,
  } = usePlayer();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (!target || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = target.x;
    let y = target.y;

    // Giới hạn y không bị tràn cạnh dưới màn hình (phía trên PlayerBar)
    if (y + rect.height > vh - 12) {
      y = Math.max(12, vh - rect.height - 12);
      setSubmenuAlign('bottom');
    } else {
      setSubmenuAlign('top');
    }

    // Giới hạn x không bị tràn cạnh phải màn hình
    if (x + rect.width > vw - 12) {
      x = Math.max(12, vw - rect.width - 12);
      setSubmenuSide('left');
    } else if (x + rect.width + 210 > vw - 12) {
      setSubmenuSide('left');
    } else {
      setSubmenuSide('right');
    }

    setMenuPos({ x, y });
  }, [target]);

  if (!target) return null;

  const isTrack = target.type === 'track';
  const track = isTrack ? (target.data as Track) : null;
  const album = !isTrack ? (target.data as Album) : null;

  const handleCreatePlaylistFromTrack = async () => {
    if (!track) return;
    const name = prompt('Tên playlist mới:', track.title);
    if (!name?.trim()) return;
    await createPlaylist(name.trim());
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        style={{ top: `${menuPos.y}px`, left: `${menuPos.x}px` }}
        className="fixed z-50 w-56 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-1.5 text-sm select-none animate-in fade-in zoom-in-95 duration-150 text-neutral-200 max-h-[calc(100vh-24px)] overflow-y-auto no-scrollbar"
      >
        {/* ── TRACK MENU ── */}
        {isTrack && track && (
          <div className="space-y-0.5">
            {/* Tiêu đề */}
            <div className="px-3 py-1.5 border-b border-white/5 mb-1">
              <p className="text-xs font-semibold text-white truncate">{track.title}</p>
              <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
            </div>

            <button
              onClick={() => { playTrack(track); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-apple-pink hover:text-white transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Phát Bài Hát</span>
            </button>

            <button
              onClick={() => { playNext(track); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <ListPlus className="w-4 h-4 text-apple-pink" />
              <span>Phát Tiếp Theo</span>
            </button>

            <button
              onClick={() => { addToQueue(track); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-neutral-400" />
              <span>Thêm Vào Hàng Chờ</span>
            </button>

            <div className="h-[1px] bg-white/5 my-1" />

            {/* Submenu Thêm vào Playlist */}
            <div
              className="relative"
              onMouseEnter={() => setShowPlaylistSubmenu(true)}
              onMouseLeave={() => setShowPlaylistSubmenu(false)}
            >
              <button className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Music className="w-4 h-4 text-apple-pink" />
                  <span>Thêm Vào Playlist</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {showPlaylistSubmenu && (
                <div className={`absolute ${submenuSide === 'left' ? 'right-full mr-1' : 'left-full ml-1'} ${submenuAlign === 'bottom' ? 'bottom-0' : 'top-0'} w-52 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-0.5 z-50 max-h-60 overflow-y-auto`}>
                  {/* Tạo playlist mới từ bài này */}
                  <button
                    onClick={handleCreatePlaylistFromTrack}
                    className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium text-apple-pink hover:bg-apple-pink/10 transition-colors flex items-center gap-2"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Tạo Playlist Mới...
                  </button>
                  {playlists.length > 0 && <div className="h-[1px] bg-white/5 my-1" />}
                  {playlists.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-neutral-500 text-center">Chưa có Playlist nào</div>
                  ) : (
                    playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => { addTrackToPlaylist(pl.id, track.id); onClose(); }}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-apple-pink hover:text-white truncate transition-colors"
                      >
                        {pl.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-[1px] bg-white/5 my-1" />

            <button
              onClick={() => { showInExplorer(track.filePath); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              <Folder className="w-4 h-4 text-amber-400" />
              <span>Mở Thư Mục Chứa File</span>
            </button>

            <button
              onClick={() => { openLyricsSearch(track); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-apple-pink/20 text-apple-pink hover:text-white transition-colors text-xs font-semibold"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tìm Lời Bài Hát (LRCLIB)...</span>
            </button>

            <button
              onClick={() => { attachLrcToTrack(track.id); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              <Mic2 className="w-4 h-4 text-emerald-400" />
              <span>{track.hasLyric ? 'Thay Đổi File Lời (.lrc)' : 'Gán File Lời (.lrc)...'}</span>
            </button>

            <button
              onClick={() => { attachMvToTrack(track.id); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              <FileVideo className="w-4 h-4 text-purple-400" />
              <span>{track.hasMv ? 'Thay Đổi File MV (Video)' : 'Gán File MV (Video)...'}</span>
            </button>

            <button
              onClick={() => { onOpenEditModal('track', track); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>Chỉnh Sửa Thông Tin</span>
            </button>

            <div className="h-[1px] bg-white/5 my-1" />

            <button
              onClick={() => {
                if (confirm(`Bạn có chắc chắn muốn xóa bài hát "${track.title}" khỏi thư viện?`)) {
                  deleteTrack(track.id, track.filePath, false);
                }
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 text-amber-400 transition-colors text-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Khỏi Thư Viện</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`CẢNH BÁO: Bài hát "${track.title}" và file trên ổ đĩa sẽ bị XÓA VĨNH VIỄN!\n\nBạn có muốn tiếp tục?`)) {
                  deleteTrack(track.id, track.filePath, true);
                }
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-xs font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Vĩnh Viễn Trên Đĩa</span>
            </button>
          </div>
        )}

        {/* ── ALBUM MENU ── */}
        {!isTrack && album && (
          <div className="space-y-0.5">
            <div className="px-3 py-1.5 border-b border-white/5 mb-1">
              <p className="text-xs font-semibold text-white truncate">{album.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">{album.artist} • {album.tracks.length} bài</p>
            </div>

            <button
              onClick={() => {
                if (album.tracks.length > 0) playTrack(album.tracks[0], album.tracks);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-apple-pink hover:text-white transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Phát Toàn Bộ Album</span>
            </button>

            <button
              onClick={() => { album.tracks.forEach(t => addToQueue(t)); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <PlusCircle className="w-4 h-4 text-neutral-400" />
              <span>Thêm Album Vào Hàng Chờ</span>
            </button>

            {/* Di chuyển Album vào Album khác */}
            <button
              onClick={() => { setShowMoveAlbumModal(true); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4 text-violet-400" />
              <span>Di Chuyển Vào Album...</span>
            </button>

            {/* Thêm Album vào Playlist */}
            <div
              className="relative"
              onMouseEnter={() => setShowAlbumPlaylistSubmenu(true)}
              onMouseLeave={() => setShowAlbumPlaylistSubmenu(false)}
            >
              <button className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2.5">
                  <Disc className="w-4 h-4 text-apple-pink" />
                  <span>Thêm Album Vào Playlist</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {showAlbumPlaylistSubmenu && (
                <div className={`absolute ${submenuSide === 'left' ? 'right-full mr-1' : 'left-full ml-1'} ${submenuAlign === 'bottom' ? 'bottom-0' : 'top-0'} w-52 bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-1.5 space-y-0.5 z-50 max-h-60 overflow-y-auto`}>
                  {playlists.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-neutral-500 text-center">Chưa có Playlist nào</div>
                  ) : (
                    playlists.map(pl => (
                      <button
                        key={pl.id}
                        onClick={() => { addAlbumToPlaylist(pl.id, album); onClose(); }}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-apple-pink hover:text-white truncate transition-colors"
                      >
                        {pl.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="h-[1px] bg-white/5 my-1" />

            <button
              onClick={() => { openBatchLyricsForAlbum(album); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-apple-pink/20 text-apple-pink hover:text-white transition-colors text-xs font-semibold"
            >
              <Sparkles className="w-4 h-4" />
              <span>Tự Động Tìm Lời Cho Album...</span>
            </button>

            {album.tracks.length > 0 && (
              <button
                onClick={() => { showInExplorer(album.tracks[0].filePath); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
              >
                <Folder className="w-4 h-4 text-amber-400" />
                <span>Mở Thư Mục Album</span>
              </button>
            )}

            <button
              onClick={() => { onOpenEditModal('album', album); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors text-xs"
            >
              <Edit3 className="w-4 h-4 text-blue-400" />
              <span>Chỉnh Sửa Thông Tin Album</span>
            </button>

            <div className="h-[1px] bg-white/5 my-1" />

            <button
              onClick={() => {
                if (confirm(`Bạn có chắc chắn muốn xóa Album "${album.name}" (${album.tracks.length} bài hát) khỏi thư viện?`)) {
                  deleteAlbum(album, false);
                }
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 text-amber-400 transition-colors text-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Album Khỏi Thư Viện</span>
            </button>

            <button
              onClick={() => {
                if (confirm(`CẢNH BÁO: Tất cả ${album.tracks.length} bài hát trong Album "${album.name}" sẽ bị XÓA VĨNH VIỄN trên đĩa cứng!\n\nBạn có muốn tiếp tục?`)) {
                  deleteAlbum(album, true);
                }
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-xs font-semibold"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Album Vĩnh Viễn Trên Đĩa</span>
            </button>
          </div>
        )}
      </div>

      {/* Move Album Modal – render ngoài menu để không bị clip */}
      {showMoveAlbumModal && album && (
        <MoveAlbumModal
          sourceAlbum={album}
          onClose={() => setShowMoveAlbumModal(false)}
        />
      )}
    </>
  );
};
