import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  Camera,
  Check,
  Copy,
  Sparkles,
  Layers,
  Disc,
} from 'lucide-react';

export type ChartType = 'both' | 'songs' | 'artists';
export type ChartLimit = 5 | 10;
export type ChartTheme = 'apple-pink' | 'cyberpunk' | 'oled';

export interface TopTrackItem {
  songId: string;
  title: string;
  artist: string;
  picture?: string;
  playCount: number;
  totalDuration: number;
}

export interface TopArtistItem {
  artist: string;
  playCount: number;
  totalDuration: number;
  picture?: string;
}

interface ChartExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  topSongs: TopTrackItem[];
  topArtists: TopArtistItem[];
  timeRangeLabel: string;
}

export const ChartExportModal: React.FC<ChartExportModalProps> = ({
  isOpen,
  onClose,
  topSongs,
  topArtists,
  timeRangeLabel,
}) => {
  const [chartType, setChartType] = useState<ChartType>('both');
  const [limit, setLimit] = useState<ChartLimit>(10);
  const [theme, setTheme] = useState<ChartTheme>('apple-pink');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Helper format smart time
  const formatTimeText = (sec: number) => {
    if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + ' phút';
    return (sec / 3600).toFixed(1) + ' giờ';
  };

  const renderPosterToCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const songsToRender = topSongs.slice(0, limit);
    const artistsToRender = topArtists.slice(0, limit);

    // Dynamic sizing based on layout
    const isBoth = chartType === 'both';
    const width = isBoth ? 1400 : 1000;
    const headerHeight = 240;
    const footerHeight = 110;
    const rowHeight = 72;
    const contentRows = Math.max(songsToRender.length, artistsToRender.length, limit);
    const contentHeight = contentRows * rowHeight + 80;
    const height = headerHeight + contentHeight + footerHeight;

    canvas.width = width;
    canvas.height = height;

    // 1. Draw Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    if (theme === 'apple-pink') {
      bgGrad.addColorStop(0, '#15151c');
      bgGrad.addColorStop(0.5, '#0e0e12');
      bgGrad.addColorStop(1, '#08080a');
    } else if (theme === 'cyberpunk') {
      bgGrad.addColorStop(0, '#120d20');
      bgGrad.addColorStop(0.5, '#090814');
      bgGrad.addColorStop(1, '#05040a');
    } else {
      bgGrad.addColorStop(0, '#0a0a0c');
      bgGrad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Ambient glowing orbs
    const drawGlow = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    if (theme === 'apple-pink') {
      drawGlow(width * 0.85, 120, 400, 'rgba(250, 36, 60, 0.22)');
      drawGlow(width * 0.15, height * 0.7, 450, 'rgba(168, 85, 247, 0.15)');
    } else if (theme === 'cyberpunk') {
      drawGlow(width * 0.85, 120, 400, 'rgba(6, 182, 212, 0.25)');
      drawGlow(width * 0.15, height * 0.7, 450, 'rgba(236, 72, 153, 0.20)');
    }

    // Outer border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // 3. Load & Draw Logo
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
        logoImg.src = '/logo.png';
      });
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, 60, 50, 72, 72);
      }
    } catch {
      // ignore
    }

    // Header Titles
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont,  Segoe UI, Roboto, sans-serif';
    ctx.fillText('FLARITY MUSIC', 150, 85);

    ctx.fillStyle = theme === 'cyberpunk' ? '#06B6D4' : '#FA243C';
    ctx.font = '700 15px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    ctx.fillText('BẢNG XẾP HẠNG THỜI GIAN THỰC · TOP ' + limit, 150, 112);

    // Meta Badge (Right side of header)
    const badgeText = timeRangeLabel.toUpperCase() + ' · ' + new Date().toLocaleDateString('vi-VN');
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    const badgeW = ctx.measureText(badgeText).width + 36;
    const badgeX = width - 60 - badgeW;
    const badgeY = 60;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, 36, [18]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#E5E7EB';
    ctx.fillText(badgeText, badgeX + 18, badgeY + 23);

    // Header Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 150);
    ctx.lineTo(width - 60, 150);
    ctx.stroke();

    // 4. Render Table Sections
    const startY = 195;

    const drawRankBadge = (x: number, y: number, rank: number) => {
      let color = '#9CA3AF';
      let bg = 'rgba(255, 255, 255, 0.06)';
      if (rank === 1) {
        color = '#F59E0B';
        bg = 'rgba(245, 158, 11, 0.2)';
      } else if (rank === 2) {
        color = '#E2E8F0';
        bg = 'rgba(226, 232, 240, 0.2)';
      } else if (rank === 3) {
        color = '#F97316';
        bg = 'rgba(249, 115, 22, 0.2)';
      }

      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y - 24, 38, 34, [10]);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = '900 16px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('#' + rank, x + 19, y - 1);
      ctx.textAlign = 'left';
    };

    if (chartType === 'both') {
      const colWidth = (width - 160) / 2;

      // Column 1: Top Songs
      ctx.fillStyle = '#FA243C';
      ctx.font = '800 20px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      ctx.fillText('TOP ' + limit + ' BÀI HÁT NGHE NHIỀU NHẤT', 60, startY);

      songsToRender.forEach((song, idx) => {
        const rowY = startY + 45 + idx * rowHeight;
        drawRankBadge(60, rowY, idx + 1);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 16px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        const title = song.title.length > 26 ? song.title.slice(0, 24) + '...' : song.title;
        ctx.fillText(title, 115, rowY - 5);

        // Artist
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        const artist = song.artist.length > 30 ? song.artist.slice(0, 28) + '...' : song.artist;
        ctx.fillText(artist, 115, rowY + 14);

        // Stats
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(song.playCount + ' lượt', 60 + colWidth, rowY - 5);

        ctx.fillStyle = '#6B7280';
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(formatTimeText(song.totalDuration), 60 + colWidth, rowY + 13);
        ctx.textAlign = 'left';

        // Row underline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, rowY + 22);
        ctx.lineTo(60 + colWidth, rowY + 22);
        ctx.stroke();
      });

      // Column 2: Top Artists
      const col2X = 60 + colWidth + 40;
      ctx.fillStyle = '#10B981';
      ctx.font = '800 20px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      ctx.fillText('TOP ' + limit + ' NGHỆ SĨ YÊU THÍCH NHẤT', col2X, startY);

      artistsToRender.forEach((artist, idx) => {
        const rowY = startY + 45 + idx * rowHeight;
        drawRankBadge(col2X, rowY, idx + 1);

        // Artist Name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 17px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        const name = artist.artist.length > 26 ? artist.artist.slice(0, 24) + '...' : artist.artist;
        ctx.fillText(name, col2X + 55, rowY - 5);

        // Subtext
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Nghệ sĩ tiêu biểu', col2X + 55, rowY + 14);

        // Stats
        ctx.textAlign = 'right';
        ctx.fillStyle = '#10B981';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(artist.playCount + ' lượt nghe', col2X + colWidth, rowY - 5);

        ctx.fillStyle = '#6B7280';
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(formatTimeText(artist.totalDuration), col2X + colWidth, rowY + 13);
        ctx.textAlign = 'left';

        // Row underline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(col2X, rowY + 22);
        ctx.lineTo(col2X + colWidth, rowY + 22);
        ctx.stroke();
      });
    } else if (chartType === 'songs') {
      const colWidth = width - 120;
      ctx.fillStyle = '#FA243C';
      ctx.font = '800 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      ctx.fillText('TOP ' + limit + ' BÀI HÁT NGHE NHIỀU NHẤT', 60, startY);

      songsToRender.forEach((song, idx) => {
        const rowY = startY + 50 + idx * rowHeight;
        drawRankBadge(60, rowY, idx + 1);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 18px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(song.title, 120, rowY - 5);

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 14px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(song.artist, 120, rowY + 15);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = '800 15px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(song.playCount + ' lượt phát', 60 + colWidth, rowY - 5);

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Tổng thời lượng: ' + formatTimeText(song.totalDuration), 60 + colWidth, rowY + 14);
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, rowY + 24);
        ctx.lineTo(60 + colWidth, rowY + 24);
        ctx.stroke();
      });
    } else {
      // Only Artists
      const colWidth = width - 120;
      ctx.fillStyle = '#10B981';
      ctx.font = '800 22px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
      ctx.fillText('TOP ' + limit + ' NGHỆ SĨ ĐƯỢC YÊU THÍCH NHẤT', 60, startY);

      artistsToRender.forEach((artist, idx) => {
        const rowY = startY + 50 + idx * rowHeight;
        drawRankBadge(60, rowY, idx + 1);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 19px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(artist.artist, 120, rowY - 5);

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 14px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Nghệ sĩ xuất sắc trong thư viện', 120, rowY + 15);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#10B981';
        ctx.font = '800 15px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(artist.playCount + ' lượt nghe', 60 + colWidth, rowY - 5);

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText('Tổng thời gian: ' + formatTimeText(artist.totalDuration), 60 + colWidth, rowY + 14);
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, rowY + 24);
        ctx.lineTo(60 + colWidth, rowY + 24);
        ctx.stroke();
      });
    }

    // 5. Footer Bar with Flarity Branding & Watermark
    const footerY = height - 55;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, footerY - 20);
    ctx.lineTo(width - 60, footerY - 20);
    ctx.stroke();

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Tạo tự động từ Flarity Music · Trình phát nhạc Audiophile Hi-Res Lossless', 60, footerY + 10);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6B7280';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    ctx.fillText('github.com/PhoPhuc/flarity-music', width - 60, footerY + 10);
    ctx.textAlign = 'left';

    return canvas;
  }, [chartType, limit, theme, topSongs, topArtists, timeRangeLabel]);

  // Update preview image
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    renderPosterToCanvas().then((canvas) => {
      if (canvas && !isCancelled) {
        setPreviewUrl(canvas.toDataURL('image/png'));
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [isOpen, renderPosterToCanvas]);

  const handleDownloadImage = async () => {
    setIsGenerating(true);
    try {
      const canvas = await renderPosterToCanvas();
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      const filename = 'flarity-chart-' + chartType + '-top' + limit + '-' + Date.now() + '.png';
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      const canvas = await renderPosterToCanvas();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && (window as any).ClipboardItem) {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        }
      }, 'image/png');
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/85 backdrop-blur-apple transition-opacity"
      />

      {/* Main Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#141417]/95 border border-white/15 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-apple-pink/20 border border-apple-pink/40 flex items-center justify-center text-apple-pink shadow-md">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Xuất Ảnh Bảng Xếp Hạng</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-apple-pink text-white">
                  Flarity Poster
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 font-medium">
                Tạo poster đồ họa chất lượng cao kèm logo Flarity để chia sẻ lên mạng xã hội
              </p>
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

        {/* Modal Body: 2 Columns (Controls on Left, Live Preview on Right) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Chọn Bảng Xếp Hạng */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-apple-pink" />
                <span>Nội Dung Bảng Xếp Hạng</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'both', label: 'Cả Hai' },
                  { id: 'songs', label: 'Bài Hát' },
                  { id: 'artists', label: 'Nghệ Sĩ' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChartType(item.id as ChartType)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      chartType === item.id
                        ? 'bg-apple-pink/20 border-apple-pink text-white shadow-md ring-1 ring-apple-pink/40'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Số Lượng Hiển Thị */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Số Lượng Hiển Thị</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 5, label: 'Top 5 Tiêu Biểu' },
                  { id: 10, label: 'Top 10 Đầy Đủ' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setLimit(item.id as ChartLimit)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      limit === item.id
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-md ring-1 ring-purple-500/40'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Chủ Đề Màu Sắc */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Disc className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chủ Đề Gradient Poster</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'apple-pink', label: 'Apple Pink' },
                  { id: 'cyberpunk', label: 'Cyber Neon' },
                  { id: 'oled', label: 'Pure OLED' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id as ChartTheme)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      theme === item.id
                        ? 'bg-white/20 border-white text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info summary */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-neutral-300 leading-relaxed">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Đặc điểm ảnh xuất:</span>
              </p>
              <p>• Độ phân giải cao (High-Resolution PNG) sắc nét.</p>
              <p>• Tự động nhúng logo thương hiệu Flarity Music & mốc thời gian.</p>
              <p>• Tỉ lệ chuẩn poster đăng Facebook, Instagram, Discord.</p>
            </div>
          </div>

          {/* Live Preview Area (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 rounded-2xl bg-black/50 border border-white/10 min-h-[360px] overflow-hidden relative group">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Live Chart Preview"
                className="w-full max-h-[460px] object-contain rounded-xl shadow-2xl border border-white/15"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-500 space-y-2">
                <Sparkles className="w-8 h-8 text-apple-pink animate-spin" />
                <p className="text-xs">Đang vẽ đồ họa bảng xếp hạng...</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <span className="text-xs text-neutral-400 hidden sm:inline">
            Khung thời gian: <strong className="text-white">{timeRangeLabel}</strong>
          </span>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={handleCopyImage}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{isCopied ? 'Đã sao chép!' : 'Sao chép ảnh'}</span>
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-apple-pink to-rose-600 hover:brightness-110 text-white shadow-lg shadow-apple-pink/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Đang xuất file...' : 'Tải Ảnh PNG Về Máy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
