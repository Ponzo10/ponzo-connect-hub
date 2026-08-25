import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Download, Eye, Heart, Loader2, Maximize, MessageCircle, Music2, Pause, Play, RotateCcw, Send, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate, BottomNav } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { FollowButton } from "@/components/ponzo/FollowButton";
import { HashtagText } from "@/components/ponzo/HashtagText";
import { offlineSuccessToast } from "@/components/ponzo/OfflineToast";
import { usePublishQueue } from "@/components/ponzo/PublishQueue";
import { UploadPill, uploadLabel } from "@/components/ponzo/UploadProgress";
import { useAuth } from "@/lib/auth";
import { saveVideoOffline } from "@/lib/offline-videos";
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
      <VideosExperience />
    </AuthGate>
  );
}

export function VideosExperience({
  startId,
  soundOn,
  onBack,
}: {
  startId?: string | undefined;
  soundOn?: boolean | undefined;
  onBack?: (() => void) | undefined;
}) {
  const { user } = useAuth();
  const { muted, volume, persist } = useSoundPreference(!soundOn);
  const pendingVideos = usePublishQueue().filter((i) => i.mediaType === "video");
  const videos = useQuery({ queryKey: ["videos"], queryFn: fetchVideoPosts, staleTime: 20000 });
  const following = useQuery({
    queryKey: ["following", user?.id],
    queryFn: () => fetchFollowing(user!.id),
    enabled: !!user,
  });

  // Ouverture depuis l'accueil : la vidéo demandée passe en tête du défilement.
  const all = useMemo(() => {
    const data = videos.data ?? [];
    if (!startId) return data;
    const target = data.find((p) => p.id === startId);
    if (!target) return data;
    return [target, ...data.filter((p) => p.id !== startId)];
  }, [videos.data, startId]);
  // Rendu fenêtré : on ne monte que quelques cartes, les suivantes arrivent au scroll.
  const [count, setCount] = useState(4);
  const list = all.slice(0, count);
  const showMore = useCallback(() => setCount((c) => Math.min(c + 3, 999)), []);

  return (
    <div className="relative min-h-screen bg-foreground pb-20">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour à l'accueil"
          className="glass-btn absolute left-3 top-3 z-30 grid h-11 w-11 place-items-center rounded-full text-background"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
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
            suggestions={all.filter((p) => p.id !== post.id).slice(0, 3)}
          />
        ))}

      </div>

      <BottomNav />
    </div>
  );
}

const progressStore = new Map<string, number>();


function VideoCard({
  post,
  eager,
  muted,
  volume,
  onToggleMute,
  onVolume,
  onNear,
  isFollowing,
  suggestions,
}: {
  post: FeedPost;
  eager: boolean;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolume: (value: number) => void;
  onNear?: (() => void) | undefined;
  isFollowing: boolean;
  suggestions: FeedPost[];
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(eager);
  const [warm, setWarm] = useState(eager);
  const [counted, setCounted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [poster, setPoster] = useState<string | undefined>(undefined);
  const [showHeart, setShowHeart] = useState(false);
  const [ready, setReady] = useState(false);
  const [ended, setEnded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [duration, setDuration] = useState(0);
  const retryTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const controlsTimer = useRef<number | null>(null);

  /** Petite vibration haptique (ignorée si non supportée). */
  const buzz = useCallback((ms = 10) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* haptique indisponible */
    }
  }, []);

  /** Affiche les contrôles puis les masque après 2 s d'inactivité. */
  const revealControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setShowControls(false), 2000);
  }, []);

  useEffect(() => {
    revealControls();
    return () => {
      if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
    };
  }, [revealControls]);

  const MAX_ATTEMPTS = 3;

  /**
   * Source de la vidéo.
   * - `#t=0.001` : le navigateur ne télécharge que le début du flux (première image
   *   immédiate) au lieu d'attendre le fichier entier.
   * - `?ponzo_r=n` sur relance : contourne une réponse incomplète mise en cache.
   */
  const src = useMemo(() => {
    if (!warm || !post.media_url) return undefined;
    const base = post.media_url;
    const busted = attempt > 0 ? `${base}${base.includes("?") ? "&" : "?"}ponzo_r=${attempt}` : base;
    return busted.includes("#") ? busted : `${busted}#t=0.001`;
  }, [warm, post.media_url, attempt]);

  const liked = useMemo(() => !!user && post.post_likes.some((l) => l.user_id === user.id), [post.post_likes, user]);
  const saved = useMemo(() => !!user && post.post_saves.some((s) => s.user_id === user.id), [post.post_saves, user]);

  /** Capture la première frame comme poster pour un affichage immédiat. */
  useEffect(() => {
    const v = ref.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || poster) return;
    const capture = () => {
      try {
        if (v.readyState < 2) return;
        canvas.width = Math.min(v.videoWidth || 640, 1280);
        canvas.height = Math.min(v.videoHeight || 360, 720);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", 0.55);
        setPoster(url);
      } catch {
        /* capture impossible : on laisse le navigateur gérer */
      }
    };
    v.addEventListener("loadeddata", capture, { once: true });
    v.addEventListener("canplay", capture, { once: true });
    return () => {
      v.removeEventListener("loadeddata", capture);
      v.removeEventListener("canplay", capture);
    };
  }, [poster]);

  /** Relance progressive du chargement (backoff) après une erreur ou un blocage. */
  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) return;
    setAttempt((n) => {
      if (n >= MAX_ATTEMPTS) {
        setFailed(true);
        return n;
      }
      retryTimer.current = window.setTimeout(() => {
        retryTimer.current = null;
        const v = ref.current;
        if (v) {
          v.preload = "auto";
          v.load();
        }
      }, 400 * (n + 1));
      return n + 1;
    });
  }, []);

  /** Relance manuelle depuis le bouton « Réessayer ». */
  const retryNow = useCallback(() => {
    setFailed(false);
    setBuffering(true);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(
    () => () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
    },
    [],
  );

  // Préchauffage : les vidéos N+1 et N+2 sont préchargées (metadata) pour une transition fluide.
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
      { rootMargin: "200% 0px" },
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

  /**
   * Stratégie en deux temps : métadonnées d'abord (poids minimal, première image
   * disponible), puis flux complet seulement quand la carte devient active.
   */
  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    v.preload = active ? "auto" : "metadata";
    if (v.readyState === 0) v.load();
  }, [src, active]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      const savedTime = progressStore.get(post.id);
      if (savedTime && Math.abs(v.currentTime - savedTime) > 1) v.currentTime = savedTime;
      const start = () => {
        claimPlayback(v);
        setPaused(false);
        v.play().then(
          () => setFailed(false),
          (error: unknown) => {
            // Blocage autoplay : ce n'est pas une erreur de chargement, on ne relance pas.
            if (error instanceof DOMException && error.name === "NotAllowedError") {
              setPaused(true);
              return;
            }
            scheduleRetry();
          },
        );
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
    releasePlayback(v);
    return;
  }, [active, post.id, counted, user, scheduleRetry, src]);

  /** Chien de garde : si rien ne se charge après 9 s, on relance la source. */
  useEffect(() => {
    if (!active || !buffering || failed) return;
    const timer = window.setTimeout(() => {
      const v = ref.current;
      if (v && v.readyState < 3) scheduleRetry();
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [active, buffering, failed, scheduleRetry]);

  /** Spinner léger différé à 300 ms pour éviter les flashs. */
  useEffect(() => {
    if (!buffering) {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSpinner(true), 300);
    return () => window.clearTimeout(timer);
  }, [buffering]);

  // Le son original de la vidéo suit le réglage de volume choisi.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = Math.min(1, Math.max(0, volume));
    v.muted = muted;
    // Certains navigateurs bloquent la lecture non muette : on relance après le choix.
    if (!muted && active && !paused) void v.play().catch(() => {});
  }, [volume, muted, active, paused]);

  /** Tap sur la vidéo : simple tap = play/pause, double tap = like. */
  const handleVideoTap = useCallback(() => {
    if (tapTimer.current) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      void like();
      setShowHeart(true);
      window.setTimeout(() => setShowHeart(false), 800);
    } else {
      tapTimer.current = window.setTimeout(() => {
        tapTimer.current = null;
        togglePlay();
      }, 260);
    }
  }, []);

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

  const toggleFullscreen = useCallback(async () => {
    const section = sectionRef.current;
    const video = ref.current;
    if (!section && !video) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (section?.requestFullscreen) {
        await section.requestFullscreen();
      } else {
        const anyVideo = video as any;
        if (anyVideo?.webkitEnterFullscreen) await anyVideo.webkitEnterFullscreen();
      }
    } catch {
      /* plein écran non supporté ou refusé */
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

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s <= 0) return "0:00";
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  /** Badge émotion : lecture rapide de la popularité de la vidéo. */
  const emotion =
    post.post_likes.length >= 100 ? "🔥 Populaire" : post.post_likes.length >= 20 ? "❤️ Aimée" : "✨ Nouveau";

  const replay = () => {
    const v = ref.current;
    if (!v) return;
    setEnded(false);
    v.currentTime = 0;
    claimPlayback(v);
    void v.play().catch(() => {});
  };

  const goNext = () => {
    const next = sectionRef.current?.nextElementSibling;
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const isFull = typeof document !== "undefined" && !!document.fullscreenElement;

  return (
    <section
      ref={sectionRef}
      onPointerDown={revealControls}
      className="relative flex h-[calc(100vh-5rem)] snap-start items-end overflow-hidden bg-foreground"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* Fond cinéma : poster très flouté et assombri derrière la vidéo. */}
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-[40px] brightness-[0.4]"
        />
      )}

      {/* Poster net légèrement flouté pendant le chargement, crossfade vers la vidéo. */}
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full object-contain blur-[10px] transition-opacity duration-300",
            ready ? "opacity-0" : "opacity-100",
          )}
        />
      )}

      <video
        ref={ref}
        src={src}
        poster={poster}
        className={cn(
          "video-cine animate-cine-in absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
          isFull ? "rounded-none" : "rounded-xl shadow-lift",
          ready ? "opacity-100" : "opacity-0",
        )}
        playsInline
        muted={muted}
        disablePictureInPicture
        preload={active ? "auto" : warm ? "metadata" : "none"}
        onClick={handleVideoTap}
        onWaiting={() => setBuffering(true)}
        onStalled={() => setBuffering(true)}
        onPlaying={() => {
          setBuffering(false);
          setFailed(false);
          setReady(true);
          setEnded(false);
        }}
        onCanPlay={() => {
          setBuffering(false);
          setReady(true);
        }}
        onLoadedMetadata={(e) => {
          setFailed(false);
          setDuration(e.currentTarget.duration || 0);
        }}
        onError={scheduleRetry}
        onPause={() => setPaused(true)}
        onPlay={() => setPaused(false)}
        onEnded={() => setEnded(true)}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onTimeUpdate={(e) => {
          progressStore.set(post.id, e.currentTarget.currentTime);
          setProgress(e.currentTarget.currentTime);
        }}
      />

      {/* Indicateur de chargement léger différé. */}
      {showSpinner && !ready && !paused && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-9 w-9 animate-spin text-background/70" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-foreground/60 px-8 text-center">
          <div className="text-background">
            <p className="text-sm font-bold">Lecture impossible</p>
            <p className="mt-1 text-xs opacity-70">Le réseau a interrompu le chargement de cette vidéo.</p>
            <button
              type="button"
              onClick={retryNow}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              <RotateCcw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        </div>
      )}

      {/* Animation double-tap like. */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <Heart className="animate-heart-burst h-24 w-24 fill-destructive text-destructive" />
        </div>
      )}

      {(paused || showControls) && !ended && (
        <button
          type="button"
          aria-label={paused ? "Lire la vidéo" : "Mettre en pause"}
          onClick={togglePlay}
          className="absolute inset-0 z-10 grid place-items-center"
        >
          <span className="glass-btn grid h-16 w-16 place-items-center rounded-full text-background">
            {paused ? <Play className="h-8 w-8" /> : <Pause className="h-8 w-8" />}
          </span>
        </button>
      )}

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/85 to-transparent" />

      {/* Badge émotion (haut gauche) et durée (haut droite). */}
      <span
        className={cn(
          "glass-btn absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-bold text-background transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        {emotion}
      </span>

      <div
        className={cn(
          "absolute right-4 top-4 flex items-center gap-2 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="glass-btn rounded-full px-2.5 py-1 text-[11px] font-bold text-background">
          {fmt(duration - progress)}
        </span>
        <button
          type="button"
          aria-label="Plein écran"
          onClick={toggleFullscreen}
          className="glass-btn grid h-11 w-11 place-items-center rounded-full text-background"
        >
          <Maximize className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label={muted ? "Activer le son" : "Couper le son"}
          onClick={onToggleMute}
          className="glass-btn grid h-11 w-11 place-items-center rounded-full text-background"
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
            <span className="bg-cine rounded-full p-[2px]">
              <Avatar person={asPerson(post.author)} size={38} zoomable />
            </span>
            <span className="truncate text-base font-bold [text-shadow:0_1px_4px_oklch(0_0_0/0.6)]">
              {post.author?.full_name ?? "Membre PONZO"}
            </span>
            <FollowButton targetId={post.author_id} initialFollowing={isFollowing} size="sm" />
          </div>
          <p className={cn("mt-3 text-sm leading-relaxed", !expanded && "line-clamp-2")}>
            <HashtagText text={post.body} />
          </p>
          {(post.body?.length ?? 0) > 80 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-semibold opacity-80"
            >
              {expanded ? "Voir moins" : "Voir plus"}
            </button>
          )}
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

        <div
          className={cn(
            "flex shrink-0 flex-col items-center gap-3 text-background transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-60",
          )}
        >
          <Action
            onClick={() => {
              buzz();
              setShowHeart(true);
              window.setTimeout(() => setShowHeart(false), 900);
              void like();
            }}
            icon={<Heart className={cn("h-6 w-6", liked && "fill-destructive text-destructive")} />}
            value={compactCount(post.post_likes.length)}
          />
          <Action
            onClick={() => setShowComments(true)}
            icon={<MessageCircle className="h-6 w-6" />}
            value={compactCount(post.post_comments.length)}
          />
          <Action onClick={() => void share()} icon={<Send className="h-6 w-6" />} value={compactCount(post.share_count)} />
          <Action
            onClick={() => void save()}
            icon={<Bookmark className={cn("h-6 w-6", saved && "fill-background")} />}
            value="Enreg."
          />
          {(post.author?.allow_video_download ?? true) && post.media_url && (
            <Action
              onClick={() => {
                toast.info("Téléchargement en cours…");
                void (async () => {
                  const result = await saveVideoOffline(post.id, post.media_url!, post.body.slice(0, 60) || "Vidéo PONZO");
                  if (result.status === "saved") offlineSuccessToast(result.count);
                  else if (result.status === "already") toast.info("Déjà disponible hors-ligne");
                  else if (result.status === "limit")
                    toast.error("Limite de 20 vidéos hors-ligne atteinte. Supprime-en une pour continuer.");
                  else void downloadMedia(post.media_url!, `ponzo-video-${post.id.slice(0, 8)}.mp4`);
                })();
              }}
              icon={<Download className="h-6 w-6" />}
              value="Télécharger"
            />
          )}
        </div>
      </div>

      {/* Barre de progression cinéma : buffer gris + progression dégradée. */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 touch-none bg-background/20">
        <span
          className="absolute inset-y-0 left-0 bg-background/30"
          style={{ width: `${duration ? Math.min(100, (buffered / duration) * 100) : 0}%` }}
        />
        <span
          className="bg-cine absolute inset-y-0 left-0"
          style={{ width: `${duration ? Math.min(100, (progress / duration) * 100) : 0}%` }}
        />
      </div>

      {/* Écran de fin : revoir, suivante et suggestions. */}
      {ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-foreground/60 px-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={replay}
              className="glass-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-background"
            >
              <RotateCcw className="h-4 w-4" /> Revoir
            </button>
            <button
              type="button"
              onClick={goNext}
              className="bg-cine flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-background"
            >
              <Play className="h-4 w-4" /> Vidéo suivante
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="grid w-full max-w-xs grid-cols-3 gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={goNext}
                  className="aspect-[9/16] overflow-hidden rounded-lg bg-background/15 text-left"
                >
                  <span className="line-clamp-3 block p-1.5 text-[9px] font-semibold text-background">
                    {s.body || "Vidéo PONZO"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
