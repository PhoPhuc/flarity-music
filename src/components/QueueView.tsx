import React, { useState, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import {
  X,
  Music,
  GripVertical,
  Shuffle,
  Repeat,
  Trash2,
  ListMusic,
} from 'lucide-react';
import { formatTime } from '../utils/lrcParser';
import { convertFileSrc } from '../utils/tauriBridge';
import { SoundWave } from './SoundWave';
import type { Track } from '../types';

export const QueueView: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const {
    queue,
    currentTrack,
    isPlaying,
    playTrack,
    reorderQueue,
    shuffle,
    repeat,
    removeFromQueue,
    clearQueue,
  } = usePlayer();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      reorderQueue(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleItemClick = (track: Track) => {
    if (isDraggingRef.current) return;
    playTrack(track, queue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] max-w-[95vw] bg-[#121214]/95 backdrop-blur-2xl border-l border-white/10 z-40 p-5 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-apple-pink/15 border border-apple-pink/30 flex items-center justify-center shadow-md">
            <ListMusic className="w-4 h-4 text-apple-pink" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Danh Sách Chờ
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono">
                {queue.length}
              </span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {shuffle && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-apple-pink/20 text-apple-pink text-[10px] font-bold">
              <Shuffle className="w-3 h-3" />
            </span>
          )}
          {repeat !== 'off' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold">
              <Repeat className="w-3 h-3" />
            </span>
          )}
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors ml-1 cursor-pointer"
            title="Đóng danh sách chờ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Sub-header */}
      <div className="flex items-center justify-between py-3 text-[11px] font-medium text-neutral-400">
        <span>Kéo thả để đổi thứ tự phát</span>
        {queue.length > 1 && (
          <button
            onClick={clearQueue}
            className="text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa hết</span>
          </button>
        )}
      </div>

      {/* Main Queue List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
        {queue.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-neutral-500 space-y-2">
            <Music className="w-10 h-10 opacity-30" />
            <p className="text-xs font-medium">Danh sách chờ trống</p>
          </div>
        ) : (
          queue.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isDragging = draggedIndex === idx;
            const isDragOver = dragOverIndex === idx && !isDragging;

            return (
              <div
                key={`${track.id}-${idx}`}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => handleItemClick(track)}
                className={`group relative flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all duration-150 select-none ${
                  isCurrent
                    ? 'bg-apple-pink/20 border border-apple-pink/30 shadow-lg shadow-apple-pink/10'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/5'
                } ${isDragging ? 'opacity-30 scale-95 border-dashed border-apple-pink/60 bg-apple-pink/10' : ''} ${
                  isDragOver ? 'border-2 border-apple-pink bg-apple-pink/20 shadow-md scale-[1.02]' : ''
                }`}
              >
                {/* Indicator line on drag over */}
                {isDragOver && (
                  <div className="absolute inset-x-0 -top-1 h-1 bg-apple-pink rounded-full shadow-[0_0_8px_#FA243C]" />
                )}

                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="cursor-grab active:cursor-grabbing text-neutral-500 group-hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="relative w-10 h-10 rounded-xl bg-neutral-800 overflow-hidden shrink-0 shadow flex items-center justify-center">
                    {track.picture ? (
                      <img
                        src={convertFileSrc(track.picture)}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Music className="w-4 h-4 text-neutral-600" />
                    )}
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[1px]">
                        <SoundWave />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex flex-col flex-1">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isCurrent ? 'text-apple-pink' : 'text-white group-hover:text-apple-pink'
                      }`}
                    >
                      {track.title}
                    </span>
                    <span className="text-[11px] text-neutral-400 truncate">{track.artist}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[11px] text-neutral-400 tabular-nums font-mono">
                    {formatTime(track.duration)}
                  </span>
                  {!isCurrent && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromQueue(idx);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Xóa khỏi danh sách chờ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
