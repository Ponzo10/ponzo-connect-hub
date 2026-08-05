import { Bookmark, ChevronLeft, ChevronRight, Download, Heart, MessageSquare, Send, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth";
import {
  addReply,
  asPerson,
  fetchComments,
  fetchPost,
  notify,
  sharePost,
  timeAgo,
  toggleLike,
  toggleSave,
  type Comment,
} from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export type PhotoViewerOptions = {
  images: string[];
  index?: number;
  alt?: string;
  postId?: string | null;
  /** false = téléchargement interdit par le propriétaire */
  allowDownload?: boolean;
};

type Viewer = {
  open: (srcOrOptions: string | PhotoViewerOptions, alt?: string) => void;
};

const PhotoViewerContext = createContext<Viewer>({ open: () => {} });

export function usePhotoViewer() {
  return useContext(PhotoViewerContext);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function ZoomableImage({
  src,
  alt,
  onSwipe,
  onClose,
}: {
  src: string;
  alt: string;
  onSwipe: (dir: 1 | -1) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const startDist = useRef(0);
  const startScale = useRef(1);
  const startOffset = useRef({ x: 0, y: 0 });
  const startPoint = useRef({ x: 0, y: 0 });
  const lastTap = useRef(0);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [src]);

  const applyZoom = useCallback(
    (next: number, cx: number, cy: number) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const px = cx - rect.left - rect.width / 2;
      const py = cy - rect.top - rect.height / 2;
      setScale((prev) => {
        const target = clamp(next, 1, 5);
        const k = target / prev;
        setOffset((o) =>
          target === 1 ? { x: 0, y: 0 } : { x: px - (px - o.x) * k, y: py - (py - o.y) * k },
        );
        return target;
      });
    },
    [],
  );

  // Molette / pinch trackpad (non passif pour bloquer le zoom navigateur)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setScale((prev) => {
        const target = clamp(prev * Math.exp(-dy * 0.0018), 1, 5);
        if (target === 1) setOffset({ x: 0, y: 0 });
        return target;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    startOffset.current = offset;
    startScale.current = scale;
    startPoint.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      startDist.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (startDist.current > 0) {
        applyZoom(
          startScale.current * (dist / startDist.current),
          (a!.x + b!.x) / 2,
          (a!.y + b!.y) / 2,
        );
      }
      return;
    }

    if (scale > 1) {
      setOffset({
        x: startOffset.current.x + (e.clientX - startPoint.current.x),
        y: startOffset.current.y + (e.clientY - startPoint.current.y),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startPoint.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) startDist.current = 0;

    if (!wasSingle) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      onSwipe(dx < 0 ? 1 : -1);
      return;
    }
    if (scale === 1 && dy > 110 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        applyZoom(scale > 1 ? 1 : 2.6, e.clientX, e.clientY);
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
    }
  };

  return (
    <div
      ref={ref}
      className="relative flex h-full w-full touch-none items-center justify-center overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        decoding="async"
        className="max-h-full max-w-full object-contain"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: pointers.current.size ? "none" : "transform 160ms ease-out",
          willChange: "transform",
        }}
      />
    </div>
  );
}

function EngagementBar({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openComments, setOpenComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const post = useQuery({ queryKey: ["post", postId], queryFn: () => fetchPost(postId) });
  const comments = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => fetchComments(postId),
    enabled: openComments,
  });

  const data = post.data;
  const liked = !!user && !!data?.post_likes.some((l) => l.user_id === user.id);
  const saved = !!user && !!data?.post_saves?.some((s) => s.user_id === user.id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["post", postId] });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["posts"] });
    void queryClient.invalidateQueries({ queryKey: ["saved"] });
  };

  const like = useMutation({
    mutationFn: async () => {
      if (!user || !data) throw new Error("auth");
      await toggleLike(postId, user.id, liked);
      if (!liked)
        await notify({
          userId: data.author_id,
          actorId: user.id,
          kind: "like",
          body: "a aimé ta photo ❤️",
          entityId: postId,
        });
    },
    onSuccess: refresh,
    onError: () => toast.error("Réaction impossible."),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await toggleSave(postId, user.id, saved);
    },
    onSuccess: () => {
      toast.success(saved ? "Retiré des favoris" : "Ajouté aux favoris");
      refresh();
    },
    onError: () => toast.error("Action impossible."),
  });

  const comment = useMutation({
    mutationFn: async () => {
      if (!user || !data || !draft.trim()) throw new Error("auth");
      await addReply(postId, user.id, draft.trim(), replyTo?.id ?? null);
      await notify({
        userId: replyTo?.author_id ?? data.author_id,
        actorId: user.id,
        kind: "comment",
        body: replyTo ? "a répondu à ton commentaire" : "a commenté ta photo",
        entityId: postId,
      });
    },
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
      void queryClient.invalidateQueries({ queryKey: ["comments", postId] });
      refresh();
    },
    onError: () => toast.error("Commentaire impossible."),
  });

  const share = async () => {
    const url = `${window.location.origin}/publication/${postId}`;
    try {
      await sharePost(postId);
      refresh();
    } catch {
      /* compteur indisponible */
    }
    try {
      if (navigator.share) await navigator.share({ title: "PONZO", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié");
      }
    } catch {
      /* annulé */
    }
  };

  if (!data) return null;

  const roots = (comments.data ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments.data ?? []).filter((c) => c.parent_id === id);

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent pb-[env(safe-area-inset-bottom)] pt-8 text-white"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-4 text-xs">
        <Avatar person={asPerson(data.author)} size={30} />
        <span className="min-w-0 truncate font-semibold">{data.author?.full_name ?? "Membre PONZO"}</span>
        <span className="text-white/60">{timeAgo(data.created_at)}</span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1 px-2 pb-3">
        <ViewerAction
          onClick={() => like.mutate()}
          icon={<Heart className={cn("h-5 w-5", liked && "fill-current text-red-500")} />}
          label={String(data.post_likes.length)}
        />
        <ViewerAction
          onClick={() => setOpenComments((v) => !v)}
          icon={<MessageSquare className="h-5 w-5" />}
          label={String(data.post_comments.length)}
        />
        <ViewerAction onClick={share} icon={<Send className="h-5 w-5" />} label={String(data.share_count ?? 0)} />
        <ViewerAction
          onClick={() => save.mutate()}
          icon={<Bookmark className={cn("h-5 w-5", saved && "fill-current text-gold")} />}
          label={saved ? "Enregistré" : "Favoris"}
        />
      </div>

      {openComments && (
        <div className="max-h-[45vh] space-y-3 overflow-y-auto border-t border-white/15 bg-black/70 px-4 py-3 text-sm">
          {roots.map((c) => (
            <div key={c.id} className="space-y-2">
              <CommentRow comment={c} onReply={() => setReplyTo(c)} onClose={onClose} />
              {repliesOf(c.id).map((r) => (
                <div key={r.id} className="pl-10">
                  <CommentRow comment={r} onReply={() => setReplyTo(r)} onClose={onClose} />
                </div>
              ))}
            </div>
          ))}
          {!comments.isLoading && roots.length === 0 && (
            <p className="text-xs text-white/60">Sois le premier à commenter cette photo.</p>
          )}

          <form
            className="sticky bottom-0 flex items-center gap-2 bg-black/70 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) comment.mutate();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? `Répondre à ${replyTo.author?.full_name ?? "ce commentaire"}…` : "Ajouter un commentaire…"}
              className="min-w-0 flex-1 rounded-full bg-white/15 px-4 py-2 text-sm text-white outline-none placeholder:text-white/50"
            />
            <button type="submit" className="grid h-9 w-9 place-items-center rounded-full bg-brand text-primary-foreground">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  onReply,
  onClose,
}: {
  comment: Comment;
  onReply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Avatar person={asPerson(comment.author)} size={28} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{comment.author?.full_name ?? "Membre PONZO"}</p>
        <p className="whitespace-pre-wrap text-sm text-white/85">{comment.body}</p>
        <button type="button" onClick={onReply} className="mt-0.5 text-[11px] text-white/60">
          Répondre · {timeAgo(comment.created_at)}
        </button>
      </div>
      <span className="sr-only" onClick={onClose} />
    </div>
  );
}

function ViewerAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold text-white/90 transition-colors active:bg-white/10"
    >
      {icon}
      {label}
    </button>
  );
}

export function PhotoViewerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Required<Omit<PhotoViewerOptions, "postId">> & { postId: string | null } | null>(
    null,
  );

  const open = useCallback((srcOrOptions: string | PhotoViewerOptions, alt = "Photo") => {
    const options: PhotoViewerOptions =
      typeof srcOrOptions === "string" ? { images: [srcOrOptions], alt } : srcOrOptions;
    setState({
      images: options.images.filter(Boolean),
      index: options.index ?? 0,
      alt: options.alt ?? alt,
      allowDownload: options.allowDownload ?? true,
      postId: options.postId ?? null,
    });
  }, []);

  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ open }), [open]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setState((s) => (s ? { ...s, index: Math.min(s.index + 1, s.images.length - 1) } : s));
      if (e.key === "ArrowLeft") setState((s) => (s ? { ...s, index: Math.max(s.index - 1, 0) } : s));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [state, close]);

  const go = (dir: 1 | -1) =>
    setState((s) => (s ? { ...s, index: clamp(s.index + dir, 0, s.images.length - 1) } : s));

  const download = async () => {
    if (!state) return;
    const src = state.images[state.index]!;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ponzo-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Photo téléchargée");
    } catch {
      window.open(src, "_blank", "noopener");
    }
  };

  return (
    <PhotoViewerContext.Provider value={value}>
      {children}
      {state && state.images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={state.alt}
          onClick={close}
          className="fixed inset-0 z-[100] bg-black"
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 text-white">
            <button
              type="button"
              aria-label="Fermer"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              <X className="h-5 w-5" />
            </button>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
              {state.index + 1} / {state.images.length}
            </span>
            {state.allowDownload ? (
              <button
                type="button"
                aria-label="Télécharger la photo"
                className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                onClick={(e) => {
                  e.stopPropagation();
                  void download();
                }}
              >
                <Download className="h-5 w-5" />
              </button>
            ) : (
              <span className="h-10 w-10" />
            )}
          </div>

          <ZoomableImage
            src={state.images[state.index]!}
            alt={state.alt}
            onSwipe={go}
            onClose={close}
          />

          {state.images.length > 1 && (
            <>
              {state.index > 0 && (
                <button
                  type="button"
                  aria-label="Photo précédente"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(-1);
                  }}
                  className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {state.index < state.images.length - 1 && (
                <button
                  type="button"
                  aria-label="Photo suivante"
                  onClick={(e) => {
                    e.stopPropagation();
                    go(1);
                  }}
                  className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </>
          )}

          {state.postId && <EngagementBar postId={state.postId} onClose={close} />}
        </div>
      )}
    </PhotoViewerContext.Provider>
  );
}
