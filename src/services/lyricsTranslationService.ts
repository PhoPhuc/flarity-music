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

// Tính khoảng cách Levenshtein giữa 2 chuỗi
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = i;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? matrix[j - 1] : Math.min(matrix[j - 1], matrix[j], prev) + 1;
      matrix[j - 1] = prev;
      prev = val;
    }
    matrix[b.length] = prev;
  }

  return matrix[b.length];
}

/**
 * Chuẩn hóa chuỗi để so sánh (xóa dấu câu, viết thường, chuẩn hóa khoảng trắng)
 */
export function normalizeTextForComparison(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”«»…\\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính độ tương đồng giữa 2 chuỗi (từ 0.0 đến 1.0)
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  const normA = normalizeTextForComparison(textA);
  const normB = normalizeTextForComparison(textB);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;

  // Nếu một chuỗi chứa trọn chuỗi kia và độ dài chênh lệch không quá 20%
  const minLen = Math.min(normA.length, normB.length);
  if (minLen / maxLen >= 0.8 && (normA.includes(normB) || normB.includes(normA))) {
    return 1.0;
  }

  const distance = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Nhận diện chuỗi có phải tiếng Việt (dựa trên các ký tự có dấu tiếng Việt đặc trưng)
 */
export function isVietnameseText(text: string): boolean {
  if (!text) return false;
  const vnRegex = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
  return vnRegex.test(text);
}

/**
 * Quyết định xem có nên hiển thị dòng phụ dịch thuật hay không:
 * 1. Không hiển thị nếu chuỗi dịch rỗng.
 * 2. Không hiển thị nếu cùng ngôn ngữ (ví dụ bài hát gốc tiếng Việt và ngôn ngữ đích là tiếng Việt).
 * 3. Không hiển thị nếu độ trùng khớp giữa dòng gốc và dòng dịch > 80% (ví dụ ad-libs 'yeah yeah', lặp từ, tên riêng).
 */
export function shouldDisplayTranslation(
  originalText: string,
  translatedText: string | undefined | null,
  targetLang: string = 'vi'
): boolean {
  if (!translatedText) return false;

  const origTrimmed = originalText.trim();
  const transTrimmed = translatedText.trim();

  if (!origTrimmed || !transTrimmed) return false;

  // 1. Kiểm tra cùng ngôn ngữ:
  // Nếu đích là tiếng Việt ('vi') và dòng gốc là tiếng Việt có dấu
  if (targetLang === 'vi' && isVietnameseText(origTrimmed)) {
    return false;
  }

  // 2. Kiểm tra độ tương đồng / trùng khớp >= 80% (0.8)
  const similarity = calculateTextSimilarity(origTrimmed, transTrimmed);
  if (similarity >= 0.8) {
    return false;
  }

  return true;
}

// System Prompt nâng cao: Dịch thoát ý theo ngữ cảnh âm nhạc, tự nhiên, đậm chất thi ca, tránh hàn lâm cứng nhắc
function buildAiPrompt(lines: string[], targetLang: string, metadata: { title: string; artist: string; album?: string }): string {
  const langName = getLanguageName(targetLang);
  const numberedLyrics = lines.map((line, idx) => `[${idx + 1}] ${line}`).join('\n');

  return `Bạn là một dịch giả âm nhạc và nhà biên soạn lời bài hát hàng đầu, có vốn từ phong phú, khả năng cảm thụ nhịp điệu và am hiểu sâu sắc văn hóa âm nhạc đương đại (Pop, Rap/Hip-hop, R&B, Ballad, Rock, EDM, Indie...).

NHIỆM VỤ: Dịch lời bài hát sau đây sang ${langName}.
- Tên bài hát: "${metadata.title}"
- Nghệ sĩ: "${metadata.artist}"
${metadata.album ? `- Album: "${metadata.album}"` : ''}

QUY TẮC DỊCH THUẬT QUAN TRỌNG (BẮT BUỘC TUÂN THỦ):

1. THOÁT Ý THEO NGỮ CẢNH ÂM NHẠC & VIBE BÀI HÁT (CHỐNG HÀN LÂM, CỨNG NHẮC):
   - TUYỆT ĐỐI KHÔNG dịch theo kiểu từ điển, sách giáo khoa hay văn bản hành chính khuôn mẫu.
   - Phải cảm nhận đúng bối cảnh, thể loại, tâm trạng (mood) và phong cách biểu đạt đặc trưng của bài hát.
   - Nhận diện đúng tiếng lóng (slang), ẩn dụ, hàm ý âm nhạc và văn hóa đời thực:
     * Ví dụ: Từ ngữ miêu tả hành động trong nhạc quẩy/hip-hop/party như "lean", "tippin", "rocking", "vibing" không dịch nghĩa đen hàn lâm là "nghiêng mình / lắc lư vật lý", mà dịch tự nhiên theo phong cách âm nhạc như "quẩy hết mình", "phiêu theo điệu nhạc", "thả mình theo beat".
     * Các từ lóng như "flex" -> "khoe cá tính / thể hiện", "ice" -> "kim cương lấp lánh", "chill" -> "thư giãn / êm dịu", "vibe" -> "tâm trạng / cảm xúc".
   - Với nhạc tình cảm/Ballad/Acoustic: Dùng từ ngữ tình tứ, mềm mại, giàu chất thơ, xúc động và tự nhiên như lời tâm sự chân thành.
   - Với nhạc Rap/Trap/Hiphop/EDM: Dùng ngôn ngữ phóng khoáng, bắt tai, gieo vần điệu, năng động, mang hơi thở âm nhạc giới trẻ.

2. TÍNH NHẠC, ĐỘ MƯỢT VÀ DỄ HÁT THEO:
   - Câu dịch phải trôi chảy, êm tai, câu từ gãy gọn, có nhịp phách để người nghe vừa đọc vừa cảm nhận được giai điệu bài hát.

3. XỬ LÝ ĐẶC BIỆT CÙNG NGÔN NGỮ & AD-LIBS:
   - Nếu câu gốc vốn dĩ ĐÃ LÀ ${langName} hoặc là tên riêng, tiếng đệm ad-libs ("Yeah yeah", "Na na na", "Oh oh"): hãy giữ nguyên bản gốc hoặc chỉ điều chỉnh nhẹ cho tự nhiên, không cố tình diễn giải dài dòng.

4. BẢO TOÀN ĐÚNG SỐ DÒNG 1:1 & ĐỊNH DẠNG JSON:
   - Trả về CHÍNH XÁC số lượng dòng tương ứng bằng định dạng JSON mảng chuỗi thuần túy: ["Lời dịch câu 1", "Lời dịch câu 2", ...].
   - TUYỆT ĐỐI KHÔNG chèn số thứ tự (như [1], [2], 1., 2., Câu 1:...) vào đầu câu trong mảng kết quả.
   - KHÔNG thêm bất kỳ văn bản giải thích, lời chào hay bình luận nào ngoài mảng JSON.

DANH SÁCH CÁC CÂU LỜI HÁT GỐC CẦN DỊCH:
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
