import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import {
  asPerson,
  fetchProfiles,
  formatPrice,
  searchPosts,
  searchProducts,
  timeAgo,
} from "@/lib/ponzo-api";
import { searchHashtags } from "@/lib/trending-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche — PONZO" },
      { name: "description", content: "Recherchez des personnes, publications, produits et projets sur le réseau professionnel PONZO." },
      { property: "og:title", content: "Recherche — PONZO" },
      { property: "og:description", content: "Trouvez des talents, des services et des opportunités en quelques secondes." },
    ],
  }),
  component: RecherchePage,
});

const tabs = ["Personnes", "Hashtags", "Publications", "Produits", "Projets"] as const;

function RecherchePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Personnes");
  const [q, setQ] = useState("");

  const people = useQuery({ queryKey: ["profiles", q], queryFn: () => fetchProfiles(q || undefined) });
  const posts = useQuery({ queryKey: ["search-posts", q], queryFn: () => searchPosts(q) });
  const products = useQuery({ queryKey: ["search-products", q], queryFn: () => searchProducts(q) });
  const hashtags = useQuery({
    queryKey: ["search-hashtags", q],
    queryFn: () => searchHashtags(q, 40),
    refetchInterval: 30000,
  });

  return (
    <AppShell title="Recherche">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-3 shadow-soft">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher sur PONZO"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                tab === t ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground shadow-soft",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2 px-3">
        {tab === "Personnes" &&
          (people.data ?? []).map((p) => (
            <Link
              key={p.id}
              to="/membre/$id"
              params={{ id: p.id }}
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
            >
              <Avatar person={asPerson(p)} size={46} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.handle ? `@${p.handle}` : "Membre"} {p.role ? `· ${p.role}` : ""}
                </p>
              </div>
            </Link>
          ))}

        {tab === "Hashtags" &&
          (hashtags.data ?? []).map((h) => (
            <Link
              key={h.id}
              to="/hashtag/$tag"
              params={{ tag: h.tag }}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg font-bold text-primary">
                #
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">#{h.tag}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {h.usage_count} publication{h.usage_count > 1 ? "s" : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-primary">Voir</span>
            </Link>
          ))}

        {tab === "Publications" &&
          (posts.data ?? []).map((p) => (
            <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-soft">
              <p className="text-xs font-semibold text-primary">
                {p.author?.full_name ?? "Membre PONZO"} · {timeAgo(p.created_at)}
              </p>
              <p className="mt-1 line-clamp-3 text-sm">{p.body}</p>
            </div>
          ))}

        {tab === "Produits" &&
          (products.data ?? []).map((p) => (
            <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gold">
                {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">{p.seller?.full_name ?? "Membre PONZO"}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-primary">{formatPrice(Number(p.price), p.currency)}</span>
            </div>
          ))}

        {tab === "Projets" &&
          (posts.data ?? [])
            .filter((p) => p.tag)
            .map((p) => (
              <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-soft">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">{p.tag}</span>
                <p className="mt-2 line-clamp-2 text-sm">{p.body}</p>
              </div>
            ))}
      </div>
    </AppShell>
  );
}
