import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { NewsCard } from "@/components/ponzo/NewsCard";
import { fetchNewsArticle, viewNews } from "@/lib/news-api";

export const Route = createFileRoute("/actualite/$id")({
  head: () => ({
    meta: [
      { title: "Actualité — PONZO" },
      { name: "description", content: "Lis l'actualité en détail, réagis, commente et partage-la sur PONZO." },
      { property: "og:title", content: "Actualité — PONZO" },
      { property: "og:description", content: "Toute l'actualité importante, en direct sur PONZO." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActualiteDetail,
});

function ActualiteDetail() {
  const { id } = Route.useParams();
  const article = useQuery({ queryKey: ["news-article", id], queryFn: () => fetchNewsArticle(id) });

  useEffect(() => {
    void viewNews(id).catch(() => undefined);
  }, [id]);

  return (
    <AppShell title="Actualité">
      <div className="px-3 pt-3">
        <Link to="/actualites" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Toutes les actualités
        </Link>
        {article.isLoading && <p className="py-6 text-sm text-muted-foreground">Chargement…</p>}
        {article.data && <NewsCard article={article.data} detailed />}
        {!article.isLoading && !article.data && (
          <p className="py-10 text-center text-sm text-muted-foreground">Cette actualité n'est plus disponible.</p>
        )}
      </div>
    </AppShell>
  );
}
