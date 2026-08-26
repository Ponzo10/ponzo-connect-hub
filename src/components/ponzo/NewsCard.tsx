import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Eye, Heart, MessageSquare, Newspaper, Repeat2, Send, Trash2 } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";

import { useAuth } from "@/lib/auth";
import {
  addNewsComment,
  deleteNewsComment,
  fetchNewsComments,
  newsDateTime,
  repostNews,
  shareNews,
  toggleNewsLike,
  toggleNewsSave,
  type NewsComment,
  type NewsItem,
} from "@/lib/news-api";
import { asPerson, timeAgo } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";
import { SmartImg } from "./SmartImg";

function NewsCardBase({ article, detailed = false }: { article: NewsItem; detailed?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openComments, setOpenComments] = useState(detailed);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<NewsComment | null>(null);

  const liked = !!user && (article.news_likes ?? []).some((l) => l.user_id === user.id);
  const saved = !!user && (article.news_saves ?? []).some((s) => s.user_id === user.id);
  const { date, time } = newsDateTime(article.published_at);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["news"] });
    void queryClient.invalidateQueries({ queryKey: ["news-article", article.id] });
  };

  const requireAuth = () => {
    if (!user) {
      toast.error("Connecte-toi pour interagir avec les actualités.");
      return false;
    }
    return true;
  };

  const likeM = useMutation({
    mutationFn: () => toggleNewsLike(article.id, user!.id, liked),
    onSuccess: invalidate,
    onError: () => toast.error("Action impossible."),
  });
  const saveM = useMutation({
    mutationFn: () => toggleNewsSave(article.id, user!.id, saved),
    onSuccess: () => {
      invalidate();
      toast.success(saved ? "Retiré des favoris" : "Ajouté aux favoris");
    },
    onError: () => toast.error("Action impossible."),
  });
  const repostM = useMutation({
    mutationFn: () => repostNews(article, user!.id),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Actualité republiée sur ton profil");
    },
    onError: () => toast.error("Republication impossible."),
  });
  const shareM = useMutation({
    mutationFn: () => shareNews(article),
    onSuccess: () => {
      invalidate();
      toast.success("Lien de l'actualité prêt à partager");
    },
  });

  const comments = useQuery({
    queryKey: ["news-comments", article.id],
    queryFn: () => fetchNewsComments(article.id),
    enabled: openComments,
    // Les commentaires déjà chargés sont gardés en cache : rouvrir la
    // section ne relance plus de requête réseau.
    staleTime: 60_000,
  });

  const commentM = useMutation({
    mutationFn: () => addNewsComment(article.id, user!.id, draft.trim(), replyTo?.id ?? null),
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      void comments.refetch();
      invalidate();
    },
    onError: () => toast.error("Commentaire impossible."),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteNewsComment(id),
    onSuccess: () => {
      void comments.refetch();
      invalidate();
    },
  });

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_id === id);

  return (
    <article className="mb-3 overflow-hidden rounded-2xl bg-surface shadow-soft">
      {article.image_url && (
        <Link to="/actualite/$id" params={{ id: article.id }} className="block">
          <SmartImg
            src={article.image_url}
            alt={article.title}
            width={720}
            quality={65}
            className={cn("w-full object-cover", detailed ? "max-h-80" : "h-44")}
          />
        </Link>
      )}
      <div className="p-3.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-bold text-primary">
            <Newspaper className="h-3 w-3" /> Actualité
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{article.category}</span>
          {article.is_important && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">À la une</span>
          )}
        </div>

        <Link to="/actualite/$id" params={{ id: article.id }} className="mt-2 block">
          <h3 className={cn("font-bold leading-snug", detailed ? "text-xl" : "text-base")}>{article.title}</h3>
        </Link>
        {article.summary && (
          <p className={cn("mt-1.5 text-sm text-muted-foreground", !detailed && "line-clamp-3")}>{article.summary}</p>
        )}
        {detailed && article.content && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{article.content}</p>
        )}

        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">{article.source}</span> · {date} · {time} ·{" "}
          {timeAgo(article.published_at)}
        </p>
        {detailed && article.source_url && (
          <a
            href={article.source_url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-block text-xs font-semibold text-primary underline"
          >
            Lire l'article original
          </a>
        )}

        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> {article.view_count}
          </span>
          <span>{(article.news_likes ?? []).length} J'aime</span>
          <span>{(article.news_comments ?? []).length} com.</span>
          <span>{article.share_count} partages</span>
          <span>{article.repost_count} republ.</span>
        </div>

        <div className="mt-2.5 grid grid-cols-5 gap-1 border-t border-border/70 pt-2">
          <Action
            icon={<Heart className={cn("h-[18px] w-[18px]", liked && "fill-destructive text-destructive")} />}
            label="J'aime"
            active={liked}
            onClick={() => requireAuth() && likeM.mutate()}
          />
          <Action
            icon={<MessageSquare className="h-[18px] w-[18px]" />}
            label="Com."
            onClick={() => setOpenComments((v) => !v)}
          />
          <Action icon={<Send className="h-[18px] w-[18px]" />} label="Partager" onClick={() => shareM.mutate()} />
          <Action
            icon={<Repeat2 className="h-[18px] w-[18px]" />}
            label="Republier"
            onClick={() => requireAuth() && repostM.mutate()}
          />
          <Action
            icon={<Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-primary text-primary")} />}
            label="Favori"
            active={saved}
            onClick={() => requireAuth() && saveM.mutate()}
          />
        </div>

        {openComments && (
          <div className="mt-3 space-y-3 border-t border-border/70 pt-3">
            {comments.isLoading && <p className="text-xs text-muted-foreground">Chargement des commentaires…</p>}
            {roots.map((c) => (
              <div key={c.id}>
                <CommentRow
                  comment={c}
                  canDelete={user?.id === c.author_id}
                  onReply={() => setReplyTo(c)}
                  onDelete={() => deleteM.mutate(c.id)}
                />
                <div className="ml-9 mt-2 space-y-2">
                  {repliesOf(c.id).map((r) => (
                    <CommentRow
                      key={r.id}
                      comment={r}
                      canDelete={user?.id === r.author_id}
                      onReply={() => setReplyTo(c)}
                      onDelete={() => deleteM.mutate(r.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {!comments.isLoading && roots.length === 0 && (
              <p className="text-xs text-muted-foreground">Sois le premier à commenter cette actualité.</p>
            )}

            {replyTo && (
              <p className="text-[11px] text-muted-foreground">
                Réponse à {replyTo.author?.full_name ?? "un membre"} ·{" "}
                <button className="font-semibold text-primary" onClick={() => setReplyTo(null)}>
                  annuler
                </button>
              </p>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!requireAuth() || !draft.trim()) return;
                commentM.mutate();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Écrire un commentaire…"
                className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || commentM.isPending}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
                aria-label="Envoyer le commentaire"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}

// Mémorisé : une actualité n'est re-rendue que si son contenu change,
// pas à chaque rafraîchissement de la liste parente.
export const NewsCard = memo(NewsCardBase, (a, b) => a.article === b.article && a.detailed === b.detailed);

function CommentRow({
  comment,
  canDelete,
  onReply,
  onDelete,
}: {
  comment: NewsComment;
  canDelete: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Avatar person={asPerson(comment.author)} size={28} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted px-3 py-2">
          <p className="text-xs font-bold">{comment.author?.full_name ?? "Membre PONZO"}</p>
          <p className="text-sm">{comment.body}</p>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-2 text-[11px] text-muted-foreground">
          <span>{timeAgo(comment.created_at)}</span>
          <button className="font-semibold" onClick={onReply}>
            Répondre
          </button>
          {canDelete && (
            <button className="inline-flex items-center gap-1 font-semibold text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" /> Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Action({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors hover:bg-muted",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
