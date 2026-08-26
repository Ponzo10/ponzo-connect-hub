import {
  Bookmark,
  Download,
  Eye,
  Flag,
  Heart,
  Loader2,

  MessageSquare,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { Badge3D } from "./Badge3D";
import { FollowButton } from "./FollowButton";
import { offlineSuccessToast } from "./OfflineToast";
import { usePhotoViewer } from "./PhotoViewer";
import { SmartImg } from "./SmartImg";

import { HashtagText } from "@/components/ponzo/HashtagText";
import { useAuth } from "@/lib/auth";
import { saveHomeScroll } from "@/lib/home-scroll";
import { saveVideoOffline } from "@/lib/offline-videos";
import { downloadMedia } from "@/lib/trending-api";
import {
  addReply,
  asPerson,
  deleteComment,
  deletePost,
  fetchComments,
  notify,
  reportContent,
  sharePost,
  timeAgo,
  toggleLike,
  toggleSave,
  updateComment,
  updatePost,
  type Comment,
  type FeedPost,
} from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";
import { claimPlayback, releasePlayback, useSoundPreference } from "@/lib/video-sound";

const tagStyle: Record<string, string> = {
  "Je cherche": "bg-primary-soft text-primary",
  "Je propose": "bg-accent-soft text-accent-foreground",
  "Mon projet": "bg-secondary text-secondary-foreground",
};

function PostCardBase({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const viewer = usePhotoViewer();
  const queryClient = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.body);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [savingOffline, setSavingOffline] = useState(false);

  // États optimistes : la réaction est instantanée et n'oblige plus à recharger
  // tout le fil (une invalidation complète rendait chaque « J'aime » très lent).
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null);
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);

  const likedServer = !!user && post.post_likes.some((l) => l.user_id === user.id);
  const savedServer = !!user && (post.post_saves ?? []).some((s) => s.user_id === user.id);
  const liked = likedOverride ?? likedServer;
  const saved = savedOverride ?? savedServer;
  const baseLikeCount = post.like_count ?? post.post_likes.length;
  const likeCount = Math.max(0, baseLikeCount + (liked === likedServer ? 0 : liked ? 1 : -1));
  const isMine = user?.id === post.author_id;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
  };

  const like = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const next = !liked;
      setLikedOverride(next);
      await toggleLike(post.id, user.id, !next);
      if (next && post.author_id !== user.id) {
        await notify({
          userId: post.author_id,
          actorId: user.id,
          kind: "like",
          body: "a aimé ta publication",
          entityId: post.id,
        });
      }
    },
    onError: () => {
      setLikedOverride(null);
      toast.error("Réaction impossible pour le moment.");
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      const next = !saved;
      setSavedOverride(next);
      await toggleSave(post.id, user.id, !next);
      return next;
    },
    onSuccess: (next) => {
      toast.success(next ? "Ajouté aux favoris" : "Retiré des favoris");
      void queryClient.invalidateQueries({ queryKey: ["saved"] });
    },
    onError: () => {
      setSavedOverride(null);
      toast.error("Action impossible pour le moment.");
    },
  });

  const comments = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: openComments,
  });

  const comment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await addReply(post.id, user.id, draft.trim(), replyTo?.id ?? null);
      const target = replyTo?.author_id ?? post.author_id;
      await notify({
        userId: target,
        actorId: user.id,
        kind: "comment",
        body: replyTo ? "a répondu à ton commentaire" : "a commenté ta publication",
        entityId: post.id,
      });
    },
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      void queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      invalidate();
    },
    onError: () => toast.error("Commentaire impossible."),
  });

  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      toast.success("Publication supprimée");
      invalidate();
    },
    onError: () => toast.error("Suppression impossible."),
  });

  const edit = useMutation({
    mutationFn: () => updatePost(post.id, { body: editDraft.trim() }),
    onSuccess: () => {
      setEditing(false);
      toast.success("Publication modifiée");
      invalidate();
    },
    onError: () => toast.error("Modification impossible."),
  });

  const share = async () => {
    const url = `${window.location.origin}/`;
    try {
      await sharePost(post.id);
      invalidate();
    } catch {
      /* compteur indisponible */
    }
    try {
      if (navigator.share) await navigator.share({ title: "PONZO", text: post.body, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié");
      }
    } catch {
      /* annulé */
    }
  };

  const report = async () => {
    if (!user) return;
    const reason = window.prompt("Motif du signalement ?");
    if (!reason) return;
    try {
      await reportContent(user.id, "post", post.id, reason);
      toast.success("Signalement envoyé à la modération");
    } catch {
      toast.error("Signalement impossible.");
    }
    setMenu(false);
  };

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_id === id);

  return (
    <article className="cv-auto mb-3 bg-surface shadow-soft sm:rounded-2xl">
      <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4">
        <Link to="/membre/$id" params={{ id: post.author_id }}>
          <Avatar person={asPerson(post.author)} size={44} />
        </Link>
        <div className="min-w-0">
          <Link
            to="/membre/$id"
            params={{ id: post.author_id }}
            className="flex min-w-0 items-center gap-1 text-sm font-semibold"
          >
            <span className="truncate">{post.author?.full_name ?? "Membre PONZO"}</span>
            <Badge3D kind={post.author?.badge} />
            {post.author?.verified && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                ✓
              </span>
            )}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {timeAgo(post.created_at)}
            {post.author?.title ? ` · ${post.author.title}` : post.author?.role ? ` · ${post.author.role}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <FollowButton targetId={post.author_id} size="sm" />
          <button
            onClick={() => setMenu((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Options de la publication"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>


        {menu && (
          <div className="absolute right-4 top-14 z-20 w-52 overflow-hidden rounded-2xl bg-surface text-sm shadow-lift">
            {isMine && (
              <>
                <MenuItem
                  icon={<Pencil className="h-4 w-4" />}
                  label="Modifier"
                  onClick={() => {
                    setEditing(true);
                    setMenu(false);
                  }}
                />
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Supprimer"
                  destructive
                  onClick={() => {
                    setMenu(false);
                    remove.mutate();
                  }}
                />
              </>
            )}
            <MenuItem
              icon={<Bookmark className="h-4 w-4" />}
              label={saved ? "Retirer des favoris" : "Enregistrer"}
              onClick={() => {
                setMenu(false);
                save.mutate();
              }}
            />
            {!isMine && <MenuItem icon={<Flag className="h-4 w-4" />} label="Signaler" onClick={report} />}
          </div>
        )}
      </div>

      {post.tag && (
        <div className="px-4 pt-3">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tagStyle[post.tag] ?? "bg-muted")}>
            {post.tag}
          </span>
        </div>
      )}

      {editing ? (
        <div className="px-4 py-3">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-2xl bg-muted p-3 text-sm outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => edit.mutate()}
              className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              Enregistrer
            </button>
            <button onClick={() => setEditing(false)} className="rounded-full bg-muted px-4 py-2 text-xs font-semibold">
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed">
          <HashtagText text={post.body} />
        </p>
      )}

      {post.media_url && post.media_type === "image" && (
        <button
          type="button"
          aria-label="Ouvrir la photo en plein écran"
          className="block w-full"
          onClick={() =>
            viewer.open({
              images: [post.media_url!],
              postId: post.id,
              alt: post.body.slice(0, 80) || "Photo PONZO",
              allowDownload: post.author?.allow_photo_download ?? true,
            })
          }
        >
          <SmartImg
            src={post.media_url}
            alt="Visuel de la publication PONZO"
            width={720}
            quality={70}
            className="max-h-[520px] w-full bg-muted object-contain"
          />
        </button>
      )}
      {post.media_url && post.media_type === "video" && (
        <div className="relative">
          <FeedVideo post={post} />
          {(post.author?.allow_video_download ?? true) && (
            <button
              type="button"
              aria-label={savingOffline ? "Sauvegarde en cours" : "Télécharger la vidéo"}
              disabled={savingOffline}
              onClick={() => {
                setSavingOffline(true);
                void (async () => {
                  const title = post.body.slice(0, 60) || "Vidéo PONZO";
                  const result = await saveVideoOffline(post.id, post.media_url!, title);
                  if (result.status === "saved") offlineSuccessToast(result.count);
                  else if (result.status === "already") toast.info("Déjà disponible hors-ligne");
                  else if (result.status === "limit")
                    toast.error("Limite de 20 vidéos hors-ligne atteinte. Supprime-en une pour continuer.");
                  else {
                    toast.info("Téléchargement en cours…");
                    void downloadMedia(post.media_url!, `ponzo-video-${post.id.slice(0, 8)}.mp4`);
                  }
                  setSavingOffline(false);
                })();
              }}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur-sm disabled:opacity-60"
            >
              {savingOffline ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
        <span>{likeCount.toLocaleString("fr-FR")} réactions</span>
        <span>{post.comment_count ?? post.post_comments.length} commentaires</span>
        <span>{(post.share_count ?? 0).toLocaleString("fr-FR")} partages</span>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-border/70 px-2 py-1">
        <ActionButton
          icon={<Heart className={cn("h-[18px] w-[18px]", liked && "fill-current")} />}
          label="J'aime"
          active={liked}
          onClick={() => like.mutate()}
        />
        <ActionButton
          icon={<MessageSquare className="h-[18px] w-[18px]" />}
          label="Commenter"
          active={openComments}
          onClick={() => setOpenComments((v) => !v)}
        />
        <ActionButton icon={<Repeat2 className="h-[18px] w-[18px]" />} label="Partager" onClick={share} />
        <ActionButton
          icon={<Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />}
          label="Favoris"
          active={saved}
          onClick={() => save.mutate()}
        />
      </div>

      {openComments && (
        <div className="space-y-3 border-t border-border/70 px-4 py-3">
          {roots.map((c) => (
            <div key={c.id} className="space-y-2">
              <CommentRow
                comment={c}
                postId={post.id}
                onReply={() => setReplyTo(c)}
              />
              <div className="space-y-2 pl-10">
                {repliesOf(c.id).map((r) => (
                  <CommentRow key={r.id} comment={r} postId={post.id} onReply={() => setReplyTo(c)} small />
                ))}
              </div>
            </div>
          ))}
          {comments.data?.length === 0 && <p className="text-xs text-muted-foreground">Sois le premier à commenter.</p>}

          {replyTo && (
            <p className="flex items-center justify-between rounded-xl bg-muted px-3 py-1.5 text-[11px]">
              Réponse à {replyTo.author?.full_name ?? "ce commentaire"}
              <button onClick={() => setReplyTo(null)} className="font-semibold text-primary">
                Annuler
              </button>
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) comment.mutate();
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? "Écrire une réponse…" : "Écrire un commentaire…"}
              className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="grid h-9 w-9 place-items-center rounded-full bg-brand text-primary-foreground"
              aria-label="Envoyer le commentaire"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

// Le fil rend des dizaines de cartes : sans mémoïsation, chaque changement
// d'état parent (pagination, actualités) re-rendait toutes les publications.
export const PostCard = memo(PostCardBase, (a, b) => {
  const x = a.post;
  const y = b.post;
  return (
    x.id === y.id &&
    x.body === y.body &&
    x.media_url === y.media_url &&
    x.like_count === y.like_count &&
    x.comment_count === y.comment_count &&
    x.share_count === y.share_count &&
    x.post_likes.length === y.post_likes.length &&
    (x.post_saves?.length ?? 0) === (y.post_saves?.length ?? 0)
  );
});

/**
 * Lecture automatique type Facebook : muet par défaut, démarre quand 60 % de la
 * carte est visible, se met en pause dès qu'elle sort, et un clic au centre
 * ouvre le lecteur plein écran avec le son.
 */
function FeedVideo({ post }: { post: FeedPost }) {
  const navigate = useNavigate();
  const ref = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { muted, volume, persist } = useSoundPreference();
  const [near, setNear] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);

  // Préchargement (métadonnées) à l'approche de l'écran + détection du seuil 60 %.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const warm = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          warm.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    const play = new IntersectionObserver(([entry]) => setActive(!!entry && entry.intersectionRatio >= 0.6), {
      threshold: [0, 0.6, 1],
    });
    warm.observe(node);
    play.observe(node);
    return () => {
      warm.disconnect();
      play.disconnect();
    };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = muted;
    v.volume = Math.min(1, Math.max(0, volume));
  }, [muted, volume]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      setNear(true);
      v.preload = "auto";
      claimPlayback(v);
      void v.play().catch(() => {});
      return;
    }
    v.pause();
    releasePlayback(v);
    return;
  }, [active]);

  useEffect(() => {
    const v = ref.current;
    return () => {
      if (v) releasePlayback(v);
    };
  }, []);

  // #t=0.001 force iOS/Android à n'obtenir que le premier segment : première
  // image immédiate au lieu d'un cadre noir.
  const streamSrc = near ? `${post.media_url}${post.media_url?.includes("#") ? "" : "#t=0.001"}` : undefined;
  const views = post.view_count ?? 0;

  return (
    <div ref={wrapRef} className="relative w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={ref}
        {...(streamSrc ? { src: streamSrc } : {})}
        muted={muted}
        loop
        playsInline
        preload={near ? "metadata" : "none"}
        onLoadedMetadata={() => setReady(true)}
        onWaiting={() => setBuffering(true)}
        onStalled={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
        className="aspect-[4/5] w-full bg-black object-cover"
      />

      {/* Zone centrale cliquable : ouvre le lecteur plein écran avec le son. */}
      <button
        type="button"
        aria-label="Ouvrir la vidéo en plein écran"
        onClick={() => {
          saveHomeScroll();
          void navigate({ to: "/video/$id", params: { id: post.id } });
        }}
        className="absolute inset-0"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-4 pt-10">
        <div className="flex items-center gap-2">
          <Avatar person={asPerson(post.author)} size={28} />
          <span className="truncate text-xs font-semibold text-white">{post.author?.full_name ?? "Membre PONZO"}</span>
        </div>
        {post.body && <p className="mt-1 line-clamp-1 text-xs text-white/90">{post.body}</p>}
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/70">
          <Eye className="h-3 w-3" />
          {views.toLocaleString("fr-FR")} vues
          {muted && <VolumeX className="ml-1 h-3 w-3" />}
        </p>
      </div>

      <button
        type="button"
        aria-label={muted ? "Activer le son" : "Couper le son"}
        onClick={() => persist({ muted: !muted, volume: volume || 1 })}
        className="glass-btn absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full text-white"
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/20">
        <div className="h-full bg-white/90 transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>

      {!ready && (
        <div className="absolute inset-0 grid animate-pulse place-items-center bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-background/80" />
        </div>
      )}
      {ready && buffering && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-background drop-shadow" />
        </div>
      )}
    </div>
  );
}



function CommentRow({
  comment,
  postId,
  onReply,
  small,
}: {
  comment: Comment;
  postId: string;
  onReply: () => void;
  small?: boolean | undefined;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.body);
  const mine = user?.id === comment.author_id;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
      <Avatar person={asPerson(comment.author)} size={small ? 26 : 32} />
      <div className="min-w-0">
        <div className="rounded-2xl bg-muted px-3 py-2">
          <p className="flex items-center gap-1 text-xs font-semibold">
            {comment.author?.full_name ?? "Membre"}
            <Badge3D kind={comment.author?.badge} />
          </p>
          {editing ? (
            <div className="mt-1 flex gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="min-w-0 flex-1 rounded-full bg-surface px-3 py-1.5 text-sm outline-none"
              />
              <button
                onClick={async () => {
                  await updateComment(comment.id, value.trim());
                  setEditing(false);
                  refresh();
                }}
                className="text-xs font-bold text-primary"
              >
                OK
              </button>
            </div>
          ) : (
            <p className="text-sm">{comment.body}</p>
          )}
        </div>
        <div className="mt-1 flex gap-3 pl-3 text-[11px] font-semibold text-muted-foreground">
          <span>{timeAgo(comment.created_at)}</span>
          <button onClick={onReply}>Répondre</button>
          {mine && <button onClick={() => setEditing((v) => !v)}>Modifier</button>}
          {mine && (
            <button
              className="text-destructive"
              onClick={async () => {
                await deleteComment(comment.id);
                refresh();
              }}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean | undefined;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-muted",
        destructive && "text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ActionButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span className="hidden min-[380px]:inline">{label}</span>
    </button>
  );
}
