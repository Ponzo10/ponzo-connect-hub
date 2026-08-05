import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookMarked } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { NewsCard } from "@/components/ponzo/NewsCard";
import { PostCard } from "@/components/ponzo/PostCard";
import { useAuth } from "@/lib/auth";
import { fetchSavedNews } from "@/lib/news-api";
import { fetchSavedPosts } from "@/lib/ponzo-api";

export const Route = createFileRoute("/favoris")({
  head: () => ({
    meta: [
      { title: "Publications enregistrées — PONZO" },
      { name: "description", content: "Retrouve toutes les publications PONZO que tu as ajoutées à tes favoris." },
      { property: "og:title", content: "Mes favoris — PONZO" },
      { property: "og:description", content: "Tes publications enregistrées, réunies au même endroit." },
    ],
  }),
  component: Favoris,
});

function Favoris() {
  const { user } = useAuth();
  const saved = useQuery({
    queryKey: ["saved", user?.id],
    queryFn: () => fetchSavedPosts(user!.id),
    enabled: !!user,
  });
  const savedNews = useQuery({
    queryKey: ["news", "saved", user?.id],
    queryFn: () => fetchSavedNews(user!.id),
    enabled: !!user,
  });

  const empty =
    !saved.isLoading && !savedNews.isLoading && (saved.data ?? []).length === 0 && (savedNews.data ?? []).length === 0;

  return (
    <AppShell title="Favoris">
      <div className="px-3 pt-4 sm:px-3">
        {(savedNews.data ?? []).map((a) => (
          <NewsCard key={a.id} article={a} />
        ))}
        {(saved.data ?? []).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {empty && (
          <div className="py-16 text-center">
            <BookMarked className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune publication enregistrée. Touche l'icône favoris sur une publication ou une actualité.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

