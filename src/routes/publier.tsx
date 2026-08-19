import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Image as ImageIcon, Search, Sparkles, Users, Video, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import { extractHashtags, searchHashtags } from "@/lib/trending-api";
import { asPerson } from "@/lib/ponzo-api";
import { enqueuePost } from "@/lib/publish-queue";
import { validateMediaFile } from "@/lib/media-pipeline";
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
  component: Publier,
});

const kinds = [
  { label: "Publication", icon: Sparkles },
  { label: "Je cherche", icon: Search },
  { label: "Je propose", icon: Users },
  { label: "Mon projet", icon: Briefcase },
] as const;

type Picked = { file: File; url: string; type: "image" | "video" };

function Publier() {
  const [kind, setKind] = useState<(typeof kinds)[number]["label"]>("Publication");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<Picked | null>(null);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

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

  // Aucun envoi réseau à la sélection : on garde le fichier localement, l'envoi
  // se fait en arrière-plan après « Publier ».
  const pick = (file: File | undefined, expected: "image" | "video") => {
    if (photoRef.current) photoRef.current.value = "";
    if (videoRef.current) videoRef.current.value = "";
    if (!file) return;
    try {
      validateMediaFile(file, expected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fichier invalide");
      return;
    }
    if (media) URL.revokeObjectURL(media.url);
    setMedia({ file, url: URL.createObjectURL(file), type: expected });
  };

  const clearMedia = () => {
    if (media) URL.revokeObjectURL(media.url);
    setMedia(null);
  };

  const publish = () => {
    if (!user) {
      toast.error("Connecte-toi pour publier.");
      return;
    }
    if (!text.trim() && !media) {
      toast.error("Ajoute un texte, une photo ou une vidéo.");
      return;
    }
    enqueuePost({
      userId: user.id,
      body: text.trim(),
      tag: kind === "Publication" ? null : kind,
      file: media?.file ?? null,
      mediaType: media?.type ?? null,
    });
    setText("");
    setMedia(null);
    void navigate({ to: media?.type === "video" ? "/videos" : "/" });
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
                onClick={clearMedia}
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
              className="flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold"
            >
              <ImageIcon className="h-4 w-4 text-primary" />
              Ajouter une photo
            </button>
            <button
              onClick={() => videoRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold"
            >
              <Video className="h-4 w-4 text-destructive" />
              Ajouter une vidéo
            </button>
          </div>
        </div>

        <button
          onClick={publish}
          disabled={!text.trim() && !media}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift transition-opacity disabled:opacity-40"
        >
          Publier
        </button>
        <p className="pb-2 text-center text-[11px] text-muted-foreground">
          L'envoi se poursuit en arrière-plan, même sur une connexion lente.
        </p>
      </div>
    </AppShell>
  );
}
