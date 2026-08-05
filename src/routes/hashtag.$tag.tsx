import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { PostCard } from "@/components/ponzo/PostCard";
import { fetchHashtagPosts, normalizeTag, searchHashtags } from "@/lib/trending-api";

export const Route = createFileRoute("/hashtag/$tag")({
  head: ({ params }) => ({
    meta: [
      { title: `#${params.tag} — PONZO` },
      { name: "description", content: `Toutes les publications PONZO contenant le hashtag #${params.tag}.` },
      { property: "og:title", content: `#${params.tag} — PONZO` },
      { property: "og:description", content: `Découvre les publications tendance autour de #${params.tag}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Hashtag indisponible</p>
        <button onClick={reset} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground">
          Réessayer
        </button>
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Hashtag introuvable.</div>,
  component: HashtagPage,
});

function HashtagPage() {
  const { tag } = Route.useParams();
  const clean = normalizeTag(tag);
  const posts = useQuery({
    queryKey: ["hashtag-posts", clean],
    queryFn: () => fetchHashtagPosts(clean),
    refetchInterval: 30000,
  });
  const related = useQuery({ queryKey: ["hashtag-related", clean], queryFn: () => searchHashtags(clean, 12) });
  const count = related.data?.find((h) => h.tag === clean)?.usage_count ?? posts.data?.length ?? 0;

  return (
    <AppShell title={`#${clean}`}>
      <div className="space-y-4 px-3 pt-4">
        <section className="rounded-3xl bg-brand p-5 text-primary-foreground shadow-lift">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-foreground/20">
            <Hash className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold">#{clean}</h1>
          <p className="mt-1 text-sm opacity-90">{count} utilisation{count > 1 ? "s" : ""} sur PONZO</p>
          <Link
            to="/tendances"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-foreground px-4 py-2 text-xs font-semibold text-primary"
          >
            <TrendingUp className="h-4 w-4" /> Voir les tendances
          </Link>
        </section>

        {(related.data ?? []).filter((h) => h.tag !== clean).length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {(related.data ?? [])
              .filter((h) => h.tag !== clean)
              .map((h) => (
                <Link
                  key={h.id}
                  to="/hashtag/$tag"
                  params={{ tag: h.tag }}
                  className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-xs font-semibold shadow-soft"
                >
                  #{h.tag} <span className="opacity-60">{h.usage_count}</span>
                </Link>
              ))}
          </div>
        )}

        {posts.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>}
        {!posts.isLoading && (posts.data ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucune publication avec ce hashtag pour le moment.
          </p>
        )}
        <div className="space-y-3">
          {(posts.data ?? []).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
