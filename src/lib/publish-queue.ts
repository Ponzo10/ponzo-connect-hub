/**
 * File d'attente de publication « résistante ».
 *
 * Objectif : l'utilisateur appuie sur « Publier » et oublie. L'écran se ferme
 * immédiatement, le post apparaît dans le fil en gris (« Envoi… ») et l'envoi
 * réel continue en arrière-plan — même après un changement de page, une perte
 * de réseau ou une fermeture de l'application (les fichiers sont conservés en
 * IndexedDB et l'envoi TUS reprend au pourcentage atteint).
 */
import { createPost } from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";

export type QueueStatus = "pending" | "uploading" | "failed";

export type QueueItem = {
  id: string;
  userId: string;
  body: string;
  tag: string | null;
  mediaType: "image" | "video" | null;
  status: QueueStatus;
  progress: number;
  error: string | null;
  createdAt: number;
};

type StoredItem = QueueItem & { file: Blob | null; fileName: string | null };

const DB_NAME = "ponzo-publish";
const STORE = "queue";
const RETRY_MS = 2 * 60 * 1000;

function newId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function dbPut(item: StoredItem) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function dbDelete(id: string) {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function dbAll(): Promise<StoredItem[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as StoredItem[]) ?? []);
    request.onerror = () => resolve([]);
  });
}

export type NetworkTier = "very-slow" | "slow" | "normal";

/** Mesure le réseau au moment précis de l'envoi (et non à la mise en file). */
export function networkTier(): NetworkTier {
  if (typeof navigator === "undefined") return "normal";
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return "normal";
  const type = conn.effectiveType;
  if (type === "slow-2g" || type === "2g") return "very-slow";
  if (conn.saveData || type === "3g") return "slow";
  return "normal";
}

/** Connexion lente ? (2G / 3G / mode économie de données) */
export function isSlowConnection() {
  return networkTier() !== "normal";
}

/** Le navigateur sait-il encoder en WebP ? (bien plus léger que le JPEG) */
function supportsWebp(canvas: HTMLCanvasElement) {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * Compression adaptative par palier, appliquée juste avant l'envoi :
 * - 2G / slow-2g : largeur max 720 px, qualité 0,55
 * - 3G / économie de données : largeur max 1080 px, qualité 0,68
 * - normal : aucune recompression
 * Le WebP est utilisé quand il est disponible, sinon JPEG.
 */
async function lighten(file: File): Promise<File> {
  const tier = networkTier();
  if (!file.type.startsWith("image/") || tier === "normal") return file;
  if (typeof document === "undefined") return file;
  const { maxWidth, quality } = tier === "very-slow" ? { maxWidth: 720, quality: 0.55 } : { maxWidth: 1080, quality: 0.68 };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const webp = supportsWebp(canvas);
    const mime = webp ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
    if (!blob || blob.size >= file.size) return file;
    const ext = webp ? ".webp" : ".jpg";
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ext, { type: mime });
  } catch {
    return file;
  }
}


// ---------------------------------------------------------------- store

type Entry = { item: QueueItem; file: File | Blob | null; fileName: string | null; previewUrl: string | null };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let snapshot: QueueItem[] = [];
let running = false;
let started = false;
let onPublished: (() => void) | null = null;

function refresh() {
  snapshot = [...entries.values()].map((e) => e.item).sort((a, b) => a.createdAt - b.createdAt);
  listeners.forEach((l) => l());
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueSnapshot() {
  return snapshot;
}

export function getPreviewUrl(id: string) {
  return entries.get(id)?.previewUrl ?? null;
}

export function setPublishedCallback(cb: () => void) {
  onPublished = cb;
}

function patch(id: string, next: Partial<QueueItem>) {
  const entry = entries.get(id);
  if (!entry) return;
  entry.item = { ...entry.item, ...next };
  refresh();
}

/** Ajoute une publication à la file et rend la main immédiatement. */
export function enqueuePost(input: {
  userId: string;
  body: string;
  tag: string | null;
  file: File | null;
  mediaType: "image" | "video" | null;
}) {
  const item: QueueItem = {
    id: newId(),
    userId: input.userId,
    body: input.body,
    tag: input.tag,
    mediaType: input.mediaType,
    status: "pending",
    progress: 0,
    error: null,
    createdAt: Date.now(),
  };
  entries.set(item.id, {
    item,
    file: input.file,
    fileName: input.file?.name ?? null,
    previewUrl: input.file && typeof URL !== "undefined" ? URL.createObjectURL(input.file) : null,
  });
  refresh();
  void dbPut({ ...item, file: input.file, fileName: input.file?.name ?? null });
  void processQueue();
  return item.id;
}

export function retryItem(id: string) {
  patch(id, { status: "pending", error: null });
  void processQueue();
}

export function removeItem(id: string) {
  const entry = entries.get(id);
  if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
  entries.delete(id);
  refresh();
  void dbDelete(id);
}

async function persist(id: string) {
  const entry = entries.get(id);
  if (!entry) return;
  await dbPut({ ...entry.item, file: entry.file, fileName: entry.fileName });
}

async function processQueue(): Promise<void> {
  if (running) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  running = true;
  try {
    for (const entry of [...entries.values()]) {
      if (entry.item.status !== "pending") continue;
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      const { id } = entry.item;
      patch(id, { status: "uploading", progress: 0, error: null });
      try {
        let mediaUrl: string | null = null;
        if (entry.file) {
          const raw =
            entry.file instanceof File
              ? entry.file
              : new File([entry.file], entry.fileName ?? "media", { type: entry.file.type });
          const file = await lighten(raw);
          const result = await uploadMedia(entry.item.userId, file, "posts", entry.item.mediaType ?? undefined, (p) =>
            patch(id, { progress: p }),
          );
          mediaUrl = result.url;
        }
        await createPost({
          authorId: entry.item.userId,
          body: entry.item.body,
          tag: entry.item.tag,
          mediaUrl,
          mediaType: entry.item.mediaType,
        });
        removeItem(id);
        onPublished?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Envoi impossible";
        patch(id, { status: "failed", error: message });
        await persist(id);
      }
    }
  } finally {
    running = false;
  }
}

/** Relance automatique : retour du réseau, toutes les 2 minutes, retour d'onglet. */
export function startPublishQueue() {
  if (started || typeof window === "undefined") return;
  started = true;
  void (async () => {
    for (const stored of await dbAll()) {
      if (entries.has(stored.id)) continue;
      const file = stored.file ?? null;
      entries.set(stored.id, {
        item: { ...stored, status: "pending", progress: 0 },
        file,
        fileName: stored.fileName,
        previewUrl: file ? URL.createObjectURL(file) : null,
      });
    }
    refresh();
    void processQueue();
  })();

  const wake = () => {
    for (const entry of entries.values()) {
      if (entry.item.status === "failed") entry.item = { ...entry.item, status: "pending", error: null };
    }
    refresh();
    void processQueue();
  };
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void processQueue();
  });
  window.setInterval(wake, RETRY_MS);
}
