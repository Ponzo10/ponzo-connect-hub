import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookMarked } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { PostCard } from "@/components/ponzo/PostCard";
import { useAuth } from "@/lib/auth";
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

  return (
    <AppShell title="Favoris">
      <div className="px-3 pt-4 sm:px-3">
        {(saved.data ?? []).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {!saved.isLoading && (saved.data ?? []).length === 0 && (
          <div className="py-16 text-center">
            <BookMarked className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucune publication enregistrée. Touche l'icône favoris sur une publication.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
