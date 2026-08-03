import { Bookmark, Heart, MessageSquare, MoreHorizontal, Repeat2, Send, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  addComment,
  asPerson,
  fetchComments,
  notify,
  timeAgo,
  toggleLike,
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
  const queryClient = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState("");

  const liked = !!user && post.post_likes.some((l) => l.user_id === user.id);
  const likeCount = post.post_likes.length;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
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
    onError: () => toast.error("Connecte-toi pour réagir aux publications."),
  });

  const comments = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: openComments,
  });

  const comment = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await addComment(post.id, user.id, draft.trim());
      await notify({
        userId: post.author_id,
        actorId: user.id,
        kind: "comment",
        body: "a commenté ta publication",
        entityId: post.id,
      });
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["comments", post.id] });
      invalidate();
    },
    onError: () => toast.error("Connecte-toi pour commenter."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Publication supprimée");
      invalidate();
    },
  });

  const share = async () => {
    const url = `${window.location.origin}/`;
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

  return (
    <article className="mb-3 bg-surface shadow-soft sm:rounded-2xl">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4">
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
            {post.author?.verified && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                ✓
              </span>
            )}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {timeAgo(post.created_at)}
            {post.author?.role ? ` · ${post.author.role}` : ""}
          </p>
        </div>
        {user?.id === post.author_id ? (
          <button
            onClick={() => remove.mutate()}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Supprimer la publication"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        ) : (
          <button
            onClick={share}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Options de la publication"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>

      {post.tag && (
        <div className="px-4 pt-3">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tagStyle[post.tag] ?? "bg-muted")}>
            {post.tag}
          </span>
        </div>
      )}

      <p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed">{post.body}</p>

      {post.media_url && post.media_type === "image" && (
        <img
          src={post.media_url}
          alt="Visuel de la publication PONZO"
          loading="lazy"
          className="max-h-[520px] w-full object-cover"
        />
      )}

      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
        <span>{likeCount.toLocaleString("fr-FR")} réactions</span>
        <span>{post.post_comments.length} commentaires</span>
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
          label="Enregistrer"
          active={saved}
          onClick={() => {
            setSaved((v) => !v);
            toast.success(saved ? "Retiré des enregistrements" : "Enregistré");
          }}
        />
      </div>

      {openComments && (
        <div className="space-y-3 border-t border-border/70 px-4 py-3">
          {comments.data?.map((c) => (
            <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
              <Avatar person={asPerson(c.author)} size={32} />
              <div className="rounded-2xl bg-muted px-3 py-2">
                <p className="text-xs font-semibold">{c.author?.full_name ?? "Membre"}</p>
                <p className="text-sm">{c.body}</p>
              </div>
            </div>
          ))}
          {comments.data?.length === 0 && (
            <p className="text-xs text-muted-foreground">Sois le premier à commenter.</p>
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
              placeholder="Écrire un commentaire…"
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
