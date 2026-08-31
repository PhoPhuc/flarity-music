import type { Track } from '../types';

export type AudioStandardId = 'hi-res-lossless' | 'lossless' | 'dolby-atmos' | 'hifi' | 'standard';

export interface AudioStandard {
  id: AudioStandardId;
  name: string;
  badgeLabel: string;
  shortTag: string;
  specs: string;
  sampleRate: string;
  bitDepth: string;
  bitrate: string;
  colorTheme: {
    badgeClass: string;
    borderClass: string;
    glowClass: string;
    textClass: string;
    bgGradient: string;
    accentColor: string;
  };
  concept: string;
  experience: string;
  equipmentTip: string;
  formats: string[];
}

export const AUDIO_STANDARDS: Record<AudioStandardId, AudioStandard> = {
  'hi-res-lossless': {
    id: 'hi-res-lossless',
    name: 'Hi-Res Lossless (Studio Master)',
    badgeLabel: 'HI-RES LOSSLESS',
    shortTag: '24-bit / 192kHz',
    specs: 'Lên đến 24-bit / 192 kHz (DSD / DSF / Studio Master FLAC)',
    sampleRate: '96 kHz – 192 kHz (hoặc DSD 2.8MHz/5.6MHz)',
    bitDepth: '24-bit / 32-bit Float',
    bitrate: '3,000 kbps – 9,216 kbps (gấp 10–30 lần MP3 thông thường)',
    colorTheme: {
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/20',
      borderClass: 'border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.35)]',
      glowClass: 'from-amber-500/30 via-orange-500/20 to-transparent ring-amber-400/50',
      textClass: 'text-amber-400',
      bgGradient: 'from-amber-950/40 via-amber-900/20 to-neutral-900/60',
      accentColor: '#f59e0b',
    },
    concept:
      'Định dạng âm thanh nguyên bản không nén từ phòng thu chuyên nghiệp (Studio Master). Lưu giữ trọn vẹn 100% từng dao động sóng âm nhỏ nhất và dải tương phản động (Dynamic Range) vô cùng rộng lớn.',
    experience:
      'Tái hiện không gian âm trường 3D sâu rộng, tách bạch chính xác vị trí từng nhạc cụ. Bạn có thể cảm nhận rõ tiếng lấy hơi của ca sĩ, độ ngân tự nhiên của đàn piano hay tiếng gảy dây acoustic cực kỳ trong trẻo, chân thực như đang ngồi trực tiếp tại phòng thu.',
    equipmentTip:
      'Nên sử dụng kèm DAC/Amp ngoài chuyên dụng và tai nghe có dây chất lượng cao (IEM / Audiophile Headphone) hoặc dàn loa Hi-End để mở khóa toàn bộ dải tần 24-bit.',
    formats: ['.flac (24-bit)', '.dsf', '.dff', '.wav (24-bit/32-bit)', '.aiff', '.alac (24-bit)'],
  },

  'dolby-atmos': {
    id: 'dolby-atmos',
    name: 'Dolby Atmos & Spatial Audio',
    badgeLabel: 'DOLBY ATMOS',
    shortTag: '3D Spatial Audio',
    specs: 'Âm thanh vòm không gian 3 chiều (Object-based Multichannel Audio)',
    sampleRate: '48 kHz / Multi-channel Spatial Bed',
    bitDepth: '24-bit Spatial Stream',
    bitrate: '768 kbps – 1,536 kbps Spatial Stream',
    colorTheme: {
      badgeClass: 'bg-gradient-to-r from-purple-500/25 to-blue-500/25 text-purple-200 border-purple-400/40 shadow-purple-500/20',
      borderClass: 'border-purple-400/60 shadow-[0_0_25px_rgba(168,85,247,0.35)]',
      glowClass: 'from-purple-500/30 via-blue-500/20 to-transparent ring-purple-400/50',
      textClass: 'text-purple-300',
      bgGradient: 'from-purple-950/40 via-indigo-950/20 to-neutral-900/60',
      accentColor: '#a855f7',
    },
    concept:
      'Công nghệ âm thanh vòm dựa trên vật thể (Object-based Audio). Âm thanh được giải phóng khỏi 2 kênh stereo trái/phải truyền thống và được định vị tự do trong không gian 360 độ quanh người nghe.',
    experience:
      'Mang lại cảm giác đắm chìm hoàn toàn như đang đứng giữa trung tâm sân khấu live concert hoặc rạp chiếu phim hiện đại. Giọng hát định vị rõ ở trước mặt, bè phụ vang vọng hai bên và các hiệu ứng nhạc cụ chuyển động mượt mà xung quanh bạn.',
    equipmentTip:
      'Trải nghiệm tối ưu với tai nghe hỗ trợ Spatial Audio (như AirPods Max/Pro, Sony WH-1000XM, Sennheiser) hoặc hệ thống loa vòm 5.1 / 7.1 kênh.',
    formats: ['Dolby Atmos Music', 'Spatial Audio FLAC', 'Multichannel 5.1/7.1', 'Binaural 3D Audio'],
  },

  'lossless': {
    id: 'lossless',
    name: 'Lossless Audio (Chuẩn đĩa CD)',
    badgeLabel: 'LOSSLESS',
    shortTag: '16-bit / 44.1kHz',
    specs: '16-bit / 44.1 kHz – 48 kHz (Bit-perfect CD Quality)',
    sampleRate: '44.1 kHz – 48 kHz',
    bitDepth: '16-bit PCM',
    bitrate: '700 kbps – 1,411 kbps (FLAC / ALAC / WAV)',
    colorTheme: {
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20',
      borderClass: 'border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.35)]',
      glowClass: 'from-emerald-500/30 via-teal-500/20 to-transparent ring-emerald-400/50',
      textClass: 'text-emerald-400',
      bgGradient: 'from-emerald-950/40 via-emerald-900/20 to-neutral-900/60',
      accentColor: '#10b981',
    },
    concept:
      'Chuẩn nén bảo toàn dữ liệu hoàn hảo 100%, giữ nguyên vẹn dải tần số âm thanh từ 20Hz đến 20,000Hz đúng như khi phát trên đĩa CD gốc mà không cắt xén bất kỳ dải tần nào.',
    experience:
      'Âm bass gọn gàng, có lực và xuống sâu; dải treble tơi xốp tự nhiên không bị gắt méo tiếng; dải trung (vocal) dày dặn và truyền cảm, khắc phục triệt để hiện tượng vỡ âm hoặc bệt tiếng của các file nén thấp.',
    equipmentTip:
      'Hoạt động tuyệt vời với hầu hết mọi tai nghe có dây, loa để bàn stereo, hệ thống âm thanh gia đình hoặc tai nghe chất lượng cao.',
    formats: ['.flac (16-bit)', '.alac', '.wav (16-bit)', '.aiff', '.ape'],
  },

  'hifi': {
    id: 'hifi',
    name: 'Hi-Fi Audio (Độ trung thực cao)',
    badgeLabel: 'HI-FI',
    shortTag: 'High Fidelity',
    specs: 'Âm thanh trung thực cao, giảm thiểu tối đa méo hài và tạp âm',
    sampleRate: '44.1 kHz – 96 kHz',
    bitDepth: '16-bit – 24-bit',
    bitrate: '450 kbps – 1,000 kbps',
    colorTheme: {
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-cyan-500/20',
      borderClass: 'border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.35)]',
      glowClass: 'from-cyan-500/30 via-blue-500/20 to-transparent ring-cyan-400/50',
      textClass: 'text-cyan-300',
      bgGradient: 'from-cyan-950/40 via-sky-950/20 to-neutral-900/60',
      accentColor: '#06b6d4',
    },
    concept:
      'Tiêu chuẩn High Fidelity nhằm tái tạo tín hiệu âm thanh với độ méo tiếng (THD - Total Harmonic Distortion) cực thấp và dải động cao, giữ được nét mộc mạc và nhạc tính phong phú.',
    experience:
      'Chất âm cân bằng, dễ nghe, không gian thoáng đãng và có độ truyền cảm cao, tạo cảm giác thư giãn khi nghe nhạc liên tục trong nhiều giờ mà không bị mỏi tai.',
    equipmentTip:
      'Tương thích tốt với các tai nghe phòng thu, tai nghe over-ear, loa kiểm âm gia đình.',
    formats: ['Hi-Fi Master', 'Remastered Vinyl', 'Enhanced PCM'],
  },

  'standard': {
    id: 'standard',
    name: 'High Quality AAC / MP3 (320 kbps)',
    badgeLabel: 'AAC 320k',
    shortTag: 'High Quality Stereo',
    specs: 'AAC / MP3 256kbps – 320kbps (Chuẩn nén tối ưu cao cấp)',
    sampleRate: '44.1 kHz',
    bitDepth: '16-bit Re-quantized',
    bitrate: '256 kbps – 320 kbps (CBR / VBR Stereo)',
    colorTheme: {
      badgeClass: 'bg-white/10 text-neutral-200 border-white/20 shadow-white/5',
      borderClass: 'border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.2)]',
      glowClass: 'from-white/20 via-neutral-500/10 to-transparent ring-white/40',
      textClass: 'text-neutral-200',
      bgGradient: 'from-neutral-800/50 via-neutral-900/30 to-neutral-900/60',
      accentColor: '#ffffff',
    },
    concept:
      'Chuẩn nén thông minh dựa trên mô hình thính giác người (Psychoacoustic model), chủ động lược bỏ các tần số tai người khó cảm nhận để thu nhỏ dung lượng tệp tin gấp 5–10 lần nhưng vẫn giữ chất lượng nghe tốt.',
    experience:
      'Âm thanh trong trẻo, sôi nổi, âm lượng đồng đều và đáp ứng rất tốt cho hầu hết nhu cầu thưởng thức âm nhạc hàng ngày trên các thiết bị di động.',
    equipmentTip:
      'Lý tưởng cho tai nghe không dây Bluetooth (SBC/AAC), loa di động, và tiết kiệm tối đa dung lượng bộ nhớ.',
    formats: ['.mp3', '.m4a (AAC)', '.ogg', '.opus', '.aac'],
  },
};

export interface TrackAudioAnalysis {
  primaryStandard: AudioStandard;
  isDolby: boolean;
  activeStandardIds: AudioStandardId[];
  badges: Array<{
    id: AudioStandardId;
    label: string;
    style: string;
    isDolby?: boolean;
  }>;
}

/**
 * Phân tích track để xác định chuẩn âm thanh thực tế
 */
export function analyzeTrackAudio(track: Track | null): TrackAudioAnalysis {
  if (!track) {
    return {
      primaryStandard: AUDIO_STANDARDS['standard'],
      isDolby: false,
      activeStandardIds: ['standard'],
      badges: [{ id: 'standard', label: 'AAC 320k', style: AUDIO_STANDARDS['standard'].colorTheme.badgeClass }],
    };
  }

  const path = (track.filePath || '').toLowerCase();
  const title = (track.title || '').toLowerCase();
  const album = (track.album || '').toLowerCase();
  const genre = (track.genre || '').toLowerCase();
  const combined = `${path} ${title} ${album} ${genre}`;

  const isDolby =
    combined.includes('dolby') ||
    combined.includes('atmos') ||
    combined.includes('spatial') ||
    combined.includes('5.1') ||
    combined.includes('7.1') ||
    combined.includes('binaural');

  let primaryId: AudioStandardId = 'standard';

  const isLosslessFormat =
    path.endsWith('.flac') ||
    path.endsWith('.alac') ||
    path.endsWith('.wav') ||
    path.endsWith('.aiff') ||
    path.endsWith('.dsf') ||
    path.endsWith('.dff') ||
    path.endsWith('.ape');

  const isHiResKeywords =
    combined.includes('hi-res') ||
    combined.includes('hires') ||
    combined.includes('24bit') ||
    combined.includes('24-bit') ||
    combined.includes('96k') ||
    combined.includes('192k') ||
    combined.includes('dsd') ||
    combined.includes('master') ||
    path.endsWith('.dsf') ||
    path.endsWith('.dff');

  if (isLosslessFormat) {
    if (isHiResKeywords) {
      primaryId = 'hi-res-lossless';
    } else {
      primaryId = 'lossless';
    }
  } else if (combined.includes('hifi') || combined.includes('hi-fi')) {
    primaryId = 'hifi';
  } else {
    primaryId = 'standard';
  }

  const activeIds: AudioStandardId[] = [primaryId];
  if (isDolby && !activeIds.includes('dolby-atmos')) {
    activeIds.unshift('dolby-atmos');
  }

  const badges: Array<{ id: AudioStandardId; label: string; style: string; isDolby?: boolean }> = [];

  if (isDolby) {
    badges.push({
      id: 'dolby-atmos',
      label: 'DOLBY ATMOS',
      style: AUDIO_STANDARDS['dolby-atmos'].colorTheme.badgeClass,
      isDolby: true,
    });
  }

  badges.push({
    id: primaryId,
    label: AUDIO_STANDARDS[primaryId].badgeLabel,
    style: AUDIO_STANDARDS[primaryId].colorTheme.badgeClass,
  });

  return {
    primaryStandard: AUDIO_STANDARDS[primaryId],
    isDolby,
    activeStandardIds: activeIds,
    badges,
  };
}
