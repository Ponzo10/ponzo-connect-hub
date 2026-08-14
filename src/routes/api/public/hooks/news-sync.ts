import { createFileRoute } from "@tanstack/react-router";

type RawArticle = {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  urlToImage?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string } | string;
  category?: string;
};

const CATEGORY_MAP: Record<string, string> = {
  business: "Économie",
  economy: "Économie",
  politics: "Politique",
  sports: "Sport",
  sport: "Sport",
  technology: "Technologie",
  science: "Technologie",
  health: "Santé",
  culture: "Culture",
  entertainment: "Divertissement",
  world: "Monde",
  general: "Monde",
};

/** Flux publics sans clé : source de secours pour que l'automatisation fonctionne toujours. */
const RSS_FEEDS: { url: string; category: string }[] = [
  { url: "https://news.google.com/rss/search?q=RD+Congo&hl=fr&gl=CD&ceid=CD:fr", category: "Monde" },
  { url: "https://news.google.com/rss/search?q=Afrique+%C3%A9conomie&hl=fr&gl=CD&ceid=CD:fr", category: "Économie" },
  { url: "https://news.google.com/rss/search?q=Afrique+sport&hl=fr&gl=CD&ceid=CD:fr", category: "Sport" },
  { url: "https://news.google.com/rss/search?q=technologie+Afrique&hl=fr&gl=CD&ceid=CD:fr", category: "Technologie" },
];

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1] ? decodeEntities(match[1]) : undefined;
}

/** Analyse minimale d'un flux RSS (pas de dépendance externe côté Worker). */
function parseRss(xml: string, category: string): RawArticle[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const link = pick(item, "link");
    const image = item.match(/<media:content[^>]*url="([^"]+)"/i)?.[1] ?? item.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1];
    const raw: RawArticle = {
      title: pick(item, "title") ?? "",
      description: pick(item, "description") ?? null ?? undefined,
      category,
      publishedAt: pick(item, "pubDate"),
      source: pick(item, "source") ?? "Google Actualités",
    };
    if (link) raw.url = link;
    if (image) raw.image = image;
    return raw;
  });
}

function normalize(a: RawArticle) {
  const source = typeof a.source === "string" ? a.source : (a.source?.name ?? "Source externe");
  const parsed = a.publishedAt ? new Date(a.publishedAt) : new Date();
  const published = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const ageHours = (Date.now() - published.getTime()) / 3_600_000;
  return {
    title: (a.title ?? "").slice(0, 300),
    summary: a.description ?? null,
    content: a.content ?? null,
    image_url: a.urlToImage ?? a.image ?? null,
    source,
    source_url: a.url ?? null,
    category: CATEGORY_MAP[(a.category ?? "general").toLowerCase()] ?? a.category ?? "Monde",
    // Les dates sont toujours stockées en UTC (ISO) : l'affichage local gère le fuseau.
    published_at: published.toISOString(),
    relevance: Math.max(0, Math.round(100 - ageHours * 2)),
    is_important: ageHours < 2,
  };
}

async function fetchFromRss(): Promise<RawArticle[]> {
  const results = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { headers: { "user-agent": "PonzoNewsBot/1.0" } });
        if (!res.ok) return [];
        return parseRss(await res.text(), feed.category).slice(0, 15);
      } catch (error) {
        console.error(`rss feed failed ${feed.url}`, error);
        return [];
      }
    }),
  );
  return results.flat();
}

async function fetchFromApi(apiKey: string, country?: string, category?: string): Promise<RawArticle[]> {
  const params = new URLSearchParams({ country: country ?? "cd", pageSize: "40", apiKey });
  if (category) params.set("category", category);
  const res = await fetch(`https://newsapi.org/v2/top-headlines?${params.toString()}`);
  if (!res.ok) {
    console.error(`news api failed [${res.status}]: ${await res.text()}`);
    return [];
  }
  const json = (await res.json()) as { articles?: RawArticle[] };
  return json.articles ?? [];
}

/** Récupère, dédoublonne et publie automatiquement les actualités. */
async function syncNews(raw: RawArticle[]) {
  const rows = raw
    .map(normalize)
    .filter((r) => r.title && r.source_url)
    .filter((r, i, arr) => arr.findIndex((x) => x.source_url === r.source_url) === i);

  if (rows.length === 0) return { ok: true, inserted: 0, received: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("news_articles")
    .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("news upsert failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, inserted: data?.length ?? 0, received: rows.length };
}

/**
 * Ingestion automatique des actualités — aucune intervention manuelle requise.
 * GET  : déclenche une synchronisation (limitée à une fois toutes les 20 minutes).
 * POST : accepte un lot d'articles { articles: [...] } ou force une synchronisation.
 * Sources : NEWS_API_KEY si configurée, sinon flux RSS publics.
 */
export const Route = createFileRoute("/api/public/hooks/news-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { articles?: RawArticle[]; country?: string; category?: string } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          payload = {};
        }

        let raw: RawArticle[] = Array.isArray(payload.articles) ? payload.articles : [];
        if (raw.length === 0) {
          const apiKey = process.env["NEWS_API_KEY"];
          raw = apiKey ? await fetchFromApi(apiKey, payload.country, payload.category) : [];
          if (raw.length === 0) raw = await fetchFromRss();
        }
        const result = await syncNews(raw);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Garde-fou : évite de marteler les sources externes à chaque visite.
        const { data: last } = await supabaseAdmin
          .from("news_articles")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastAt = last?.created_at ? new Date(last.created_at).getTime() : 0;
        if (Date.now() - lastAt < 20 * 60_000) {
          return Response.json({ ok: true, skipped: true, reason: "recent-sync" });
        }

        const apiKey = process.env["NEWS_API_KEY"];
        let raw = apiKey ? await fetchFromApi(apiKey) : [];
        if (raw.length === 0) raw = await fetchFromRss();
        const result = await syncNews(raw);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
