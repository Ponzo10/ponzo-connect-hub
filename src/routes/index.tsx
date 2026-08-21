import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { PostCard } from "@/components/ponzo/PostCard";
import { PendingPosts } from "@/components/ponzo/PublishQueue";
import { StoriesBar } from "@/components/ponzo/StoriesBar";
import { useAuth } from "@/lib/auth";
import { FEED_PAGE_SIZE, fetchFeed } from "@/lib/ponzo-api";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PONZO — Le réseau social professionnel africain" },
      {
        name: "description",
        content:
          "PONZO : connecte-toi, crée et construis. Fil d'actualité, stories, vidéos courtes, marketplace et opportunités professionnelles.",
      },
      { property: "og:title", content: "PONZO" },
      {
        property: "og:description",
        content: "Le réseau social professionnel pour trouver des opportunités, proposer ses services et lancer ses projets.",
      },
    ],
  }),
  component: Feed,
});


function Feed() {
  const { user } = useAuth();
  const feed = useInfiniteQuery({
    queryKey: ["feed", user?.id ?? null],
    queryFn: ({ pageParam }) => fetchFeed(pageParam, FEED_PAGE_SIZE, user?.id ?? null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < FEED_PAGE_SIZE ? undefined : (lastPage[lastPage.length - 1]?.created_at ?? undefined),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    // Inutile de charger le fil tant que la session n'est pas connue :
    // cela évitait un aller-retour réseau perdu à chaque ouverture.
    enabled: !!user,
  });
  const posts = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  // Chargement progressif : la page suivante démarre avant que l'utilisateur
  // n'atteigne le bas du fil, sans bouton « voir plus ».
  const sentinel = useRef<HTMLDivElement | null>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);



  return (
    <AppShell>
      <StoriesBar />

      <section className="mt-3 sm:px-3">

        <h2 className="sr-only">Fil d'actualité</h2>
        <PendingPosts />
        {feed.isLoading && (
          <div className="space-y-3 px-3 sm:px-0" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <FeedSkeleton key={i} />
            ))}
          </div>
        )}
        {!feed.isLoading && posts.length === 0 && (
          <div className="mx-3 rounded-2xl bg-surface p-6 text-center shadow-soft">
            <p className="text-sm font-semibold">Le fil est encore vide</p>
            <p className="mt-1 text-xs text-muted-foreground">Sois le premier à publier sur PONZO.</p>
            <Link
              to={user ? "/publier" : "/auth"}
              className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground"
            >
              {user ? "Créer une publication" : "Rejoindre PONZO"}
            </Link>
          </div>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        <div ref={sentinel} aria-hidden className="h-1" />
        {feed.isFetchingNextPage && (
          <div className="px-3 sm:px-0">
            <FeedSkeleton />
          </div>
        )}




      </section>
    </AppShell>
  );
}


function FeedSkeleton() {
  return (
    <div className="mb-3 animate-pulse rounded-2xl bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-muted" />
          <div className="h-2.5 w-1/5 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
      </div>
      <div className="mt-3 h-40 rounded-xl bg-muted" />
    </div>
  );
}
