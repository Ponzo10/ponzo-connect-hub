import { supabase } from "@/integrations/supabase/client";

const TEN_YEARS = 60 * 60 * 24 * 3650;

export type MediaKind = "image" | "video" | "audio" | "file";

export function kindOf(file: File | Blob & { type?: string }): MediaKind {
  const type = (file as File).type ?? "";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

export type UploadResult = { url: string; path: string; kind: MediaKind; name: string };

export async function uploadMedia(userId: string, file: File, folder = "posts"): Promise<UploadResult> {
  const name = file.name || `${folder}-${Date.now()}`;
  const ext = name.includes(".") ? name.split(".").pop() : kindOf(file) === "audio" ? "webm" : "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage.from("media").createSignedUrl(path, TEN_YEARS);
  if (signError) throw signError;

  return { url: data.signedUrl, path, kind: kindOf(file), name };
}
