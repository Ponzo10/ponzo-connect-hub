import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EventKind = "page_view" | "feature" | "error" | "perf" | "session";

export type OwnerDashboard = {
  users: {
    total: number;
    today: number;
    week: number;
    month: number;
    year: number;
    online: number;
    active_24h: number;
    active_7d: number;
  };
  content: Record<string, number>;
  marketplace: Record<string, number>;
  news: Record<string, number>;
  moderation: { reports_open: number; reports_total: number };
  signups_daily: { day: string; count: number }[];
  activity_daily: { day: string; posts: number; events: number; users: number }[];
  top_pages: { path: string; visits: number; users: number }[];
  features: { name: string; uses: number; users: number }[];
  errors: { name: string; occurrences: number; last_seen: string; message: string | null }[];
  performance: {
    avg_load_ms: number;
    p95_load_ms: number;
    slow_pages: { path: string; avg_ms: number; samples: number }[];
    avg_session_ms: number;
    sessions_30d: number;
    errors_24h: number;
  };
  security: {
    open_alerts: number;
    critical_alerts: number;
    auth_failures_24h: number;
    events_7d: number;
  };
  generated_at: string;
};

export type SecurityEvent = {
  id: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string | null;
  subject: string | null;
  resolved: boolean;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/* Tracking (client side)                                              */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "ponzo_session_id";

export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** Enregistre un évènement d'usage. Silencieux en cas d'échec. */
export async function trackEvent(input: {
  kind: EventKind;
  name: string;
  path?: string | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    await supabase.from("app_events").insert({
      user_id: userId,
      session_id: sessionId(),
      kind: input.kind,
      name: input.name.slice(0, 120),
      path: input.path ?? null,
      duration_ms: input.durationMs ?? null,
      metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    /* analytics ne doit jamais casser l'app */
  }
}

export const trackFeature = (name: string, metadata?: Record<string, unknown>) =>
  void trackEvent({ kind: "feature", name, metadata: metadata ?? {} });

export async function logSecurityEvent(input: {
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail?: string;
  subject?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_security_event", {
      _kind: input.kind,
      _severity: input.severity,
      _title: input.title,
      _detail: input.detail ?? "",
      _subject: input.subject ?? "",
      _metadata: (input.metadata ?? {}) as never,
    });
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Lecture (propriétaire / admin)                                      */
/* ------------------------------------------------------------------ */

export async function fetchOwnerDashboard(): Promise<OwnerDashboard> {
  const { data, error } = await supabase.rpc("owner_dashboard");
  if (error) throw error;
  return data as unknown as OwnerDashboard;
}

export async function fetchSecurityEvents(limit = 60): Promise<SecurityEvent[]> {
  const { data, error } = await supabase
    .from("security_events")
    .select("id, kind, severity, title, detail, subject, resolved, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SecurityEvent[];
}

export async function resolveSecurityEvent(id: string, resolved: boolean) {
  const { error } = await supabase.rpc("resolve_security_event", { _id: id, _resolved: resolved });
  if (error) throw error;
}

export type ServiceStatus = { name: string; ok: boolean; latencyMs: number; detail: string };

/** Vérifie en direct l'état des services Lovable Cloud (auth, base, stockage, temps réel). */
export async function checkServices(): Promise<ServiceStatus[]> {
  const probe = async (name: string, fn: () => Promise<unknown>): Promise<ServiceStatus> => {
    const started = performance.now();
    try {
      await fn();
      return { name, ok: true, latencyMs: Math.round(performance.now() - started), detail: "Opérationnel" };
    } catch (error) {
      return {
        name,
        ok: false,
        latencyMs: Math.round(performance.now() - started),
        detail: error instanceof Error ? error.message : "Indisponible",
      };
    }
  };

  return Promise.all([
    probe("Authentification", async () => {
      const { error } = await supabase.auth.getUser();
      if (error) throw error;
    }),
    probe("Base de données", async () => {
      const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    }),
    probe("Stockage média", async () => {
      const { error } = await supabase.storage.from("media").list("", { limit: 1 });
      if (error) throw error;
    }),
    probe("API temps réel", async () => {
      const { error } = await supabase.from("app_events").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Moteur de recommandations                                           */
/* ------------------------------------------------------------------ */

export type Recommendation = {
  id: string;
  category: "Fonctionnalité" | "Performance" | "Sécurité" | "UX" | "Croissance" | "Tendance" | "Bug";
  priority: "haute" | "moyenne" | "basse";
  title: string;
  detail: string;
  action: string;
};

const PRIORITY_WEIGHT = { haute: 0, moyenne: 1, basse: 2 } as const;

/** Analyse les données réelles et propose des priorités de développement. */
export function buildRecommendations(d: OwnerDashboard | undefined): Recommendation[] {
  if (!d) return [];
  const recs: Recommendation[] = [];
  const c = d.content;
  const add = (r: Recommendation) => recs.push(r);

  // --- Bugs / erreurs
  if (d.performance.errors_24h > 0) {
    add({
      id: "errors",
      category: "Bug",
      priority: d.performance.errors_24h > 20 ? "haute" : "moyenne",
      title: `${d.performance.errors_24h} erreur(s) client en 24 h`,
      detail: d.errors[0]?.message ?? "Erreurs JavaScript remontées par les membres.",
      action: "Ouvrir l'onglet Erreurs et corriger les occurrences les plus fréquentes.",
    });
  }

  // --- Performance
  if (d.performance.p95_load_ms > 2500) {
    add({
      id: "perf-p95",
      category: "Performance",
      priority: "haute",
      title: `Chargement lent (p95 ${Math.round(d.performance.p95_load_ms)} ms)`,
      detail: "Certaines pages dépassent 2,5 s au 95ᵉ centile.",
      action: "Alléger les images, paginer les listes et précharger les requêtes du fil.",
    });
  }
  const slowest = d.performance.slow_pages[0];
  if (slowest && slowest.avg_ms > 1800) {
    add({
      id: "perf-page",
      category: "Performance",
      priority: "moyenne",
      title: `Page lente : ${slowest.path}`,
      detail: `${Math.round(slowest.avg_ms)} ms en moyenne sur ${slowest.samples} mesures.`,
      action: "Réduire le nombre de requêtes et activer le cache React Query sur cette page.",
    });
  }

  // --- Sécurité
  if (d.security.critical_alerts > 0) {
    add({
      id: "sec-critical",
      category: "Sécurité",
      priority: "haute",
      title: `${d.security.critical_alerts} alerte(s) critique(s) non traitée(s)`,
      detail: "Le centre de sécurité a détecté des évènements critiques.",
      action: "Traiter les alertes dans l'onglet Sécurité et bloquer les comptes concernés.",
    });
  }
  if (d.security.auth_failures_24h > 10) {
    add({
      id: "sec-auth",
      category: "Sécurité",
      priority: "haute",
      title: "Nombreux échecs de connexion",
      detail: `${d.security.auth_failures_24h} tentatives échouées sur 24 h.`,
      action: "Activer la vérification des mots de passe compromis et limiter les tentatives.",
    });
  }
  if (d.moderation.reports_open > 0) {
    add({
      id: "moderation",
      category: "Sécurité",
      priority: d.moderation.reports_open > 5 ? "haute" : "moyenne",
      title: `${d.moderation.reports_open} signalement(s) en attente`,
      detail: "Des contenus signalés attendent une décision de modération.",
      action: "Traiter la file dans l'onglet Signalements.",
    });
  }

  // --- Fonctionnalités peu / très utilisées
  const top = d.features[0];
  if (top) {
    add({
      id: "feature-top",
      category: "Fonctionnalité",
      priority: "moyenne",
      title: `« ${top.name} » est la fonctionnalité la plus utilisée`,
      detail: `${top.uses} utilisations par ${top.users} membre(s) sur 30 jours.`,
      action: "Investir sur cette fonctionnalité : plus d'options, meilleure mise en avant.",
    });
  }
  const weak = d.features.filter((f) => f.uses > 0).slice(-1)[0];
  if (weak && d.features.length > 2) {
    add({
      id: "feature-weak",
      category: "Fonctionnalité",
      priority: "basse",
      title: `« ${weak.name} » est peu utilisée`,
      detail: `Seulement ${weak.uses} utilisation(s) sur 30 jours.`,
      action: "Rendre l'entrée plus visible, ou simplifier le parcours avant d'investir davantage.",
    });
  }

  // --- Contenu / croissance
  if ((c['stories_active'] ?? 0) === 0) {
    add({
      id: "stories",
      category: "Croissance",
      priority: "moyenne",
      title: "Aucune story active",
      detail: "Les stories créent l'habitude quotidienne : sans contenu récent, le retour chute.",
      action: "Relancer les membres actifs par notification pour publier une story.",
    });
  }
  if ((c['videos'] ?? 0) < (c['photos'] ?? 0) / 3) {
    add({
      id: "video",
      category: "Tendance",
      priority: "moyenne",
      title: "La vidéo courte est sous-exploitée",
      detail: "Les réseaux majeurs tirent 60 % de leur engagement de la vidéo verticale.",
      action: "Mettre en avant l'onglet Vidéos et proposer la caméra directement depuis le fil.",
    });
  }
  if (d.users.total > 0 && d.users.active_7d / d.users.total < 0.3) {
    add({
      id: "retention",
      category: "Croissance",
      priority: "haute",
      title: "Rétention hebdomadaire faible",
      detail: `${d.users.active_7d} membres actifs sur ${d.users.total} inscrits (7 jours).`,
      action: "Notifications de réengagement, résumé quotidien et invitations d'amis.",
    });
  }
  if (d.users.week === 0) {
    add({
      id: "acquisition",
      category: "Croissance",
      priority: "haute",
      title: "Aucune inscription cette semaine",
      detail: "L'acquisition est à l'arrêt.",
      action: "Activer le partage d'invitation, les liens de profil publics et le référencement.",
    });
  }
  if ((c['groups'] ?? 0) > 0 && (c['group_messages'] ?? 0) / (c['groups'] ?? 1) < 5) {
    add({
      id: "groups",
      category: "UX",
      priority: "basse",
      title: "Groupes peu animés",
      detail: "Peu de messages par groupe : les nouveaux membres n'y trouvent pas d'activité.",
      action: "Ajouter des suggestions de groupes et des messages de bienvenue automatiques.",
    });
  }
  if ((d.marketplace['products'] ?? 0) < 10) {
    add({
      id: "marketplace",
      category: "Croissance",
      priority: "moyenne",
      title: "Catalogue Marketplace limité",
      detail: `${d.marketplace['products'] ?? 0} produit(s) publiés.`,
      action: "Inciter les vendeurs à créer leur boutique et mettre en avant les nouveautés.",
    });
  }
  if ((d.news['new_7d'] ?? 0) === 0) {
    add({
      id: "news",
      category: "Fonctionnalité",
      priority: "moyenne",
      title: "Aucune actualité publiée cette semaine",
      detail: "La synchronisation automatique n'a rien ingéré.",
      action: "Connecter une source d'information et programmer la tâche de synchronisation.",
    });
  }

  // --- Tendances marché (toujours utiles)
  add({
    id: "trend-ai",
    category: "Tendance",
    priority: "basse",
    title: "Recommandations de contenu personnalisées",
    detail: "Un fil trié par affinité augmente fortement le temps passé.",
    action: "Classer le fil selon les interactions passées plutôt que la seule chronologie.",
  });
  add({
    id: "trend-monet",
    category: "Croissance",
    priority: "basse",
    title: "Préparer la monétisation",
    detail: "Boutiques vérifiées, mise en avant payante et abonnements créateurs.",
    action: "Activer les paiements puis suivre les revenus dans cet espace.",
  });

  return recs.sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]);
}

export function formatDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}
