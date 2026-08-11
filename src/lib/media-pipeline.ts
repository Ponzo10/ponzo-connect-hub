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

/**
 * Vérifie que le média est réellement lisible depuis son URL avant de le
 * considérer comme « prêt à publier ». Évite l'aperçu vide / la publication
 * cassée quand l'objet n'est pas encore servi par le stockage.
 */
export function verifyMediaReadable(url: string, type: "image" | "video", timeoutMs = 30000) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const el = type === "image" ? new Image() : document.createElement("video");
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      el.removeAttribute("src");
      if (type === "video") (el as HTMLVideoElement).load();
      if (ok) resolve();
      else reject(new PipelineError("PREVIEW_FAILED", "preview", "Le fichier envoyé n'est pas lisible. Réessaie."));
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);
    if (type === "video") {
      const video = el as HTMLVideoElement;
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => finish(true);
      video.onerror = () => finish(false);
      video.onloadeddata = () => finish(true);
    } else {
      const img = el as HTMLImageElement;
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
    }
    el.src = url;
    if (type === "video") (el as HTMLVideoElement).load();
  });
}
