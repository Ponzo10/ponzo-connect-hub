import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  Briefcase,
  Flame,
  ImageIcon,
  Megaphone,
  Newspaper,
  Radio,
  Search,
  ShoppingBag,
  Users,
  Video,
} from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { NewsCard } from "@/components/ponzo/NewsCard";
import { PostCard } from "@/components/ponzo/PostCard";
import { StoriesBar } from "@/components/ponzo/StoriesBar";
import { useAuth } from "@/lib/auth";
import { fetchNews } from "@/lib/news-api";
import { FEED_PAGE_SIZE, asPerson, fetchFeed } from "@/lib/ponzo-api";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PONZO — Le réseau social professionnel africain" },
      {
        name: "description",
        content:
          "PONZO : connecte-toi, crée et construis. Fil d'actualité, stories, vidéos courtes, marketplace et opportunités professionnelles.",
      },
      { property: "og:title", content: "PONZO — Connecte-toi. Crée. Construis." },
      {
        property: "og:description",
        content: "Le réseau social professionnel pour trouver des opportunités, proposer ses services et lancer ses projets.",
      },
    ],
  }),
  component: Feed,
});

const quickActions = [
  { label: "Tendances", icon: Flame, to: "/tendances", tone: "text-destructive" },
  { label: "Actualités", icon: Newspaper, to: "/actualites", tone: "text-primary" },
  { label: "Je cherche", icon: Search, to: "/publier", tone: "text-primary" },
  { label: "Je propose", icon: Megaphone, to: "/publier", tone: "text-accent-foreground" },
  { label: "Mon projet", icon: Briefcase, to: "/publier", tone: "text-primary" },
  { label: "Marketplace", icon: ShoppingBag, to: "/marketplace", tone: "text-foreground" },
  { label: "Vidéos", icon: Video, to: "/videos", tone: "text-destructive" },
  { label: "Groupes", icon: Users, to: "/groupes", tone: "text-accent-foreground" },
  { label: "Live", icon: Radio, to: "/decouvrir", tone: "text-primary" },
] as const;

function Feed() {
  const { user, profile } = useAuth();
  const feed = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < FEED_PAGE_SIZE ? undefined : (lastPage[lastPage.length - 1]?.created_at ?? undefined),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const news = useQuery({
    queryKey: ["news", "feed"],
    queryFn: () => fetchNews({ limit: 12 }),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
  });

  const posts = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);
  const timeline = useMemo(
    () =>
      [
        ...posts.map((p) => ({ kind: "post" as const, at: p.created_at, post: p })),
        ...(news.data ?? []).map((n) => ({ kind: "news" as const, at: n.published_at, article: n })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [posts, news.data],
  );

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
      <section className="px-3 pt-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
          <div className="relative">
            <Avatar person={asPerson(profile)} size={44} />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
          </div>
          <Link
            to={user ? "/publier" : "/auth"}
            className="min-w-0 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground"
          >
            {user ? "À quoi pensez-vous ?" : "Connecte-toi pour publier"}
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ComposerChip to="/publier" icon={<ImageIcon className="h-4 w-4 text-primary" />} label="Photo" />
          <ComposerChip to="/groupes" icon={<Users className="h-4 w-4 text-accent-foreground" />} label="Groupe" />
          <ComposerChip to="/videos" icon={<Video className="h-4 w-4 text-destructive" />} label="Vidéo" />
        </div>
      </section>

      <StoriesBar />

      <section className="mt-4 px-3">
        <h2 className="sr-only">Actions rapides</h2>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface px-1 py-2.5 text-center shadow-soft transition-colors hover:bg-muted"
              >
                <Icon className={`h-5 w-5 ${a.tone}`} />
                <span className="text-[11px] font-semibold leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-4 sm:px-3">
        <h2 className="sr-only">Fil d'actualité</h2>
        {feed.isLoading && (
          <div className="space-y-3 px-3 sm:px-0" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <FeedSkeleton key={i} />
            ))}
          </div>
        )}
        {!feed.isLoading && timeline.length === 0 && (
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
        {timeline.map((item) =>
          item.kind === "news" ? (
            <div key={`n-${item.article.id}`} className="px-3 sm:px-0">
              <NewsCard article={item.article} />
            </div>
          ) : (
            <PostCard key={`p-${item.post.id}`} post={item.post} />
          ),
        )}

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

function ComposerChip({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 rounded-xl bg-surface py-2.5 text-xs font-semibold shadow-soft transition-colors hover:bg-muted"
    >
      {icon}
      {label}
    </Link>
  );
}
