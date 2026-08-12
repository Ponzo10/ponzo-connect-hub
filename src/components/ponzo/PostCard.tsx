import {
  Bookmark,
  Download,
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Send,
  Trash2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { Badge3D } from "./Badge3D";
import { FollowButton } from "./FollowButton";
import { usePhotoViewer } from "./PhotoViewer";

import { HashtagText } from "@/components/ponzo/HashtagText";
import { useAuth } from "@/lib/auth";
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

const tagStyle: Record<string, string> = {
  "Je cherche": "bg-primary-soft text-primary",
  "Je propose": "bg-accent-soft text-accent-foreground",
  "Mon projet": "bg-secondary text-secondary-foreground",
};

export function PostCard({ post }: { post: FeedPost }) {
  const { user } = useAuth();
  const viewer = usePhotoViewer();
  const queryClient = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.body);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const liked = !!user && post.post_likes.some((l) => l.user_id === user.id);
  const saved = !!user && (post.post_saves ?? []).some((s) => s.user_id === user.id);
  const likeCount = post.like_count ?? post.post_likes.length;
  const isMine = user?.id === post.author_id;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
  };

  const like = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await toggleLike(post.id, user.id, liked);
      if (!liked && post.author_id !== user.id) {
        await notify({
          userId: post.author_id,
          actorId: user.id,
          kind: "like",
          body: "a aimé ta publication",
          entityId: post.id,
        });
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error("Réaction impossible pour le moment."),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await toggleSave(post.id, user.id, saved);
    },
    onSuccess: () => {
      toast.success(saved ? "Retiré des favoris" : "Ajouté aux favoris");
      invalidate();
    },
    onError: () => toast.error("Action impossible pour le moment."),
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
    <article className="mb-3 bg-surface shadow-soft sm:rounded-2xl">
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
          <img
            src={post.media_url}
            alt="Visuel de la publication PONZO"
            loading="lazy"
            decoding="async"
            className="max-h-[520px] w-full bg-muted object-contain"
          />
        </button>
      )}
      {post.media_url && post.media_type === "video" && (
        <div className="relative">
          <video
            src={post.media_url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[520px] w-full bg-black object-contain"
          />
          {(post.author?.allow_video_download ?? true) && (
            <button
              type="button"
              aria-label="Télécharger la vidéo"
              onClick={() => {
                toast.info("Téléchargement en cours…");
                void downloadMedia(post.media_url!, `ponzo-video-${post.id.slice(0, 8)}.mp4`);
              }}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur-sm"
            >
              <Download className="h-4 w-4" />
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
