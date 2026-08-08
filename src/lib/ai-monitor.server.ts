/**
 * Collecte des signaux techniques de PONZO et rédaction du diagnostic.
 * Lecture seule : aucune correction n'est appliquée par l'assistant.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { askGateway, ASSISTANT_MODEL, parseJsonBlock } from "@/lib/ai-gateway.server";

export type Metrics = Record<string, unknown>;

export type Finding = {
  area: string;
  title: string;
  cause: string;
  impact: string;
  priority: "critical" | "high" | "medium" | "low";
  recommendation: string;
};

const since = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

/** Agrège les signaux d'usage, d'erreurs, de sécurité et de contenu. */
export async function collectMetrics(): Promise<Metrics> {
  const day = since(24);
  const week = since(24 * 7);

  const [errors, perf, security, sessions, posts, messages, notifications, users, reports, media] =
    await Promise.all([
      supabaseAdmin.from("app_events").select("name, path, metadata, created_at").eq("kind", "error").gte("created_at", week).order("created_at", { ascending: false }).limit(60),
      supabaseAdmin.from("app_events").select("name, path, duration_ms").eq("kind", "perf").gte("created_at", week).limit(500),
      supabaseAdmin.from("security_events").select("kind, severity, title, detail, created_at, resolved").gte("created_at", week).order("created_at", { ascending: false }).limit(40),
      supabaseAdmin.from("app_events").select("user_id").eq("kind", "session").gte("created_at", day).limit(500),
      supabaseAdmin.from("posts").select("id, media_type, created_at").gte("created_at", week).limit(500),
      supabaseAdmin.from("messages").select("id, delivered_at, read_at, created_at").gte("created_at", day).limit(500),
      supabaseAdmin.from("notifications").select("id, read_at").gte("created_at", week).limit(500),
      supabaseAdmin.from("profiles").select("id, created_at").gte("created_at", week).limit(1000),
      supabaseAdmin.from("reports").select("id, status").eq("status", "pending").limit(200),
      supabaseAdmin.from("posts").select("id, media_url, media_type").not("media_type", "is", null).gte("created_at", week).limit(300),
    ]);

  const durations = (perf.data ?? []).map((p) => p.duration_ms ?? 0).filter(Boolean).sort((a, b) => a - b);
  const slow = new Map<string, { total: number; n: number }>();
  for (const row of perf.data ?? []) {
    const key = row.path ?? row.name ?? "?";
    const entry = slow.get(key) ?? { total: 0, n: 0 };
    entry.total += row.duration_ms ?? 0;
    entry.n += 1;
    slow.set(key, entry);
  }

  const errorGroups = new Map<string, { count: number; sample: string }>();
  for (const row of errors.data ?? []) {
    const key = `${row.name}@${row.path ?? "-"}`;
    const entry = errorGroups.get(key) ?? { count: 0, sample: "" };
    entry.count += 1;
    entry.sample ||= String((row.metadata as { message?: string } | null)?.message ?? "");
    errorGroups.set(key, entry);
  }

  const msgs = messages.data ?? [];
  const mediaPosts = media.data ?? [];

  return {
    generated_at: new Date().toISOString(),
    errors_7d: [...errorGroups.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.count - a.count).slice(0, 15),
    error_total_7d: (errors.data ?? []).length,
    performance: {
      samples: durations.length,
      avg_ms: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p95_ms: durations.length ? durations[Math.floor(durations.length * 0.95)] ?? 0 : 0,
      slowest: [...slow.entries()]
        .map(([path, v]) => ({ path, avg_ms: Math.round(v.total / v.n), samples: v.n }))
        .sort((a, b) => b.avg_ms - a.avg_ms)
        .slice(0, 8),
    },
    security: {
      unresolved: (security.data ?? []).filter((s) => !s.resolved).length,
      recent: (security.data ?? []).slice(0, 10),
    },
    engagement: {
      sessions_24h: (sessions.data ?? []).length,
      active_users_24h: new Set((sessions.data ?? []).map((s) => s.user_id)).size,
      new_users_7d: (users.data ?? []).length,
      posts_7d: (posts.data ?? []).length,
      media_posts_7d: mediaPosts.length,
      broken_media: mediaPosts.filter((p) => !p.media_url).length,
      messages_24h: msgs.length,
      messages_undelivered_24h: msgs.filter((m) => !m.delivered_at).length,
      notifications_unread_7d: (notifications.data ?? []).filter((n) => !n.read_at).length,
      reports_pending: (reports.data ?? []).length,
    },
  };
}

const SYSTEM = `Tu es l'assistant IA de surveillance de PONZO, un réseau social professionnel africain (React + TanStack Start + Supabase).
Tu analyses des métriques techniques réelles : erreurs client, performances, sécurité, publications/médias, messagerie, notifications, modération.
Tu es en LECTURE SEULE : tu ne modifies jamais l'application et tu ne prétends jamais avoir corrigé quoi que ce soit.
Tu réponds toujours en français, de façon concise, factuelle et actionnable. Si un signal manque, dis-le au lieu d'inventer.`;

/** Demande au modèle un diagnostic structuré à partir des métriques. */
export async function analyzeMetrics(metrics: Metrics) {
  const text = await askGateway([
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Analyse ces métriques PONZO et renvoie UNIQUEMENT un JSON valide de la forme :
{"summary":"2 phrases max","health_score":0-100,"findings":[{"area":"auth|publication|media|messagerie|notifications|performance|securite|base_de_donnees|interface|general","title":"","cause":"","impact":"","priority":"critical|high|medium|low","recommendation":""}]}
Maximum 6 anomalies, les plus importantes uniquement. Si tout est sain, findings peut être vide.

MÉTRIQUES:
${JSON.stringify(metrics).slice(0, 12000)}`,
    },
  ]);

  const parsed = parseJsonBlock<{ summary?: string; health_score?: number; findings?: Finding[] }>(text, {});
  const findings = (parsed.findings ?? []).slice(0, 6).map((f) => ({
    area: String(f.area ?? "general").slice(0, 40),
    title: String(f.title ?? "Anomalie").slice(0, 200),
    cause: String(f.cause ?? "").slice(0, 800),
    impact: String(f.impact ?? "").slice(0, 800),
    priority: (["critical", "high", "medium", "low"] as const).includes(f.priority) ? f.priority : "medium",
    recommendation: String(f.recommendation ?? "").slice(0, 1200),
  }));

  return {
    summary: String(parsed.summary ?? text).slice(0, 1000),
    health_score: Math.max(0, Math.min(100, Math.round(Number(parsed.health_score ?? 80)) || 80)),
    findings,
    model: ASSISTANT_MODEL,
  };
}

/** Répond à une question de l'administrateur, métriques à l'appui. */
export async function answerAdmin(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  metrics: Metrics,
) {
  return askGateway([
    { role: "system", content: SYSTEM },
    { role: "system", content: `Métriques PONZO actuelles :\n${JSON.stringify(metrics).slice(0, 12000)}` },
    ...history.slice(-12),
  ]);
}
