import React, { useEffect, useRef, useState, useMemo } from 'react';
import type { LyricBgEffect } from '../types';
import { convertFileSrc } from '../utils/tauriBridge';

export interface LyricsVisualizerBgProps {
  effect?: LyricBgEffect;
  colors?: string[];
  imageUrl?: string;
  isPlaying?: boolean;
  className?: string;
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, l];
}

// Convert HSL to HEX
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return `#${((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1)}`;
}

const colorCache = new Map<string, string[]>();

export function extractPaletteFromImage(imageUrl: string): Promise<string[]> {
  const validUrl = convertFileSrc(imageUrl);
  if (!validUrl) {
    return Promise.resolve(['#e11d48', '#8b5cf6', '#0f172a']);
  }

  if (colorCache.has(validUrl)) {
    return Promise.resolve(colorCache.get(validUrl)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    if (validUrl.startsWith('http://') || validUrl.startsWith('https://')) {
      if (!validUrl.includes('localhost') && !validUrl.includes('127.0.0.1')) {
        img.crossOrigin = 'Anonymous';
      }
    }
    img.src = validUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallback = ['#e11d48', '#8b5cf6', '#0f172a'];
          colorCache.set(imageUrl, fallback);
          return resolve(fallback);
        }

        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);

        const imgData = ctx.getImageData(0, 0, 64, 64).data;
        const colorClusters: Map<string, { r: number; g: number; b: number; count: number; score: number; h: number; s: number; l: number }> = new Map();

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue;

          const [h, s, l] = rgbToHsl(r, g, b);
          if (l < 0.12 || l > 0.90) continue;

          const vibrancyScore = s * 3.5 + (1 - Math.abs(l - 0.5) * 2);
          const hBin = Math.floor(h / 15) * 15;
          const sBin = Math.floor(s * 4) / 4;
          const lBin = Math.floor(l * 4) / 4;
          const key = `${hBin}-${sBin}-${lBin}`;

          const existing = colorClusters.get(key);
          if (existing) {
            existing.count += 1;
            existing.score += vibrancyScore;
          } else {
            colorClusters.set(key, { r, g, b, count: 1, score: vibrancyScore, h, s, l });
          }
        }

        const sorted = Array.from(colorClusters.values()).sort((a, b) => b.score - a.score);

        if (sorted.length > 0) {
          const primary = sorted[0];
          let secondary = sorted[1];
          let tertiary = sorted[2];

          for (let i = 1; i < sorted.length; i++) {
            const candidate = sorted[i];
            const hueDiff = Math.abs(candidate.h - primary.h);
            const minHueDiff = Math.min(hueDiff, 360 - hueDiff);
            if (minHueDiff >= 30) {
              secondary = candidate;
              break;
            }
          }

          if (secondary) {
            for (let i = 1; i < sorted.length; i++) {
              const candidate = sorted[i];
              const diffP = Math.min(Math.abs(candidate.h - primary.h), 360 - Math.abs(candidate.h - primary.h));
              const diffS = Math.min(Math.abs(candidate.h - secondary.h), 360 - Math.abs(candidate.h - secondary.h));
              if (diffP >= 25 && diffS >= 25) {
                tertiary = candidate;
                break;
              }
            }
          }

          const primaryHex = hslToHex(primary.h, Math.max(primary.s, 0.45), Math.min(Math.max(primary.l, 0.28), 0.55));
          const secondaryHex = secondary
            ? hslToHex(secondary.h, Math.max(secondary.s, 0.45), Math.min(Math.max(secondary.l, 0.28), 0.55))
            : primaryHex;
          const tertiaryHex = tertiary
            ? hslToHex(tertiary.h, Math.max(tertiary.s, 0.35), Math.min(Math.max(tertiary.l, 0.18), 0.45))
            : '#09090b';

          const resultColors = [primaryHex, secondaryHex, tertiaryHex];
          colorCache.set(imageUrl, resultColors);
          return resolve(resultColors);
        }
      } catch (err) {
        console.warn('Cannot extract colors from image canvas:', err);
      }
      const fallback = ['#e11d48', '#8b5cf6', '#0f172a'];
      colorCache.set(imageUrl, fallback);
      resolve(fallback);
    };

    img.onerror = () => {
      const fallback = ['#be123c', '#6d28d9', '#09090b'];
      colorCache.set(imageUrl, fallback);
      resolve(fallback);
    };
  });
}

export const LyricsVisualizerBg: React.FC<LyricsVisualizerBgProps> = ({
  effect = 'mesh',
  colors: inputColors,
  imageUrl,
  isPlaying = true,
  className = '',
}) => {
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (inputColors && inputColors.length >= 2) {
      setExtractedColors(inputColors);
      return;
    }

    if (imageUrl) {
      if (colorCache.has(imageUrl)) {
        setExtractedColors(colorCache.get(imageUrl)!);
        return;
      }

      let isMounted = true;
      extractPaletteFromImage(imageUrl).then((extracted) => {
        if (isMounted) {
          setExtractedColors(extracted);
        }
      });
      return () => {
        isMounted = false;
      };
    } else {
      setExtractedColors(['#be123c', '#7c3aed', '#09090b']);
    }
  }, [inputColors, imageUrl]);

  const activeColors = useMemo(() => {
    if (inputColors && inputColors.length >= 2) return inputColors;
    if (extractedColors.length >= 2) return extractedColors;
    return ['#be123c', '#7c3aed', '#09090b'];
  }, [inputColors, extractedColors]);

  const c1 = activeColors[0] || '#be123c';
  const c2 = activeColors[1] || '#7c3aed';
  const c3 = activeColors[2] || activeColors[0] || '#09090b';

  // Cosmic Starfield & Nebula Canvas Animation Engine
  useEffect(() => {
    if (effect !== 'cosmic') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle pool
    const particleCount = 85;
    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
      alphaSpeed: number;
      color: string;
    }> = [];

    const starColors = [c1, c2, '#ffffff', '#a5b4fc', '#fbcfe8'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.8 + 0.2,
        alphaSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }

    let t = 0;
    const render = () => {
      t += 0.01;
      ctx.clearRect(0, 0, width, height);

      // Deep space gradient
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) / 1.1);
      bgGrad.addColorStop(0, '#0c0a1f');
      bgGrad.addColorStop(0.5, '#05040d');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Nebula clouds
      const g1 = ctx.createRadialGradient(width * 0.3 + Math.sin(t * 0.4) * 40, height * 0.4 + Math.cos(t * 0.3) * 30, 20, width * 0.3, height * 0.4, width * 0.45);
      g1.addColorStop(0, `${c1}33`);
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, width, height);

      const g2 = ctx.createRadialGradient(width * 0.7 + Math.cos(t * 0.3) * 40, height * 0.6 + Math.sin(t * 0.5) * 30, 20, width * 0.7, height * 0.6, width * 0.45);
      g2.addColorStop(0, `${c2}33`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, width, height);

      // Render stars
      for (const p of particles) {
        if (isPlaying) {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha += p.alphaSpeed;
          if (p.alpha <= 0.15 || p.alpha >= 0.95) p.alphaSpeed = -p.alphaSpeed;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = p.radius * 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameId);
    };
  }, [effect, c1, c2, isPlaying]);

  return (
    <div className={`absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-none transform-gpu ${className}`}>
      {/* 1. Fluid Dynamic Mesh (Apple Music / Spicetify Beautiful Lyrics style) */}
      {effect === 'mesh' && (
        <div className={`absolute inset-[-10%] w-[120%] h-[120%] pointer-events-none filter blur-2xl opacity-85 transition-all duration-700 transform-gpu ${isPlaying ? '' : 'pause-anim'}`}>
          <div
            className={`absolute top-1/4 left-1/4 w-[50vw] h-[50vw] max-w-[550px] max-h-[550px] rounded-full transform-gpu ${isPlaying ? 'animate-fluid-1' : ''}`}
            style={{
              background: `radial-gradient(circle at center, ${c1} 0%, ${c1}66 35%, rgba(0,0,0,0) 70%)`,
            }}
          />
          <div
            className={`absolute top-1/3 right-1/4 w-[45vw] h-[45vw] max-w-[500px] max-h-[500px] rounded-full transform-gpu ${isPlaying ? 'animate-fluid-2' : ''}`}
            style={{
              background: `radial-gradient(circle at center, ${c2} 0%, ${c2}66 35%, rgba(0,0,0,0) 70%)`,
            }}
          />
          <div
            className={`absolute bottom-1/4 left-1/3 w-[55vw] h-[55vw] max-w-[600px] max-h-[600px] rounded-full transform-gpu ${isPlaying ? 'animate-fluid-3' : ''}`}
            style={{
              background: `radial-gradient(circle at center, ${c3} 0%, ${c3}66 35%, rgba(0,0,0,0) 70%)`,
            }}
          />
        </div>
      )}

      {/* 2. Cosmic Starfield & Nebula Canvas */}
      {effect === 'cosmic' && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full transform-gpu" />
      )}

      {/* 3. Aurora Wave Ribbon */}
      {effect === 'aurora' && (
        <div className="absolute inset-0 w-full h-full overflow-hidden bg-neutral-950">
          <div
            className={`absolute -top-[20%] -left-[15%] w-[130%] h-[130%] filter blur-2xl opacity-75 transform-gpu ${isPlaying ? 'animate-aurora-1' : ''}`}
            style={{
              background: `radial-gradient(ellipse at 30% 20%, ${c1} 0%, ${c1}44 40%, rgba(0,0,0,0) 65%), radial-gradient(ellipse at 70% 60%, ${c2} 0%, ${c2}44 35%, rgba(0,0,0,0) 60%)`,
            }}
          />
          <div
            className={`absolute -bottom-[20%] -right-[15%] w-[130%] h-[130%] filter blur-2xl opacity-70 transform-gpu ${isPlaying ? 'animate-aurora-2' : ''}`}
            style={{
              background: `radial-gradient(ellipse at 60% 80%, ${c3} 0%, ${c3}44 40%, rgba(0,0,0,0) 65%), radial-gradient(ellipse at 20% 40%, ${c2} 0%, ${c2}44 35%, rgba(0,0,0,0) 60%)`,
            }}
          />
        </div>
      )}

      {/* 4. Vinyl Spin & Audio Pulse Aura */}
      {effect === 'vinyl' && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-[#09090b]">
          {/* Glowing Aura backdrop */}
          <div
            className="absolute w-[450px] h-[450px] rounded-full filter blur-2xl opacity-50 transition-colors duration-700"
            style={{
              background: `radial-gradient(circle, ${c1} 0%, ${c2} 45%, rgba(0,0,0,0) 75%)`,
            }}
          />

          {/* Pulse Rings */}
          <div
            className={`absolute w-[400px] h-[400px] rounded-full border border-white/20 ${isPlaying ? 'animate-vinyl-ring-1' : ''}`}
            style={{ borderColor: `${c1}60` }}
          />
          <div
            className={`absolute w-[480px] h-[480px] rounded-full border border-white/15 ${isPlaying ? 'animate-vinyl-ring-2' : ''}`}
            style={{ borderColor: `${c2}50` }}
          />

          {/* Vinyl Disc Silhouette */}
          <div className={`relative w-72 h-72 md:w-80 md:h-80 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center opacity-40 ${isPlaying ? 'animate-vinyl-spin' : ''}`}>
            {/* Grooves */}
            <div className="absolute inset-4 rounded-full border border-neutral-800/80" />
            <div className="absolute inset-8 rounded-full border border-neutral-800/80" />
            <div className="absolute inset-12 rounded-full border border-neutral-800/80" />
            <div className="absolute inset-16 rounded-full border border-neutral-800/80" />
            <div className="absolute inset-20 rounded-full border border-neutral-800/80" />
            {/* Center Label */}
            <div
              className="w-20 h-20 rounded-full border-2 border-white/20 shadow-inner flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
            >
              <div className="w-4 h-4 rounded-full bg-black border border-white/40" />
            </div>
          </div>
        </div>
      )}

      {/* 5. Spectrum Frequency Wave */}
      {effect === 'spectrum' && (
        <div className="absolute inset-0 w-full h-full bg-[#08080c] overflow-hidden flex flex-col justify-end">
          {/* Subtle ambient glow top */}
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] filter blur-2xl opacity-40"
            style={{ background: `radial-gradient(ellipse, ${c1} 0%, ${c2} 40%, rgba(0,0,0,0) 80%)` }}
          />
          {/* Animated Frequency Bars Container */}
          <div className="w-full h-36 px-6 flex items-end justify-between gap-1 opacity-35">
            {Array.from({ length: 36 }).map((_, i) => {
              const animDuration = 0.8 + ((i * 7) % 15) * 0.08;
              const delay = ((i * 11) % 20) * 0.05;
              const minHeight = 8 + (i % 6) * 4;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-full transition-all duration-300 transform-gpu"
                  style={{
                    height: isPlaying ? `calc(${minHeight}% + ${((i * 13) % 70)}%)` : '6%',
                    background: `linear-gradient(to top, ${c1}, ${c2}, #ffffff)`,
                    animation: isPlaying ? `soundWave1 ${animDuration}s ease-in-out infinite alternate ${delay}s` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* 6. OLED Pure Dark Mode */}
      {effect === 'dark' && (
        <div className="absolute inset-0 bg-[#000000]" />
      )}

      {/* Universal Ambient Overlay for optimum readability */}
      {effect !== 'dark' && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transform-gpu" />
      )}
    </div>
  );
};
