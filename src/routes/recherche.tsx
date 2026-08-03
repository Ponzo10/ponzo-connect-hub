import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { hashtags, people, posts, products, reels } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recherche")({
  head: () => ({
    meta: [
      { title: "Recherche — PONZO" },
      { name: "description", content: "Recherchez des personnes, publications, vidéos, produits, projets et hashtags sur PONZO." },
      { property: "og:title", content: "Recherche — PONZO" },
      { property: "og:description", content: "Trouvez des talents, des services et des opportunités en quelques secondes." },
    ],
  }),
  component: RecherchePage,
});

const tabs = ["Personnes", "Publications", "Vidéos", "Produits", "Projets", "Hashtags"] as const;

function RecherchePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Personnes");
  const [q, setQ] = useState("");

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
          people.map((p) => (
            <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
              <Avatar person={p} size={46} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.handle} · {p.role}
                </p>
              </div>
              <button className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground">
                Suivre
              </button>
            </div>
          ))}

        {tab === "Publications" &&
          posts.map((p) => (
            <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-soft">
              <p className="text-xs font-semibold text-primary">{p.author.name}</p>
              <p className="mt-1 line-clamp-2 text-sm">{p.text}</p>
            </div>
          ))}

        {tab === "Vidéos" && (
          <div className="grid grid-cols-3 gap-2">
            {[...reels, ...reels].map((r, i) => (
              <div key={`${r.id}-${i}`} className="aspect-[9/16] rounded-xl bg-brand p-2 text-[10px] font-semibold text-primary-foreground">
                {r.likes} ❤
              </div>
            ))}
          </div>
        )}

        {tab === "Produits" &&
          products.slice(0, 4).map((p) => (
            <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
              <span className="h-12 w-12 shrink-0 rounded-xl bg-gold" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.title}</p>
                <p className="truncate text-xs text-muted-foreground">{p.seller}</p>
              </div>
              <span className="shrink-0 text-sm font-bold text-primary">{p.price}</span>
            </div>
          ))}

        {tab === "Projets" &&
          posts
            .filter((p) => p.tag)
            .map((p) => (
              <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-soft">
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">{p.tag}</span>
                <p className="mt-2 line-clamp-2 text-sm">{p.text}</p>
              </div>
            ))}

        {tab === "Hashtags" && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((h) => (
              <span key={h} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-soft">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
