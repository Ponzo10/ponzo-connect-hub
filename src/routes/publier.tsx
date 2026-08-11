import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Image as ImageIcon, Loader2, Search, Sparkles, Users, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import { extractHashtags, searchHashtags } from "@/lib/trending-api";
import { asPerson, createPost } from "@/lib/ponzo-api";
import { removeUploadedMedia, uploadMedia } from "@/lib/upload";
import {
  PipelineError,
  classifyUploadError,
  trackStage,
  validateMediaFile,
  verifyMediaReadable,
} from "@/lib/media-pipeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/publier")({
  head: () => ({
    meta: [
      { title: "Créer une publication — PONZO" },
      {
        name: "description",
        content: "Publie un texte, une photo, une vidéo, un besoin, un service ou un projet sur PONZO.",
      },
      { property: "og:title", content: "Créer une publication — PONZO" },
      { property: "og:description", content: "Partage tes idées, tes services et tes projets avec la communauté." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Création de publication</p>
        <p className="text-xs text-muted-foreground">Recharge cet écran pour continuer.</p>
        <button onClick={reset} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground">
          Réessayer
        </button>
      </div>
    </div>
  ),

  component: Publier,
});


const kinds = [
  { label: "Publication", icon: Sparkles },
  { label: "Je cherche", icon: Search },
  { label: "Je propose", icon: Users },
  { label: "Mon projet", icon: Briefcase },
] as const;

type UploadState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "uploading"; progress: number }
  | { status: "checking" }
  | { status: "ready" }
  | { status: "error"; code: string; message: string };

function Publier() {
  const [kind, setKind] = useState<(typeof kinds)[number]["label"]>("Publication");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ url: string; path: string; type: "image" | "video" } | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [busy, setBusy] = useState(false);
  const lastPick = useRef<{ file: File; expected: "image" | "video" } | null>(null);
  const pickSequence = useRef(0);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);

  const uploading = upload.status === "validating" || upload.status === "uploading" || upload.status === "checking";

  const currentTags = useMemo(() => extractHashtags(text), [text]);
  const typing = /#([A-Za-z0-9_À-ÿ]{1,50})$/.exec(text)?.[1] ?? "";
  const suggestions = useQuery({
    queryKey: ["hashtag-suggestions", typing],
    queryFn: () => searchHashtags(typing, 8),
    enabled: !!user,
    staleTime: 20000,
  });
  const suggested = (suggestions.data ?? []).filter((h) => !currentTags.includes(h.tag)).slice(0, 8);

  const addTag = (tag: string) => {
    setText((prev) => {
      const base = typing ? prev.replace(/#[A-Za-z0-9_À-ÿ]{1,50}$/, "") : prev;
      const sep = base && !base.endsWith(" ") ? " " : "";
      return `${base}${sep}#${tag} `;
    });
  };
  const videoRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined, expected: "image" | "video") => {
    if (!file) return;
    if (!user) {
      toast.error("Connecte-toi pour ajouter un fichier.");
      return;
    }
    lastPick.current = { file, expected };
    const sequence = ++pickSequence.current;
    const previousMedia = media;
    let uploadedPath: string | null = null;
    try {
      // 1. Validation locale — aucun envoi réseau si le fichier est invalide.
      setUpload({ status: "validating" });
      trackStage("validate", "start", { expected, size: file.size, mime: file.type || "unknown" });
      validateMediaFile(file, expected);
      trackStage("validate", "ok", { expected, size: file.size });

      // 2. Envoi réel vers le stockage.
      setUpload({ status: "uploading", progress: 0 });
      trackStage("upload", "start", { expected, size: file.size });
      const result = await uploadMedia(user.id, file, "posts", expected, (p) =>
        sequence === pickSequence.current && setUpload({ status: "uploading", progress: p }),
      );
      uploadedPath = result.path;
      if (sequence !== pickSequence.current) {
        await removeUploadedMedia(result.path).catch(() => undefined);
        return;
      }
      trackStage("upload", "ok", { expected, size: file.size });

      // 3. Vérification que le média est réellement lisible avant de l'accepter.
      const type = result.kind === "video" || expected === "video" ? "video" : "image";
      setUpload({ status: "checking" });
      await verifyMediaReadable(result.url, type);
      if (sequence !== pickSequence.current) {
        await removeUploadedMedia(result.path).catch(() => undefined);
        return;
      }
      trackStage("preview", "ok", { type });

      setMedia({ url: result.url, path: result.path, type });
      setUpload({ status: "ready" });
      if (previousMedia?.path && previousMedia.path !== result.path) {
        void removeUploadedMedia(previousMedia.path).catch(() => undefined);
      }
      toast.success(type === "video" ? "Vidéo envoyée et vérifiée" : "Photo envoyée et vérifiée");
    } catch (error) {
      if (sequence !== pickSequence.current) return;
      const failure = error instanceof PipelineError ? error : classifyUploadError(error);
      // Aucun média partiel ne doit rester attaché à une publication.
      setMedia(previousMedia);
      if (uploadedPath) void removeUploadedMedia(uploadedPath).catch(() => undefined);
      trackStage(failure.stage, "fail", { code: failure.code, expected });
      setUpload({ status: "error", code: failure.code, message: failure.message });
      toast.error(failure.message);
    } finally {
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  useEffect(
    () => () => {
      pickSequence.current += 1;
    },
    [],
  );

  const retryPick = () => {
    const previous = lastPick.current;
    if (!previous) return;
    void pick(previous.file, previous.expected);
  };



  const publish = async () => {
    if (!user) {
      toast.error("Connecte-toi pour publier.");
      return;
    }
    if (uploading) {
      toast.info("Envoi du fichier en cours…");
      return;
    }
    if (!text.trim() && !media) {
      toast.error("Ajoute un texte, une photo ou une vidéo.");
      return;
    }
    setBusy(true);
    trackStage("post_create", "start", { hasMedia: !!media, mediaType: media?.type ?? null });
    try {
      const destination = media?.type === "video" ? "/videos" : "/";
      const postId = await createPost({
        authorId: user.id,
        body: text.trim(),
        tag: kind === "Publication" ? null : kind,
        mediaUrl: media?.url ?? null,
        mediaType: media?.type ?? null,
      });
      trackStage("post_create", "ok", { postId, mediaType: media?.type ?? null });
      setText("");
      setMedia(null);
      setUpload({ status: "idle" });
      lastPick.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["videos"] }),
        queryClient.invalidateQueries({ queryKey: ["posts", user.id] }),
      ]);
      toast.success("Publication en ligne 🎉");
      void navigate({ to: destination });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publication impossible";
      trackStage("post_create", "fail", { code: "POST_CREATION_FAILED", message: message.slice(0, 200) });
      toast.error(`Publication impossible : ${message}`);
    } finally {
      setBusy(false);
    }

  };


  return (
    <AppShell title="Créer">
      <div className="space-y-4 px-3 pt-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {kinds.map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.label}
                onClick={() => setKind(k.label)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  kind === k.label ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground shadow-soft",
                )}
              >
                <Icon className="h-4 w-4" />
                {k.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <Avatar person={asPerson(profile)} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Membre PONZO"}</p>
              <p className="truncate text-xs text-muted-foreground">Public · Tous les membres</p>
            </div>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={
              kind === "Je cherche"
                ? "Décris ce que tu recherches…"
                : kind === "Je propose"
                  ? "Décris le service que tu proposes…"
                  : kind === "Mon projet"
                    ? "Présente ton projet et ce dont tu as besoin…"
                    : "À quoi pensez-vous ?"
            }
            className="mt-3 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />

          {suggested.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] font-semibold text-muted-foreground">Hashtags suggérés</p>
              <div className="no-scrollbar mt-1.5 flex gap-2 overflow-x-auto pb-1">
                {suggested.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => addTag(h.tag)}
                    className="shrink-0 rounded-full bg-primary-soft px-3 py-1.5 text-[11px] font-semibold text-primary"
                  >
                    #{h.tag} <span className="opacity-60">{h.usage_count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentTags.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Hashtags détectés : {currentTags.map((t) => `#${t}`).join(" ")}
            </p>
          )}

          {media && (
            <div className="relative mt-2 overflow-hidden rounded-xl">
              {media.type === "image" ? (
                <img src={media.url} alt="Aperçu" className="max-h-72 w-full object-cover" />
              ) : (
                <video src={media.url} controls playsInline className="max-h-72 w-full bg-black object-contain" />
              )}
              <button
                 onClick={() => {
                    pickSequence.current += 1;
                   const uploaded = media;
                   setMedia(null);
                    setUpload({ status: "idle" });
                   void removeUploadedMedia(uploaded.path).catch(() => undefined);
                 }}
                aria-label="Retirer le fichier"
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0], "image")}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0], "video")}
          />


          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
            <button
              onClick={() => photoRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 text-primary" />}
              Ajouter une photo
            </button>
            <button
              onClick={() => videoRef.current?.click()}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4 text-destructive" />}
              Ajouter une vidéo
            </button>
          </div>
          {uploading && (
            <div className="mt-3" role="status" aria-live="polite">
              <progress
                className="h-1.5 w-full overflow-hidden rounded-full accent-primary"
                max={100}
                value={upload.status === "uploading" ? Math.max(4, Math.round(upload.progress * 100)) : 100}
              />
              <p className="mt-1.5 text-center text-xs font-medium text-muted-foreground">
                {upload.status === "validating" && "Vérification du fichier…"}
                {upload.status === "uploading" && `Envoi sécurisé… ${Math.round(upload.progress * 100)} %`}
                {upload.status === "checking" && "Contrôle du média envoyé…"}
              </p>
            </div>
          )}
          {upload.status === "error" && (
            <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs" role="alert">
              <p className="font-semibold text-destructive">{upload.message}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Code : {upload.code}</p>
              {lastPick.current && (
                <button
                  type="button"
                  onClick={retryPick}
                  className="mt-2 rounded-full bg-brand px-4 py-1.5 text-[11px] font-bold text-primary-foreground"
                >
                  Réessayer l'envoi
                </button>
              )}
            </div>
          )}

        </div>

        <button
          onClick={publish}
          disabled={(!text.trim() && !media) || busy || uploading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift transition-opacity disabled:opacity-40"
        >
          {busy ? "Publication…" : "Publier"}
        </button>
      </div>
    </AppShell>
  );
}
