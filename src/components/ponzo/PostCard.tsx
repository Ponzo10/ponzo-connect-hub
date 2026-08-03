import { Bookmark, Heart, Link2, MessageSquare, MoreHorizontal, Play, Repeat2 } from "lucide-react";
import { useState } from "react";

import { Avatar } from "./Avatar";
import type { Post } from "@/data/demo";
import { cn } from "@/lib/utils";
import banner from "@/assets/ponzo-banner.jpg";

const tagStyle: Record<string, string> = {
  "Je cherche": "bg-primary-soft text-primary",
  "Je propose": "bg-accent-soft text-accent-foreground",
  "Mon projet": "bg-secondary text-secondary-foreground",
};

export function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <article className="mb-3 bg-surface shadow-soft sm:rounded-2xl">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pt-4">
        <Avatar person={post.author} size={44} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1 text-sm font-semibold">
            <span className="truncate">{post.author.name}</span>
            {post.author.verified && (
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                ✓
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {post.time} · {post.author.role}
          </p>
        </div>
        <button
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="Options de la publication"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {post.tag && (
        <div className="px-4 pt-3">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", tagStyle[post.tag])}>
            {post.tag}
          </span>
        </div>
      )}

      <p className="px-4 py-3 text-[15px] leading-relaxed">{post.text}</p>

      {post.media === "image" && (
        <img
          src={banner}
          alt="Visuel de la publication PONZO"
          width={1200}
          height={675}
          loading="lazy"
          className="w-full object-cover sm:px-0"
        />
      )}

      {post.media === "video" && (
        <div className="relative aspect-video w-full bg-brand">
          <div className="absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-surface/90 text-primary shadow-lift">
              <Play className="h-7 w-7 fill-current" />
            </span>
          </div>
          <span className="absolute bottom-3 right-3 rounded-md bg-foreground/70 px-2 py-0.5 text-xs font-medium text-background">
            0:48
          </span>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex -space-x-1">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
              👍
            </span>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px]">❤️</span>
          </span>
          {(post.reactions + (liked ? 1 : 0)).toLocaleString("fr-FR")}
        </span>
        <span>
          {post.comments} commentaires · {post.shares} partages
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 border-t border-border/70 px-2 py-1">
        <ActionButton
          icon={<Heart className={cn("h-[18px] w-[18px]", liked && "fill-current")} />}
          label="J'aime"
          active={liked}
          onClick={() => setLiked((v) => !v)}
        />
        <ActionButton icon={<MessageSquare className="h-[18px] w-[18px]" />} label="Commenter" />
        <ActionButton icon={<Repeat2 className="h-[18px] w-[18px]" />} label="Partager" />
        <ActionButton
          icon={<Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />}
          label="Enregistrer"
          active={saved}
          onClick={() => setSaved((v) => !v)}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        Copier le lien · Signaler
      </div>
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
  active?: boolean;
  onClick?: () => void;
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
      <span className="hidden xs:inline sm:inline">{label}</span>
    </button>
  );
}
