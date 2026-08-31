import React, { useState, useEffect } from 'react';
import {
  Languages,
  Sparkles,
  Bot,
  Globe,
  RefreshCw,
  Sliders,
  Check,
  Loader2,
  AlertCircle,
  Trash2,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import {
  type TranslationSettings,
  type TranslationProvider,
  SUPPORTED_LANGUAGES,
  loadTranslationSettings,
  saveTranslationSettings,
} from '../types';
import {
  translateLyrics,
  clearTranslationCache,
  getCachedTranslation,
} from '../services/lyricsTranslationService';
import { usePlayer } from '../context/PlayerContext';

interface LyricsTranslationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onTranslationUpdated?: () => void;
}

export const LyricsTranslationPopover: React.FC<LyricsTranslationPopoverProps> = ({
  isOpen,
  onClose,
  onTranslationUpdated,
}) => {
  const { currentTrack, lyrics, openSettings } = usePlayer();
  const [settings, setSettings] = useState<TranslationSettings>(loadTranslationSettings);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(loadTranslationSettings());
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trackKey = currentTrack ? (currentTrack.id || `${currentTrack.title}_${currentTrack.artist}`) : '';
  const isCached = trackKey ? !!getCachedTranslation(trackKey, settings.targetLanguage, settings.provider) : false;

  const handleProviderChange = (provider: TranslationProvider) => {
    const next = { ...settings, provider };
    setSettings(next);
    saveTranslationSettings(next);
    setErrorMsg(null);
  };

  const handleLanguageChange = (targetLanguage: string) => {
    const next = { ...settings, targetLanguage };
    setSettings(next);
    saveTranslationSettings(next);
    setErrorMsg(null);
  };

  const handleToggleEnabled = (enabled: boolean) => {
    const next = { ...settings, enabled };
    setSettings(next);
    saveTranslationSettings(next);
    if (enabled && lyrics.length > 0 && currentTrack && !isCached) {
      void handleRunTranslation(false, next);
    } else {
      onTranslationUpdated?.();
    }
  };

  const handleRunTranslation = async (forceFresh = false, customSettings?: TranslationSettings) => {
    if (!currentTrack || lyrics.length === 0) {
      setErrorMsg('Chưa có lời bài hát để dịch.');
      return;
    }

    const activeSettings = customSettings || settings;

    // Kiểm tra cấu hình API Key nếu dùng AI
    if (activeSettings.provider === 'gemini' && !activeSettings.geminiApiKey) {
      setErrorMsg('Vui lòng nhập API Key của Google Gemini trong phần Cài đặt.');
      return;
    }
    if (activeSettings.provider === 'openai' && !activeSettings.openaiApiKey) {
      setErrorMsg('Vui lòng nhập API Key của OpenAI trong phần Cài đặt.');
      return;
    }
    if (activeSettings.provider === 'openrouter' && !activeSettings.openrouterApiKey) {
      setErrorMsg('Vui lòng nhập API Key của OpenRouter trong phần Cài đặt.');
      return;
    }
    if (activeSettings.provider === 'claude' && !activeSettings.claudeApiKey) {
      setErrorMsg('Vui lòng nhập API Key của Anthropic Claude trong phần Cài đặt.');
      return;
    }
    if (activeSettings.provider === 'custom' && !activeSettings.customEndpointUrl) {
      setErrorMsg('Vui lòng cấu hình URL Custom Endpoint trong phần Cài đặt.');
      return;
    }

    setIsTranslating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await translateLyrics(
        lyrics,
        {
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          trackId: currentTrack.id,
        },
        activeSettings,
        forceFresh
      );

      // Bật hiển thị nếu chưa bật
      if (!activeSettings.enabled) {
        const next = { ...activeSettings, enabled: true };
        setSettings(next);
        saveTranslationSettings(next);
      }

      setSuccessMsg('Đã dịch và đồng bộ lời bài hát thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
      onTranslationUpdated?.();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Có lỗi xảy ra trong quá trình dịch lời bài hát.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleClearCurrentTranslation = () => {
    if (!trackKey) return;
    clearTranslationCache(trackKey);
    setSuccessMsg('Đã xóa bản dịch đã lưu của bài hát này.');
    setTimeout(() => setSuccessMsg(null), 2500);
    onTranslationUpdated?.();
  };

  return (
    <div className="absolute right-3 top-12 z-50 w-80 sm:w-88 rounded-2xl bg-[#0e0e12]/98 border border-white/15 p-4 shadow-2xl backdrop-blur-2xl text-white select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-apple-pink/20 text-apple-pink border border-apple-pink/30">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-tight">Dịch Lời Bài Hát</h4>
            <p className="text-[10px] text-neutral-400">Song ngữ theo thời gian thực</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3.5 pt-3">
        {/* Chế độ dịch hiện tại banner */}
        <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-neutral-200">Chế độ dịch:</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  settings.autoTranslate
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-neutral-800 text-neutral-300 border border-white/10'
                }`}
              >
                {settings.autoTranslate ? 'Tự động khi mở' : 'Thủ công'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">
              {settings.autoTranslate
                ? `Tự động dịch với ${settings.autoTranslateProvider || settings.provider}`
                : 'Nhấn nút Dịch Ngay bên dưới để dịch bài này'}
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              openSettings();
            }}
            className="text-[10px] text-apple-pink font-bold hover:underline cursor-pointer flex items-center gap-1 shrink-0 bg-apple-pink/10 px-2 py-1 rounded-lg border border-apple-pink/20"
            title="Đổi sang tự động dịch hoặc chọn trình dịch trong Cài Đặt"
          >
            <SettingsIcon className="w-3 h-3" />
            <span>Cài đặt</span>
          </button>
        </div>

        {/* Toggle bật/tắt hiển thị */}
        <div className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-xl p-2.5">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-neutral-200">Hiển thị bản dịch</span>
            <p className="text-[10px] text-neutral-400">Hiện dòng phụ dưới lời gốc</p>
          </div>
          <button
            onClick={() => handleToggleEnabled(!settings.enabled)}
            className={`w-11 h-6 rounded-full transition-all relative cursor-pointer ${
              settings.enabled ? 'bg-apple-pink' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-all transform absolute top-1 ${
                settings.enabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Chọn ngôn ngữ đích */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-apple-pink" />
            <span>Ngôn ngữ đích</span>
          </label>
          <select
            value={settings.targetLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-apple-pink cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-neutral-900 text-white">
                {lang.name} ({lang.native})
              </option>
            ))}
          </select>
        </div>

        {/* Chọn Engine Dịch */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-apple-pink" />
              <span>Engine dịch thuật</span>
            </span>
            <button
              onClick={() => {
                onClose();
                openSettings();
              }}
              className="text-[10px] text-apple-pink hover:underline flex items-center gap-1 cursor-pointer"
            >
              <SettingsIcon className="w-3 h-3" />
              <span>Cấu hình API</span>
            </button>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'google' as const, label: 'Google Dịch (Auto)' },
              { id: 'gemini' as const, label: 'Google Gemini' },
              { id: 'openai' as const, label: 'OpenAI (ChatGPT)' },
              { id: 'openrouter' as const, label: 'OpenRouter' },
              { id: 'claude' as const, label: 'Claude AI' },
              { id: 'custom' as const, label: 'Custom API' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-left border transition-all cursor-pointer flex items-center justify-between ${
                  settings.provider === p.id
                    ? 'bg-apple-pink/20 text-apple-pink border-apple-pink/40 shadow-sm'
                    : 'bg-neutral-900/80 text-neutral-400 border-white/5 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="truncate">{p.label}</span>
                {settings.provider === p.id && <Check className="w-3 h-3 shrink-0 ml-1" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tùy chỉnh nhanh Phong cách & Màu sắc Sub-text */}
        <div className="space-y-2 bg-white/[0.02] border border-white/5 rounded-xl p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-neutral-300">Phong cách Sub-text</span>
            <span className="text-[10px] text-apple-pink font-semibold uppercase">
              {settings.style || 'apple'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'apple' as const, label: 'Apple' },
              { id: 'spotify' as const, label: 'Spotify' },
              { id: 'minimal' as const, label: 'Cinema' },
              { id: 'duet-glow' as const, label: 'Neon' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  const newColor = st.id === 'spotify' ? '#1DB954' : st.id === 'apple' ? '#FA243C' : settings.color;
                  const next = { ...settings, style: st.id, color: newColor };
                  setSettings(next);
                  saveTranslationSettings(next);
                  onTranslationUpdated?.();
                }}
                className={`py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer text-center ${
                  settings.style === st.id
                    ? 'bg-apple-pink/20 text-apple-pink border-apple-pink/50'
                    : 'bg-neutral-900 text-neutral-400 border-white/5 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-neutral-400">Màu hiển thị:</span>
            <div className="flex items-center gap-1.5">
              {[
                { color: '#FA243C', name: 'Apple Pink' },
                { color: '#1DB954', name: 'Spotify Green' },
                { color: '#06B6D4', name: 'Cyan' },
                { color: '#F59E0B', name: 'Amber' },
                { color: '#FFFFFF', name: 'White' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => {
                    const next = { ...settings, color: c.color };
                    setSettings(next);
                    saveTranslationSettings(next);
                    onTranslationUpdated?.();
                  }}
                  className={`w-3.5 h-3.5 rounded-full transition-transform cursor-pointer ${
                    settings.color === c.color ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Thông báo trạng thái / lỗi */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Nút hành động */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleRunTranslation(true)}
            disabled={isTranslating || !currentTrack || lyrics.length === 0}
            className="flex-1 py-2.5 px-3 rounded-xl bg-apple-pink hover:bg-apple-pinkHover text-white text-xs font-bold transition-all shadow-md shadow-apple-pink/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang dịch...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isCached ? 'Dịch lại bài này' : 'Dịch lời ngay'}</span>
              </>
            )}
          </button>

          {isCached && (
            <button
              onClick={handleClearCurrentTranslation}
              disabled={isTranslating}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-rose-400 border border-white/10 transition-colors cursor-pointer"
              title="Xóa bản dịch đã lưu của bài này"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
