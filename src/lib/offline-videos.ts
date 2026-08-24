/**
 * Bibliothèque hors-ligne PONZO.
 * Les vidéos sont stockées dans le Cache Storage du navigateur avec une limite
 * stricte de 20 vidéos pour ne jamais saturer le téléphone de l'utilisateur.
 */

export const OFFLINE_LIMIT = 20;

const CACHE_NAME = "ponzo-offline-videos";
const INDEX_KEY = "ponzo:offline-videos";

export type OfflineVideo = {
  id: string;
  url: string;
  title: string;
  savedAt: number;
};

function readIndex(): OfflineVideo[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as OfflineVideo[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(list: OfflineVideo[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* quota indisponible */
  }
}

export function listOfflineVideos(): OfflineVideo[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function isVideoOffline(id: string): boolean {
  return readIndex().some((v) => v.id === id);
}

export type SaveResult = { status: "saved" | "already" | "limit" | "error"; count: number };

export async function saveVideoOffline(id: string, url: string, title: string): Promise<SaveResult> {
  const index = readIndex();
  if (index.some((v) => v.id === id)) return { status: "already", count: index.length };
  if (index.length >= OFFLINE_LIMIT) return { status: "limit", count: index.length };

  try {
    if (typeof caches === "undefined") throw new Error("cache indisponible");
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("téléchargement impossible");
    await cache.put(url, response);
    const next = [...index, { id, url, title, savedAt: Date.now() }];
    writeIndex(next);
    return { status: "saved", count: next.length };
  } catch {
    return { status: "error", count: index.length };
  }
}

export async function removeVideoOffline(id: string): Promise<void> {
  const index = readIndex();
  const target = index.find((v) => v.id === id);
  if (!target) return;
  try {
    if (typeof caches !== "undefined") {
      const cache = await caches.open(CACHE_NAME);
      await cache.delete(target.url);
    }
  } catch {
    /* déjà purgé */
  }
  writeIndex(index.filter((v) => v.id !== id));
}
