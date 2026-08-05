import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Image as ImageIcon, Loader2, Search, Sparkles, Users, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import { asPerson, createPost } from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";
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
        <p className="text-sm font-semibold">Connexion interrompue</p>
        <p className="text-xs text-muted-foreground">Ta publication n'a pas été perdue, réessaie simplement.</p>
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

function Publier() {
  const [kind, setKind] = useState<(typeof kinds)[number]["label"]>("Publication");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined, expected: "image" | "video") => {
    if (!file) return;
    if (!user) {
      toast.error("Connecte-toi pour ajouter un fichier.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadMedia(user.id, file, "posts", expected);
      const type = result.kind === "video" || expected === "video" ? "video" : "image";
      setMedia({ url: result.url, type });
      toast.success("Fichier ajouté");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi du fichier impossible.");
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
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
    try {
      await createPost({
        authorId: user.id,
        body: text.trim(),
        tag: kind === "Publication" ? null : kind,
        mediaUrl: media?.url ?? null,
        mediaType: media?.type ?? null,
      });
      setText("");
      setMedia(null);
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      toast.success("Publication en ligne 🎉");
      void navigate({ to: media?.type === "video" ? "/videos" : "/" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publication impossible";
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

          {media && (
            <div className="relative mt-2 overflow-hidden rounded-xl">
              {media.type === "image" ? (
                <img src={media.url} alt="Aperçu" className="max-h-72 w-full object-cover" />
              ) : (
                <video src={media.url} controls playsInline className="max-h-72 w-full bg-black object-contain" />
              )}
              <button
                onClick={() => setMedia(null)}
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
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
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
