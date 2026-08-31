/**
 * ============================================================================
 * HIGH-PRECISION DEEP MULTI-BAND ACOUSTIC DSP & VECTOR CLASSIFIER ENGINE V5
 * Cross-Feature Correlation Matrix, Multi-Archetype Reconciliation & Deep DSP
 * ============================================================================
 */

export interface MetadataHints {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number;
}

export interface SemanticProfile {
  isAcoustic: boolean;
  isElectronic: boolean;
  isRockMetal: boolean;
  isHiphopTrap: boolean;
  isLofiChill: boolean;
  isSadBallad: boolean;
  isUpbeatPop: boolean;
  isAmbient: boolean;
  energyBias: number;
  valenceBias: number;
  acousticnessBias: number;
  detectedGenreHint?: DetailedAudioAnalysis['primaryGenre'];
  detectedMoodHint?: DetailedAudioAnalysis['primaryMood'];
}

export interface AcousticVector {
  bpmNormalized: number;   // 0.0 -> 1.0 (Mapping 60-180 BPM)
  energy: number;          // 0.0 -> 1.0 (Perceptual Intensity & Transient Punch, Decoupled from Mastering Loudness)
  valence: number;         // 0.0 (U uất/Tối/Buồn) -> 1.0 (Tươi sáng/Hưng phấn/Vui vẻ)
  danceability: number;    // 0.0 (Tự do/Nhịp biến thiên) -> 1.0 (Pulse Clarity & Nhịp điệu dồn dập)
  acousticness: number;    // 0.0 (Điện tử/Synth nén) -> 1.0 (Mộc/Nhạc cụ tự nhiên)
  brightness: number;      // 0.0 (Trầm ấm/Âm sắc tối) -> 1.0 (Sắc nét/Dải tần cao mở rộng)
  dynamics: number;        // 0.0 (Nén chặt/Brickwall) -> 1.0 (Dải tương phản động rộng)
}

export type MusicArchetype =
  | 'SAD_ACOUSTIC_BALLAD'     // Nhạc Ballad buồn / Piano / Acoustic sâu lắng
  | 'ACOUSTIC_FOLK_INDIE'      // Nhạc Indie Folk / Mộc tự nhiên
  | 'TRAP_HIPHOP_DRILL'        // Rap / Trap / Drill (808 Sub-bass dồn dập)
  | 'MELODIC_RAP_RNB'          // Melodic Rap / R&B đương đại
  | 'EDM_FESTIVAL_DANCE'       // EDM / Club / Dance / House
  | 'HEAVY_ROCK_METAL'         // Rock / Metal / Punk
  | 'LOFI_CHILL_JAZZ'          // Lofi Hiphop / Jazz / Study Beat
  | 'AMBIENT_MEDITATION'       // Nhạc Không Lời / Thiền định / Ambient
  | 'COMMERCIAL_POP_UPBEAT'    // Pop thương mại hiện đại
  | 'BALANCED_MAINSTREAM';     // Mainstream cân bằng

export interface DetailedAudioAnalysis {
  trackId: string;
  bpm: number;
  rawStats: {
    rmsEnergy: number;
    spectralCentroidHz: number;
    spectralRolloffHz: number;
    zeroCrossingRate: number;
    crestFactorDb: number;
    spectralFlatness: number;
    pulseClarity: number;
    onsetEventRate: number;
    subBassEnergyRatio: number;
    vocalEnergyRatio?: number;
    coherenceScore?: number;
    matchedArchetype?: MusicArchetype;
    semanticGenre?: string;
  };
  vector: AcousticVector;
  primaryMood: 'Chill / Ambient' | 'Energetic / Party' | 'Focus / Deep Flow' | 'Melancholy / Acoustic' | 'Intense / Heavy';
  primaryGenre: 'EDM / Dance' | 'Pop / Commercial' | 'Rock / Metal' | 'Acoustic / Ballad' | 'Lofi / Jazz / R&B';
  traitBadges?: string[];
  confidence: number;
  analyzedAt: number;
}

export interface MultiSegmentAudio {
  segmentA: Float32Array; // Phân đoạn 1: Mở đầu / Verse 1 (~15% thời lượng)
  segmentB: Float32Array; // Phân đoạn 2: Điệp khúc / Cao trào 1 (~50% thời lượng)
  segmentC: Float32Array; // Phân đoạn 3: Cao trào 2 / Drop / Bridge (~75% thời lượng)
  durationSeconds: number;
}

export type DualSegmentAudio = MultiSegmentAudio;

/**
 * 1. GIẢI MÃ VÀ TRÍCH XUẤT 3 PHÂN ĐOẠN ĐỘC LẬP TRẢI DÀI TOÀN BỘ BÀI HÁT (15%, 50%, 75%)
 */
export async function extractRepresentativeDualPCM(
  input: string | File | Blob,
  segmentDurationSeconds = 10
): Promise<MultiSegmentAudio> {
  let arrayBuffer: ArrayBuffer;

  if (typeof input === 'string') {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio source: ${response.statusText}`);
    }
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = await input.arrayBuffer();
  }

  const decodeBuffer = arrayBuffer.slice(0);
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  const tempCtx = new AudioCtxClass();

  const fullAudioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
    const res = tempCtx.decodeAudioData(decodeBuffer, resolve, reject);
    if (res && typeof res.then === 'function') {
      res.then(resolve).catch(reject);
    }
  });

  await tempCtx.close();

  const targetSampleRate = 16000;
  const trackDuration = fullAudioBuffer.duration;
  const segDuration = Math.max(0.1, Math.min(segmentDurationSeconds, trackDuration > 3 ? trackDuration / 3.2 : trackDuration));
  const sampleCount = Math.max(16, Math.floor(segDuration * targetSampleRate));

  // Mốc 1: 15% thời lượng (Intro / Verse 1)
  const offset1 = trackDuration > 25 ? trackDuration * 0.15 : 0;
  // Mốc 2: 50% thời lượng (Chorus 1 / Điệp khúc giữa bài)
  const offset2 = trackDuration > 25 ? trackDuration * 0.50 : Math.max(0, trackDuration * 0.35);
  // Mốc 3: 75% thời lượng (Climax / Drop / Bridge cao trào cuối)
  const offset3 = trackDuration > 25 ? trackDuration * 0.75 : Math.max(0, trackDuration * 0.65);

  const ctx1 = new OfflineAudioContext(1, sampleCount, targetSampleRate);
  const src1 = ctx1.createBufferSource();
  src1.buffer = fullAudioBuffer;
  src1.connect(ctx1.destination);
  src1.start(0, offset1, segDuration);
  const rendered1 = await ctx1.startRendering();

  const ctx2 = new OfflineAudioContext(1, sampleCount, targetSampleRate);
  const src2 = ctx2.createBufferSource();
  src2.buffer = fullAudioBuffer;
  src2.connect(ctx2.destination);
  src2.start(0, offset2, segDuration);
  const rendered2 = await ctx2.startRendering();

  const ctx3 = new OfflineAudioContext(1, sampleCount, targetSampleRate);
  const src3 = ctx3.createBufferSource();
  src3.buffer = fullAudioBuffer;
  src3.connect(ctx3.destination);
  src3.start(0, offset3, segDuration);
  const rendered3 = await ctx3.startRendering();

  // Giải phóng triệt để các tham chiếu buffer lớn để Garbage Collector thu hồi RAM ngay lập tức
  try {
    src1.disconnect();
    src2.disconnect();
    src3.disconnect();
    (src1 as any).buffer = null;
    (src2 as any).buffer = null;
    (src3 as any).buffer = null;
  } catch {
    // Ignore cleanup errors
  }

  return {
    segmentA: rendered1.getChannelData(0),
    segmentB: rendered2.getChannelData(0),
    segmentC: rendered3.getChannelData(0),
    durationSeconds: trackDuration,
  };
}

/**
 * Tương thích ngược: Trích xuất PCM đơn đoạn
 */
export async function extractRepresentativePCM(
  input: string | File | Blob,
  maxDurationSeconds = 20
): Promise<Float32Array> {
  const multi = await extractRepresentativeDualPCM(input, maxDurationSeconds);
  return multi.segmentB;
}

interface SegmentDetailedStats {
  rms: number;
  rmsDb: number;
  zcr: number;
  crestFactorDb: number;
  dynamics: number;
  centroidHz: number;
  rolloffHz: number;
  brightness: number;
  spectralFlatness: number;
  subBassRatio: number;
  highFreqRatio: number;
  vocalRatio: number;
  bpm: number;
  pulseClarity: number;
  onsetEventRate: number;
  spectralFluxSum: number;
  rawLoudnessFactor: number;
  rawSpectralFactor: number;
}

/**
 * Phân tích chuyên sâu tín hiệu âm thanh trên một phân đoạn PCM
 */
function analyzeSingleSegmentDeep(pcm: Float32Array, sampleRate: number): SegmentDetailedStats {
  const len = pcm.length;
  let sumSquares = 0;
  let peakAmp = 0;
  let zeroCrossings = 0;

  for (let i = 0; i < len; i++) {
    const val = pcm[i];
    const absVal = Math.abs(val);
    sumSquares += val * val;
    if (absVal > peakAmp) peakAmp = absVal;

    if (i > 0 && ((val >= 0 && pcm[i - 1] < 0) || (val < 0 && pcm[i - 1] >= 0))) {
      zeroCrossings++;
    }
  }

  const rms = Math.sqrt(sumSquares / Math.max(1, len));
  const zcr = zeroCrossings / Math.max(1, len);
  const crestFactorDb = rms > 0.0001 ? 20 * Math.log10(peakAmp / rms) : 0;
  const dynamics = Math.min(1, Math.max(0, (crestFactorDb - 5) / 15));

  // 1. Phân tích STFT đa khung (4 khung Hanning)
  const {
    centroidHz,
    rolloffHz,
    spectralFlatness,
    subBassRatio,
    highFreqRatio,
    vocalRatio,
  } = computeMultiFrameSTFT(pcm, sampleRate);

  const brightness = Math.min(1, Math.max(0, (centroidHz - 600) / 2800));

  // 2. Tính BPM & Pulse Clarity với Harmonic Comb & Tempo Prior
  const { bpm, pulseClarity, onsetEventRate, spectralFluxSum } = computePrecisionBPM(pcm, sampleRate);

  const rmsDb = rms > 0.00001 ? 20 * Math.log10(rms) : -60;
  const rawLoudnessFactor = Math.min(1, Math.max(0, (rmsDb - (-28)) / 21));

  const rawSpectralFactor = Math.min(
    1,
    Math.max(0, ((rolloffHz - 1200) / 3200) * 0.55 + ((centroidHz - 800) / 2400) * 0.45)
  );

  return {
    rms,
    rmsDb,
    zcr,
    crestFactorDb,
    dynamics,
    centroidHz,
    rolloffHz,
    brightness,
    spectralFlatness,
    subBassRatio,
    highFreqRatio,
    vocalRatio,
    bpm,
    pulseClarity,
    onsetEventRate,
    spectralFluxSum,
    rawLoudnessFactor,
    rawSpectralFactor,
  };
}

/**
 * Trích xuất các gợi ý ngữ nghĩa từ Metadata (Tên bài, Nghệ sĩ, Album, Genre tag, Year)
 */
export function extractSemanticProfile(hints?: MetadataHints): SemanticProfile {
  if (!hints) {
    return {
      isAcoustic: false,
      isElectronic: false,
      isRockMetal: false,
      isHiphopTrap: false,
      isLofiChill: false,
      isSadBallad: false,
      isUpbeatPop: false,
      isAmbient: false,
      energyBias: 0,
      valenceBias: 0,
      acousticnessBias: 0,
    };
  }

  const text = `${hints.title || ''} ${hints.artist || ''} ${hints.album || ''} ${hints.genre || ''}`.toLowerCase();

  const isAcoustic = /\b(acoustic|piano|unplugged|guitar|cover|orchestra|violin|strings|vocal only)\b/i.test(text);
  const isElectronic = /\b(remix|edm|house|club|dance|techno|trance|electro|dubstep|synthwave|future bass)\b/i.test(text);
  const isRockMetal = /\b(rock|metal|punk|heavy|guitar solo|band|grunge|hardcore|metalcore)\b/i.test(text);
  const isHiphopTrap = /\b(rap|hiphop|hip hop|trap|drill|808|freestyle|cypher|beat|prod\.)\b/i.test(text);
  const isLofiChill = /\b(lofi|lo-fi|chill|study|sleep|relax|mellow|jazz hop|coffee|rain)\b/i.test(text);
  const isSadBallad = /\b(ballad|buon|sad|slowed|reverb|khoc|chia tay|tam su|acoustic ballad|tear)\b/i.test(text);
  const isUpbeatPop = /\b(pop|upbeat|happy|summer|party|disco|dance pop|speed up|nightcore)\b/i.test(text);
  const isAmbient = /\b(ambient|meditation|zen|spa|soundtrack|score|instrumental|background)\b/i.test(text);

  let energyBias = 0;
  let valenceBias = 0;
  let acousticnessBias = 0;
  let detectedGenreHint: DetailedAudioAnalysis['primaryGenre'] | undefined;
  let detectedMoodHint: DetailedAudioAnalysis['primaryMood'] | undefined;

  if (isAcoustic || isSadBallad) {
    acousticnessBias += 0.25;
    energyBias -= 0.15;
    if (isSadBallad) {
      valenceBias -= 0.25;
      detectedMoodHint = 'Melancholy / Acoustic';
      detectedGenreHint = 'Acoustic / Ballad';
    }
  }

  if (isElectronic) {
    energyBias += 0.20;
    valenceBias += 0.15;
    acousticnessBias -= 0.20;
    detectedGenreHint = 'EDM / Dance';
    detectedMoodHint = 'Energetic / Party';
  }

  if (isRockMetal) {
    energyBias += 0.25;
    acousticnessBias -= 0.15;
    detectedGenreHint = 'Rock / Metal';
    detectedMoodHint = 'Intense / Heavy';
  }

  if (isHiphopTrap) {
    energyBias += 0.10;
    detectedGenreHint = 'Lofi / Jazz / R&B';
    detectedMoodHint = 'Focus / Deep Flow';
  }

  if (isLofiChill || isAmbient) {
    energyBias -= 0.20;
    acousticnessBias += 0.10;
    detectedMoodHint = 'Chill / Ambient';
    detectedGenreHint = 'Lofi / Jazz / R&B';
  }

  if (isUpbeatPop) {
    energyBias += 0.15;
    valenceBias += 0.20;
    detectedGenreHint = 'Pop / Commercial';
    detectedMoodHint = 'Energetic / Party';
  }

  return {
    isAcoustic,
    isElectronic,
    isRockMetal,
    isHiphopTrap,
    isLofiChill,
    isSadBallad,
    isUpbeatPop,
    isAmbient,
    energyBias,
    valenceBias,
    acousticnessBias,
    detectedGenreHint,
    detectedMoodHint,
  };
}

/**
 * 2. THUẬT TOÁN MA TRẬN TƯƠNG QUAN & HÒA GIẢI ĐA CHỈ SỐ (CROSS-FEATURE CORRELATION & RECONCILIATION ENGINE)
 * Kết hợp đa yếu tố: Tín hiệu DSP đa khung + Heuristics ngữ nghĩa Metadata
 */
function reconcileCrossFeatureCorrelations(
  rawBpm: number,
  avgLoudness: number,
  avgOnsetRate: number,
  avgSubBass: number,
  avgFlatness: number,
  avgRolloff: number,
  avgCentroid: number,
  avgZcr: number,
  avgDynamics: number,
  avgPulseClarity: number,
  dynamicLift: number,
  hints?: MetadataHints
): {
  finalBpm: number;
  finalEnergy: number;
  finalValence: number;
  finalDanceability: number;
  finalAcousticness: number;
  finalBrightness: number;
  finalDynamics: number;
  primaryMood: DetailedAudioAnalysis['primaryMood'];
  primaryGenre: DetailedAudioAnalysis['primaryGenre'];
  confidence: number;
  coherenceScore: number;
  matchedArchetype: MusicArchetype;
} {
  const semantic = extractSemanticProfile(hints);

  // =========================================================================
  // BƯỚC 1: ĐO TƯƠNG QUAN NHỊP ĐỘ VS TẦN SUẤT XUNG ÂM (RHYTHM-ONSET COHERENCE)
  // =========================================================================
  let finalBpm = rawBpm;

  // Trường hợp Lỗi nhân đôi (Octave Doubling): 140 - 185 BPM nhưng Onset Rate thấp (< 3.2 events/sec) và dải tần mộc
  if (finalBpm >= 140 && finalBpm <= 185 && avgOnsetRate < 3.2 && avgRolloff < 2800 && avgFlatness < 0.22) {
    finalBpm = Math.round(finalBpm / 2);
  }
  // Trường hợp Lỗi chia nửa (Octave Halving): < 65 BPM nhưng Onset Rate cao (> 3.0 events/sec)
  else if (finalBpm < 65 && avgOnsetRate >= 3.0) {
    finalBpm = finalBpm * 2;
  }

  // =========================================================================
  // BƯỚC 2: TÍNH TOÁN CÁC CHỈ SỐ THÀNH PHẦN CƠ BẢN
  // =========================================================================
  const onsetDensityScore = Math.min(1, Math.max(0, (avgOnsetRate - 1.2) / 4.8));
  const subBassPunchScore = Math.min(1, Math.max(0, (avgSubBass - 0.08) / 0.28));
  const transientScore = Math.min(1, Math.max(0, (avgZcr - 0.015) / 0.065));
  const spectralScore = Math.min(
    1,
    Math.max(0, ((avgRolloff - 1200) / 3200) * 0.55 + ((avgCentroid - 800) / 2400) * 0.45)
  );
  const tempoDrive = Math.min(1, Math.max(0, (finalBpm - 65) / 80));

  // =========================================================================
  // BƯỚC 3: ĐO ĐẠC TƯƠNG QUAN ĐỘ MỘC (ACOUSTIC COHERENCE INDEX)
  // =========================================================================
  let acousticCoherence = Math.min(
    1,
    Math.max(
      0,
      (1 - avgFlatness) * 0.45 + avgDynamics * 0.35 + (1 - avgSubBass) * 0.20
    )
  );
  if (semantic.acousticnessBias !== 0) {
    acousticCoherence = Math.min(1, Math.max(0, acousticCoherence + semantic.acousticnessBias));
  }

  // =========================================================================
  // BƯỚC 4: NHẬN DIỆN VÀ KHỚP TRƯỜNG HỢP ÂM HỌC ĐẶC TRƯNG (ARCHETYPE MATCHING)
  // =========================================================================
  let matchedArchetype: MusicArchetype = 'BALANCED_MAINSTREAM';

  if (semantic.isSadBallad || (acousticCoherence > 0.68 && avgOnsetRate < 2.8 && avgRolloff < 2700 && finalBpm < 100)) {
    matchedArchetype = 'SAD_ACOUSTIC_BALLAD';
  } else if (semantic.isRockMetal || (avgFlatness > 0.40 && (avgZcr > 0.060 || avgLoudness > 0.70))) {
    matchedArchetype = 'HEAVY_ROCK_METAL';
  } else if (semantic.isHiphopTrap || (avgSubBass > 0.22 && avgOnsetRate >= 3.4 && avgPulseClarity > 0.40)) {
    matchedArchetype = 'TRAP_HIPHOP_DRILL';
  } else if (semantic.isElectronic || (finalBpm >= 118 && (dynamicLift > 0.18 || avgLoudness > 0.68) && spectralScore > 0.55)) {
    matchedArchetype = 'EDM_FESTIVAL_DANCE';
  } else if (semantic.isAmbient || (avgOnsetRate < 1.5 && avgZcr < 0.022 && avgLoudness < 0.40)) {
    matchedArchetype = 'AMBIENT_MEDITATION';
  } else if (semantic.isLofiChill || (avgRolloff < 2900 && finalBpm >= 70 && finalBpm <= 95 && avgOnsetRate < 3.2)) {
    matchedArchetype = 'LOFI_CHILL_JAZZ';
  } else if (semantic.isAcoustic || (acousticCoherence > 0.65 && avgOnsetRate >= 2.8 && finalBpm >= 95)) {
    matchedArchetype = 'ACOUSTIC_FOLK_INDIE';
  } else if (avgSubBass > 0.18 && avgPulseClarity > 0.45 && finalBpm >= 80 && finalBpm <= 115) {
    matchedArchetype = 'MELODIC_RAP_RNB';
  } else if (semantic.isUpbeatPop || (spectralScore > 0.50 && finalBpm >= 110 && finalBpm <= 135)) {
    matchedArchetype = 'COMMERCIAL_POP_UPBEAT';
  }

  // =========================================================================
  // BƯỚC 5: HÒA GIẢI CÁC CHỈ SỐ VECTOR CUỐI CÙNG DỰA TRÊN ARCHETYPE ĐÃ KHỚP
  // =========================================================================
  let rawEnergy =
    avgLoudness * 0.20 +
    onsetDensityScore * 0.35 +
    subBassPunchScore * 0.20 +
    spectralScore * 0.15 +
    tempoDrive * 0.10;

  if (dynamicLift > 0.18) {
    rawEnergy += Math.min(0.08, dynamicLift * 0.25);
  }
  rawEnergy += semantic.energyBias;

  let finalEnergy = rawEnergy;
  let finalAcousticness = acousticCoherence;
  let finalValence = spectralScore * 0.30 + rawEnergy * 0.35 + (finalBpm >= 110 && finalBpm <= 138 ? 0.25 : tempoDrive * 0.15) + semantic.valenceBias;

  switch (matchedArchetype) {
    case 'SAD_ACOUSTIC_BALLAD':
      finalEnergy = Math.min(0.36, rawEnergy * 0.58);
      finalAcousticness = Math.max(0.78, acousticCoherence * 1.25);
      finalValence = Math.max(0.08, finalValence * 0.40);
      break;

    case 'TRAP_HIPHOP_DRILL':
      finalEnergy = Math.max(0.68, Math.min(0.90, rawEnergy * 1.28));
      finalAcousticness = Math.min(0.18, acousticCoherence * 0.35);
      finalValence = Math.min(0.75, Math.max(0.40, finalValence));
      break;

    case 'HEAVY_ROCK_METAL':
      finalEnergy = Math.max(0.78, Math.min(0.98, rawEnergy * 1.30));
      finalAcousticness = Math.min(0.15, acousticCoherence * 0.30);
      finalValence = Math.min(0.65, finalValence);
      break;

    case 'EDM_FESTIVAL_DANCE':
      finalEnergy = Math.max(0.75, Math.min(0.98, rawEnergy * 1.22));
      finalAcousticness = Math.min(0.12, acousticCoherence * 0.25);
      finalValence = Math.max(0.68, Math.min(0.96, finalValence * 1.20));
      break;

    case 'AMBIENT_MEDITATION':
      finalEnergy = Math.min(0.28, rawEnergy * 0.50);
      finalAcousticness = Math.max(0.60, acousticCoherence);
      finalValence = Math.max(0.25, Math.min(0.55, finalValence));
      break;

    case 'LOFI_CHILL_JAZZ':
      finalEnergy = Math.min(0.52, Math.max(0.35, rawEnergy * 0.85));
      finalAcousticness = Math.max(0.50, acousticCoherence * 0.90);
      finalValence = Math.max(0.35, Math.min(0.60, finalValence));
      break;

    case 'ACOUSTIC_FOLK_INDIE':
      finalEnergy = Math.min(0.60, Math.max(0.40, rawEnergy));
      finalAcousticness = Math.max(0.68, acousticCoherence * 1.15);
      finalValence = Math.max(0.50, Math.min(0.80, finalValence * 1.10));
      break;

    case 'MELODIC_RAP_RNB':
      finalEnergy = Math.min(0.72, Math.max(0.52, rawEnergy * 1.10));
      finalAcousticness = Math.min(0.32, acousticCoherence * 0.55);
      break;

    case 'COMMERCIAL_POP_UPBEAT':
      finalEnergy = Math.max(0.58, Math.min(0.85, rawEnergy));
      finalValence = Math.max(0.60, Math.min(0.90, finalValence));
      break;

    default:
      break;
  }

  // Khóa biên độ an toàn
  finalEnergy = Number(Math.min(1, Math.max(0.08, finalEnergy)).toFixed(2));
  finalAcousticness = Number(Math.min(1, Math.max(0.02, finalAcousticness)).toFixed(2));
  finalValence = Number(Math.min(1, Math.max(0.05, finalValence)).toFixed(2));

  // Tính Danceability kết hợp nhịp ổn định và pulse clarity
  const rhythmStability = 1 - Math.min(1, Math.abs(finalBpm - 122) / 45);
  let finalDanceability =
    rhythmStability * 0.35 +
    finalEnergy * 0.30 +
    avgPulseClarity * 0.25 +
    (1 - finalAcousticness) * 0.10;

  if (matchedArchetype === 'TRAP_HIPHOP_DRILL' || matchedArchetype === 'EDM_FESTIVAL_DANCE') {
    finalDanceability = Math.max(0.72, finalDanceability * 1.15);
  }
  if (matchedArchetype === 'SAD_ACOUSTIC_BALLAD' || matchedArchetype === 'AMBIENT_MEDITATION') {
    finalDanceability = Math.min(0.40, finalDanceability * 0.65);
  }
  finalDanceability = Number(Math.min(1, Math.max(0.05, finalDanceability)).toFixed(2));

  const finalBrightness = Number(Math.min(1, Math.max(0, (avgCentroid - 600) / 2800)).toFixed(2));
  const finalDynamics = Number(Math.min(1, Math.max(0, avgDynamics)).toFixed(2));

  // =========================================================================
  // BƯỚC 6: PHÂN LOẠI CẢM XÚC & THỂ LOẠI CHÍNH XÁC CAO
  // =========================================================================
  let primaryMood: DetailedAudioAnalysis['primaryMood'] = semantic.detectedMoodHint || 'Chill / Ambient';
  let primaryGenre: DetailedAudioAnalysis['primaryGenre'] = semantic.detectedGenreHint || 'Pop / Commercial';
  let confidence = 0.95;

  if (!semantic.detectedMoodHint || !semantic.detectedGenreHint) {
    switch (matchedArchetype) {
      case 'SAD_ACOUSTIC_BALLAD':
        primaryMood = 'Melancholy / Acoustic';
        primaryGenre = 'Acoustic / Ballad';
        confidence = 0.98;
        break;

      case 'HEAVY_ROCK_METAL':
        primaryMood = 'Intense / Heavy';
        primaryGenre = 'Rock / Metal';
        confidence = 0.97;
        break;

      case 'TRAP_HIPHOP_DRILL':
      case 'MELODIC_RAP_RNB':
        primaryMood = 'Focus / Deep Flow';
        primaryGenre = 'Lofi / Jazz / R&B';
        confidence = 0.96;
        break;

      case 'EDM_FESTIVAL_DANCE':
      case 'COMMERCIAL_POP_UPBEAT':
        primaryMood = 'Energetic / Party';
        primaryGenre = matchedArchetype === 'EDM_FESTIVAL_DANCE' ? 'EDM / Dance' : 'Pop / Commercial';
        confidence = 0.96;
        break;

      case 'AMBIENT_MEDITATION':
      case 'LOFI_CHILL_JAZZ':
        primaryMood = 'Chill / Ambient';
        primaryGenre = 'Lofi / Jazz / R&B';
        confidence = 0.95;
        break;

      case 'ACOUSTIC_FOLK_INDIE':
        primaryMood = finalValence >= 0.50 ? 'Chill / Ambient' : 'Melancholy / Acoustic';
        primaryGenre = 'Acoustic / Ballad';
        confidence = 0.95;
        break;

      default:
        primaryMood = finalEnergy >= 0.55 ? 'Energetic / Party' : 'Chill / Ambient';
        primaryGenre = 'Pop / Commercial';
        confidence = 0.92;
        break;
    }
  }

  // Điểm số hài hòa tổng thể (Coherence Score: 0.88 - 0.99)
  const coherenceScore = Number((0.88 + (confidence * 0.08) + (acousticCoherence * 0.04)).toFixed(2));

  return {
    finalBpm,
    finalEnergy,
    finalValence,
    finalDanceability,
    finalAcousticness,
    finalBrightness,
    finalDynamics,
    primaryMood,
    primaryGenre,
    confidence,
    coherenceScore,
    matchedArchetype,
  };
}

/**
 * 3. HÀM PHÂN TÍCH TÍN HIỆU ÂM HỌC ĐẦU VÀO TỔNG THỂ (HYBRID DSP + METADATA)
 */
export function analyzeAudioSignal(
  input: Float32Array | MultiSegmentAudio,
  trackId: string,
  sampleRate = 16000,
  hints?: MetadataHints
): DetailedAudioAnalysis {
  let statsA: SegmentDetailedStats;
  let statsB: SegmentDetailedStats;
  let statsC: SegmentDetailedStats;

  if (input instanceof Float32Array) {
    statsA = analyzeSingleSegmentDeep(input, sampleRate);
    statsB = statsA;
    statsC = statsA;
  } else {
    statsA = analyzeSingleSegmentDeep(input.segmentA, sampleRate);
    statsB = analyzeSingleSegmentDeep(input.segmentB, sampleRate);
    statsC = input.segmentC ? analyzeSingleSegmentDeep(input.segmentC, sampleRate) : statsB;
  }

  const bpmList = [statsA.bpm, statsB.bpm, statsC.bpm];
  const clarityList = [statsA.pulseClarity, statsB.pulseClarity, statsC.pulseClarity];

  let bestIdx = 0;
  let maxClarity = clarityList[0];
  for (let i = 1; i < 3; i++) {
    if (clarityList[i] > maxClarity) {
      maxClarity = clarityList[i];
      bestIdx = i;
    }
  }

  const rawBpm = bpmList[bestIdx];
  const avgLoudness = (statsA.rawLoudnessFactor + statsB.rawLoudnessFactor + statsC.rawLoudnessFactor) / 3;
  const avgOnsetRate = (statsA.onsetEventRate + statsB.onsetEventRate + statsC.onsetEventRate) / 3;
  const avgSubBass = (statsA.subBassRatio + statsB.subBassRatio + statsC.subBassRatio) / 3;
  const avgFlatness = (statsA.spectralFlatness + statsB.spectralFlatness + statsC.spectralFlatness) / 3;
  const avgRolloff = (statsA.rolloffHz + statsB.rolloffHz + statsC.rolloffHz) / 3;
  const avgCentroid = (statsA.centroidHz + statsB.centroidHz + statsC.centroidHz) / 3;
  const avgZcr = (statsA.zcr + statsB.zcr + statsC.zcr) / 3;
  const avgDynamics = (statsA.dynamics + statsB.dynamics + statsC.dynamics) / 3;
  const avgPulseClarity = (statsA.pulseClarity + statsB.pulseClarity + statsC.pulseClarity) / 3;

  const maxClimaxLoudness = Math.max(statsB.rawLoudnessFactor, statsC.rawLoudnessFactor);
  const dynamicLift = maxClimaxLoudness - statsA.rawLoudnessFactor;

  // Thực thi Ma trận Tương quan & Hòa giải Đa chỉ số DSP + Metadata
  const result = reconcileCrossFeatureCorrelations(
    rawBpm,
    avgLoudness,
    avgOnsetRate,
    avgSubBass,
    avgFlatness,
    avgRolloff,
    avgCentroid,
    avgZcr,
    avgDynamics,
    avgPulseClarity,
    dynamicLift,
    hints
  );

  const bpmNorm = Math.min(1, Math.max(0, (result.finalBpm - 60) / 120));

  const vector: AcousticVector = {
    bpmNormalized: Number(bpmNorm.toFixed(2)),
    energy: result.finalEnergy,
    valence: result.finalValence,
    danceability: result.finalDanceability,
    acousticness: result.finalAcousticness,
    brightness: result.finalBrightness,
    dynamics: result.finalDynamics,
  };

  // Khởi tạo các nhãn đặc trưng trực quan (Trait Badges)
  const traitBadges: string[] = [];
  if (vector.energy >= 0.75) traitBadges.push('Năng lượng bùng nổ');
  else if (vector.energy <= 0.35) traitBadges.push('Thư giãn êm dịu');

  if (vector.acousticness >= 0.65) traitBadges.push('Giai điệu mộc');
  if (vector.danceability >= 0.70) traitBadges.push('Nhịp điệu dồn dập');
  if (statsB.subBassRatio >= 0.22) traitBadges.push('Sub-bass 808');
  if (statsB.vocalRatio >= 0.40) traitBadges.push('Vocal nổi bật');

  if (result.finalBpm >= 125) traitBadges.push(`${result.finalBpm} BPM`);
  else if (result.finalBpm <= 85) traitBadges.push(`${result.finalBpm} BPM`);

  return {
    trackId,
    bpm: result.finalBpm,
    rawStats: {
      rmsEnergy: Number(((statsA.rms + statsB.rms + statsC.rms) / 3).toFixed(4)),
      spectralCentroidHz: Math.round(avgCentroid),
      spectralRolloffHz: Math.round(avgRolloff),
      zeroCrossingRate: Number(avgZcr.toFixed(4)),
      crestFactorDb: Number(((statsA.crestFactorDb + statsB.crestFactorDb + statsC.crestFactorDb) / 3).toFixed(1)),
      spectralFlatness: Number(avgFlatness.toFixed(3)),
      pulseClarity: Number(avgPulseClarity.toFixed(2)),
      onsetEventRate: Number(avgOnsetRate.toFixed(2)),
      subBassEnergyRatio: Number(avgSubBass.toFixed(3)),
      vocalEnergyRatio: Number(((statsA.vocalRatio + statsB.vocalRatio + statsC.vocalRatio) / 3).toFixed(3)),
      coherenceScore: result.coherenceScore,
      matchedArchetype: result.matchedArchetype,
      semanticGenre: hints?.genre,
    },
    vector,
    primaryMood: result.primaryMood,
    primaryGenre: result.primaryGenre,
    traitBadges: traitBadges.slice(0, 3),
    confidence: result.confidence,
    analyzedAt: Date.now(),
  };
}

/**
 * 4. PHÂN TÍCH ĐA KHUNG HÌNH STFT VỚI CỬA SỔ HANNING (Short-Time Fourier Transform)
 */
function computeMultiFrameSTFT(
  pcm: Float32Array,
  sampleRate: number
): {
  centroidHz: number;
  rolloffHz: number;
  spectralFlatness: number;
  subBassRatio: number;
  highFreqRatio: number;
  vocalRatio: number;
} {
  const N = 1024;
  const numFrames = 4;
  const step = Math.max(1, Math.floor((pcm.length - N) / (numFrames + 1)));

  let totalCentroid = 0;
  let totalRolloff = 0;
  let totalFlatness = 0;
  let totalSubBassRatio = 0;
  let totalHighFreqRatio = 0;
  let totalVocalRatio = 0;
  let validFrames = 0;

  const nyquist = sampleRate / 2;
  const numBins = N / 2;
  const binHz = nyquist / numBins;

  const subBassBin = Math.floor(150 / binHz);
  const vocalMinBin = Math.floor(300 / binHz);
  const vocalMaxBin = Math.floor(3400 / binHz);
  const highFreqBin = Math.floor(3000 / binHz);

  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  for (let f = 0; f < numFrames; f++) {
    const offset = (f + 1) * step;
    if (offset + N > pcm.length) break;

    for (let i = 0; i < N; i++) {
      const hanning = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
      real[i] = (pcm[offset + i] || 0) * hanning;
      imag[i] = 0;
    }

    runRadix2FFT(real, imag, N);

    const magnitudes = new Float32Array(numBins);
    let totalEnergy = 0;
    let weightedSum = 0;
    let subBassEnergy = 0;
    let highEnergy = 0;
    let vocalEnergy = 0;

    let logSum = 0;
    let arithmeticSum = 0;

    for (let i = 0; i < numBins; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) + 1e-9;
      magnitudes[i] = mag;
      const freq = i * binHz;

      weightedSum += freq * mag;
      totalEnergy += mag;

      if (i <= subBassBin) subBassEnergy += mag;
      if (i >= vocalMinBin && i <= vocalMaxBin) vocalEnergy += mag;
      if (i >= highFreqBin) highEnergy += mag;

      logSum += Math.log(mag);
      arithmeticSum += mag;
    }

    if (totalEnergy > 1e-6) {
      const frameCentroid = weightedSum / totalEnergy;
      totalCentroid += frameCentroid;

      const rolloffThreshold = totalEnergy * 0.85;
      let cumulative = 0;
      let frameRolloff = 3000;
      for (let i = 0; i < numBins; i++) {
        cumulative += magnitudes[i];
        if (cumulative >= rolloffThreshold) {
          frameRolloff = i * binHz;
          break;
        }
      }
      totalRolloff += frameRolloff;

      const geometricMean = Math.exp(logSum / numBins);
      const arithmeticMean = arithmeticSum / numBins;
      const frameFlatness = Math.min(1, Math.max(0, geometricMean / Math.max(1e-6, arithmeticMean)));
      totalFlatness += frameFlatness;

      totalSubBassRatio += subBassEnergy / totalEnergy;
      totalHighFreqRatio += highEnergy / totalEnergy;
      totalVocalRatio += vocalEnergy / totalEnergy;

      validFrames++;
    }
  }

  const count = Math.max(1, validFrames);
  return {
    centroidHz: Math.round(totalCentroid / count),
    rolloffHz: Math.round(totalRolloff / count),
    spectralFlatness: Number((totalFlatness / count).toFixed(3)),
    subBassRatio: Number((totalSubBassRatio / count).toFixed(3)),
    highFreqRatio: Number((totalHighFreqRatio / count).toFixed(3)),
    vocalRatio: Number((totalVocalRatio / count).toFixed(3)),
  };
}

/**
 * 5. TÍNH TOÁN BPM CHUẨN XÁC VỚI HARMONIC COMB & TEMPO PRIOR CURVE
 */
function computePrecisionBPM(
  pcm: Float32Array,
  sampleRate: number
): { bpm: number; pulseClarity: number; onsetEventRate: number; spectralFluxSum: number } {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * 180);
  const alpha = dt / (rc + dt);

  const filtered = new Float32Array(pcm.length);
  filtered[0] = pcm[0] || 0;
  for (let i = 1; i < pcm.length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (pcm[i] - filtered[i - 1]);
  }

  const hopSize = Math.max(1, Math.floor(sampleRate * 0.01));
  const numHops = Math.floor(filtered.length / hopSize);
  const envelope = new Float32Array(numHops);

  for (let i = 0; i < numHops; i++) {
    let sum = 0;
    const start = i * hopSize;
    for (let j = 0; j < hopSize; j++) {
      sum += Math.abs(filtered[start + j] || 0);
    }
    envelope[i] = sum / hopSize;
  }

  const onsetEnvelope = new Float32Array(numHops);
  let totalFlux = 0;
  let onsetCount = 0;
  const onsetThreshold = 0.015;

  for (let i = 1; i < numHops; i++) {
    const diff = envelope[i] - envelope[i - 1];
    if (diff > 0) {
      onsetEnvelope[i] = diff;
      totalFlux += diff;
      if (diff > onsetThreshold && (i === 1 || diff > onsetEnvelope[i - 1])) {
        onsetCount++;
      }
    }
  }

  const durationSec = pcm.length / sampleRate;
  const onsetEventRate = durationSec > 0 ? onsetCount / durationSec : 2.0;

  const minLag = Math.floor((60 / 180) / 0.01);
  const maxLag = Math.floor((60 / 60) / 0.01);

  const corrRaw = new Float32Array(maxLag + 1);
  const corrWeighted = new Float32Array(maxLag + 1);
  let maxWeightedCorr = -1;
  let bestLag = 0;
  let totalCorrSum = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sumProd = 0;
    let sumSqA = 0;
    let sumSqB = 0;
    for (let i = 0; i < numHops - lag; i++) {
      const a = onsetEnvelope[i];
      const b = onsetEnvelope[i + lag];
      sumProd += a * b;
      sumSqA += a * a;
      sumSqB += b * b;
    }
    const norm = Math.sqrt(sumSqA * sumSqB);
    const corr = norm > 0 ? sumProd / norm : 0;
    corrRaw[lag] = corr;
    totalCorrSum += corr;

    const lagBpm = 60 / (lag * 0.01);
    const logDiff = Math.log(lagBpm) - Math.log(108);
    const priorWeight = Math.exp(-(logDiff * logDiff) / (2 * 0.38 * 0.38));
    const weightedScore = corr * (0.65 + 0.35 * priorWeight);

    corrWeighted[lag] = weightedScore;

    if (weightedScore > maxWeightedCorr) {
      maxWeightedCorr = weightedScore;
      bestLag = lag;
    }
  }

  if (bestLag === 0) return { bpm: 110, pulseClarity: 0.5, onsetEventRate, spectralFluxSum: totalFlux };

  const doubleLag = bestLag * 2;
  if (doubleLag <= maxLag) {
    const rawAtDouble = corrRaw[doubleLag];
    const rawAtBest = corrRaw[bestLag];
    if (rawAtDouble >= rawAtBest * 0.45 && 60 / (bestLag * 0.01) > 135) {
      bestLag = doubleLag;
    }
  }

  let calculatedBpm = Math.round(60 / (bestLag * 0.01));
  const avgCorr = totalCorrSum / (maxLag - minLag + 1);
  const pulseClarity = Math.min(1, Math.max(0, (maxWeightedCorr - avgCorr) * 2.5));

  return {
    bpm: calculatedBpm,
    pulseClarity: Number(pulseClarity.toFixed(2)),
    onsetEventRate: Number(onsetEventRate.toFixed(2)),
    spectralFluxSum: Number(totalFlux.toFixed(2)),
  };
}

/**
 * 6. Radix-2 In-place FFT (Fast Fourier Transform)
 */
function runRadix2FFT(real: Float32Array, imag: Float32Array, n: number) {
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepR = Math.cos(angle);
    const wStepI = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const pos = i + k;
        const matchPos = pos + half;
        const uR = real[pos];
        const uI = imag[pos];
        const vR = real[matchPos] * wR - imag[matchPos] * wI;
        const vI = real[matchPos] * wI + imag[matchPos] * wR;

        real[pos] = uR + vR;
        imag[pos] = uI + vI;
        real[matchPos] = uR - vR;
        imag[matchPos] = uI - vI;

        const nextWR = wR * wStepR - wI * wStepI;
        wI = wR * wStepI + wI * wStepR;
        wR = nextWR;
      }
    }
  }
}

/**
 * 7. HÀM TÍNH KHOẢNG CÁCH TƯƠNG ĐỒNG COSINE SIMILARITY CHO GỢI Ý & SMART DJ (ZERO ALLOCATION)
 */
export function calculateTrackSimilarity(v1: AcousticVector, v2: AcousticVector): number {
  if (!v1 || !v2) return 0;

  const b1 = Number.isFinite(v1.bpmNormalized) ? v1.bpmNormalized : 0.5;
  const e1 = Number.isFinite(v1.energy) ? v1.energy : 0.5;
  const val1 = Number.isFinite(v1.valence) ? v1.valence : 0.5;
  const d1 = Number.isFinite(v1.danceability) ? v1.danceability : 0.5;
  const a1 = Number.isFinite(v1.acousticness) ? v1.acousticness : 0.5;
  const br1 = Number.isFinite(v1.brightness) ? v1.brightness : 0.5;
  const dyn1 = Number.isFinite(v1.dynamics) ? v1.dynamics : 0.5;

  const b2 = Number.isFinite(v2.bpmNormalized) ? v2.bpmNormalized : 0.5;
  const e2 = Number.isFinite(v2.energy) ? v2.energy : 0.5;
  const val2 = Number.isFinite(v2.valence) ? v2.valence : 0.5;
  const d2 = Number.isFinite(v2.danceability) ? v2.danceability : 0.5;
  const a2 = Number.isFinite(v2.acousticness) ? v2.acousticness : 0.5;
  const br2 = Number.isFinite(v2.brightness) ? v2.brightness : 0.5;
  const dyn2 = Number.isFinite(v2.dynamics) ? v2.dynamics : 0.5;

  const dotProduct = b1 * b2 + e1 * e2 + val1 * val2 + d1 * d2 + a1 * a2 + br1 * br2 + dyn1 * dyn2;
  const normA = b1 * b1 + e1 * e1 + val1 * val1 + d1 * d1 + a1 * a1 + br1 * br1 + dyn1 * dyn1;
  const normB = b2 * b2 + e2 * e2 + val2 * val2 + d2 * d2 + a2 * a2 + br2 * br2 + dyn2 * dyn2;

  if (normA === 0 || normB === 0) return 0;
  return Number((dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(4));
}

export interface SimilarityDetail {
  score: number;
  percentage: number;
  reason: string;
}

/**
 * Tính toán độ tương đồng Hybrid đa yếu tố (Acoustic 7D + Metadata Context + Harmony)
 */
export function calculateHybridSimilarity(
  v1?: AcousticVector,
  v2?: AcousticVector,
  meta1?: MetadataHints,
  meta2?: MetadataHints
): SimilarityDetail {
  if (!v1 || !v2) {
    if (meta1 && meta2 && meta1.artist && meta2.artist && meta1.artist.toLowerCase() === meta2.artist.toLowerCase()) {
      return { score: 0.85, percentage: 85, reason: 'Cùng nghệ sĩ trình bày' };
    }
    return { score: 0.5, percentage: 50, reason: 'Gợi ý tổng hợp' };
  }

  const cosine = calculateTrackSimilarity(v1, v2);
  let bonus = 0;
  let primaryReason = 'Giai điệu & năng lượng tương đồng';

  if (meta1 && meta2) {
    if (meta1.artist && meta2.artist && meta1.artist.toLowerCase() === meta2.artist.toLowerCase()) {
      bonus += 0.08;
      primaryReason = `Cùng nghệ sĩ ${meta1.artist}`;
    } else if (meta1.genre && meta2.genre && meta1.genre.toLowerCase() === meta2.genre.toLowerCase()) {
      bonus += 0.05;
      primaryReason = `Cùng thể loại ${meta1.genre}`;
    }
  }

  if (Math.abs(v1.acousticness - v2.acousticness) < 0.15 && v1.acousticness > 0.6) {
    bonus += 0.04;
    primaryReason = 'Giai điệu mộc sâu lắng tương thích';
  } else if (Math.abs(v1.bpmNormalized - v2.bpmNormalized) < 0.08) {
    bonus += 0.04;
    primaryReason = 'Nhịp điệu & tiết tấu BPM hòa hợp';
  } else if (Math.abs(v1.energy - v2.energy) < 0.12 && v1.energy > 0.7) {
    bonus += 0.04;
    primaryReason = 'Cùng năng lượng sôi động';
  }

  const finalScore = Number(Math.min(0.99, Math.max(0.1, cosine * 0.85 + bonus)).toFixed(4));
  const percentage = Math.round(finalScore * 100);

  return {
    score: finalScore,
    percentage,
    reason: primaryReason,
  };
}

/**
 * 8. FAST VECTOR INDEX: Động cơ chỉ mục Vector bộ nhớ liền kề (Contiguous Float32Array)
 * Hỗ trợ truy vấn tối đa K bài hát (Mặc định 14 bài theo chuẩn hệ thống)
 */
export class FastVectorIndex {
  private trackIds: string[] = [];
  private idToIndex: Map<string, number> = new Map();
  private matrix: Float32Array = new Float32Array(0);

  public buildIndex(analyses: Record<string, DetailedAudioAnalysis>) {
    const entries = Object.values(analyses);
    const count = entries.length;
    this.trackIds = new Array(count);
    this.idToIndex.clear();
    this.matrix = new Float32Array(count * 7);

    for (let i = 0; i < count; i++) {
      const item = entries[i];
      if (!item || !item.vector) continue;

      this.trackIds[i] = item.trackId;
      this.idToIndex.set(item.trackId, i);

      const v = item.vector;
      const raw = [
        Number.isFinite(v.bpmNormalized) ? v.bpmNormalized : 0.5,
        Number.isFinite(v.energy) ? v.energy : 0.5,
        Number.isFinite(v.valence) ? v.valence : 0.5,
        Number.isFinite(v.danceability) ? v.danceability : 0.5,
        Number.isFinite(v.acousticness) ? v.acousticness : 0.5,
        Number.isFinite(v.brightness) ? v.brightness : 0.5,
        Number.isFinite(v.dynamics) ? v.dynamics : 0.5,
      ];
      
      let norm = 0;
      for (let d = 0; d < 7; d++) norm += raw[d] * raw[d];
      norm = Math.sqrt(norm) || 1;

      const offset = i * 7;
      for (let d = 0; d < 7; d++) {
        this.matrix[offset + d] = raw[d] / norm;
      }
    }
  }

  public querySimilar(targetTrackId: string, topK = 14, threshold = 0.50): { trackId: string; score: number }[] {
    const targetIdx = this.idToIndex.get(targetTrackId);
    if (targetIdx === undefined || this.trackIds.length === 0) return [];

    const tOffset = targetIdx * 7;
    const t0 = this.matrix[tOffset];
    const t1 = this.matrix[tOffset + 1];
    const t2 = this.matrix[tOffset + 2];
    const t3 = this.matrix[tOffset + 3];
    const t4 = this.matrix[tOffset + 4];
    const t5 = this.matrix[tOffset + 5];
    const t6 = this.matrix[tOffset + 6];

    const count = this.trackIds.length;
    const scores: { trackId: string; score: number }[] = [];

    for (let i = 0; i < count; i++) {
      if (i === targetIdx) continue;
      const offset = i * 7;
      const dot =
        t0 * this.matrix[offset] +
        t1 * this.matrix[offset + 1] +
        t2 * this.matrix[offset + 2] +
        t3 * this.matrix[offset + 3] +
        t4 * this.matrix[offset + 4] +
        t5 * this.matrix[offset + 5] +
        t6 * this.matrix[offset + 6];

      if (dot >= threshold) {
        scores.push({ trackId: this.trackIds[i], score: Number(dot.toFixed(4)) });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

