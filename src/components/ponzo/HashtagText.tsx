import { Link } from "@tanstack/react-router";

import { normalizeTag } from "@/lib/trending-api";
import { cn } from "@/lib/utils";

/** Affiche un texte en rendant les hashtags cliquables. */
export function HashtagText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(#[A-Za-z0-9_À-ÿ]{2,50})/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("#") && part.length > 1 ? (
          <Link
            key={`${part}-${i}`}
            to="/hashtag/$tag"
            params={{ tag: normalizeTag(part) }}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-primary hover:underline"
          >
            {part}
          </Link>
        ) : (
          <span key={`t-${i}`}>{part}</span>
        ),
      )}
    </span>
  );
}

export function HashtagPill({ tag, count, active }: { tag: string; count?: number; active?: boolean }) {
  return (
    <Link
      to="/hashtag/$tag"
      params={{ tag: normalizeTag(tag) }}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
        active ? "bg-brand text-primary-foreground" : "bg-surface text-foreground shadow-soft",
      )}
    >
      <span>#{normalizeTag(tag)}</span>
      {count !== undefined && <span className="text-[11px] opacity-70">{count}</span>}
    </Link>
  );
}
