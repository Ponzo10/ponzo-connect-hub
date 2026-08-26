import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Newspaper, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { NewsCard } from "@/components/ponzo/NewsCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchNews, NEWS_CATEGORIES } from "@/lib/news-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/actualites")({
  head: () => ({
    meta: [
      { title: "Actualités — PONZO" },
      {
        name: "description",
        content:
          "Les actualités importantes du pays et du monde : politique, économie, sport, technologie, santé, culture et divertissement.",
      },
      { property: "og:title", content: "Actualités — PONZO" },
      { property: "og:description", content: "Suis l'essentiel de l'actualité locale et internationale sur PONZO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Actualites,
});

function Actualites() {
  const [category, setCategory] = useState<string>("Tout");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const channel = supabase
      .channel("news-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "news_articles" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["news"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "news_likes" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["news"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const news = useQuery({
    queryKey: ["news", category, debounced],
    queryFn: () => fetchNews({ category, search: debounced }),
    // Cache agressif : la liste des actualités change peu, on la garde
    // 2 minutes en mémoire pour éviter les requêtes répétées.
    staleTime: 2 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <AppShell title="Actualités">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une actualité, une source…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {NEWS_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                category === c ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground shadow-soft",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-3 px-3">
        <h2 className="sr-only">Liste des actualités</h2>
        {news.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Chargement des actualités…</p>}
        {news.data?.map((a) => (
          <NewsCard key={a.id} article={a} />
        ))}
        {!news.isLoading && (news.data ?? []).length === 0 && (
          <div className="rounded-2xl bg-surface p-8 text-center shadow-soft">
            <Newspaper className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Aucune actualité pour l'instant</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les actualités arrivent automatiquement dès qu'une source d'information est connectée.
            </p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground">
              Retour au fil
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
