import type { LyricLine } from '../types';

/**
 * Phân tích cú pháp chuỗi văn bản file .lrc thành mốc thời gian (giây), nội dung và bản dịch song ngữ nếu có.
 * Cấu trúc mẫu .lrc: 
 *   [offset:+500]
 *   [00:12.34]Lời bài hát tại mốc thời gian này // Bản dịch tiếng Việt hoặc phiên âm
 */
export function parseLrc(lrcContent: string): LyricLine[] {
  if (!lrcContent) return [];

  const lines = lrcContent.split(/\r?\n/);
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;

  let fileOffsetSeconds = 0;

  // Quét tìm thẻ offset trước
  for (const line of lines) {
    const offsetMatch = offsetRegex.exec(line);
    if (offsetMatch) {
      const ms = parseInt(offsetMatch[1], 10);
      if (!isNaN(ms)) {
        fileOffsetSeconds = ms / 1000;
      }
      break;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[offset:') || trimmed.startsWith('[ti:') || trimmed.startsWith('[ar:') || trimmed.startsWith('[al:')) {
      continue;
    }

    let match;
    // Tìm tất cả timestamp trong một dòng
    timeRegex.lastIndex = 0;
    const timestamps: number[] = [];

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10);
      
      const rawSeconds = minutes * 60 + seconds + (ms > 99 ? ms / 1000 : ms / 100);
      // Áp dụng offset từ file nếu có (cộng thêm độ trễ)
      const adjustedTime = Math.max(0, rawSeconds + fileOffsetSeconds);
      timestamps.push(adjustedTime);
    }

    // Loại bỏ timestamp khỏi chuỗi để lấy phần lời hát
    let rawText = trimmed.replace(timeRegex, '').trim();

    if (rawText && timestamps.length > 0) {
      let mainText = rawText;
      let translation: string | undefined = undefined;

      // Nhận diện định dạng song ngữ: "Chữ gốc // Bản dịch" hoặc "Chữ gốc | Bản dịch"
      if (rawText.includes(' // ')) {
        const parts = rawText.split(' // ');
        mainText = parts[0].trim();
        translation = parts.slice(1).join(' // ').trim();
      } else if (rawText.includes(' | ')) {
        const parts = rawText.split(' | ');
        mainText = parts[0].trim();
        translation = parts.slice(1).join(' | ').trim();
      }

      for (const time of timestamps) {
        result.push({ 
          time, 
          text: mainText, 
          ...(translation ? { translation } : {}) 
        });
      }
    }
  }

  // Sắp xếp lyric theo thứ tự thời gian tăng dần
  return result.sort((a, b) => a.time - b.time);
}

/**
 * Trích xuất giá trị offset (milliseconds) hiện có trong file LRC
 */
export function extractLrcOffset(lrcContent: string): number {
  if (!lrcContent) return 0;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;
  const match = offsetRegex.exec(lrcContent);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? 0 : val;
  }
  return 0;
}

/**
 * Chèn hoặc cập nhật thẻ [offset:+/-ms] vào chuỗi LRC
 */
export function applyOffsetToLrc(lrcContent: string, offsetMs: number): string {
  if (!lrcContent) return `[offset:${offsetMs}]\n`;
  const offsetRegex = /\[offset:\s*[+-]?\d+\s*\]/i;
  if (offsetRegex.test(lrcContent)) {
    return lrcContent.replace(offsetRegex, `[offset:${offsetMs}]`);
  }
  return `[offset:${offsetMs}]\n` + lrcContent;
}

/**
 * Format số giây thành chuỗi thời gian mm:ss
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Format số giây thành chuỗi thời gian hiển thị bằng phút (vd: "4.5 Phút" hoặc "12 Phút")
 */
export function formatDurationInMinutes(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0 Phút';
  const mins = seconds / 60;
  if (mins < 1) {
    return `${Math.round(seconds)} Giây`;
  }
  if (mins >= 10 || Math.abs(mins - Math.round(mins)) < 0.1) {
    return `${Math.round(mins)} Phút`;
  }
  return `${mins.toFixed(1)} Phút`;
}
