import { supabase } from "@/integrations/supabase/client";
import { Upload } from "tus-js-client";

const TEN_YEARS = 60 * 60 * 24 * 3650;
const MAX_BYTES = 200 * 1024 * 1024; // 200 Mo
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;

/**
 * Sur réseau lent, de petits morceaux permettent de reprendre bien plus près
 * du point de coupure (au lieu de reperdre jusqu'à 6 Mo à chaque interruption).
 */
function chunkSizeForNetwork() {
  if (typeof navigator === "undefined") return RESUMABLE_CHUNK_SIZE;
  const conn = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  const type = conn?.effectiveType;
  if (type === "slow-2g" || type === "2g") return 256 * 1024;
  if (conn?.saveData || type === "3g") return 512 * 1024;
  return RESUMABLE_CHUNK_SIZE;
}

const SIGN_ATTEMPTS = 5;
const UPLOAD_ATTEMPTS = 3;

export type MediaKind = "image" | "video" | "audio" | "file";

export function kindOf(file: File | (Blob & { type?: string })): MediaKind {
  const type = (file as File).type ?? "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

export type UploadResult = { url: string; path: string; kind: MediaKind; name: string };

/** UUID sûr : crypto.randomUUID n'existe pas sur certains WebView Android / contextes non sécurisés. */
function safeId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeExt(name: string, kind: MediaKind) {
  const raw = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  if (cleaned) return cleaned;
  if (kind === "image") return "jpg";
  if (kind === "video") return "mp4";
  if (kind === "audio") return "webm";
  return "bin";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function activeAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw error ?? new Error("Session d'envoi indisponible");

  const expiresSoon = (data.session.expires_at ?? 0) * 1000 - Date.now() < 5 * 60 * 1000;
  if (!expiresSoon) return data.session.access_token;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) {
    throw refreshed.error ?? new Error("Session expirée. Reconnecte-toi puis réessaie.");
  }
  return refreshed.data.session.access_token;
}

async function resumableUpload(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (progress: number) => void,
  resume = true,
) {
  const projectUrl = import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!projectUrl || !publishableKey) {
    throw new Error("Service d'envoi indisponible");
  }

  let allowResume = resume;
  // Chaque passe recrée l'objet TUS : la taille de chunk et le jeton sont donc
  // recalculés, et la reprise repart de l'offset réel renvoyé par le serveur.
  for (let pass = 0; ; pass += 1) {
    const accessToken = await activeAccessToken();
    const chunkSize = chunkSizeForNetwork();
    let restartOnNetworkChange = false;

    const conn = typeof navigator !== "undefined"
      ? (navigator as unknown as { connection?: EventTarget & { effectiveType?: string } }).connection
      : undefined;

    const done = await new Promise<boolean>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: `${projectUrl}/storage/v1/upload/resumable`,
        headers: {
          authorization: `Bearer ${accessToken}`,
          apikey: publishableKey,
          "x-upsert": "true",
        },
        metadata: {
          bucketName: "media",
          objectName: path,
          contentType,
          cacheControl: "31536000",
        },
        uploadSize: file.size,
        chunkSize,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        removeFingerprintOnSuccess: true,
        // Le chemin fait partie de l'empreinte. Sans cela, TUS peut reprendre un
        // ancien envoi du même fichier vers un autre objet après une interruption.
        fingerprint: async () => `ponzo-v2-${path}-${file.size}-${file.lastModified}`,
        onProgress: (uploaded, total) => onProgress?.(total > 0 ? uploaded / total : 0),
        onError: (error) => {
          cleanup();
          if (restartOnNetworkChange) resolve(false);
          else reject(error);
        },
        onSuccess: () => {
          cleanup();
          onProgress?.(1);
          resolve(true);
        },
      });

      const onNetworkChange = () => {
        const next = chunkSizeForNetwork();
        if (next === chunkSize) return;
        // Le réseau a changé de catégorie : on coupe proprement (sans effacer
        // l'empreinte) pour repartir de l'offset serveur avec un chunk adapté.
        restartOnNetworkChange = true;
        void Promise.resolve(upload.abort(false)).then(() => {
          cleanup();
          resolve(false);
        });
      };

      function cleanup() {
        conn?.removeEventListener?.("change", onNetworkChange);
      }

      conn?.addEventListener?.("change", onNetworkChange);

      void upload
        .findPreviousUploads()
        .then((previousUploads) => {
          const previous = allowResume || pass > 0 ? previousUploads[0] : undefined;
          if (previous) upload.resumeFromPreviousUpload(previous);
          upload.start();
        })
        .catch((error) => {
          cleanup();
          reject(error);
        });
    });

    if (done) return;
    allowResume = true;
  }
}


export async function uploadMedia(
  userId: string,
  file: File,
  folder = "posts",
  expected?: MediaKind,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  if (!userId) throw new Error("Connecte-toi pour envoyer un fichier.");
  if (file.size === 0) throw new Error("Ce fichier est vide ou illisible.");
  if (file.size > MAX_BYTES) throw new Error("Fichier trop volumineux (200 Mo maximum).");

  // Certains WebView Android renvoient un type MIME vide : on retombe sur le type attendu.
  const detected = kindOf(file);
  const kind: MediaKind = detected === "file" && expected ? expected : detected;
  const name = file.name || `${folder}-${Date.now()}`;
  const contentType = file.type || (kind === "video" ? "video/mp4" : kind === "image" ? "image/jpeg" : "application/octet-stream");
  let path = `${userId}/${folder}/${safeId()}.${safeExt(name, kind)}`;
  let lastError: unknown = null;
  let uploaded = false;

  for (let attempt = 0; attempt < UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      if (file.size >= RESUMABLE_THRESHOLD) {
        await resumableUpload(path, file, contentType, onProgress, attempt === 0);
      } else {
        await activeAccessToken();
        const { error } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType, upsert: true, cacheControl: "31536000" });
        if (error) throw error;
        onProgress?.(1);
      }
      uploaded = true;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < UPLOAD_ATTEMPTS - 1) {
        // Une reprise TUS peut pointer vers une ressource serveur expirée. Après
        // le premier échec, repartir sur un objet neuf évite les boucles 404/409.
        if (file.size >= RESUMABLE_THRESHOLD) {
          path = `${userId}/${folder}/${safeId()}.${safeExt(name, kind)}`;
          onProgress?.(0);
        }
        try {
          await activeAccessToken();
        } catch {
          // Le prochain essai renverra l'erreur d'authentification utile.
        }
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 15_000);
            window.addEventListener("online", () => {
              window.clearTimeout(timeout);
              resolve();
            }, { once: true });
          });
        } else {
          await sleep(800 * (attempt + 1));
        }
      }
    }
  }

  if (!uploaded) {
    const message = lastError instanceof Error ? lastError.message : "Envoi impossible";
    throw new Error(`Envoi du fichier impossible : ${message}`);
  }

  // La signature est une requête séparée : si elle échoue brièvement, ne pas
  // renvoyer tout le fichier (particulièrement coûteux pour une vidéo).
  for (let attempt = 0; attempt < SIGN_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
    if (!error && data?.signedUrl) return { url: data.signedUrl, path, kind, name };
    lastError = error;
    if (attempt < SIGN_ATTEMPTS - 1) {
      // Une session expirée est la cause la plus fréquente : on la rafraîchit avant de réessayer.
      try {
        await activeAccessToken();
      } catch {
        /* on réessaie quand même */
      }
      await sleep(500 * (attempt + 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : "URL indisponible";
  throw new Error(`Fichier envoyé, mais confirmation impossible : ${message}`);
}

export async function removeUploadedMedia(path: string) {
  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) throw error;
}
