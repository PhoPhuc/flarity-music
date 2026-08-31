import type { LyricLine, TranslationSettings, TranslationProvider } from '../types';
import { loadTranslationSettings, saveTranslationSettings, SUPPORTED_LANGUAGES } from '../types';

// Bộ nhớ cache tạm thời trong phiên làm việc
const memoryCache = new Map<string, string[]>();

function getLanguageName(code: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  return found ? `${found.name} (${found.native})` : code;
}

function getCacheKey(trackKey: string, targetLang: string, provider: string): string {
  return `flarity_trans_${trackKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_${targetLang}_${provider}`;
}

export function getCachedTranslation(trackKey: string, targetLang: string, provider: string): string[] | null {
  const key = getCacheKey(trackKey, targetLang, provider);
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryCache.set(key, parsed);
          return parsed;
        }
      }
    }
  } catch {}
  return null;
}

export function setCachedTranslation(trackKey: string, targetLang: string, provider: string, translations: string[]): void {
  const key = getCacheKey(trackKey, targetLang, provider);
  memoryCache.set(key, translations);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(translations));
    }
  } catch {}
}

export function clearTranslationCache(trackKey: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const prefix = `flarity_trans_${trackKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k);
        memoryCache.delete(k);
      });
    }
  } catch {}
}

// 1. ENGINE GOOGLE DỊCH (Miễn phí / Tự động / Không cần API Key)
async function translateWithGoogle(lines: string[], targetLang: string): Promise<string[]> {
  if (lines.length === 0) return [];

  // Gom các dòng theo nhóm 40 dòng để tránh vượt quá URL length
  const chunkSize = 40;
  const translatedLines: string[] = [];

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    const joinedText = chunk.join('\n');

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(joinedText)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Google Translate lỗi HTTP ${response.status}`);
    }

    const data = await response.json();
    let chunkResult = '';
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (const item of data[0]) {
        if (Array.isArray(item) && typeof item[0] === 'string') {
          chunkResult += item[0];
        }
      }
    }

    const splitResult = chunkResult.split('\n');
    for (let j = 0; j < chunk.length; j++) {
      translatedLines.push(splitResult[j]?.trim() || chunk[j]);
    }
  }

  return translatedLines;
}

// System Prompt nâng cao: Đảm bảo dịch đúng ngữ cảnh bài hát, cảm xúc, phong hóa, phong cách tác giả
function buildAiPrompt(lines: string[], targetLang: string, metadata: { title: string; artist: string; album?: string }): string {
  const langName = getLanguageName(targetLang);
  const numberedLyrics = lines.map((line, idx) => `[${idx + 1}] ${line}`).join('\n');

  return `Bạn là một dịch giả thi ca và âm nhạc chuyên nghiệp, am hiểu sâu sắc về văn hóa nghệ thuật và phong cách biểu đạt của các nghệ sĩ âm nhạc.

NHIỆM VỤ: Dịch lời bài hát sau đây sang ${langName}.
- Tên bài hát: "${metadata.title}"
- Nghệ sĩ / Ban nhạc: "${metadata.artist}"
${metadata.album ? `- Album: "${metadata.album}"` : ''}

QUY TẮC DỊCH THUẬT BẮT BUỘC:
1. THẤU CẢM NGỮ CẢNH & PHONG HÓA:
   - Nghiên cứu kỹ ngữ cảnh, nội tâm cảm xúc, ẩn dụ thi ca, tiếng lóng và phong cách biểu diễn đặc trưng của nghệ sĩ ${metadata.artist}.
   - Dịch thoát ý tự nhiên, văn minh, phù hợp với thuần phong mỹ tục nhưng giữ trọn vẹn hồn cốt của tác phẩm gốc.
2. TÍNH NHẠC VÀ NHỊP ĐIỆU:
   - Lời dịch phải êm tai, mượt mà, bay bổng, có nhạc tính để người nghe có thể ngân nga theo giai điệu bài hát.
3. KHỚP DÒNG TUYỆT ĐỐI 1:1:
   - Giữ nguyên chính xác số lượng dòng và thứ tự câu hát.
   - Trả về kết quả dưới định dạng JSON mảng chuỗi thuần túy đúng với số dòng ban đầu: ["Lời dịch câu 1", "Lời dịch câu 2", ...].
   - TUYỆT ĐỐI KHÔNG CHÈN SỐ THỨ TỰ, KHÔNG CHÈN [1], [2], 1., 2. Ở ĐẦU CÂU TRẢ VỀ.
   - KHÔNG THÊM BẤT KỲ LỜI BÌNH HOẶC GIẢI THÍCH NÀO KHÁC.

DANH SÁCH CÁC CÂU CẦN DỊCH:
${numberedLyrics}`;
}

export function stripLineIndexPrefix(text: string): string {
  if (!text) return '';
  let cleaned = String(text).trim();
  // Loại bỏ các mẫu tiền tố đánh số dòng: [10], (10), 10., 10 -, 10:, 10), #10, Line 10:, Câu 10:, Dòng 10:
  cleaned = cleaned.replace(/^(?:\[\s*\d+\s*\]|\(\s*\d+\s*\)|\d+[\.\:\-\)\s]\s*|#\s*\d+[\.\:\-\s]*|(?:line|dòng|câu)\s*\d+[\.\:\-\s]*)\s*/i, '').trim();
  return cleaned;
}

function parseAiResponseLines(rawResponse: string, expectedCount: number): string[] {
  let cleaned = rawResponse.trim();
  
  // 1. Thử parse nếu là JSON mảng
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => stripLineIndexPrefix(String(item)));
    }
  } catch {}

  // 2. Parse theo format từng dòng
  const result: string[] = [];
  const lines = cleaned.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    result.push(stripLineIndexPrefix(trimmed));
  }

  if (result.length > 0) {
    return result.map(stripLineIndexPrefix);
  }

  return lines.map((l) => stripLineIndexPrefix(l)).filter(Boolean);
}

// 2. ENGINE GOOGLE GEMINI (Gemini 2.0 Flash, Gemini 2.0 Pro, Gemini 1.5 Pro)
async function translateWithGemini(
  lines: string[],
  targetLang: string,
  metadata: { title: string; artist: string; album?: string },
  settings: TranslationSettings
): Promise<string[]> {
  if (!settings.geminiApiKey) {
    throw new Error('Vui lòng nhập API Key của Google Gemini trong Cài đặt.');
  }

  const model = settings.geminiModel || 'gemini-3.5-flash-lite';
  const prompt = buildAiPrompt(lines, targetLang, metadata);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
    settings.geminiApiKey
  )}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(`Gemini API Error (${response.status}): ${errJson.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAiResponseLines(textOutput, lines.length);
}

// 3. ENGINE OPENAI (GPT-4o / GPT-4o-mini / o3-mini / GPT-4.5)
async function translateWithOpenAI(
  lines: string[],
  targetLang: string,
  metadata: { title: string; artist: string; album?: string },
  settings: TranslationSettings
): Promise<string[]> {
  if (!settings.openaiApiKey) {
    throw new Error('Vui lòng nhập API Key của OpenAI trong Cài đặt.');
  }

  const model = settings.openaiModel || 'gpt-4o-mini';
  const prompt = buildAiPrompt(lines, targetLang, metadata);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Bạn là chuyên gia dịch thuật âm nhạc thi ca xuất sắc.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(`OpenAI Error (${response.status}): ${errJson.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';
  return parseAiResponseLines(textOutput, lines.length);
}

// 4. ENGINE OPENROUTER (Tất cả mô hình mở mới nhất: Claude 3.7, Gemini 2.0...)
async function translateWithOpenRouter(
  lines: string[],
  targetLang: string,
  metadata: { title: string; artist: string; album?: string },
  settings: TranslationSettings
): Promise<string[]> {
  if (!settings.openrouterApiKey) {
    throw new Error('Vui lòng nhập API Key của OpenRouter trong Cài đặt.');
  }

  const model = settings.openrouterModel || 'google/gemini-2.0-flash-001';
  const prompt = buildAiPrompt(lines, targetLang, metadata);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.openrouterApiKey}`,
      'HTTP-Referer': 'https://flarity.music',
      'X-Title': 'Flarity Music',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(`OpenRouter Error (${response.status}): ${errJson.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';
  return parseAiResponseLines(textOutput, lines.length);
}

// 5. ENGINE ANTHROPIC CLAUDE (Claude 3.7 Sonnet / Claude 3.5 Sonnet / Claude 3.5 Haiku)
async function translateWithClaude(
  lines: string[],
  targetLang: string,
  metadata: { title: string; artist: string; album?: string },
  settings: TranslationSettings
): Promise<string[]> {
  if (!settings.claudeApiKey) {
    throw new Error('Vui lòng nhập API Key của Anthropic Claude trong Cài đặt.');
  }

  const model = settings.claudeModel || 'claude-3-7-sonnet-20250219';
  const prompt = buildAiPrompt(lines, targetLang, metadata);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.claudeApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(`Claude Error (${response.status}): ${errJson.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.content?.[0]?.text || '';
  return parseAiResponseLines(textOutput, lines.length);
}

// 6. ENGINE CUSTOM OPENAI-COMPATIBLE ENDPOINT
async function translateWithCustom(
  lines: string[],
  targetLang: string,
  metadata: { title: string; artist: string; album?: string },
  settings: TranslationSettings
): Promise<string[]> {
  if (!settings.customEndpointUrl) {
    throw new Error('Vui lòng cấu hình URL Endpoint Custom trong Cài đặt.');
  }

  const endpoint = settings.customEndpointUrl.replace(/\/+$/, '');
  const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
  const prompt = buildAiPrompt(lines, targetLang, metadata);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.customApiKey) {
    headers.Authorization = `Bearer ${settings.customApiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.customModel || 'default',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(`Custom API Error (${response.status}): ${errJson.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const textOutput = data.choices?.[0]?.message?.content || '';
  return parseAiResponseLines(textOutput, lines.length);
}

// HÀM ĐIỀU PHỐI CHÍNH: Dịch mảng LyricLine[] có bảo tồn thời gian
export async function translateLyrics(
  lyricLines: LyricLine[],
  metadata: { title: string; artist: string; album?: string; trackId?: string },
  overrideSettings?: Partial<TranslationSettings>,
  forceFresh = false
): Promise<LyricLine[]> {
  if (!lyricLines || lyricLines.length === 0) return [];

  const settings = { ...loadTranslationSettings(), ...overrideSettings };
  const targetLang = settings.targetLanguage || 'vi';
  const provider = settings.provider || 'google';
  const trackKey = metadata.trackId || `${metadata.title}_${metadata.artist}`;

  // Kiểm tra Cache
  if (!forceFresh) {
    const cached = getCachedTranslation(trackKey, targetLang, provider);
    if (cached && cached.length === lyricLines.length) {
      return lyricLines.map((line, idx) => ({
        ...line,
        translation: cached[idx] || line.text,
      }));
    }
  }

  const originalTexts = lyricLines.map((l) => l.text.trim());

  let translatedTexts: string[] = [];

  switch (provider) {
    case 'gemini':
      translatedTexts = await translateWithGemini(originalTexts, targetLang, metadata, settings);
      break;
    case 'openai':
      translatedTexts = await translateWithOpenAI(originalTexts, targetLang, metadata, settings);
      break;
    case 'openrouter':
      translatedTexts = await translateWithOpenRouter(originalTexts, targetLang, metadata, settings);
      break;
    case 'claude':
      translatedTexts = await translateWithClaude(originalTexts, targetLang, metadata, settings);
      break;
    case 'custom':
      translatedTexts = await translateWithCustom(originalTexts, targetLang, metadata, settings);
      break;
    case 'google':
    default:
      translatedTexts = await translateWithGoogle(originalTexts, targetLang);
      break;
  }

  // Khớp 1-1 với số lượng dòng
  const finalTranslations: string[] = [];
  const merged: LyricLine[] = lyricLines.map((line, idx) => {
    const trans = stripLineIndexPrefix(translatedTexts[idx] || '');
    finalTranslations.push(trans);
    return {
      ...line,
      translation: trans || undefined,
    };
  });

  // Lưu vào cache
  setCachedTranslation(trackKey, targetLang, provider, finalTranslations);

  return merged;
}

// Kiểm tra kết nối API trong cài đặt
export async function testTranslationProvider(
  provider: TranslationProvider,
  settings: TranslationSettings
): Promise<{ success: boolean; message: string }> {
  const sample = ['Hello, how are you today?', 'Music is the universal language of mankind.'];
  const dummyMeta = { title: 'Test Song', artist: 'Test Artist' };

  try {
    let res: string[] = [];
    switch (provider) {
      case 'gemini':
        res = await translateWithGemini(sample, 'vi', dummyMeta, settings);
        break;
      case 'openai':
        res = await translateWithOpenAI(sample, 'vi', dummyMeta, settings);
        break;
      case 'openrouter':
        res = await translateWithOpenRouter(sample, 'vi', dummyMeta, settings);
        break;
      case 'claude':
        res = await translateWithClaude(sample, 'vi', dummyMeta, settings);
        break;
      case 'custom':
        res = await translateWithCustom(sample, 'vi', dummyMeta, settings);
        break;
      case 'google':
      default:
        res = await translateWithGoogle(sample, 'vi');
        break;
    }
    if (res.length > 0) {
      return { success: true, message: `Kết nối thành công! Kết quả thử: "${res[0]}"` };
    }
    return { success: false, message: 'Không nhận được dữ liệu trả về từ API.' };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
}
