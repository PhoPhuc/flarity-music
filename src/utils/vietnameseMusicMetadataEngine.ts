import type { Track, Album } from '../types';

/**
 * ============================================================================
 * FLARITY MUSIC - VIETNAMESE MUSIC METADATA & SHOW PATTERN RECOGNITION ENGINE
 * ============================================================================
 * 
 * Features:
 * 1. Comprehensive Vietnamese Show, Competition, TV Show & OST Catalogs:
 *    - Anh Trai "Say Hi" (ATSH)
 *    - Anh Trai Vượt Ngàn Chông Gai (ATVNCG / Call Me By Fire VN)
 *    - Rap Việt (Mùa 1, 2, 3, 4 / 2024)
 *    - The Masked Singer Vietnam (Ca Sĩ Mặt Nạ)
 *    - Chị Đẹp Đạp Gió Rẽ Sóng (Sisters Who Make Waves VN)
 *    - Our Song Vietnam (Bài Hát Của Chúng Ta)
 *    - Sing My Song Vietnam (Bài Hát Hay Nhất)
 *    - The Voice Vietnam (Giọng Hát Việt / The Voice Kids)
 *    - OST (Original Soundtrack / Nhạc Phim Điện Ảnh, Phim Truyền Hình)
 *    - Live Sessions & Concerts (Sky Tour, Show Của Đen, See Sing Share, v.v.)
 * 
 * 2. Multi-Part YouTube Title Parsing & Segment Decomposition:
 *    - Separates Primary / Lead Artists, Featured / Guest Artists (ft./feat./with), and Producers (Prod. by / Beat by).
 *    - Extracts Episode, Stage, Round (Bảng A, Công Diễn 1, Chung Kết, Tập 5...).
 *    - Strips YouTube junk tags ([MV], (Official Audio), [4K], Visualizer...).
 * 
 * 3. >= 95% Fuzzy Album Clustering & Multi-Artist Album Unification:
 *    - Token Set Ratio + Token Sort Ratio + Normalized Levenshtein Distance.
 *    - Automatically groups tracks with >= 95% album similarity into single unified Album entities.
 *    - Supports multi-artist compilation and show albums ("Various Artists" / Show Name).
 */

// ============================================================================
// 1. SHOW CATALOG DEFINITIONS & PATTERNS
// ============================================================================

export interface VietnameseShowCatalogItem {
  id: string;
  canonicalName: string;
  shortCode: string;
  aliases: string[];
  patterns: RegExp[];
  bracketPattern: RegExp;
  defaultGenre: string;
  defaultAlbumArtist: string;
}

export const VIETNAMESE_SHOW_CATALOG: VietnameseShowCatalogItem[] = [
  {
    id: 'atsh',
    canonicalName: 'Anh Trai "Say Hi"',
    shortCode: 'ATSH',
    aliases: ['ATSH', 'Say Hi', 'SayHi', 'Anh Trai Say Hi', 'Anh Trai Say Hi 2024'],
    patterns: [
      /\b(?:ATSH|Anh\s*Trai\s*["“]?Say\s*Hi["”]?|Say\s*Hi\s*2024)\b/i,
    ],
    bracketPattern: /\[\s*(?:ATSH|Anh\s*Trai\s*["“]?Say\s*Hi["”]?)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / TV Show',
    defaultAlbumArtist: 'Anh Trai "Say Hi"',
  },
  {
    id: 'atvncg',
    canonicalName: 'Anh Trai Vượt Ngàn Chông Gai',
    shortCode: 'ATVNCG',
    aliases: ['ATVNCG', 'Anh Trai Vuot Ngan Chong Gai', 'Call Me By Fire Vietnam', 'Call Me By Fire VN', 'Call Me By Fire', 'Vượt Ngàn Chông Gai'],
    patterns: [
      /\b(?:ATVNCG|Anh\s*Trai\s*V(?:ượ|uo)t\s*Ng(?:à|a)n\s*Ch(?:ô|o)ng\s*Gai|Call\s*Me\s*By\s*Fire(?:\s*VN|\s*Vietnam)?)\b/i,
    ],
    bracketPattern: /\[\s*(?:ATVNCG|Anh\s*Trai\s*V(?:ượ|uo)t\s*Ng(?:à|a)n\s*Ch(?:ô|o)ng\s*Gai|Call\s*Me\s*By\s*Fire)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Rock / TV Show',
    defaultAlbumArtist: 'Anh Trai Vượt Ngàn Chông Gai',
  },
  {
    id: 'rap_viet',
    canonicalName: 'Rap Việt',
    shortCode: 'RAP_VIET',
    aliases: ['Rap Việt', 'Rap Viet', 'Rap Việt 2024', 'Rap Việt Mùa 1', 'Rap Việt Mùa 2', 'Rap Việt Mùa 3', 'Rap Việt Mùa 4'],
    patterns: [
      /\b(?:RAP\s*VI(?:Ệ|E)T(?:\s*(?:2024|2023|2022|2021|2020|M(?:Ù|U)A\s*\d+|SEASON\s*\d+))?)\b/i,
    ],
    bracketPattern: /\[\s*RAP\s*VI(?:Ệ|E)T[^\]]*\]/gi,
    defaultGenre: 'V-Rap / Hip-Hop',
    defaultAlbumArtist: 'Rap Việt',
  },
  {
    id: 'masked_singer',
    canonicalName: 'The Masked Singer Vietnam',
    shortCode: 'TMS_VN',
    aliases: ['The Masked Singer Vietnam', 'The Masked Singer VN', 'Ca Sĩ Mặt Nạ', 'Ca Si Mat Na'],
    patterns: [
      /\b(?:THE\s*MASKED\s*SINGER(?:\s*VIETNAM|\s*VN)?|Ca\s*S(?:ĩ|i)\s*M(?:ặ|a)t\s*N(?:ạ|a))\b/i,
    ],
    bracketPattern: /\[\s*(?:THE\s*MASKED\s*SINGER|Ca\s*S(?:ĩ|i)\s*M(?:ặ|a)t\s*N(?:ạ|a))[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Ballad',
    defaultAlbumArtist: 'The Masked Singer Vietnam',
  },
  {
    id: 'chi_dep',
    canonicalName: 'Chị Đẹp Đạp Gió Rẽ Sóng',
    shortCode: 'CHI_DEP',
    aliases: ['Chị Đẹp Đạp Gió Rẽ Sóng', 'Chị Đẹp Đạp Gió', 'Chị Đẹp', 'Chi Dep', 'Sisters Who Make Waves VN'],
    patterns: [
      /\b(?:CH(?:Ị|I)\s*(?:Đ|D)(?:Ẹ|E)P(?:\s*(?:Đ|D)(?:Ạ|A)P\s*GI(?:Ó|O)(?:\s*R(?:Ẽ|E)\s*S(?:Ó|O)NG)?|\s*\d{4})?|Sisters\s*Who\s*Make\s*Waves)\b/i,
    ],
    bracketPattern: /\[\s*(?:CH(?:Ị|I)\s*(?:Đ|D)(?:Ẹ|E)P|Sisters\s*Who\s*Make\s*Waves)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Dance',
    defaultAlbumArtist: 'Chị Đẹp Đạp Gió Rẽ Sóng',
  },
  {
    id: 'our_song',
    canonicalName: 'Our Song Vietnam',
    shortCode: 'OUR_SONG',
    aliases: ['Our Song Vietnam', 'Our Song VN', 'Bài Hát Của Chúng Ta', 'Our Song'],
    patterns: [
      /\b(?:OUR\s*SONG(?:\s*VIETNAM|\s*VN)?|B(?:à|a)i\s*H(?:á|a)t\s*C(?:ủ|u)a\s*Ch(?:ú|u)ng\s*Ta)\b/i,
    ],
    bracketPattern: /\[\s*(?:OUR\s*SONG|B(?:à|a)i\s*H(?:á|a)t\s*C(?:ủ|u)a\s*Ch(?:ú|u)ng\s*Ta)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Duet',
    defaultAlbumArtist: 'Our Song Vietnam',
  },
  {
    id: 'sing_my_song',
    canonicalName: 'Sing My Song Vietnam',
    shortCode: 'SING_MY_SONG',
    aliases: ['Sing My Song Vietnam', 'Sing My Song VN', 'Bài Hát Hay Nhất', 'Sing My Song'],
    patterns: [
      /\b(?:SING\s*MY\s*SONG(?:\s*VIETNAM|\s*VN)?|B(?:à|a)i\s*H(?:á|a)t\s*Hay\s*Nh(?:ấ|a)t)\b/i,
    ],
    bracketPattern: /\[\s*(?:SING\s*MY\s*SONG|B(?:à|a)i\s*H(?:á|a)t\s*Hay\s*Nh(?:ấ|a)t)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Indie',
    defaultAlbumArtist: 'Sing My Song Vietnam',
  },
  {
    id: 'the_voice',
    canonicalName: 'Giọng Hát Việt',
    shortCode: 'THE_VOICE',
    aliases: ['Giọng Hát Việt', 'The Voice Vietnam', 'The Voice VN', 'Giọng Hát Việt Nhí', 'The Voice Kids'],
    patterns: [
      /\b(?:THE\s*VOICE(?:\s*VIETNAM|\s*VN|\s*KIDS)?|Gi(?:ọ|o)ng\s*H(?:á|a)t\s*Vi(?:ệ|e)t(?:\s*Nh(?:í|i))?)\b/i,
    ],
    bracketPattern: /\[\s*(?:THE\s*VOICE|Gi(?:ọ|o)ng\s*H(?:á|a)t\s*Vi(?:ệ|e)t)[^\]]*\]/gi,
    defaultGenre: 'V-Pop',
    defaultAlbumArtist: 'Giọng Hát Việt',
  },
  {
    id: 'ost',
    canonicalName: 'Original Soundtrack',
    shortCode: 'OST',
    aliases: ['OST', 'Nhạc Phim', 'Original Soundtrack', 'Official OST'],
    patterns: [
      /\b(?:OST|Original\s*Soundtrack|Nh(?:ạ|a)c\s*Phim)\b/i,
    ],
    bracketPattern: /\[\s*(?:OST|Nh(?:ạ|a)c\s*Phim|Original\s*Soundtrack)[^\]]*\]/gi,
    defaultGenre: 'Soundtrack',
    defaultAlbumArtist: 'Various Artists',
  },
  {
    id: 'live_series',
    canonicalName: 'Live Sessions & Concerts',
    shortCode: 'LIVE_CONCERT',
    aliases: ['See Sing Share', 'Sky Tour', 'Show Của Đen', 'Xuân Hạ Thu Đông Rồi Lại Xuân', 'Hương Mùa Hè', 'Lululola Show', 'Mây Lang Thang', 'Giao Lộ Thời Gian'],
    patterns: [
      /\b(?:See\s*Sing\s*Share(?:\s*Season\s*\d+)?|Sky\s*Tour|Show\s*C(?:ủ|u)a\s*(?:Đ|D)en|Xu(?:â|a)n\s*H(?:ạ|a)\s*Thu\s*(?:Đ|D)(?:ô|o)ng\s*R(?:ồ|o)i\s*L(?:ạ|a)i\s*Xu(?:â|a)n|H(?:ư|u)(?:ơ|o)ng\s*M(?:ù|u)a\s*H(?:è|e)|Lululola(?:\s*Show)?|M(?:â|a)y\s*Lang\s*Thang|Giao\s*L(?:ộ|o)\s*Th(?:ờ|o)i\s*Gian)\b/i,
    ],
    bracketPattern: /\[\s*(?:See\s*Sing\s*Share|Sky\s*Tour|Show\s*C(?:ủ|u)a\s*(?:Đ|D)en|Xu(?:â|a)n\s*H(?:ạ|a)\s*Thu\s*(?:Đ|D)(?:ô|o)ng|Lululola|M(?:â|a)y\s*Lang\s*Thang)[^\]]*\]/gi,
    defaultGenre: 'V-Pop / Live Acoustic',
    defaultAlbumArtist: 'Various Artists',
  },
];

// ============================================================================
// 2. PARSING PATTERNS & REGEX REPOSITORIES
// ============================================================================

/**
 * YouTube Junk patterns to strip from song titles:
 */
const YOUTUBE_JUNK_REGEX = /\s*(?:\[|\()(?:\s*(?:OFFICIAL\s*(?:MUSIC\s*)?VIDEO|OFFICIAL\s*AUDIO|OFFICIAL\s*MV|OFFICIAL\s*LYRICS?|OFFICIAL\s*TRACK|OFFICIAL\s*VISUALIZER|OFFICIAL|MUSIC\s*VIDEO|MV\s*HD|FULL\s*MV|MV|LYRIC\s*VIDEO|LYRICS?|AUDIO|AUDIO\s*OFFICIAL|VISUALIZER|VIDEO\s*CLIP|VIDEO|REMASTERED|REMASTER|LIVE\s*PERFORMANCE|LIVE\s*STAGE|LIVE\s*AT\s*[^)\]]+|LIVE\s*IN\s*[^)\]]+|LIVE|HD|4K|1080P|KARAOKE|EXPLICIT|VIETSUB|ENG\s*SUB|KARA|TEASER|TRAILER|BẢN\s*CHUẨN|CHẤT\s*LƯỢNG\s*CAO)\s*)(?:\]|\))/gi;

/**
 * Suffixes like "| Official Music Video" or "- Audio" at the end of string
 */
const TRAILING_YOUTUBE_JUNK_REGEX = /\s*(?:\||\/\/|-)\s*(?:OFFICIAL\s*(?:MUSIC\s*)?VIDEO|OFFICIAL\s*AUDIO|OFFICIAL\s*MV|OFFICIAL|MV|AUDIO|LYRICS?|LYRIC\s*VIDEO|LIVE\s*PERFORMANCE|VISUALIZER|4K|HD).*$/gi;

/**
 * Round, Episode, and Stage patterns inside titles (e.g. "TẬP 5", "BẢNG A", "CÔNG DIỄN 1", "VÒNG 3 BỨT PHÁ")
 */
const STAGE_ROUND_REGEX = /\s*(?:\[|\(|\b)(?:T(?:Ậ|A)P\s*\d+|B(?:Ả|A)NG\s*[A-Z]|C(?:Ô|O)NG\s*DI(?:Ễ|E)N\s*\d+|C(?:Ô|O)NG\s*\d+|V(?:Ò|O)NG\s*\d+(?:\s*[^)\]|]+)?|CHUNG\s*K(?:Ế|E)T(?:\s*\d+)?|B(?:Á|A)N\s*K(?:Ế|E)T|LIVE\s*STAGE\s*\d+|TEAM\s*[^)\]|]+|V(?:Ò|O)NG\s*B(?:Ứ|U)T\s*PH(?:Á|A)|V(?:Ò|O)NG\s*CHINH\s*PH(?:Ụ|U)C|V(?:Ò|O)NG\s*(?:Đ|D)(?:Ố|O)I\s*(?:Đ|D)(?:Ầ|A)U)(?:\]|\)|\b)/gi;

/**
 * Featured / Guest Artists Regex:
 * Match: (ft. APJ), [feat. Snoop Dogg], (featuring Trang), with Orange, etc.
 */
const FEAT_ARTIST_REGEX = /(?:[([{\s]|^)(?:feat\.?|ft\.?|featuring|with)\s+([^()[\]{}]+)(?:[)\]}]|$)/gi;

/**
 * Producer / Beatmaker / Arranger Regex:
 * Match: (Prod. by Kewtiie), [Produced by Wokeup], (Beat by Touliver), (Prod. 2Pillz), etc.
 */
const PRODUCER_REGEX = /(?:[([{\s]|^)(?:prod\.?\s*(?:by)?|produced\s*by|beat\s*by|arranged\s*by|arranger\s*:?|music\s*producer\s*:?)\s*([^()[\]{}]+)(?:[)\]}]|$)/gi;

/**
 * Split delimiters for artist lists:
 * - Comma, semicolon, bullet, slashes, plus, ampersand: , ; • · / \ + &
 * - " x ", " X ", " vs ", " vs. ", " and ", " và "
 * - Hyphen with spaces: " - " (excluding hyphen in names like Son Tung M-TP, Jay-Z)
 */
const ARTIST_SEPARATORS_REGEX = /\s*(?:feat\.?|ft\.?|featuring|with|presents?|prod\.?\s*by|prod\.?|by)\s+|\s+(?:-)\s+|[,;/|&+\\•·~]+\s*|\s+(?:x|X|vs\.?|vs|and|v&|và)\s+/i;

// ============================================================================
// 3. DIACRITICS & STRING NORMALIZATION ENGINE
// ============================================================================

/**
 * Strips all Vietnamese and Latin diacritics for phonetic comparison:
 */
export function removeDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Cleans a string into a standardized alphanumeric tokenized form:
 */
export function normalizeCanonicalString(str: string): string {
  if (!str) return '';
  return removeDiacritics(str)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips bracket-enclosed tokens and punctuation cleanly while preserving valid balanced parentheses:
 */
function cleanEnclosingPunctuation(str: string): string {
  if (!str) return '';
  let clean = str.trim();
  // Strip leading punctuation and unclosed brackets
  clean = clean.replace(/^[\])}|/\-–—:~"'`\s]+/, '').trim();
  // Strip trailing punctuation
  clean = clean.replace(/[\[({|/\-–—:~"'`\s]+$/, '').trim();

  // If ends with unclosed parenthesis or bracket, balance it
  const openParen = (clean.match(/\(/g) || []).length;
  const closeParen = (clean.match(/\)/g) || []).length;
  if (openParen > closeParen) {
    clean += ')'.repeat(openParen - closeParen);
  }

  const openBracket = (clean.match(/\[/g) || []).length;
  const closeBracket = (clean.match(/\]/g) || []).length;
  if (openBracket > closeBracket) {
    clean += ']'.repeat(openBracket - closeBracket);
  }

  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes title casing for Vietnamese text gracefully:
 */
export function formatVietnameseTitleCase(str: string): string {
  if (!str || !str.trim()) return '';

  const clean = cleanEnclosingPunctuation(str);
  // If the entire string is uppercase or lowercase, convert to Title Case
  const isAllUpper = clean === clean.toUpperCase() && /[A-ZÀ-Ỹ]/.test(clean);
  const isAllLower = clean === clean.toLowerCase();

  if (!isAllUpper && !isAllLower) {
    return clean;
  }

  // Preserve well-known Vietnamese artist and technical acronyms
  const PRESERVE_ACRONYMS = new Set([
    'HIEUTHUHAI', 'SOOBIN', 'MONO', 'MCK', 'RHYDER', 'JSOL', 'ERIK', 'APJ',
    'K-ICM', 'GREY D', 'B-WINE', '16 TYPH', 'GDUCKY', '24K.RIGHT', 'WXRDIE',
    'GILL', 'LIL WUYN', 'DOUBLE2T', 'HURRYKNG', 'NSND', 'NSƯT', 'MV', 'EP',
    'OST', 'HIT', 'VIP', 'DNA', 'BFF', 'OK', 'V-POP', 'RAP', 'ATSH', 'ATVNCG'
  ]);

  const LOWERCASE_WORDS = new Set([
    'của', 'và', 'ở', 'trong', 'với', 'cho', 'về', 'từ', 'tại', 'là', 'như',
    'of', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'the', 'a', 'an'
  ]);

  const words = clean.split(/\s+/);
  const formattedWords = words.map((word, idx) => {
    const upper = word.toUpperCase();
    if (PRESERVE_ACRONYMS.has(upper)) {
      return upper;
    }

    const lower = word.toLowerCase();
    if (idx > 0 && idx < words.length - 1 && LOWERCASE_WORDS.has(lower)) {
      return lower;
    }

    // Capitalize first character
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return formattedWords.join(' ');
}

// ============================================================================
// 4. STRUCTURED ARTIST PARSER
// ============================================================================

export interface StructuredArtistResult {
  primaryArtists: string[];
  featuredArtists: string[];
  producers: string[];
  allArtists: string[];
  formattedArtistString: string;
}

/**
 * Parses artist strings and extracts primary artists, guest/feat artists, and producers:
 */
export function parseArtistsStructured(
  rawArtistStr?: string,
  rawTitleStr?: string
): StructuredArtistResult {
  const primarySet = new Set<string>();
  const featuredSet = new Set<string>();
  const producerSet = new Set<string>();

  const processAndAdd = (name: string, targetSet: Set<string>) => {
    let clean = cleanEnclosingPunctuation(name);
    // Strip trailing stage words like "BỨT PHÁ", "CÔNG DIỄN", etc.
    clean = clean.replace(STAGE_ROUND_REGEX, '').trim();
    clean = cleanEnclosingPunctuation(clean);

    if (
      clean &&
      clean.length > 1 &&
      !['unknown', 'unknown artist', 'various artists', 'nghệ sĩ chưa rõ', 'feat', 'ft'].includes(clean.toLowerCase())
    ) {
      targetSet.add(clean);
    }
  };

  // 1. Extract Producers from Title and Artist string
  if (rawTitleStr) {
    const prodMatches = Array.from(rawTitleStr.matchAll(PRODUCER_REGEX));
    for (const m of prodMatches) {
      if (m[1]) {
        const parts = m[1].split(ARTIST_SEPARATORS_REGEX);
        for (const p of parts) processAndAdd(p, producerSet);
      }
    }
  }
  if (rawArtistStr) {
    const prodMatches = Array.from(rawArtistStr.matchAll(PRODUCER_REGEX));
    for (const m of prodMatches) {
      if (m[1]) {
        const parts = m[1].split(ARTIST_SEPARATORS_REGEX);
        for (const p of parts) processAndAdd(p, producerSet);
      }
    }
  }

  // 2. Extract Featured Artists from Title and Artist string
  if (rawTitleStr) {
    const featMatches = Array.from(rawTitleStr.matchAll(FEAT_ARTIST_REGEX));
    for (const m of featMatches) {
      if (m[1]) {
        const parts = m[1].split(ARTIST_SEPARATORS_REGEX);
        for (const p of parts) {
          if (!producerSet.has(p.trim())) {
            processAndAdd(p, featuredSet);
          }
        }
      }
    }
  }
  if (rawArtistStr) {
    const featMatches = Array.from(rawArtistStr.matchAll(FEAT_ARTIST_REGEX));
    for (const m of featMatches) {
      if (m[1]) {
        const parts = m[1].split(ARTIST_SEPARATORS_REGEX);
        for (const p of parts) {
          if (!producerSet.has(p.trim())) {
            processAndAdd(p, featuredSet);
          }
        }
      }
    }
  }

  // 3. Clean rawArtistStr from feat / prod and split for primary artists
  if (rawArtistStr && rawArtistStr.trim()) {
    let cleanedArtistStr = rawArtistStr
      .replace(PRODUCER_REGEX, ' ')
      .replace(FEAT_ARTIST_REGEX, ' ')
      .replace(STAGE_ROUND_REGEX, ' ')
      .trim();

    const parts = cleanedArtistStr.split(ARTIST_SEPARATORS_REGEX);
    for (const p of parts) {
      if (!producerSet.has(p.trim()) && !featuredSet.has(p.trim())) {
        processAndAdd(p, primarySet);
      }
    }
  }

  const primaryArtists = Array.from(primarySet);
  const featuredArtists = Array.from(featuredSet).filter(
    (f) => !primaryArtists.some((p) => p.toLowerCase() === f.toLowerCase())
  );
  const producers = Array.from(producerSet);

  const allArtistsMap = new Map<string, string>();
  for (const a of [...primaryArtists, ...featuredArtists, ...producers]) {
    const key = a.toLowerCase();
    if (!allArtistsMap.has(key)) {
      allArtistsMap.set(key, a);
    }
  }
  const allArtists = Array.from(allArtistsMap.values());

  // Formatted artist string for UI presentation
  let formattedArtistString = primaryArtists.length > 0 ? primaryArtists.join(', ') : 'Nghệ sĩ chưa rõ';
  if (featuredArtists.length > 0) {
    formattedArtistString += ` (feat. ${featuredArtists.join(', ')})`;
  }
  if (producers.length > 0) {
    formattedArtistString += ` [Prod. by ${producers.join(', ')}]`;
  }

  return {
    primaryArtists: primaryArtists.length > 0 ? primaryArtists : ['Nghệ sĩ chưa rõ'],
    featuredArtists,
    producers,
    allArtists: allArtists.length > 0 ? allArtists : ['Nghệ sĩ chưa rõ'],
    formattedArtistString,
  };
}

// ============================================================================
// 5. VIETNAMESE SHOW PATTERN DETECTOR & YOUTUBE METADATA EXTRACTOR
// ============================================================================

export interface ParsedVietnameseMetadata {
  title: string;
  artist: string;
  artists: string[];
  album: string;
  isRecognizedShow: boolean;
  showCatalogItem?: VietnameseShowCatalogItem;
  showStageRound?: string;
  primaryArtists: string[];
  featuredArtists: string[];
  producers: string[];
}

/**
 * Detects if a title / artist belongs to a recognized Vietnamese Show catalog:
 */
export function detectVietnameseShow(
  title: string,
  artist?: string
): { show?: VietnameseShowCatalogItem; stageOrRound?: string; movieTitle?: string } {
  const combined = `${title} ${artist || ''}`;

  // Check OST Movie Name: [OST MAI] or [OST LAT MAT 7]
  const ostMatch = combined.match(/\[\s*OST\s+([^\]]+)\]/i);
  let movieTitle: string | undefined;
  if (ostMatch && ostMatch[1]) {
    movieTitle = ostMatch[1].trim();
  }

  for (const show of VIETNAMESE_SHOW_CATALOG) {
    for (const pattern of show.patterns) {
      if (pattern.test(combined)) {
        let stageOrRound: string | undefined;
        const stageMatches = Array.from(combined.matchAll(STAGE_ROUND_REGEX));
        if (stageMatches.length > 0 && stageMatches[0][0]) {
          stageOrRound = cleanEnclosingPunctuation(stageMatches[0][0]);
        }

        return {
          show,
          stageOrRound,
          movieTitle,
        };
      }
    }
  }

  return {};
}

/**
 * Đánh giá điểm số chuyên sâu để xác định chuỗi là Nghệ Sĩ (Artist) hay Tiêu Đề Bài Hát (Title)
 */
export function scoreArtistVsTitle(str: string): { artistScore: number; titleScore: number } {
  if (!str || !str.trim()) return { artistScore: 0, titleScore: 0 };
  const s = str.trim();
  const lower = s.toLowerCase();
  let artistScore = 0;
  let titleScore = 0;

  // 1. Phân tích mẫu ngoặc Feat: "Tên Bài Hát (feat. Ca sĩ khách)"
  // Sự hiện diện của (feat. ...) hay (ft. ...) trong ngoặc là đặc trưng của Title có kèm khách mời
  const hasFeatInBracket = /[\(\[\{]\s*(?:feat\.?|ft\.?|featuring|with|prod\.?)\s+[^()\[\]{}]+[\)\]\}]/i.test(s);
  if (hasFeatInBracket) {
    titleScore += 50;
  }

  // 2. Danh mục nghệ sĩ phổ biến
  const KNOWN_ARTISTS = [
    'mck', 'tlinh', 'hieuthuhai', 'soobin', 'rhyder', 'erik', 'atus', 'den', 'đen', 'vu', 'vũ', 'son tung', 'sơn tùng', 'sơn tùng m-tp',
    'phan manh quynh', 'phan mạnh quỳnh', 'my linh', 'mỹ linh', 'minh tuyet', 'minh tuyết', 'phuong thanh', 'phương thanh',
    'nsnd tu long', 'tự long', 'cuong seven', 'cường seven', 'orange', 'grey d', 'mono', 'quang hung masterd', 'quang hùng masterd',
    'duong domic', 'dương domic', 'captain boy', 'wokeup', 'kewtiie', 'touliver', 'slimv', 'justatee',
    'karik', 'suboi', 'thai vg', 'trang', 'voi ban don', 'anh tu', 'anh tú', 'hurrykng', 'phap kieu', 'pháp kiều',
    'tag', 'bray', 'b ray', 'masew', 'binz', 'soobin hoang son', 'hoang dung', 'hoàng dũng', 'vu cat tuong', 'vũ cát tường',
    'duc phuc', 'đức phúc', 'hoa minzy', 'hòa minzy', 'amee', 'min', 'jack', 'j97', 'k-icm', 'kicm',
    'low g', 'wxrdie', '24k.right', 'gill', 'tage', 'obito', 'vstra', 'marzuz', 'wean', 'naomi', 'ronboogz',
    'taylor swift', 'ariana grande', 'billie eilish', 'justin bieber', 'the weeknd', 'drake', 'post malone', 'eminem',
    'charlie puth', 'bruno mars', 'ed sheeran', 'adele', 'bts', 'blackpink', 'newjeans', 'aespa', 'ive', 'twice'
  ];

  const cleanBase = s.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim().toLowerCase();
  if (KNOWN_ARTISTS.some((a) => cleanBase === a || cleanBase === normalizeCanonicalString(a))) {
    artistScore += 70;
  } else if (KNOWN_ARTISTS.some((a) => lower.includes(a))) {
    artistScore += 25;
  }

  // 3. Ký tự kết nối nghệ sĩ: "A x B", "A & B", "A, B, C"
  if (/\s+(?:x|X|vs\.?|vs|and|và)\s+/i.test(cleanBase) || /[,;&+]/.test(cleanBase)) {
    artistScore += 30;
  }

  // 4. Số từ và độ dài chuỗi
  const words = cleanBase.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 3) {
    artistScore += 15;
  } else if (words.length >= 5) {
    titleScore += 35;
  }

  return { artistScore, titleScore };
}

function isLikelyArtistString(str: string): boolean {
  const { artistScore, titleScore } = scoreArtistVsTitle(str);
  return artistScore > titleScore;
}

/**
 * Comprehensive Parser for Complex Vietnamese YouTube Titles:
 */
export function parseVietnameseMusicMetadata(
  rawTitle: string,
  rawArtist?: string,
  suggestedArtist?: string,
  channelName?: string
): ParsedVietnameseMetadata {
  let originalTitle = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();

  // Tự động phát hiện và đảo ngược lại nếu rawTitle là Tên Nghệ Sĩ và rawArtist là Tên Bài Hát
  if (originalTitle && artist && !['youtube music', 'nghệ sĩ chưa rõ', 'unknown artist', 'unknown'].includes(artist.toLowerCase())) {
    const tScore = scoreArtistVsTitle(originalTitle);
    const aScore = scoreArtistVsTitle(artist);
    if (tScore.artistScore >= 40 && aScore.titleScore >= 30 && tScore.artistScore > tScore.titleScore && aScore.titleScore > aScore.artistScore) {
      const temp = originalTitle;
      originalTitle = artist;
      artist = temp;
    }
  }

  // 1. Detect Vietnamese Show catalog
  const { show, stageOrRound, movieTitle } = detectVietnameseShow(originalTitle, artist || channelName);

  // 2. Clean YouTube junk and media tags
  let workingTitle = originalTitle.replace(YOUTUBE_JUNK_REGEX, ' ').trim();
  workingTitle = workingTitle.replace(TRAILING_YOUTUBE_JUNK_REGEX, '').trim();

  // Strip whole show bracket (e.g. [ATSH], [ATVNCG], [RAP VIỆT 2024], [OST MAI])
  if (show) {
    workingTitle = workingTitle.replace(show.bracketPattern, ' ').trim();
  }
  // Strip any other generic [OST ...], [MV], [LIVE ...] brackets at the start
  workingTitle = workingTitle.replace(/^\[[^\]]+\]\s*/g, '').trim();

  // Clean channel name
  let cleanedChannel = (channelName || '').trim();
  cleanedChannel = cleanedChannel.replace(/\s*-\s*Topic$/i, '').trim();
  cleanedChannel = cleanedChannel.replace(/\s*(?:Official|VEVO|Channel|Music|Entertainment|Records|TV|Media|Studio)$/i, '').trim();

  // 3. Handle suggestedArtist if provided explicitly
  if (
    suggestedArtist &&
    suggestedArtist.trim() &&
    !['nghệ sĩ chưa rõ', 'unknown artist', 'random_all'].includes(suggestedArtist.toLowerCase())
  ) {
    const baseArtist = suggestedArtist.trim();
    const structured = parseArtistsStructured(baseArtist, workingTitle);

    const separators = [' - ', ' – ', ' — ', ' | ', ' // '];
    for (const sep of separators) {
      if (workingTitle.includes(sep)) {
        const parts = workingTitle.split(sep);
        if (parts[0].toLowerCase().includes(baseArtist.toLowerCase())) {
          workingTitle = parts.slice(1).join(' ').trim();
          break;
        }
      }
    }

    workingTitle = workingTitle.replace(FEAT_ARTIST_REGEX, '').replace(PRODUCER_REGEX, '').replace(STAGE_ROUND_REGEX, '').trim();
    workingTitle = cleanEnclosingPunctuation(workingTitle);

    const determinedAlbum = show
      ? show.canonicalName
      : (movieTitle ? `${movieTitle} (Original Soundtrack)` : (structured.primaryArtists[0] || 'YouTube Music'));

    return {
      title: formatVietnameseTitleCase(workingTitle || originalTitle),
      artist: structured.formattedArtistString,
      artists: structured.allArtists,
      album: determinedAlbum,
      isRecognizedShow: !!show,
      showCatalogItem: show,
      showStageRound: stageOrRound,
      primaryArtists: structured.primaryArtists,
      featuredArtists: structured.featuredArtists,
      producers: structured.producers,
    };
  }

  // 4. Multi-Segment decomposition:
  // Split by pipe '|' or '//' first
  const pipeParts = workingTitle.split(/\s*(?:\||\/\/)\s*/).map((p) => cleanEnclosingPunctuation(p)).filter(Boolean);

  // Filter out standalone stage/round segments (e.g. 'BẢNG A', 'TẬP 5', 'CÔNG DIỄN 1')
  const contentSegments: string[] = [];
  for (const part of pipeParts) {
    if (part.replace(STAGE_ROUND_REGEX, '').trim().length > 0) {
      contentSegments.push(part);
    }
  }

  let finalRawArtist = '';
  let finalRawTitle = '';

  // Case A: A segment contains hyphen '-' / '–' / '—'
  let foundHyphenSegment = contentSegments.find((s) => /\s+[-–—]\s+/.test(s));

  if (foundHyphenSegment) {
    const subParts = foundHyphenSegment.split(/\s+[-–—]\s+/).map((p) => cleanEnclosingPunctuation(p)).filter(Boolean);
    if (subParts.length >= 2) {
      const score0 = scoreArtistVsTitle(subParts[0]);
      const score1 = scoreArtistVsTitle(subParts[1]);

      if (score1.artistScore > score0.artistScore && score0.titleScore >= score1.titleScore) {
        // subParts[0] là Title, subParts[1] là Artist (ví dụ: Nếu Như Ta Chẳng Còn (feat...) - MCK)
        finalRawTitle = subParts[0];
        finalRawArtist = subParts.slice(1).join(' - ');
      } else if (score0.artistScore > score1.artistScore && score1.titleScore >= score0.titleScore) {
        // subParts[0] là Artist, subParts[1] là Title (ví dụ: MCK - Nếu Như Ta Chẳng Còn (feat...))
        finalRawArtist = subParts[0];
        finalRawTitle = subParts.slice(1).join(' - ');
      } else if (show) {
        // Show được nhận diện: Mặc định Title - Artist
        finalRawTitle = subParts[0];
        finalRawArtist = subParts.slice(1).join(' - ');
      } else {
        // Mặc định chuẩn âm nhạc quốc tế: Artist - Title
        finalRawArtist = subParts[0];
        finalRawTitle = subParts.slice(1).join(' - ');
      }
    }
  } else if (contentSegments.length >= 2) {
    // Case B: Pipe separated segments: Artist | Title or Title | Artist
    const score0 = scoreArtistVsTitle(contentSegments[0]);
    const score1 = scoreArtistVsTitle(contentSegments[1]);

    if (score0.artistScore > score1.artistScore) {
      finalRawArtist = contentSegments[0];
      finalRawTitle = contentSegments.slice(1).join(' ');
    } else if (score1.artistScore > score0.artistScore) {
      finalRawTitle = contentSegments[0];
      finalRawArtist = contentSegments.slice(1).join(' ');
    } else {
      finalRawTitle = contentSegments[0];
      finalRawArtist = contentSegments.slice(1).join(' ');
    }
  } else if (contentSegments.length === 1) {
    finalRawTitle = contentSegments[0];
  } else {
    finalRawTitle = workingTitle;
  }

  // Fallback artist if not found in title
  if (!finalRawArtist) {
    if (artist && !['youtube music', 'nghệ sĩ chưa rõ', 'unknown artist'].includes(artist.toLowerCase())) {
      finalRawArtist = artist;
    } else if (cleanedChannel) {
      finalRawArtist = cleanedChannel;
    }
  }

  // Clean title from stage/rounds and feat/prod keywords
  finalRawTitle = finalRawTitle
    .replace(STAGE_ROUND_REGEX, ' ')
    .replace(FEAT_ARTIST_REGEX, ' ')
    .replace(PRODUCER_REGEX, ' ')
    .trim();
  finalRawTitle = cleanEnclosingPunctuation(finalRawTitle);

  // Structure artists
  const structured = parseArtistsStructured(finalRawArtist || cleanedChannel || 'Nghệ sĩ chưa rõ', originalTitle);

  let determinedAlbum = show ? show.canonicalName : 'YouTube Stream / Single';
  if (movieTitle) {
    determinedAlbum = `${formatVietnameseTitleCase(movieTitle)} (Original Soundtrack)`;
  } else if (!show && structured.primaryArtists.length === 1 && structured.primaryArtists[0] !== 'Nghệ sĩ chưa rõ') {
    determinedAlbum = `${structured.primaryArtists[0]} - Single`;
  }

  return {
    title: formatVietnameseTitleCase(finalRawTitle || workingTitle || originalTitle),
    artist: structured.formattedArtistString,
    artists: structured.allArtists,
    album: determinedAlbum,
    isRecognizedShow: !!show,
    showCatalogItem: show,
    showStageRound: stageOrRound,
    primaryArtists: structured.primaryArtists,
    featuredArtists: structured.featuredArtists,
    producers: structured.producers,
  };
}

// ============================================================================
// 6. >= 95% FUZZY ALBUM SIMILARITY & CLUSTERING ENGINE
// ============================================================================

/**
 * Calculates Levenshtein edit distance between two strings with O(min(N, M)) memory:
 */
export function calculateLevenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  let v0 = new Int32Array(s2.length + 1);
  let v1 = new Int32Array(s2.length + 1);

  for (let i = 0; i <= s2.length; i++) {
    v0[i] = i;
  }

  for (let i = 0; i < s1.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < s2.length; j++) {
      const cost = s1.charAt(i) === s2.charAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= s2.length; j++) {
      v0[j] = v1[j];
    }
  }

  return v1[s2.length];
}

/**
 * Normalized Levenshtein similarity ratio between 0.0 and 1.0:
 */
export function normalizedLevenshteinRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = calculateLevenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Strips album stopwords and punctuation for fuzzy comparison:
 */
export function cleanAlbumForComparison(albumName: string): string {
  if (!albumName) return '';

  const ALBUM_STOPWORDS = /\b(?:album|ep|single|ost|soundtrack|official|deluxe|edition|full\s*album|vol\.?\s*\d*|cd\s*\d*|part\s*\d*|t(?:ậ|a)p\s*\d*|m(?:ù|u)a\s*\d*|season\s*\d*|remastered|remaster|live\s*stage|live|chính\s*thức)\b/gi;

  let cleaned = normalizeCanonicalString(albumName);
  cleaned = cleaned.replace(ALBUM_STOPWORDS, ' ').replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Token Sort Ratio: sorts words alphabetically before computing similarity
 */
export function tokenSortRatio(s1: string, s2: string): number {
  const sorted1 = s1.split(/\s+/).filter(Boolean).sort().join(' ');
  const sorted2 = s2.split(/\s+/).filter(Boolean).sort().join(' ');
  return normalizedLevenshteinRatio(sorted1, sorted2);
}

/**
 * Token Set Ratio: compares intersection of unique tokens
 */
export function tokenSetRatio(s1: string, s2: string): number {
  const set1 = new Set(s1.split(/\s+/).filter(Boolean));
  const set2 = new Set(s2.split(/\s+/).filter(Boolean));

  const intersection: string[] = [];
  const diff1: string[] = [];
  const diff2: string[] = [];

  for (const token of set1) {
    if (set2.has(token)) {
      intersection.push(token);
    } else {
      diff1.push(token);
    }
  }

  for (const token of set2) {
    if (!set1.has(token)) {
      diff2.push(token);
    }
  }

  intersection.sort();
  diff1.sort();
  diff2.sort();

  const interStr = intersection.join(' ');
  const t1 = [interStr, ...diff1].filter(Boolean).join(' ').trim();
  const t2 = [interStr, ...diff2].filter(Boolean).join(' ').trim();

  const r1 = normalizedLevenshteinRatio(interStr, t1);
  const r2 = normalizedLevenshteinRatio(interStr, t2);
  const r3 = normalizedLevenshteinRatio(t1, t2);

  return Math.max(r1, r2, r3);
}

/**
 * Calculates >= 95% Fuzzy Album Similarity Score:
 * Considers Vietnamese Show Catalogs, Token Sets, and Levenshtein metrics.
 */
export function calculateAlbumSimilarity(
  albumA: string,
  albumB: string,
  artistA?: string,
  artistB?: string
): number {
  if (!albumA || !albumB) return 0;
  if (albumA.trim().toLowerCase() === albumB.trim().toLowerCase()) return 1.0;

  // 1. Check if both match the same Vietnamese Show Catalog
  const showA = detectVietnameseShow(albumA, artistA);
  const showB = detectVietnameseShow(albumB, artistB);
  if (showA.show && showB.show && showA.show.id === showB.show.id) {
    return 1.0; // Exact Show Catalog Match (100% confidence)
  }

  // 2. Clean both album strings
  const cleanA = cleanAlbumForComparison(albumA);
  const cleanB = cleanAlbumForComparison(albumB);

  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 1.0;

  // 3. Compute hybrid similarity score
  const levRatio = normalizedLevenshteinRatio(cleanA, cleanB);
  const sortRatio = tokenSortRatio(cleanA, cleanB);
  const setRatio = tokenSetRatio(cleanA, cleanB);

  return Math.max(levRatio, sortRatio, setRatio);
}

/**
 * Groups tracks into Unified Multi-Artist Albums with >= 95% Fuzzy Matching:
 */
export function groupTracksIntoUnifiedAlbums(tracks: Track[]): Album[] {
  if (!tracks || tracks.length === 0) return [];

  interface AlbumCluster {
    id: string;
    canonicalName: string;
    showItem?: VietnameseShowCatalogItem;
    primaryArtistCandidate: string;
    artistSet: Set<string>;
    tracks: Track[];
    picture?: string;
    year?: number;
  }

  const clusters: AlbumCluster[] = [];

  for (const track of tracks) {
    const rawAlbumName = (track.album || 'Unknown Album').trim();
    const rawArtistName = (track.artist || 'Unknown Artist').trim();

    const showDetection = detectVietnameseShow(rawAlbumName, rawArtistName);
    const parsedMeta = parseVietnameseMusicMetadata(track.title, track.artist);

    let matchedCluster: AlbumCluster | null = null;
    let highestSim = 0;

    // Check against existing clusters
    for (const cluster of clusters) {
      // If both belong to the same show catalog:
      if (
        showDetection.show &&
        cluster.showItem &&
        showDetection.show.id === cluster.showItem.id
      ) {
        matchedCluster = cluster;
        highestSim = 1.0;
        break;
      }

      // Check similarity
      const sim = calculateAlbumSimilarity(
        rawAlbumName,
        cluster.canonicalName,
        rawArtistName,
        cluster.primaryArtistCandidate
      );

      if (sim >= 0.95 && sim > highestSim) {
        highestSim = sim;
        matchedCluster = cluster;
      }
    }

    if (matchedCluster) {
      matchedCluster.tracks.push(track);
      if (!matchedCluster.picture && track.picture) {
        matchedCluster.picture = track.picture;
      }
      if (!matchedCluster.year && track.year) {
        matchedCluster.year = track.year;
      }
      for (const a of parsedMeta.primaryArtists) {
        matchedCluster.artistSet.add(a);
      }
    } else {
      const initialArtistSet = new Set<string>(parsedMeta.primaryArtists);
      const canonicalAlbumName = showDetection.show
        ? showDetection.show.canonicalName
        : formatVietnameseTitleCase(rawAlbumName);

      clusters.push({
        id: `album_${clusters.length}_${normalizeCanonicalString(canonicalAlbumName)}`,
        canonicalName: canonicalAlbumName,
        showItem: showDetection.show,
        primaryArtistCandidate: rawArtistName,
        artistSet: initialArtistSet,
        tracks: [track],
        picture: track.picture,
        year: track.year,
      });
    }
  }

  // Convert clusters into final Album entities
  return clusters.map((cluster) => {
    let finalArtist = cluster.primaryArtistCandidate;

    if (cluster.showItem) {
      finalArtist = cluster.showItem.canonicalName;
    } else if (cluster.artistSet.size > 1) {
      finalArtist = 'Various Artists';
    } else if (cluster.artistSet.size === 1) {
      finalArtist = Array.from(cluster.artistSet)[0];
    }

    return {
      id: cluster.id,
      name: cluster.canonicalName,
      artist: finalArtist,
      picture: cluster.picture,
      year: cluster.year,
      tracks: cluster.tracks,
    };
  });
}
