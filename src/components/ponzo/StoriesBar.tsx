import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, Loader2, MessageCircle, Plus, Send, Share2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { asPerson, notify, timeAgo } from "@/lib/ponzo-api";
import {
  addStoryComment,
  createStory,
  deleteStory,
  fetchStories,
  fetchStoryComments,
  fetchStoryViewers,
  groupStories,
  recordStoryView,
  toggleStoryLike,
  type Story,
  type StoryGroup,
} from "@/lib/stories-api";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";

export function StoriesBar() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openGroup, setOpenGroup] = useState<StoryGroup | null>(null);

  const stories = useQuery({ queryKey: ["stories"], queryFn: fetchStories, staleTime: 15000 });
  const groups = groupStories(stories.data ?? [], user?.id);

  useEffect(() => {
    const channel = supabase
      .channel("stories-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["stories"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const pick = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const result = await uploadMedia(user.id, file, "stories");
      await createStory({
        authorId: user.id,
        mediaUrl: result.url,
        mediaType: result.kind === "video" ? "video" : "image",
      });
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story publiée — visible 24 h.");
    } catch {
      toast.error("Publication de la story impossible.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="mt-4">
      <h2 className="sr-only">Stories</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative flex h-44 w-28 shrink-0 flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl bg-surface p-2 shadow-soft"
        >
          <span className="absolute inset-x-0 top-0 flex justify-center pt-3">
            <Avatar person={asPerson(profile)} size={56} />
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-primary-foreground">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </span>
          <span className="w-full truncate text-center text-[11px] font-semibold">Ma story</span>
        </button>

        {groups.map((g) => {
          const cover = g.stories[g.stories.length - 1]!;
          return (
            <button
              key={g.authorId}
              type="button"
              onClick={() => setOpenGroup(g)}
              className="relative flex h-44 w-28 shrink-0 flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl bg-secondary p-2 text-left shadow-soft"
            >
              {cover.media_type === "image" ? (
                <img
                  src={cover.media_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
              ) : (
                <span className="absolute inset-0 bg-gradient-to-b from-primary/70 to-foreground/80" />
              )}
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-foreground/85 to-transparent" />
              <span className="absolute left-2 top-2">
                <Avatar person={asPerson(g.author)} size={38} ring={!g.seen} />
              </span>
              <span className="relative w-full truncate text-center text-[11px] font-semibold text-background">
                {g.author?.full_name ?? "Membre"}
              </span>
            </button>
          );
        })}

        {groups.length === 0 && !stories.isLoading && (
          <p className="grid h-44 place-items-center px-2 text-xs text-muted-foreground">
            Aucune story pour l'instant.
          </p>
        )}
      </div>

      {openGroup && <StoryViewer group={openGroup} onClose={() => setOpenGroup(null)} />}
    </section>
  );
}

function StoryViewer({ group, onClose }: { group: StoryGroup; onClose: () => void }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [panel, setPanel] = useState<"none" | "comments" | "viewers">("none");
  const story = group.stories[index];

  useEffect(() => {
    if (!story || !user) return;
    void recordStoryView(story.id, user.id).then(() =>
      queryClient.invalidateQueries({ queryKey: ["stories"] }),
    );
  }, [story?.id, user?.id, queryClient, story, user]);

  useEffect(() => {
    if (panel !== "none" || !story || story.media_type === "video") return;
    const t = setTimeout(() => {
      if (index < group.stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 6000);
    return () => clearTimeout(t);
  }, [index, panel, story, group.stories.length, onClose]);

  if (!story) return null;

  const isOwner = user?.id === story.author_id;
  const liked = !!user && story.story_likes.some((l) => l.user_id === user.id);

  const like = async () => {
    if (!user) return;
    try {
      await toggleStoryLike(story.id, user.id, liked);
      if (!liked) {
        await notify({
          userId: story.author_id,
          actorId: user.id,
          kind: "story_like",
          body: `${profile?.full_name ?? "Un membre"} a aimé votre story ❤️`,
          entityId: story.id,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
    } catch {
      toast.error("Réaction impossible.");
    }
  };

  const share = async () => {
    if (!story.allow_share) {
      toast.error("Le propriétaire n'autorise pas le partage.");
      return;
    }
    const url = `${window.location.origin}/membre/${story.author_id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Story PONZO", url });
      else await navigator.clipboard.writeText(url);
      toast.success("Story partagée");
      if (user) {
        await notify({
          userId: story.author_id,
          actorId: user.id,
          kind: "story_share",
          body: `${profile?.full_name ?? "Un membre"} a partagé votre story.`,
          entityId: story.id,
        });
      }
    } catch {
      /* partage annulé */
    }
  };

  const remove = async () => {
    try {
      await deleteStory(story.id);
      await queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story supprimée");
      onClose();
    } catch {
      toast.error("Suppression impossible.");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-foreground">
      <div className="flex items-center gap-1.5 px-3 pt-3">
        {group.stories.map((_, i) => (
          <span
            key={i}
            className={cn("h-1 flex-1 rounded-full", i <= index ? "bg-background" : "bg-background/30")}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-3 text-background">
        <Avatar person={asPerson(story.author)} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{story.author?.full_name ?? "Membre PONZO"}</p>
          <p className="text-[11px] opacity-75">{timeAgo(story.created_at)}</p>
        </div>
        {isOwner && (
          <button type="button" aria-label="Supprimer la story" onClick={() => void remove()} className="p-2">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <button type="button" aria-label="Fermer" onClick={onClose} className="p-2">
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {story.media_type === "video" ? (
          <video
            src={story.media_url}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            controls
            onEnded={() => (index < group.stories.length - 1 ? setIndex(index + 1) : onClose())}
          />
        ) : (
          <img src={story.media_url} alt={story.caption ?? "Story"} className="h-full w-full object-contain" />
        )}
        <button
          type="button"
          aria-label="Story précédente"
          className="absolute inset-y-0 left-0 w-1/3"
          onClick={() => (index > 0 ? setIndex(index - 1) : undefined)}
        />
        <button
          type="button"
          aria-label="Story suivante"
          className="absolute inset-y-0 right-0 w-1/3"
          onClick={() => (index < group.stories.length - 1 ? setIndex(index + 1) : onClose())}
        />
        {story.caption && (
          <p className="absolute inset-x-0 bottom-3 px-5 text-center text-sm text-background drop-shadow">
            {story.caption}
          </p>
        )}
      </div>

      <div className="flex items-center justify-around border-t border-background/15 px-4 py-3 text-background">
        <button type="button" onClick={() => void like()} className="flex items-center gap-1.5 text-sm font-semibold">
          <Heart className={cn("h-6 w-6", liked && "fill-destructive text-destructive")} />
          {story.story_likes.length}
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "comments" ? "none" : "comments")}
          className="flex items-center gap-1.5 text-sm font-semibold"
        >
          <MessageCircle className="h-6 w-6" />
          {story.story_comments.length}
        </button>
        <button type="button" onClick={() => void share()} className="flex items-center gap-1.5 text-sm font-semibold">
          <Share2 className="h-6 w-6" />
        </button>
        {isOwner && (
          <button
            type="button"
            onClick={() => setPanel(panel === "viewers" ? "none" : "viewers")}
            className="flex items-center gap-1.5 text-sm font-semibold"
          >
            <Eye className="h-6 w-6" />
            {story.story_views.length}
          </button>
        )}
      </div>

      {panel === "comments" && <StoryComments story={story} onClose={() => setPanel("none")} />}
      {panel === "viewers" && <StoryViewers storyId={story.id} onClose={() => setPanel("none")} />}
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-lift">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">{title}</p>
        <button type="button" aria-label="Fermer" onClick={onClose}>
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function StoryComments({ story, onClose }: { story: Story; onClose: () => void }) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const comments = useQuery({
    queryKey: ["story-comments", story.id],
    queryFn: () => fetchStoryComments(story.id),
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !text.trim()) return;
      await addStoryComment(story.id, user.id, text.trim(), replyTo?.id ?? null);
      await notify({
        userId: replyTo ? story.author_id : story.author_id,
        actorId: user.id,
        kind: "story_comment",
        body: `${profile?.full_name ?? "Un membre"} a commenté votre story : « ${text.trim().slice(0, 60)} »`,
        entityId: story.id,
      });
    },
    onSuccess: () => {
      setText("");
      setReplyTo(null);
      void comments.refetch();
      void queryClient.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: () => toast.error("Commentaire impossible."),
  });

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);

  return (
    <Sheet title="Commentaires" onClose={onClose}>
      <div className="space-y-3">
        {roots.map((c) => (
          <div key={c.id}>
            <CommentRow
              name={c.author?.full_name ?? "Membre"}
              avatar={asPerson(c.author)}
              body={c.body}
              at={c.created_at}
              onReply={() => setReplyTo({ id: c.id, name: c.author?.full_name ?? "Membre" })}
            />
            <div className="ml-10 mt-2 space-y-2">
              {(comments.data ?? [])
                .filter((r) => r.parent_id === c.id)
                .map((r) => (
                  <CommentRow
                    key={r.id}
                    name={r.author?.full_name ?? "Membre"}
                    avatar={asPerson(r.author)}
                    body={r.body}
                    at={r.created_at}
                  />
                ))}
            </div>
          </div>
        ))}
        {roots.length === 0 && <p className="text-xs text-muted-foreground">Aucun commentaire pour l'instant.</p>}
      </div>

      {/* Stickers : réaction instantanée à la story en un seul geste. */}
      <div className="sticky bottom-16 mt-3 flex gap-1 overflow-x-auto bg-surface pb-1 no-scrollbar">
        {STORY_STICKERS.map((sticker) => (
          <button
            key={sticker}
            type="button"
            aria-label={`Envoyer ${sticker}`}
            disabled={send.isPending}
            onClick={() => {
              setText(sticker);
              // Envoi immédiat du sticker choisi.
              setTimeout(() => send.mutate(), 0);
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xl transition-transform active:scale-90"
          >
            {sticker}
          </button>
        ))}
      </div>

      <form
        className="sticky bottom-0 mt-4 flex items-center gap-2 bg-surface pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? `Répondre à ${replyTo.name}…` : "Ajouter un commentaire…"}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={send.isPending || !text.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </Sheet>
  );
}

function CommentRow({
  name,
  avatar,
  body,
  at,
  onReply,
}: {
  name: string;
  avatar: { name: string; tone: "green" | "gold" | "teal" | "sand"; src: string | null };
  body: string;
  at: string;
  onReply?: (() => void) | undefined;
}) {
  return (
    <div className="flex gap-2">
      <Avatar person={avatar} size={32} zoomable />
      <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
        <p className="text-xs font-bold">{name}</p>
        <p className="text-sm">{body}</p>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{timeAgo(at)}</span>
          {onReply && (
            <button type="button" onClick={onReply} className="font-semibold">
              Répondre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StoryViewers({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const viewers = useQuery({ queryKey: ["story-viewers", storyId], queryFn: () => fetchStoryViewers(storyId) });

  return (
    <Sheet title={`Vues (${viewers.data?.length ?? 0})`} onClose={onClose}>
      <ul className="space-y-3">
        {(viewers.data ?? []).map((v) => (
          <li key={v.viewer_id} className="flex items-center gap-3">
            <Avatar person={asPerson(v.viewer)} size={36} zoomable />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{v.viewer?.full_name ?? "Membre PONZO"}</p>
              <p className="text-[11px] text-muted-foreground">{v.viewer?.role ?? "Membre"}</p>
            </div>
            <span className="text-[11px] text-muted-foreground">{timeAgo(v.created_at)}</span>
          </li>
        ))}
        {viewers.data?.length === 0 && <p className="text-xs text-muted-foreground">Personne n'a encore vu cette story.</p>}
      </ul>
    </Sheet>
  );
}
