import { useEffect, useRef } from 'react';
import { tauriAPI } from '../utils/tauriBridge';
import type { Track } from '../types';

interface UseAudioTelemetryOptions {
  audio: HTMLAudioElement;
  track: Track | null;
}

/**
 * Event-Driven Telemetry Hook:
 * Eliminates periodic heartbeat intervals/timers in React.
 * Listens to HTMLAudioElement UI events and dispatches IPC signals to the Rust Native Engine.
 */
export const useAudioTelemetry = ({ audio, track }: UseAudioTelemetryOptions) => {
  const trackRef = useRef<Track | null>(track);

  useEffect(() => {
    const previousTrack = trackRef.current;
    if (previousTrack?.id !== track?.id) {
      trackRef.current = track;
      void tauriAPI.telemetryOnTrackChange(
        track
          ? {
              songId: track.id,
              title: track.title,
              artist: track.artist,
              albumArt: track.picture,
              trackDuration: audio.duration || track.duration || 0,
            }
          : null
      );
    }
  }, [audio, track]);

  useEffect(() => {
    const handlePlay = () => {
      void tauriAPI.telemetryOnPlay();
    };
    const handlePause = () => {
      void tauriAPI.telemetryOnPause();
    };
    const handleRateChange = () => {
      void tauriAPI.telemetryOnRateChange(audio.playbackRate || 1);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handlePause);
    audio.addEventListener('stalled', handlePause);
    audio.addEventListener('ratechange', handleRateChange);

    const handleBeforeUnload = () => {
      void tauriAPI.telemetryOnAppExit();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handlePause);
      audio.removeEventListener('stalled', handlePause);
      audio.removeEventListener('ratechange', handleRateChange);
    };
  }, [audio]);

  return {
    flushTelemetry: (_reason?: string) => void tauriAPI.telemetryOnPause(),
  };
};
