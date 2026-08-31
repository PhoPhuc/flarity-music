export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  year?: number;
  duration: number;
  bpm?: number;
  picture?: string; // Cached Image File Path or URL
  hasLyric: boolean;
  lrcPath?: string;
  hasMv: boolean;
  mvPath?: string;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  picture?: string;
  year?: number;
  tracks: Track[];
}

export interface ArtistProfile {
  name: string;
  trackCount: number;
  picture?: string;
  tracks: Track[];
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string;
  trackIds: string[];
  createdAt: number;
}

export interface LyricLine {
  time: number; // in seconds
  text: string;
  translation?: string; // Bản dịch hoặc phiên âm song ngữ nếu có
}

export type LyricEffectStyle = 'apple' | 'karaoke' | 'neon' | 'perspective3d' | 'spotify';
export type LyricBgEffect = 'mesh' | 'cosmic' | 'aurora' | 'vinyl' | 'spectrum' | 'dark';
export type LyricFontSize = 'medium' | 'large' | 'xlarge';
export type LyricTextAlign = 'left' | 'center' | 'right';

export interface LyricCustomizationSettings {
  style: LyricEffectStyle;
  bgEffect: LyricBgEffect;
  fontSize: LyricFontSize;
  textAlign: LyricTextAlign;
  blurInactive: boolean;
  showTranslation: boolean;
  karaokeGlow: boolean;
}

export const DEFAULT_LYRIC_SETTINGS: LyricCustomizationSettings = {
  style: 'apple',
  bgEffect: 'mesh',
  fontSize: 'large',
  textAlign: 'left',
  blurInactive: true,
  showTranslation: true,
  karaokeGlow: true,
};

export const LYRICS_SETTINGS_KEY = 'flarity_lyric_effects_settings';

export type TranslationProvider = 'google' | 'gemini' | 'openai' | 'openrouter' | 'claude' | 'custom';
export type TranslationStyle = 'apple' | 'spotify' | 'minimal' | 'duet-glow';
export type TranslationFontSize = 'tiny' | 'small' | 'medium';

export interface TranslationSettings {
  enabled: boolean;
  autoTranslate: boolean; // false = Thủ công (Mặc định), true = Tự động dịch khi mở bài hát
  autoTranslateProvider: TranslationProvider; // Trình dịch được chọn để tự động dịch khi mở bài hát
  provider: TranslationProvider;
  targetLanguage: string; // 'vi', 'en', 'ja', 'ko', 'zh-CN', 'fr', 'es', etc.
  
  // Tùy biến hiển thị Sub-text Lời Dịch
  style: TranslationStyle; // 'apple' | 'spotify' | 'minimal' | 'duet-glow'
  fontSize: TranslationFontSize; // 'tiny' | 'small' | 'medium'
  color: string; // Hex color: '#FA243C', '#1DB954', '#06B6D4', '#F59E0B', '#A855F7', '#FFFFFF', '#9CA3AF', custom hex
  dimInactive: boolean;

  geminiApiKey: string;
  geminiModel: string; // 'gemini-3.5-flash-lite', 'gemini-3.7-flash', 'gemini-2.0-flash', 'gemini-2.0-pro-exp-02-05', 'gemini-1.5-pro'
  openaiApiKey: string;
  openaiModel: string; // 'gpt-4o-mini', 'gpt-4o', 'o3-mini', 'gpt-4.5-preview'
  openrouterApiKey: string;
  openrouterModel: string; // 'anthropic/claude-3.7-sonnet', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-chat'
  claudeApiKey: string;
  claudeModel: string; // 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'
  customEndpointUrl: string;
  customApiKey: string;
  customModel: string;
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  enabled: true,
  autoTranslate: false, // Mặc định là thủ công, không tự động dịch
  autoTranslateProvider: 'google',
  provider: 'google',
  targetLanguage: 'vi',
  style: 'apple',
  fontSize: 'tiny',
  color: '#FA243C',
  dimInactive: true,
  geminiApiKey: '',
  geminiModel: 'gemini-3.5-flash-lite',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openrouterApiKey: '',
  openrouterModel: 'google/gemini-2.0-flash-001',
  claudeApiKey: '',
  claudeModel: 'claude-3-7-sonnet-20250219',
  customEndpointUrl: '',
  customApiKey: '',
  customModel: '',
};

export const SUPPORTED_LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', native: 'Tiếng Việt' },
  { code: 'en', name: 'Tiếng Anh', native: 'English' },
  { code: 'ja', name: 'Tiếng Nhật', native: '日本語' },
  { code: 'ko', name: 'Tiếng Hàn', native: '한국어' },
  { code: 'zh-CN', name: 'Tiếng Trung (Giản thể)', native: '简体中文' },
  { code: 'zh-TW', name: 'Tiếng Trung (Phồn thể)', native: '繁體中文' },
  { code: 'fr', name: 'Tiếng Pháp', native: 'Français' },
  { code: 'es', name: 'Tiếng Tây Ban Nha', native: 'Español' },
  { code: 'de', name: 'Tiếng Đức', native: 'Deutsch' },
  { code: 'ru', name: 'Tiếng Nga', native: 'Русский' },
  { code: 'th', name: 'Tiếng Thái', native: 'ไทย' },
  { code: 'id', name: 'Tiếng Indonesia', native: 'Bahasa Indonesia' },
];

export const TRANSLATION_SETTINGS_KEY = 'flarity_lyrics_translation_settings';

export function loadLyricSettings(): LyricCustomizationSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LYRICS_SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_LYRIC_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_LYRIC_SETTINGS;
}

export function saveLyricSettings(settings: LyricCustomizationSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('lyric-settings-updated', { detail: settings }));
    }
  } catch {}
}

export function loadTranslationSettings(): TranslationSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TRANSLATION_SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_TRANSLATION_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_TRANSLATION_SETTINGS;
}

export function saveTranslationSettings(settings: TranslationSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TRANSLATION_SETTINGS_KEY, JSON.stringify(settings));
      window.dispatchEvent(new CustomEvent('lyrics-translation-settings-updated', { detail: settings }));
    }
  } catch {}
}

export type ViewMode = 'home' | 'discovery' | 'library-tracks' | 'library-albums' | 'library-artists' | 'album-detail' | 'artist-detail' | 'playlist-detail' | 'lyrics' | 'analytics';

export interface DiscoveryTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  thumbnail: string;
  source: 'youtube' | 'itunes' | 'recommendation' | 'local';
  previewUrl?: string;
  youtubeUrl?: string;
  quality?: string;
  releaseDate?: string;
  genre?: string;
  downloadStatus?: 'idle' | 'downloading' | 'completed' | 'error';
  downloadProgress?: number; // 0 to 100
}

export interface DownloadItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  thumbnail: string;
  progress: number; // 0 to 100
  speed?: string; // e.g. "3.2 MB/s"
  size?: string; // e.g. "9.4 MB"
  status: 'queued' | 'downloading' | 'completed' | 'error';
  downloadType?: 'audio' | 'video' | 'both';
  error?: string;
  startedAt?: number;
  addedAt?: number;
  completedAt?: number;
  audioUrl?: string;
  filePath?: string;
  quality?: string;
}

