import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Download, Eye, Heart, Loader2, MessageCircle, Music2, Send, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate, BottomNav } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { FollowButton } from "@/components/ponzo/FollowButton";
import { HashtagText } from "@/components/ponzo/HashtagText";
import { usePublishQueue } from "@/components/ponzo/PublishQueue";
import { UploadPill, uploadLabel } from "@/components/ponzo/UploadProgress";
import { useAuth } from "@/lib/auth";
import { downloadMedia } from "@/lib/trending-api";
import {
  addReply,
  asPerson,
  compactCount,
  fetchComments,
  fetchFollowing,
  fetchVideoPosts,
  incrementView,
  notify,
  sharePost,
  timeAgo,
  toggleLike,
  toggleSave,
  type FeedPost,
} from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Vidéos courtes — PONZO" },
      {
        name: "description",
        content: "Découvre les vidéos courtes PONZO en défilement vertical : créateurs, projets et conseils business.",
      },
      { property: "og:title", content: "Vidéos courtes — PONZO" },
      { property: "og:description", content: "Défilement vertical, lecture automatique, réactions et partages." },
    ],
  }),
  component: VideosPage,
});

function VideosPage() {
  return (
    <AuthGate>
      <Videos />
    </AuthGate>
  );
}

const SOUND_KEY = "ponzo.video.sound";

/** Mémorise le choix de son de l'utilisateur d'une session à l'autre. */
function useSoundPreference() {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SOUND_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { muted?: boolean; volume?: number };
      if (typeof saved.muted === "boolean") setMuted(saved.muted);
      if (typeof saved.volume === "number") setVolume(Math.min(1, Math.max(0, saved.volume)));
    } catch {
      /* préférence illisible : on garde les valeurs par défaut */
    }
  }, []);

  const persist = useCallback((next: { muted: boolean; volume: number }) => {
    setMuted(next.muted);
    setVolume(next.volume);
    if (typeof window !== "undefined") window.localStorage.setItem(SOUND_KEY, JSON.stringify(next));
  }, []);

  return { muted, volume, persist };
}

function Videos() {
  const { user } = useAuth();
  const { muted, volume, persist } = useSoundPreference();
  const pendingVideos = usePublishQueue().filter((i) => i.mediaType === "video");
  const videos = useQuery({ queryKey: ["videos"], queryFn: fetchVideoPosts, staleTime: 20000 });
  const following = useQuery({
    queryKey: ["following", user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user,
  });

  const all = videos.data ?? [];
  // Rendu fenêtré : on ne monte que quelques cartes, les suivantes arrivent au scroll.
  const [count, setCount] = useState(4);
  const list = all.slice(0, count);
  const showMore = useCallback(() => setCount((c) => Math.min(c + 3, 999)), []);

  return (
    <div className="relative min-h-screen bg-foreground pb-20">
      {pendingVideos.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-1 px-4">
          {pendingVideos.map((item) => (
            <UploadPill key={item.id} tone="dark" progress={item.progress} label={uploadLabel(item.status, item.progress)} />
          ))}
        </div>
      )}
      <div className="snap-y-page h-[calc(100vh-5rem)] snap-y snap-mandatory overflow-y-auto no-scrollbar">
        {videos.isLoading && (
          <div className="h-[calc(100vh-5rem)] snap-start bg-foreground p-5">
            <div className="h-full w-full animate-pulse rounded-2xl bg-background/10" />
          </div>
        )}

        {!videos.isLoading && all.length === 0 && (
          <div className="grid h-[calc(100vh-5rem)] place-items-center px-8 text-center text-background">
            <div>
              <p className="text-sm font-bold">Aucune vidéo pour l'instant</p>
              <p className="mt-1 text-xs opacity-70">Publie une vidéo depuis l'onglet Publier : elle apparaîtra ici et dans le fil.</p>
            </div>
          </div>
        )}
        {list.map((post, i) => (
          <VideoCard
            key={post.id}
            post={post}
            eager={i === 0}
            muted={muted}
            volume={volume}
            onToggleMute={() => persist({ muted: !muted, volume: volume || 1 })}
            onVolume={(v) => persist({ muted: v === 0, volume: v })}
            onNear={i >= list.length - 2 && count < all.length ? showMore : undefined}
            isFollowing={(following.data ?? []).includes(post.author_id)}
          />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

const progressStore = new Map<string, number>();

/** Registre global : une seule vidéo joue à la fois. */
let currentPlaying: HTMLVideoElement | null = null;
function claimPlayback(el: HTMLVideoElement) {
  if (currentPlaying && currentPlaying !== el) {
    currentPlaying.pause();
  }
  currentPlaying = el;
}

function VideoCard({
  post,
  eager,
  muted,
  volume,
  onToggleMute,
  onVolume,
  onNear,
  isFollowing,
}: {
  post: FeedPost;
  eager: boolean;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolume: (value: number) => void;
  onNear?: (() => void) | undefined;
  isFollowing: boolean;
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(eager);
  const [warm, setWarm] = useState(eager);
  const [counted, setCounted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showComments, setShowComments] = useState(false);


  const liked = useMemo(() => !!user && post.post_likes.some((l) => l.user_id === user.id), [post.post_likes, user]);
  const saved = useMemo(() => !!user && post.post_saves.some((s) => s.user_id === user.id), [post.post_saves, user]);

  // Préchauffage : seule la vidéo suivante est préchargée (économie de données en 2G/3G).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const warmObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setWarm(true);
          onNear?.();
        }
      },
      { rootMargin: "90% 0px" },
    );
    const observer = new IntersectionObserver(
      ([entry]) => setActive(!!entry && entry.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] },
    );
    warmObserver.observe(el);
    observer.observe(el);
    return () => {
      warmObserver.disconnect();
      observer.disconnect();
    };
  }, [onNear]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      const savedTime = progressStore.get(post.id);
      if (savedTime && Math.abs(v.currentTime - savedTime) > 1) v.currentTime = savedTime;
      const start = () => {
        claimPlayback(v);
        setPaused(false);
        void v.play().catch(() => {});
      };
      if (v.readyState >= 2) start();
      else v.addEventListener("loadeddata", start, { once: true });
      if (!counted && user) {
        setCounted(true);
        void incrementView(post.id);
      }
      return () => v.removeEventListener("loadeddata", start);
    }
    progressStore.set(post.id, v.currentTime);
    v.pause();
    if (currentPlaying === v) currentPlaying = null;
    return;
  }, [active, post.id, counted, user]);

  // Le son original de la vidéo suit le réglage de volume choisi.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
    v.muted = muted;
    // Certains navigateurs bloquent la lecture non muette : on relance après le choix.
    if (!muted && active && !paused) void v.play().catch(() => {});
  }, [volume, muted, active, paused]);

  /** Tap sur la vidéo : affiche les contrôles et bascule lecture / pause. */
  const togglePlay = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    setShowControls(true);
    window.setTimeout(() => setShowControls(false), 1800);
    if (v.paused) {
      claimPlayback(v);
      setPaused(false);
      void v.play().catch(() => {});
    } else {
      v.pause();
      setPaused(true);
    }
  }, []);



  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["videos"] }), [queryClient]);

  const like = async () => {
    if (!user) return;
    try {
      await toggleLike(post.id, user.id, liked);
      if (!liked) {
        await notify({
          userId: post.author_id,
          actorId: user.id,
          kind: "like",
          body: `${profile?.full_name ?? "Un membre"} a aimé votre vidéo ❤️`,
          entityId: post.id,
        });
      }
      await refresh();
    } catch {
      toast.error("Réaction impossible.");
    }
  };

  const save = async () => {
    if (!user) return;
    try {
      await toggleSave(post.id, user.id, saved);
      await refresh();
      toast.success(saved ? "Retiré des favoris" : "Ajouté aux favoris");
    } catch {
      toast.error("Action impossible.");
    }
  };

  const share = async () => {
    try {
      await sharePost(post.id);
      const url = `${window.location.origin}/membre/${post.author_id}`;
      if (navigator.share) await navigator.share({ title: "Vidéo PONZO", text: post.body, url });
      else await navigator.clipboard.writeText(url);
      await refresh();
      toast.success("Vidéo partagée");
    } catch {
      /* partage annulé */
    }
  };

  return (
    <section ref={sectionRef} className="relative flex h-[calc(100vh-5rem)] snap-start items-end bg-foreground">
      <video
        ref={ref}
        src={warm && post.media_url ? `${post.media_url}${post.media_url.includes("#") ? "" : "#t=0.001"}` : undefined}
        className="absolute inset-0 h-full w-full object-contain"
        playsInline
        loop
        muted={muted}
        disablePictureInPicture
        preload={active ? "auto" : warm ? "metadata" : "none"}
        onClick={togglePlay}
        onWaiting={() => setBuffering(true)}
        onStalled={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onPause={() => setPaused(true)}
        onPlay={() => setPaused(false)}
        onTimeUpdate={(e) => progressStore.set(post.id, e.currentTarget.currentTime)}
      />

      {/* Aucun écran de chargement bloquant : un simple voile discret pendant la mise en mémoire tampon. */}
      {buffering && !paused && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-9 w-9 animate-spin text-background/70" />
        </div>
      )}

      {(paused || showControls) && (
        <button
          type="button"
          aria-label={paused ? "Lire la vidéo" : "Mettre en pause"}
          onClick={togglePlay}
          className="absolute inset-0 z-10 grid place-items-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full bg-foreground/45 text-background backdrop-blur-sm">
            {paused ? <Play className="h-8 w-8" /> : <Pause className="h-8 w-8" />}
          </span>
        </button>
      )}


      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/85 to-transparent" />


      <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-background/15 px-2 py-1.5 backdrop-blur-sm">
        <button
          type="button"
          aria-label={muted ? "Activer le son" : "Couper le son"}
          onClick={onToggleMute}
          className="grid h-8 w-8 place-items-center rounded-full text-background"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        {!muted && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            aria-label="Volume"
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-1 w-20 cursor-pointer accent-brand"
          />
        )}
      </div>

      <div className="relative z-10 flex w-full items-end justify-between gap-4 p-5 pb-8">
        <div className="min-w-0 flex-1 text-background">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar person={asPerson(post.author)} size={38} zoomable />
            <span className="truncate text-sm font-bold">{post.author?.full_name ?? "Membre PONZO"}</span>
            <FollowButton targetId={post.author_id} initialFollowing={isFollowing} size="sm" />
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed">
            <HashtagText text={post.body} />
          </p>
          <p className="mt-2 flex items-center gap-3 text-xs opacity-80">
            <span className="flex items-center gap-1">
              <Music2 className="h-3.5 w-3.5" /> Son original
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {compactCount(post.view_count ?? 0)}
            </span>
            <span>{timeAgo(post.created_at)}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-4 text-background">
          <Action
            onClick={() => void like()}
            icon={<Heart className={cn("h-7 w-7", liked && "fill-destructive text-destructive")} />}
            value={compactCount(post.post_likes.length)}
          />
          <Action
            onClick={() => setShowComments(true)}
            icon={<MessageCircle className="h-7 w-7" />}
            value={compactCount(post.post_comments.length)}
          />
          <Action onClick={() => void share()} icon={<Send className="h-7 w-7" />} value={compactCount(post.share_count)} />
          <Action
            onClick={() => void save()}
            icon={<Bookmark className={cn("h-7 w-7", saved && "fill-background")} />}
            value="Enreg."
          />
          {(post.author?.allow_video_download ?? true) && post.media_url && (
            <Action
              onClick={() => {
                toast.info("Téléchargement en cours…");
                void downloadMedia(post.media_url!, `ponzo-video-${post.id.slice(0, 8)}.mp4`);
              }}
              icon={<Download className="h-7 w-7" />}
              value="Télécharger"
            />
          )}
        </div>
      </div>

      {showComments && <VideoComments post={post} onClose={() => setShowComments(false)} onChange={refresh} />}
    </section>
  );
}

function VideoComments({
  post,
  onClose,
  onChange,
}: {
  post: FeedPost;
  onClose: () => void;
  onChange: () => void;
}) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const comments = useQuery({ queryKey: ["comments", post.id], queryFn: () => fetchComments(post.id) });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    try {
      await addReply(post.id, user.id, text.trim(), replyTo?.id ?? null);
      await notify({
        userId: post.author_id,
        actorId: user.id,
        kind: "comment",
        body: `${profile?.full_name ?? "Un membre"} a commenté votre vidéo : « ${text.trim().slice(0, 60)} »`,
        entityId: post.id,
      });
      setText("");
      setReplyTo(null);
      await comments.refetch();
      onChange();
    } catch {
      toast.error("Commentaire impossible.");
    }
  };

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">Commentaires ({comments.data?.length ?? 0})</p>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-muted-foreground">
          Fermer
        </button>
      </div>
      <div className="space-y-3">
        {roots.map((c) => (
          <div key={c.id}>
            <div className="flex gap-2">
              <Avatar person={asPerson(c.author)} size={32} zoomable />
              <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
                <p className="text-xs font-bold">{c.author?.full_name ?? "Membre"}</p>
                <p className="text-sm">{c.body}</p>
                <button
                  type="button"
                  onClick={() => setReplyTo({ id: c.id, name: c.author?.full_name ?? "Membre" })}
                  className="mt-1 text-[10px] font-semibold text-muted-foreground"
                >
                  Répondre · {timeAgo(c.created_at)}
                </button>
              </div>
            </div>
            <div className="ml-10 mt-2 space-y-2">
              {(comments.data ?? [])
                .filter((r) => r.parent_id === c.id)
                .map((r) => (
                  <div key={r.id} className="flex gap-2">
                    <Avatar person={asPerson(r.author)} size={28} zoomable />
                    <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
                      <p className="text-xs font-bold">{r.author?.full_name ?? "Membre"}</p>
                      <p className="text-sm">{r.body}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {roots.length === 0 && <p className="text-xs text-muted-foreground">Sois le premier à commenter.</p>}
      </div>
      <form onSubmit={send} className="sticky bottom-0 mt-4 flex items-center gap-2 bg-surface pt-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? `Répondre à ${replyTo.name}…` : "Ajouter un commentaire…"}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Action({ icon, value, onClick }: { icon: React.ReactNode; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 transition-transform active:scale-90">
      {icon}
      <span className="text-[11px] font-semibold">{value}</span>
    </button>
  );
}
