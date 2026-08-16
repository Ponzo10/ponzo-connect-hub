import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  Download,
  Eye,
  Flame,
  Hash,
  Heart,
  MessageCircle,
  Play,
  Send,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { asPerson, compactCount, formatPrice } from "@/lib/ponzo-api";
import { downloadMedia, fetchTrending, type TrendingPost } from "@/lib/trending-api";
import { cn } from "@/lib/utils";
import { SmartImg } from "@/components/ponzo/SmartImg";

export const Route = createFileRoute("/tendances")({
  head: () => ({
    meta: [
      { title: "Tendances — PONZO" },
      {
        name: "description",
        content:
          "Les hashtags, vidéos, publications, produits, boutiques et créateurs les plus populaires de PONZO, en temps réel.",
      },
      { property: "og:title", content: "Tendances — PONZO" },
      { property: "og:description", content: "Découvre en direct ce qui cartonne sur PONZO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ reset }) => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Tendances indisponibles</p>
        <button onClick={reset} className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-primary-foreground">
          Réessayer
        </button>
      </div>
    </div>
  ),
  component: TendancesPage,
});

const tabs = ["Hashtags", "Vidéos", "Publications", "Produits", "Boutiques", "Créateurs"] as const;

function Stat({ icon: Icon, value }: { icon: typeof Eye; value: number }) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {compactCount(value)}
    </span>
  );
}

function PostStats({ p }: { p: TrendingPost }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <Stat icon={Eye} value={p.view_count} />
      <Stat icon={Heart} value={p.like_count} />
      <Stat icon={MessageCircle} value={p.comment_count} />
      <Stat icon={Send} value={p.share_count} />
      <Stat icon={Bookmark} value={p.save_count} />
    </div>
  );
}

function TendancesPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Hashtags");
  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => fetchTrending(15),
    refetchInterval: 20000,
    staleTime: 10000,
  });
  const data = trending.data;

  const download = async (p: TrendingPost) => {
    if (!p.media_url) return;
    toast.info("Téléchargement en cours…");
    await downloadMedia(p.media_url, `ponzo-video-${p.id.slice(0, 8)}.mp4`);
  };

  return (
    <AppShell title="Tendances">
      <div className="space-y-4 px-3 pt-4">
        <section className="rounded-3xl bg-brand p-5 text-primary-foreground shadow-lift">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-90">
            <Flame className="h-4 w-4" /> En direct
          </span>
          <h1 className="mt-2 text-xl font-bold">Ce qui cartonne sur PONZO</h1>
          <p className="mt-1 text-sm opacity-90">
            Classement basé sur les vues, réactions, commentaires, partages, enregistrements et nouveaux abonnés.
          </p>
        </section>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
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

        {trending.isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>}

        {tab === "Hashtags" && (
          <div className="space-y-2">
            {(data?.hashtags ?? []).map((h, i) => (
              <Link
                key={h.id}
                to="/hashtag/$tag"
                params={{ tag: h.tag }}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">#{h.tag}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.usage_count} publication{h.usage_count > 1 ? "s" : ""} · {h.recent_count} cette semaine
                  </p>
                </div>
                <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {!trending.isLoading && (data?.hashtags ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun hashtag encore. Ajoute-en un avec # dans ta prochaine publication.
              </p>
            )}
          </div>
        )}

        {tab === "Vidéos" && (
          <div className="grid grid-cols-2 gap-3">
            {(data?.videos ?? []).map((v) => (
              <div key={v.id} className="overflow-hidden rounded-2xl bg-surface shadow-soft">
                <Link to="/publication/$id" params={{ id: v.id }} className="relative block aspect-[9/14] bg-black">
                  <video
                    src={v.media_url ?? undefined}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center">
                    <Play className="h-9 w-9 text-white/90" />
                  </span>
                </Link>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs font-semibold">{v.body || "Vidéo PONZO"}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{v.author_name ?? "Membre PONZO"}</p>
                  <PostStats p={v} />
                  {v.allow_download && v.media_url && (
                    <button
                      onClick={() => void download(v)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-primary-soft py-1.5 text-[11px] font-semibold text-primary"
                    >
                      <Download className="h-3.5 w-3.5" /> Télécharger
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!trending.isLoading && (data?.videos ?? []).length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">Aucune vidéo populaire.</p>
            )}
          </div>
        )}

        {tab === "Publications" && (
          <div className="space-y-2">
            {(data?.posts ?? []).map((p, i) => (
              <Link
                key={p.id}
                to="/publication/$id"
                params={{ id: p.id }}
                className="block rounded-2xl bg-surface p-4 shadow-soft"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
                    #{i + 1}
                  </span>
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {p.author_name ?? "Membre PONZO"}
                  </p>
                </div>
                <p className="mt-2 line-clamp-3 text-sm">{p.body}</p>
                <PostStats p={p} />
              </Link>
            ))}
          </div>
        )}

        {tab === "Produits" && (
          <div className="grid grid-cols-2 gap-3">
            {(data?.products ?? []).map((pd) => (
              <Link key={pd.id} to="/marketplace" className="overflow-hidden rounded-2xl bg-surface shadow-soft">
                <span className="block aspect-square bg-gold">
                  {pd.image_url && (
                    <SmartImg src={pd.image_url} alt={pd.title} width={160} quality={60} className="h-full w-full object-cover" />
                  )}
                </span>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{pd.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{pd.seller_name ?? "Membre PONZO"}</p>
                  <p className="mt-1 text-sm font-bold text-primary">{formatPrice(Number(pd.price), pd.currency)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "Boutiques" && (
          <div className="space-y-2">
            {(data?.shops ?? []).map((s) => (
              <Link
                key={s.id}
                to="/boutique"
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                  {s.logo_url ? (
                    <SmartImg src={s.logo_url} alt={s.name} width={96} quality={60} className="h-full w-full object-cover" />
                  ) : (
                    <Store className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.product_count} produit{s.product_count > 1 ? "s" : ""}
                    {s.city ? ` · ${s.city}` : ""}
                  </p>
                </div>
                <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              </Link>
            ))}
          </div>
        )}

        {tab === "Créateurs" && (
          <div className="space-y-2">
            {(data?.creators ?? []).map((c, i) => (
              <Link
                key={c.id}
                to="/membre/$id"
                params={{ id: c.id }}
                className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
              >
                <span className="text-sm font-bold text-primary">{i + 1}</span>
                <Avatar
                  person={asPerson({ id: c.id, full_name: c.full_name, avatar_url: c.avatar_url } as never)}
                  size={46}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.handle ? `@${c.handle}` : "Membre"} · {compactCount(c.followers)} abonnés
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <Users className="mr-1 inline h-3 w-3" />+{c.new_followers} cette semaine · engagement{" "}
                    {compactCount(Number(c.engagement))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
