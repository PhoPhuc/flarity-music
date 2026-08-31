import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  Camera,
  Check,
  Copy,
  Layers,
  Music,
  User,
  Sparkles,
} from 'lucide-react';
import { convertFileSrc } from '../utils/tauriBridge';

export type ChartType = 'both' | 'songs' | 'artists';
export type ChartLimit = 5 | 10;

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

// Hàm tải ảnh bất đồng bộ với Promise
function loadImageAsync(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Vẽ hình chữ nhật bo góc
function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Format đơn vị phút theo số tự nhiên (ví dụ 45 phút, 120 phút)
function formatMinutesNatural(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 phút';
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} phút`;
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const renderPosterToCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const songsToRender = topSongs.slice(0, limit);
    const artistsToRender = topArtists.slice(0, limit);

    // Kích thước poster chuẩn thiết kế Apple Dark
    const isBoth = chartType === 'both';
    const width = isBoth ? 1280 : 860;
    const headerHeight = 150;
    const footerHeight = 100;
    const rowHeight = 64;
    const contentRows = Math.max(
      isBoth ? Math.max(songsToRender.length, artistsToRender.length) : (chartType === 'songs' ? songsToRender.length : artistsToRender.length),
      1
    );
    const contentHeight = contentRows * rowHeight + 40;
    const height = headerHeight + contentHeight + footerHeight;

    // Retina 2x Canvas cho độ nét tối đa
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // 1. NỀN ĐEN HOÀN TOÀN (Pure OLED Black #000000)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 2. CHỈ GLOW ĐỎ Ở GÓC (Apple Pink / Red Glow ở góc trên phải & góc dưới trái)
    const drawCornerGlow = (cx: number, cy: number, radius: number, alpha: number) => {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(250, 36, 60, ${alpha})`);
      grad.addColorStop(0.5, `rgba(250, 36, 60, ${alpha * 0.3})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // Glow góc trên bên phải
    drawCornerGlow(width, 0, 420, 0.28);
    // Glow nhẹ góc dưới bên trái
    drawCornerGlow(0, height, 360, 0.15);

    // Viền khung mờ tinh tế
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    drawRoundedRectPath(ctx, 16, 16, width - 32, height - 32, 20);
    ctx.stroke();

    // 3. HEADER BẢNG XẾP HẠNG (Font Web chuẩn)
    const fontStack = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // Tiêu đề chính
    ctx.fillStyle = '#FA243C';
    ctx.font = `800 13px ${fontStack}`;
    ctx.fillText('FLARITY MUSIC', 48, 62);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 28px ${fontStack}`;
    const mainTitle =
      chartType === 'both'
        ? `BẢNG XẾP HẠNG TOP ${limit}`
        : chartType === 'songs'
        ? `TOP ${limit} BÀI HÁT NGHE NHIỀU NHẤT`
        : `TOP ${limit} NGHỆ SĨ ĐƯỢC YÊU THÍCH`;
    ctx.fillText(mainTitle, 48, 98);

    // Huy hiệu mốc thời gian (Góc phải header)
    const timeBadgeText = timeRangeLabel.toUpperCase();
    ctx.font = `700 12px ${fontStack}`;
    const badgeW = ctx.measureText(timeBadgeText).width + 28;
    const badgeX = width - 48 - badgeW;
    const badgeY = 66;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    drawRoundedRectPath(ctx, badgeX, badgeY, badgeW, 30, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    ctx.fillStyle = '#E4E4E7';
    ctx.fillText(timeBadgeText, badgeX + 14, badgeY + 19);

    // Đường kẻ phân cách header
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, 126);
    ctx.lineTo(width - 48, 126);
    ctx.stroke();

    // Tải trước tất cả hình ảnh bìa bài hát & avatar nghệ sĩ
    const songImages = await Promise.all(
      songsToRender.map((s) => (s.picture ? loadImageAsync(convertFileSrc(s.picture)) : Promise.resolve(null)))
    );
    const artistImages = await Promise.all(
      artistsToRender.map((a) => (a.picture ? loadImageAsync(convertFileSrc(a.picture)) : Promise.resolve(null)))
    );

    // 4. RENDER NỘI DUNG DANH SÁCH
    const startY = 160;

    const drawRankBadge = (x: number, y: number, rank: number) => {
      let color = '#71717A';
      let bg = 'rgba(255, 255, 255, 0.04)';
      if (rank === 1) {
        color = '#F59E0B';
        bg = 'rgba(245, 158, 11, 0.18)';
      } else if (rank === 2) {
        color = '#E2E8F0';
        bg = 'rgba(226, 232, 240, 0.16)';
      } else if (rank === 3) {
        color = '#F97316';
        bg = 'rgba(249, 115, 22, 0.18)';
      }

      ctx.fillStyle = bg;
      drawRoundedRectPath(ctx, x, y - 20, 32, 28, 8);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = `800 13px ${fontStack}`;
      ctx.textAlign = 'center';
      ctx.fillText(`#${rank}`, x + 16, y - 1);
      ctx.textAlign = 'left';
    };

    if (chartType === 'both') {
      const colWidth = (width - 136) / 2;

      // CỘT 1: TOP BÀI HÁT
      ctx.fillStyle = '#FA243C';
      ctx.font = `800 15px ${fontStack}`;
      ctx.fillText(`TOP ${limit} BÀI HÁT`, 48, startY + 10);

      songsToRender.forEach((song, idx) => {
        const rowY = startY + 36 + idx * rowHeight;
        const img = songImages[idx];

        // 1. Rank Badge
        drawRankBadge(48, rowY, idx + 1);

        // 2. Bìa Bài Hát (Square Rounded Rect 44x44)
        const coverX = 88;
        const coverY = rowY - 24;
        const coverSize = 42;

        ctx.save();
        drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 8);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
        } else {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(coverX, coverY, coverSize, coverSize);
          ctx.fillStyle = '#FA243C';
          ctx.font = `700 16px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.fillText('♪', coverX + coverSize / 2, coverY + coverSize / 2 + 5);
          ctx.textAlign = 'left';
        }
        ctx.restore();

        // Viền ảnh bìa
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 8);
        ctx.stroke();

        // 3. Tên bài hát & Nghệ sĩ
        const textX = coverX + coverSize + 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 14px ${fontStack}`;
        const title = song.title.length > 22 ? song.title.slice(0, 20) + '...' : song.title;
        ctx.fillText(title, textX, rowY - 6);

        ctx.fillStyle = '#A1A1AA';
        ctx.font = `500 12px ${fontStack}`;
        const artist = song.artist.length > 24 ? song.artist.slice(0, 22) + '...' : song.artist;
        ctx.fillText(artist, textX, rowY + 11);

        // 4. Số liệu: Lượt & Phút theo số tự nhiên
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = `700 12px ${fontStack}`;
        ctx.fillText(`${song.playCount} lượt`, 48 + colWidth, rowY - 6);

        ctx.fillStyle = '#71717A';
        ctx.font = `500 11px ${fontStack}`;
        ctx.fillText(formatMinutesNatural(song.totalDuration), 48 + colWidth, rowY + 11);
        ctx.textAlign = 'left';

        // Đường kẻ dòng mờ
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(48, rowY + 22);
        ctx.lineTo(48 + colWidth, rowY + 22);
        ctx.stroke();
      });

      // CỘT 2: TOP NGHỆ SĨ
      const col2X = 48 + colWidth + 40;
      ctx.fillStyle = '#FA243C';
      ctx.font = `800 15px ${fontStack}`;
      ctx.fillText(`TOP ${limit} NGHỆ SĨ`, col2X, startY + 10);

      artistsToRender.forEach((artist, idx) => {
        const rowY = startY + 36 + idx * rowHeight;
        const img = artistImages[idx];

        // 1. Rank Badge
        drawRankBadge(col2X, rowY, idx + 1);

        // 2. Bìa / Avatar Nghệ Sĩ (Hình Tròn 42x42)
        const avatarX = col2X + 40;
        const avatarY = rowY - 24;
        const avatarSize = 42;
        const radius = avatarSize / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + radius, avatarY + radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        if (img) {
          ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        } else {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
          ctx.fillStyle = '#FA243C';
          ctx.font = `800 16px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.fillText(artist.artist.charAt(0).toUpperCase(), avatarX + radius, avatarY + radius + 5);
          ctx.textAlign = 'left';
        }
        ctx.restore();

        // Viền tròn avatar
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(avatarX + radius, avatarY + radius, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 3. Tên Nghệ Sĩ
        const textX = avatarX + avatarSize + 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 14px ${fontStack}`;
        const name = artist.artist.length > 22 ? artist.artist.slice(0, 20) + '...' : artist.artist;
        ctx.fillText(name, textX, rowY - 6);

        ctx.fillStyle = '#A1A1AA';
        ctx.font = `500 12px ${fontStack}`;
        ctx.fillText('Nghệ sĩ yêu thích', textX, rowY + 11);

        // 4. Số liệu: Lượt nghe & Phút theo số tự nhiên
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = `700 12px ${fontStack}`;
        ctx.fillText(`${artist.playCount} lượt nghe`, col2X + colWidth, rowY - 6);

        ctx.fillStyle = '#71717A';
        ctx.font = `500 11px ${fontStack}`;
        ctx.fillText(formatMinutesNatural(artist.totalDuration), col2X + colWidth, rowY + 11);
        ctx.textAlign = 'left';

        // Đường kẻ dòng mờ
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(col2X, rowY + 22);
        ctx.lineTo(col2X + colWidth, rowY + 22);
        ctx.stroke();
      });
    } else if (chartType === 'songs') {
      // CHỈ BÀI HÁT (FULL WIDTH)
      const colWidth = width - 96;

      songsToRender.forEach((song, idx) => {
        const rowY = startY + 20 + idx * rowHeight;
        const img = songImages[idx];

        drawRankBadge(48, rowY, idx + 1);

        const coverX = 92;
        const coverY = rowY - 24;
        const coverSize = 44;

        ctx.save();
        drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 8);
        ctx.clip();
        if (img) {
          ctx.drawImage(img, coverX, coverY, coverSize, coverSize);
        } else {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(coverX, coverY, coverSize, coverSize);
          ctx.fillStyle = '#FA243C';
          ctx.font = `700 16px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.fillText('♪', coverX + coverSize / 2, coverY + coverSize / 2 + 5);
          ctx.textAlign = 'left';
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        drawRoundedRectPath(ctx, coverX, coverY, coverSize, coverSize, 8);
        ctx.stroke();

        const textX = coverX + coverSize + 14;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 15px ${fontStack}`;
        ctx.fillText(song.title, textX, rowY - 6);

        ctx.fillStyle = '#A1A1AA';
        ctx.font = `500 13px ${fontStack}`;
        ctx.fillText(song.artist, textX, rowY + 12);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = `700 13px ${fontStack}`;
        ctx.fillText(`${song.playCount} lượt phát`, 48 + colWidth, rowY - 6);

        ctx.fillStyle = '#71717A';
        ctx.font = `500 12px ${fontStack}`;
        ctx.fillText(formatMinutesNatural(song.totalDuration), 48 + colWidth, rowY + 12);
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(48, rowY + 24);
        ctx.lineTo(48 + colWidth, rowY + 24);
        ctx.stroke();
      });
    } else {
      // CHỈ NGHỆ SĨ (FULL WIDTH)
      const colWidth = width - 96;

      artistsToRender.forEach((artist, idx) => {
        const rowY = startY + 20 + idx * rowHeight;
        const img = artistImages[idx];

        drawRankBadge(48, rowY, idx + 1);

        const avatarX = 92;
        const avatarY = rowY - 24;
        const avatarSize = 44;
        const radius = avatarSize / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + radius, avatarY + radius, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        if (img) {
          ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        } else {
          ctx.fillStyle = '#18181B';
          ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
          ctx.fillStyle = '#FA243C';
          ctx.font = `800 18px ${fontStack}`;
          ctx.textAlign = 'center';
          ctx.fillText(artist.artist.charAt(0).toUpperCase(), avatarX + radius, avatarY + radius + 6);
          ctx.textAlign = 'left';
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(avatarX + radius, avatarY + radius, radius, 0, Math.PI * 2);
        ctx.stroke();

        const textX = avatarX + avatarSize + 14;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 15px ${fontStack}`;
        ctx.fillText(artist.artist, textX, rowY - 6);

        ctx.fillStyle = '#A1A1AA';
        ctx.font = `500 13px ${fontStack}`;
        ctx.fillText('Nghệ sĩ yêu thích trong thư viện', textX, rowY + 12);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#FA243C';
        ctx.font = `700 13px ${fontStack}`;
        ctx.fillText(`${artist.playCount} lượt nghe`, 48 + colWidth, rowY - 6);

        ctx.fillStyle = '#71717A';
        ctx.font = `500 12px ${fontStack}`;
        ctx.fillText(formatMinutesNatural(artist.totalDuration), 48 + colWidth, rowY + 12);
        ctx.textAlign = 'left';

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(48, rowY + 24);
        ctx.lineTo(48 + colWidth, rowY + 24);
        ctx.stroke();
      });
    }

    // 5. GÓC DƯỚI CÙNG: CHỈ 1 LOGO FLARITY (Không ghi thêm bất kỳ thông tin nào)
    const logoImg = await loadImageAsync('/logo.png');
    if (logoImg) {
      const logoSize = 36;
      const logoX = width - 48 - logoSize;
      const logoY = height - 36 - logoSize;
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    }

    return canvas;
  }, [chartType, limit, topSongs, topArtists, timeRangeLabel]);

  // Cập nhật xem trước ảnh tức thì
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
      const filename = `flarity-chart-${chartType}-top${limit}-${Date.now()}.png`;
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
        className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#0c0c0e] border border-white/15 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-apple-pink/20 text-apple-pink border border-apple-pink/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Xuất Ảnh Bảng Xếp Hạng
              </h3>
              <p className="text-xs text-neutral-400">
                Ảnh poster OLED sắc nét kèm bìa bài hát & nghệ sĩ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Controls Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            {/* Lựa chọn nội dung hiển thị */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-apple-pink" />
                <span>Nội dung bảng xếp hạng</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'both' as const, label: 'Cả Hai' },
                  { id: 'songs' as const, label: 'Bài Hát' },
                  { id: 'artists' as const, label: 'Nghệ Sĩ' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setChartType(t.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      chartType === t.id
                        ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Số lượng bài / nghệ sĩ */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-apple-pink" />
                <span>Số lượng hiển thị</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 10 as const, label: 'Top 10' },
                  { id: 5 as const, label: 'Top 5' },
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setLimit(l.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      limit === l.id
                        ? 'bg-apple-pink text-white shadow-lg shadow-apple-pink/20'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-medium px-1">
              <span>Xem trước ảnh chụp thực tế (Tỷ lệ thực):</span>
              <span className="text-[11px] text-apple-pink font-bold">Nền Đen OLED · Glow Đỏ · Logo Flarity</span>
            </div>

            <div className="w-full bg-black/90 border border-white/10 rounded-2xl p-4 flex items-center justify-center overflow-hidden min-h-[300px] max-h-[460px]">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Chart Preview"
                  className="max-h-[420px] w-auto object-contain rounded-xl shadow-2xl border border-white/10 animate-in fade-in duration-300"
                />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2 text-neutral-500">
                  <div className="w-6 h-6 border-2 border-apple-pink/30 border-t-apple-pink rounded-full animate-spin" />
                  <span className="text-xs">Đang dựng poster...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyImage}
              disabled={!previewUrl}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Đã Sao Chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao Chép Ảnh</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadImage}
              disabled={isGenerating || !previewUrl}
              className="px-5 py-2.5 rounded-xl bg-apple-pink hover:bg-apple-pinkHover text-white font-bold text-xs shadow-lg shadow-apple-pink/25 flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGenerating ? 'Đang xuất...' : 'Tải Ảnh Xuống'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
