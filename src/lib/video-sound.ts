import { useCallback, useEffect, useState } from "react";

export const SOUND_KEY = "ponzo.video.sound";

/** Mémorise le choix de son de l'utilisateur d'une session à l'autre. */
export function useSoundPreference(defaultMuted = true) {
  const [muted, setMuted] = useState(defaultMuted);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SOUND_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { muted?: boolean; volume?: number };
      if (!defaultMuted) {
        // Page vidéo : le son est activé d'office, on ne réapplique que le volume.
        if (typeof saved.volume === "number") setVolume(Math.min(1, Math.max(0, saved.volume)));
        return;
      }
      if (typeof saved.muted === "boolean") setMuted(saved.muted);
      if (typeof saved.volume === "number") setVolume(Math.min(1, Math.max(0, saved.volume)));
    } catch {
      /* préférence illisible : on garde les valeurs par défaut */
    }
  }, [defaultMuted]);

  const persist = useCallback((next: { muted: boolean; volume: number }) => {
    setMuted(next.muted);
    setVolume(next.volume);
    if (typeof window !== "undefined") window.localStorage.setItem(SOUND_KEY, JSON.stringify(next));
  }, []);

  return { muted, volume, persist };
}

/** Registre global : une seule vidéo joue à la fois dans toute l'application. */
let currentPlaying: HTMLVideoElement | null = null;

export function claimPlayback(el: HTMLVideoElement) {
  if (currentPlaying && currentPlaying !== el) currentPlaying.pause();
  currentPlaying = el;
}

export function releasePlayback(el: HTMLVideoElement) {
  if (currentPlaying === el) currentPlaying = null;
}
