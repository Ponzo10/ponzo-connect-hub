import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 3650;
const MAX_BYTES = 200 * 1024 * 1024; // 200 Mo

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

export async function uploadMedia(
  userId: string,
  file: File,
  folder = "posts",
  expected?: MediaKind,
): Promise<UploadResult> {
  if (!userId) throw new Error("Connecte-toi pour envoyer un fichier.");
  if (file.size === 0) throw new Error("Ce fichier est vide ou illisible.");
  if (file.size > MAX_BYTES) throw new Error("Fichier trop volumineux (200 Mo maximum).");

  // Certains WebView Android renvoient un type MIME vide : on retombe sur le type attendu.
  const detected = kindOf(file);
  const kind: MediaKind = detected === "file" && expected ? expected : detected;
  const name = file.name || `${folder}-${Date.now()}`;
  const contentType = file.type || (kind === "video" ? "video/mp4" : kind === "image" ? "image/jpeg" : "application/octet-stream");


  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const path = `${userId}/${folder}/${safeId()}.${safeExt(name, kind)}`;
    try {
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType, upsert: true, cacheControl: "3600" });
      if (error) throw error;

      const { data, error: signError } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
      if (signError || !data?.signedUrl) throw signError ?? new Error("URL indisponible");

      return { url: data.signedUrl, path, kind, name };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(600 * (attempt + 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Envoi impossible";
  throw new Error(`Envoi du fichier impossible : ${message}. Vérifie ta connexion puis réessaie.`);
}
