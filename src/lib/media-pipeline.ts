import { trackEvent } from "@/lib/analytics";

/** Codes d'erreur techniques du pipeline de publication. */
export type PipelineCode =
  | "INVALID_FILE"
  | "FILE_TOO_LARGE"
  | "UPLOAD_FAILED"
  | "STORAGE_ERROR"
  | "STORAGE_PERMISSION_ERROR"
  | "PREVIEW_FAILED"
  | "POST_CREATION_FAILED"
  | "POST_FETCH_FAILED"
  | "AUTH_ERROR"
  | "NETWORK_ERROR";

export type PipelineStage =
  | "select"
  | "validate"
  | "upload"
  | "storage"
  | "preview"
  | "post_create"
  | "post_visible";

export class PipelineError extends Error {
  code: PipelineCode;
  stage: PipelineStage;
  constructor(code: PipelineCode, stage: PipelineStage, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.stage = stage;
  }
}

const MAX_BYTES = 200 * 1024 * 1024;
const IMAGE_MAX = 25 * 1024 * 1024;

/** Journalise une étape du pipeline (aucun contenu privé, uniquement des métadonnées techniques). */
export function trackStage(
  stage: PipelineStage,
  status: "start" | "ok" | "fail",
  meta: Record<string, unknown> = {},
) {
  void trackEvent({
    kind: status === "fail" ? "error" : "feature",
    name: `publish_${stage}_${status}`,
    metadata: meta,
  });
}

/** Validation locale avant tout envoi réseau. */
export function validateMediaFile(file: File, expected: "image" | "video") {
  const type = file.type || "";
  if (file.size === 0) {
    throw new PipelineError("INVALID_FILE", "validate", "Ce fichier est vide ou illisible.");
  }
  if (file.size > MAX_BYTES) {
    throw new PipelineError("FILE_TOO_LARGE", "validate", "Fichier trop volumineux (200 Mo maximum).");
  }
  if (expected === "image" && file.size > IMAGE_MAX) {
    throw new PipelineError("FILE_TOO_LARGE", "validate", "Photo trop volumineuse (25 Mo maximum).");
  }
  // Certains WebView Android renvoient un type vide : on l'accepte, le type attendu fait foi.
  if (type && expected === "image" && !type.startsWith("image/")) {
    throw new PipelineError("INVALID_FILE", "validate", "Ce fichier n'est pas une photo valide.");
  }
  if (type && expected === "video" && !type.startsWith("video/")) {
    throw new PipelineError("INVALID_FILE", "validate", "Ce fichier n'est pas une vidéo valide.");
  }
}

/** Traduit une erreur brute (Storage, réseau) en code exploitable. */
export function classifyUploadError(error: unknown): PipelineError {
  const message = error instanceof Error ? error.message : "Envoi impossible";
  const lower = message.toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return new PipelineError("NETWORK_ERROR", "upload", "Connexion perdue. Réessaie une fois en ligne.");
  }
  if (lower.includes("row-level security") || lower.includes("unauthorized") || lower.includes("403")) {
    return new PipelineError("STORAGE_PERMISSION_ERROR", "storage", "Accès au stockage refusé. Reconnecte-toi puis réessaie.");
  }
  if (lower.includes("session") || lower.includes("jwt") || lower.includes("token")) {
    return new PipelineError("AUTH_ERROR", "upload", "Session expirée. Reconnecte-toi puis réessaie.");
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("timeout")) {
    return new PipelineError("NETWORK_ERROR", "upload", "Réseau instable pendant l'envoi. Réessaie.");
  }
  if (lower.includes("storage") || lower.includes("bucket") || lower.includes("signed")) {
    return new PipelineError("STORAGE_ERROR", "storage", message);
  }
  return new PipelineError("UPLOAD_FAILED", "upload", message);
}

/** Résultat détaillé de la vérification post-envoi. */
export type MediaCheck = { accessible: boolean; decodable: boolean; bytes: number | null };

/** Le fichier est-il réellement servi par le stockage ? (source de vérité) */
async function fetchAccessible(url: string, timeoutMs: number): Promise<{ ok: boolean; bytes: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Range 0-0 : on ne télécharge qu'un octet, suffisant pour prouver l'accès.
    const response = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: controller.signal, cache: "no-store" });
    if (!response.ok && response.status !== 206) return { ok: false, bytes: null };
    const total = response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("content-length");
    const bytes = total ? Number(total) : null;
    if (bytes !== null && Number.isFinite(bytes) && bytes === 0) return { ok: false, bytes: 0 };
    return { ok: true, bytes: Number.isFinite(bytes as number) ? bytes : null };
  } catch {
    return { ok: false, bytes: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Le navigateur courant sait-il décoder ce média ? (signal secondaire, non bloquant) */
function decodable(url: string, type: "image" | "video", timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(true);
    const el = type === "image" ? new Image() : document.createElement("video");
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(ok);
      window.setTimeout(() => {
        el.removeAttribute("src");
        if (type === "video") (el as HTMLVideoElement).load();
      }, 0);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    if (type === "video") {
      const video = el as HTMLVideoElement;
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => finish(true);
      video.onloadeddata = () => finish(true);
      video.onerror = () => finish(false);
    } else {
      const img = el as HTMLImageElement;
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
    }
    el.src = url;
    if (type === "video") (el as HTMLVideoElement).load();
  });
}

/**
 * Vérifie que le média est réellement disponible avant de le considérer comme
 * « prêt à publier ».
 *
 * Critère bloquant : le fichier doit être servi par le stockage (requête
 * partielle réussie, taille non nulle). Le décodage par le navigateur n'est
 * qu'un signal secondaire : un HEVC/.mov d'iPhone ou un HEIC peut être
 * parfaitement stocké et lisible ailleurs tout en n'étant pas décodable ici —
 * c'était la cause réelle des « publi_preview_fail ».
 *
 * Le stockage peut mettre un instant à servir un objet fraîchement écrit :
 * on réessaie plusieurs fois avant de déclarer l'échec.
 */
export async function verifyMediaReadable(
  url: string,
  type: "image" | "video",
  timeoutMs = 30000,
): Promise<MediaCheck> {
  if (typeof window === "undefined") return { accessible: true, decodable: true, bytes: null };

  const deadline = Date.now() + timeoutMs;
  let access = await fetchAccessible(url, 10000);
  let attempt = 1;
  while (!access.ok && Date.now() < deadline && attempt < 4) {
    await new Promise((r) => setTimeout(r, 700 * attempt));
    access = await fetchAccessible(url, 10000);
    attempt += 1;
  }

  if (!access.ok) {
    throw new PipelineError(
      "PREVIEW_FAILED",
      "preview",
      "Le fichier envoyé n'est pas encore accessible. Réessaie dans un instant.",
    );
  }

  const remaining = Math.max(4000, deadline - Date.now());
  const canDecode = await decodable(url, type, Math.min(remaining, 15000));
  return { accessible: true, decodable: canDecode, bytes: access.bytes };
}

