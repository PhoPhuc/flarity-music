import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  ExternalLink,
  X,
  ArrowUpCircle,
  Package,
  Calendar,
  Zap,
} from 'lucide-react';
import {
  type AppUpdateInfo,
  openExternalLink,
  skipThisUpdateVersion,
  detectPlatform,
} from '../services/updateService';

interface UpdateNotificationModalProps {
  updateInfo: AppUpdateInfo;
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  updateInfo,
  isOpen,
  onClose,
}) => {
  const [isSkipped, setIsSkipped] = useState(false);

  if (!isOpen || !updateInfo.hasUpdate) return null;

  const platform = detectPlatform();
  const recommendedAsset = updateInfo.recommendedAsset;

  const handleDownload = () => {
    if (recommendedAsset?.downloadUrl) {
      openExternalLink(recommendedAsset.downloadUrl);
    } else {
      openExternalLink(updateInfo.releaseUrl);
    }
    onClose();
  };

  const handleSkipVersion = () => {
    skipThisUpdateVersion(updateInfo.latestVersion);
    setIsSkipped(true);
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VNE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-apple transition-opacity" />

      {/* Modal Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg bg-[#141417]/95 border border-apple-pink/30 rounded-3xl shadow-[0_25px_80px_rgba(250,36,60,0.25)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Glow Top Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-apple-pink via-purple-500 to-cyan-400" />

        {/* Header */}
        <div className="p-6 pb-4 flex items-start justify-between border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-apple-pink/20 border border-apple-pink/40 flex items-center justify-center shadow-lg shadow-apple-pink/20 shrink-0">
              <Sparkles className="w-6 h-6 text-apple-pink animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-apple-pink text-white shadow-sm">
                  Cập Nhật Mới
                </span>
                {updateInfo.publishedAt && (
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(updateInfo.publishedAt)}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-extrabold text-white tracking-tight mt-1">
                Flarity Music f{updateInfo.latestVersion}
              </h3>
            </div>
          </div>


          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[v0hW overflow-y-auto custom-scrollbar">
          {/* Version Transition Badge */}
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-neutral-300">
                Phiên bản hiện tại: <span className="font-mono text-neutral-400">v{updateInfo.currentVersion}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-xs text-apple-pink">
              <span>Nâng cấp lên:</span>
              <span className="px-2 py-0.5 rounded-lg bg-apple-pink/20 border border-apple-pink/40 font-mono text-white">
                v{updateInfo.latestVersion}
              </span>
            </div>
          </div>

          {/* Release Notes Preview */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Nội Dung Cập Nhật & Tính Năng Mới</span>
            </label>
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
              {updateInfo.releaseNotes || 'Bản cập nhật tối ưu hóa hyệu nc�ng, cải tiến dịch thuật AI và sủa các lỗi tồn đọng.'}
            </div>
          </div>

          {/* Available Download Assets List */}
          {updateInfo.allAssets.length > 0 && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Package className="w-3 h-3 text-cyan-400" />
                <span>Các Gói Cài Đặt Khả Dụng ({platform === 'windows' ? 'Windows' : platform === 'macos' ? 'macOS' : 'All'})</span>
              </label>
              <div className="space-y-1.5">
                {updateInfo.allAssets.map((asset) => (
                  <button
                    key={asset.name}
                    onClick={() => {
                      openExternalLink(asset.downloadUrl);
                      onClose();
                    }}
                    className={'w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ' +
                      (asset.name === recommendedAsset?.name
                        ? 'bg-apple-pink/15 border-apple-pink/40 text-white shadow-md ring-1 ring-apple-pink/30'
                        : 'bg-white/5 border-white/5 text-neutral-300 hover:bg-white/10 hover:text-white')}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Download className={'w-3.5 h-3.5 shrink-0 ' + (asset.name === recommendedAsset?.name ? 'text-apple-pink' : 'text-neutral-400')} />
                      <span className="text-xs font-semibold truncate">{asset.name}</span>
                      {asset.name === recommendedAsset?.name && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-apple-pink text-white shrink-0">
                          Khuyên Dùng
                        </span>
                      )}
                    </div>
                    {asset.size > 0 && (
                      <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-2">
                        {formatFileSize(asset.size)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleSkipVersion}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer py-1"
            >
              {isSkipped ? 'Đã bỏ qua' : 'Bỏ qua bản này'}
            </button>
            <span className="text-neutral-600">·</span>
            <button
              onClick={() => openExternalLink(updateInfo.releaseUrl)}
              className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer py-1"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Xem GitHub</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-neutral-200 hover:text-white transition-all cursor-pointer active:scale-95"
            >
              Để sau
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-apple-pink to-rose-600 hover:brightness-110 text-white shadow-lg shadow-apple-pink/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Tải Bản Cập Nhật</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
