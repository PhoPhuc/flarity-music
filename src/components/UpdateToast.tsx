import React from 'react';
import { Sparkles, Download, X, ArrowUpCircle } from 'lucide-react';
import { type AppUpdateInfo, openExternalLink } from '../services/updateService';

interface UpdateToastProps {
  updateInfo: AppUpdateInfo | null;
  isOpen: boolean;
  onOpenModal: () => void;
  onClose: () => void;
}

export const UpdateToast: React.FC<UpdateToastProps> = ({
  updateInfo,
  isOpen,
  onOpenModal,
  onClose,
}) => {
  if (!isOpen || !updateInfo || !updateInfo.hasUpdate) return null;

  const recommendedAsset = updateInfo.recommendedAsset;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recommendedAsset?.downloadUrl) {
      openExternalLink(recommendedAsset.downloadUrl);
    } else {
      openExternalLink(updateInfo.releaseUrl);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-[90] max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300 select-none">
      <div className="relative bg-[#141417]/95 border border-apple-pink/40 rounded-2xl shadow-[0_15px_40px_rgba(250,36,60,0.25)] backdrop-blur-xl p-4 overflow-hidden group">
        {/* Glow corner accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-apple-pink/15 rounded-full blur-xl pointer-events-none -mr-8 -mt-8" />

        <div className="flex items-start gap-3 relative z-10">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-apple-pink/20 border border-apple-pink/40 flex items-center justify-center text-apple-pink shrink-0 shadow-md shadow-apple-pink/20">
            <ArrowUpCircle className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  Có bản cập nhật mới
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-apple-pink/20 text-apple-pink border border-apple-pink/30 shrink-0">
                  v{updateInfo.latestVersion}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
              {updateInfo.releaseTitle || ('Flarity Music v' + updateInfo.latestVersion + ' đã sẵn sàng')}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-apple-pink hover:bg-apple-pink/90 active:scale-95 text-white text-[11px] font-bold shadow-md shadow-apple-pink/30 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ngay</span>
              </button>
              <button
                type="button"
                onClick={onOpenModal}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 active:scale-95 text-neutral-200 hover:text-white text-[11px] font-medium transition-all cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-apple-pink" />
                <span>Chi tiết</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
