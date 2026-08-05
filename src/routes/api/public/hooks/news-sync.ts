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

function normalize(a: RawArticle) {
  const source = typeof a.source === "string" ? a.source : (a.source?.name ?? "Source externe");
  const published = a.publishedAt ? new Date(a.publishedAt) : new Date();
  const ageHours = (Date.now() - published.getTime()) / 3_600_000;
  return {
    title: (a.title ?? "").slice(0, 300),
    summary: a.description ?? null,
    content: a.content ?? null,
    image_url: a.urlToImage ?? a.image ?? null,
    source,
    source_url: a.url ?? null,
    category: CATEGORY_MAP[(a.category ?? "general").toLowerCase()] ?? "Monde",
    published_at: published.toISOString(),
    relevance: Math.max(0, Math.round(100 - ageHours * 2)),
    is_important: ageHours < 6,
  };
}

/**
 * Ingestion automatique des actualités.
 * Configure le secret NEWS_API_KEY (newsapi.org ou compatible) pour activer la récupération.
 * Peut aussi recevoir un lot d'articles en POST : { articles: [...] }.
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

        const apiKey = process.env["NEWS_API_KEY"];
        if (raw.length === 0) {
          if (!apiKey) {
            return Response.json(
              {
                ok: false,
                configured: false,
                message:
                  "Aucune source configurée. Ajoute le secret NEWS_API_KEY ou envoie { articles: [...] } dans le corps de la requête.",
              },
              { status: 200 },
            );
          }
          const params = new URLSearchParams({
            country: payload.country ?? "cd",
            pageSize: "40",
            apiKey,
          });
          if (payload.category) params.set("category", payload.category);
          const res = await fetch(`https://newsapi.org/v2/top-headlines?${params.toString()}`);
          if (!res.ok) {
            const body = await res.text();
            console.error(`news api failed [${res.status}]: ${body}`);
            return Response.json({ ok: false, status: res.status, error: body }, { status: 502 });
          }
          const json = (await res.json()) as { articles?: RawArticle[] };
          raw = json.articles ?? [];
        }

        const rows = raw
          .map(normalize)
          .filter((r) => r.title && r.source_url)
          .filter((r, i, arr) => arr.findIndex((x) => x.source_url === r.source_url) === i);

        if (rows.length === 0) return Response.json({ ok: true, inserted: 0 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("news_articles")
          .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
          .select("id");

        if (error) {
          console.error("news upsert failed", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, inserted: data?.length ?? 0, received: rows.length });
      },
      GET: async () =>
        Response.json({
          ok: true,
          configured: !!process.env["NEWS_API_KEY"],
          usage: "POST { articles: [...] } ou configure NEWS_API_KEY pour une récupération automatique.",
        }),
    },
  },
});
