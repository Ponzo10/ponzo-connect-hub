import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/ponzo/AppShell";
import { PostCard } from "@/components/ponzo/PostCard";
import { fetchPost } from "@/lib/ponzo-api";

export const Route = createFileRoute("/publication/$id")({
  head: () => ({
    meta: [
      { title: "Publication — PONZO" },
      { name: "description", content: "Découvre cette publication PONZO : photo, vidéo, réactions et commentaires de la communauté." },
      { property: "og:title", content: "Publication — PONZO" },
      { property: "og:description", content: "Réagis, commente et partage cette publication sur PONZO." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { id } = Route.useParams();
  const post = useQuery({ queryKey: ["post", id], queryFn: () => fetchPost(id) });

  return (
    <AppShell title="Publication">
      <div className="pt-3">
        {post.isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Chargement…</p>}
        {!post.isLoading && !post.data && (
          <div className="mx-3 rounded-2xl bg-surface p-6 text-center shadow-soft">
            <p className="text-sm font-semibold">Publication introuvable</p>
            <p className="mt-1 text-xs text-muted-foreground">Elle a peut-être été supprimée.</p>
            <Link to="/" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground">
              Retour au fil
            </Link>
          </div>
        )}
        {post.data && <PostCard post={post.data} />}
      </div>
    </AppShell>
  );
}
