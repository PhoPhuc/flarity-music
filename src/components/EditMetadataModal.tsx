import React, { useState } from 'react';
import { X, Upload, Save, FolderCheck } from 'lucide-react';
import type { Track, Album } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { convertFileSrc } from '../utils/tauriBridge';

interface EditMetadataModalProps {
  type: 'track' | 'album';
  data: Track | Album | null;
  onClose: () => void;
}

export const EditMetadataModal: React.FC<EditMetadataModalProps> = ({
  type,
  data,
  onClose
}) => {
  const { updateTrackMetadata } = usePlayer();
  const isTrack = type === 'track';
  const track = isTrack ? (data as Track) : null;
  const album = !isTrack ? (data as Album) : null;

  const [title, setTitle] = useState(isTrack ? track?.title || '' : album?.name || '');
  const [artist, setArtist] = useState(data?.artist || '');
  const [albumName, setAlbumName] = useState(isTrack ? track?.album || '' : album?.name || '');
  const [year, setYear] = useState<string>(data?.year ? String(data.year) : '');
  const [picture, setPicture] = useState<string>(data?.picture || '');
  const [moveFile, setMoveFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!data) return null;

  const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPicture(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updates = {
      title,
      artist,
      album: albumName,
      year: year ? parseInt(year) : undefined,
      picture,
      moveFile
    };

    if (isTrack && track) {
      await updateTrackMetadata(track.id, updates);
    } else if (album) {
      // Cập nhật toàn bộ bài hát thuộc Album
      for (const t of album.tracks) {
        await updateTrackMetadata(t.id, {
          artist,
          album: albumName,
          year: year ? parseInt(year) : undefined,
          picture,
          moveFile
        });
      }
    }

    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-bold tracking-tight">
            {isTrack ? 'Chỉnh Sửa Thông Tin Bài Hát' : 'Chỉnh Sửa Thông Tin Album'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex gap-6">
            {/* Cover Art Box & Upload Button */}
            <div className="flex flex-col items-center space-y-3 shrink-0">
              <div className="w-32 h-32 rounded-2xl bg-neutral-800 border border-white/10 overflow-hidden relative group shadow-xl">
                {picture ? (
                  <img 
                    src={convertFileSrc(picture)} 
                    alt="Cover" 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs">
                    Chưa có ảnh
                  </div>
                )}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-medium">
                  <Upload className="w-5 h-5 mb-1" />
                  <span>Tải ảnh mới</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePictureUpload} />
                </label>
              </div>
              <span className="text-[11px] text-neutral-400">Định dạng JPG/PNG</span>
            </div>

            {/* Inputs */}
            <div className="flex-1 space-y-3">
              {isTrack && (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">Tên bài hát</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-apple-pink transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Nghệ sĩ</label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-apple-pink transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Album</label>
                <input
                  type="text"
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-apple-pink transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Năm phát hành</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-apple-pink transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Option Di chuyển thư mục trên đĩa */}
          <div className="pt-2 border-t border-white/5">
            <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-colors">
              <input
                type="checkbox"
                checked={moveFile}
                onChange={(e) => setMoveFile(e.target.checked)}
                className="w-4 h-4 rounded text-apple-pink focus:ring-0 focus:ring-offset-0 bg-neutral-800 border-white/20"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <FolderCheck className="w-3.5 h-3.5 text-amber-400" />
                  Sắp xếp lại file trên đĩa cứng
                </span>
                <span className="text-[11px] text-neutral-400">
                  Tự động di chuyển file vào thư mục <code className="text-apple-pink">Thư_mục/Nghệ_sĩ/Album/</code>
                </span>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 transition-colors text-neutral-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-apple-pink hover:bg-apple-pinkHover transition-colors flex items-center gap-2 text-white shadow-lg shadow-apple-pink/20 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
