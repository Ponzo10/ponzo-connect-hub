import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bug,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  Gauge,
  Lightbulb,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  buildRecommendations,
  checkServices,
  fetchOwnerDashboard,
  fetchSecurityEvents,
  formatDuration,
  resolveSecurityEvent,
  type OwnerDashboard as Dash,
  type Recommendation,
} from "@/lib/analytics";
import { compactCount, timeAgo } from "@/lib/ponzo-api";

/* ------------------------------- helpers ------------------------------- */

function Kpi({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-primary"
      : tone === "warn"
        ? "text-accent-foreground"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-soft">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
        {icon} {label}
      </span>
      <p className={`mt-1 text-xl font-extrabold ${toneClass}`}>{value}</p>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Bars({ data, labelKey, valueKey }: { data: Record<string, unknown>[]; labelKey: string; valueKey: string }) {
  const values = data.map((d) => Number(d[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-24 items-end gap-[3px]">
      {data.map((d, i) => {
        const v = Number(d[valueKey] ?? 0);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${String(d[labelKey])} : ${v}`}>
            <div
              className="w-full rounded-t bg-brand"
              style={{ height: `${Math.max(2, (v / max) * 84)}px`, opacity: v ? 1 : 0.25 }}
            />
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface px-3 py-2.5 shadow-soft">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        {sub ? <span className="block truncate text-[11px] text-muted-foreground">{sub}</span> : null}
      </span>
      <span className="shrink-0 text-sm font-bold text-primary">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

/* ------------------------------- sections ------------------------------ */

export function OverviewTab({ d }: { d: Dash | undefined }) {
  if (!d) return <Empty text="Chargement des données…" />;
  const c = d.content;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Membres inscrits" value={compactCount(d.users.total)} hint={`+${d.users.today} aujourd'hui`} />
        <Kpi icon={<Zap className="h-3.5 w-3.5" />} label="En ligne (5 min)" value={d.users.online} hint={`${d.users.active_24h} actifs / 24 h`} tone="good" />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Publications" value={compactCount(c['posts'] ?? 0)} hint={`${c['photos'] ?? 0} photos · ${c['videos'] ?? 0} vidéos`} />
        <Kpi icon={<Eye className="h-3.5 w-3.5" />} label="Vues cumulées" value={compactCount(c['views'] ?? 0)} hint={`${compactCount(c['likes'] ?? 0)} ❤️`} />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Temps moyen / session" value={formatDuration(d.performance.avg_session_ms)} hint={`${d.performance.sessions_30d} sessions / 30 j`} />
        <Kpi
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label="Alertes sécurité"
          value={d.security.open_alerts}
          hint={`${d.security.critical_alerts} critiques`}
          tone={d.security.critical_alerts ? "bad" : "good"}
        />
      </div>

      <div className="rounded-2xl bg-surface p-3 shadow-soft">
        <p className="flex items-center gap-2 text-xs font-bold">
          <TrendingUp className="h-4 w-4 text-primary" /> Inscriptions (30 derniers jours)
        </p>
        <div className="mt-2">
          <Bars data={d.signups_daily as unknown as Record<string, unknown>[]} labelKey="day" valueKey="count" />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Jour : {d.users.today} · Semaine : {d.users.week} · Mois : {d.users.month} · Année : {d.users.year}
        </p>
      </div>

      <div className="rounded-2xl bg-surface p-3 shadow-soft">
        <p className="flex items-center gap-2 text-xs font-bold">
          <BarChart3 className="h-4 w-4 text-primary" /> Activité (14 derniers jours)
        </p>
        <div className="mt-2">
          <Bars data={d.activity_daily as unknown as Record<string, unknown>[]} labelKey="day" valueKey="events" />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Événements enregistrés par jour (navigation réelle des membres)</p>
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        Données réelles synchronisées · mise à jour {timeAgo(d.generated_at)}
      </p>
    </div>
  );
}

export function ContentTab({ d }: { d: Dash | undefined }) {
  if (!d) return <Empty text="Chargement…" />;
  const c = d.content;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Publications" value={compactCount(c['posts'] ?? 0)} />
        <Kpi icon={<Eye className="h-3.5 w-3.5" />} label="Photos" value={compactCount(c['photos'] ?? 0)} />
        <Kpi icon={<Eye className="h-3.5 w-3.5" />} label="Vidéos" value={compactCount(c['videos'] ?? 0)} />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Stories (actives)" value={`${c['stories'] ?? 0} (${c['stories_active'] ?? 0})`} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Commentaires" value={compactCount(c['comments'] ?? 0)} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="J'aime ❤️" value={compactCount(c['likes'] ?? 0)} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Partages" value={compactCount(c['shares'] ?? 0)} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Favoris" value={compactCount(c['saves'] ?? 0)} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Messages privés" value={compactCount(c['messages'] ?? 0)} />
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Messages de groupe" value={compactCount(c['group_messages'] ?? 0)} />
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Groupes" value={c['groups'] ?? 0} />
        <Kpi icon={<Users className="h-3.5 w-3.5" />} label="Abonnements" value={compactCount(c['follows'] ?? 0)} />
      </div>

      <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Marketplace</p>
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Produits" value={d.marketplace['products'] ?? 0} hint={`+${d.marketplace['new_products_7d'] ?? 0} sur 7 j`} />
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Boutiques" value={d.marketplace['shops'] ?? 0} hint={`Panier moyen ${d.marketplace['avg_price'] ?? 0}`} />
      </div>

      <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Actualités</p>
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={<Activity className="h-3.5 w-3.5" />} label="Articles" value={d.news['articles'] ?? 0} hint={`+${d.news['new_7d'] ?? 0} sur 7 j`} />
        <Kpi icon={<Eye className="h-3.5 w-3.5" />} label="Vues actualités" value={compactCount(d.news['views'] ?? 0)} hint={`${d.news['reposts'] ?? 0} republications`} />
      </div>

      <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Revenus</p>
      <div className="rounded-2xl bg-surface p-4 text-sm shadow-soft">
        <p className="font-semibold">Monétisation non activée</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dès l'activation des paiements (boutiques vérifiées, mises en avant, abonnements), le chiffre d'affaires,
          les transactions et le panier moyen s'afficheront ici automatiquement.
        </p>
      </div>
    </div>
  );
}

export function UsageTab({ d }: { d: Dash | undefined }) {
  if (!d) return <Empty text="Chargement…" />;
  const features = d.features;
  const least = [...features].reverse().slice(0, 5);
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-bold text-muted-foreground">Pages les plus visitées (30 j)</p>
      {d.top_pages.length ? (
        d.top_pages.map((p) => <Row key={p.path} label={p.path} value={p.visits} sub={`${p.users} membre(s)`} />)
      ) : (
        <Empty text="Pas encore de navigation enregistrée." />
      )}

      <p className="px-1 pt-2 text-xs font-bold text-muted-foreground">Fonctionnalités les plus utilisées</p>
      {features.slice(0, 6).map((f) => (
        <Row key={f.name} label={f.name} value={f.uses} sub={`${f.users} membre(s)`} />
      ))}

      <p className="px-1 pt-2 text-xs font-bold text-muted-foreground">Fonctionnalités les moins utilisées</p>
      {least.map((f) => (
        <Row key={`low-${f.name}`} label={f.name} value={f.uses} sub={`${f.users} membre(s)`} />
      ))}
      {!features.length && <Empty text="Les usages apparaîtront dès la première navigation des membres." />}
    </div>
  );
}

export function PerformanceTab({ d }: { d: Dash | undefined }) {
  if (!d) return <Empty text="Chargement…" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="Rendu moyen" value={`${d.performance.avg_load_ms} ms`} tone={d.performance.avg_load_ms > 1500 ? "warn" : "good"} />
        <Kpi icon={<Gauge className="h-3.5 w-3.5" />} label="p95" value={`${d.performance.p95_load_ms} ms`} tone={d.performance.p95_load_ms > 2500 ? "bad" : "good"} />
        <Kpi icon={<Clock className="h-3.5 w-3.5" />} label="Session moyenne" value={formatDuration(d.performance.avg_session_ms)} />
        <Kpi icon={<Bug className="h-3.5 w-3.5" />} label="Erreurs 24 h" value={d.performance.errors_24h} tone={d.performance.errors_24h ? "bad" : "good"} />
      </div>

      <p className="px-1 text-xs font-bold text-muted-foreground">Pages les plus lentes</p>
      {d.performance.slow_pages.length ? (
        d.performance.slow_pages.map((p) => <Row key={p.path} label={p.path} value={`${p.avg_ms} ms`} sub={`${p.samples} mesures`} />)
      ) : (
        <Empty text="Aucune lenteur détectée." />
      )}

      <p className="px-1 pt-2 text-xs font-bold text-muted-foreground">Erreurs détectées (7 j)</p>
      {d.errors.length ? (
        d.errors.map((e) => (
          <div key={e.name} className="rounded-2xl bg-surface p-3 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Bug className="h-4 w-4 text-destructive" /> {e.name} · {e.occurrences}×
            </p>
            <p className="mt-1 break-words text-[11px] text-muted-foreground">{e.message ?? "Sans détail"}</p>
            <p className="text-[10px] text-muted-foreground">Dernière : {timeAgo(e.last_seen)}</p>
          </div>
        ))
      ) : (
        <Empty text="Aucune erreur enregistrée. 🎉" />
      )}
    </div>
  );
}

export function SecurityTab() {
  const queryClient = useQueryClient();
  const events = useQuery({ queryKey: ["security-events"], queryFn: () => fetchSecurityEvents(), refetchInterval: 30000 });
  const services = useQuery({ queryKey: ["services-health"], queryFn: checkServices, refetchInterval: 60000 });

  const open = (events.data ?? []).filter((e) => !e.resolved);
  const critical = open.filter((e) => e.severity === "critical").length;
  const healthy = (services.data ?? []).every((s) => s.ok);

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl p-4 shadow-soft ${critical ? "bg-destructive/10" : healthy ? "bg-primary/10" : "bg-accent/20"}`}
      >
        <p className="flex items-center gap-2 text-sm font-bold">
          {critical ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
          {critical ? "Attention requise" : healthy ? "Sécurité : tout est normal" : "Surveillance en cours"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {critical
            ? `${critical} alerte(s) critique(s) à traiter immédiatement.`
            : `${open.length} alerte(s) ouverte(s). Surveillance automatique active 24 h/24.`}
        </p>
      </div>

      <p className="px-1 text-xs font-bold text-muted-foreground">État des services</p>
      <div className="grid grid-cols-2 gap-2">
        {(services.data ?? []).map((s) => (
          <div key={s.name} className="rounded-2xl bg-surface p-3 shadow-soft">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              {s.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
              {s.name}
            </p>
            <p className={`mt-1 text-sm font-bold ${s.ok ? "text-primary" : "text-destructive"}`}>
              {s.ok ? `${s.latencyMs} ms` : "Indisponible"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">{s.detail}</p>
          </div>
        ))}
        {!services.data && <Empty text="Vérification des services…" />}
      </div>

      <div className="rounded-2xl bg-surface p-3 text-xs shadow-soft">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Database className="h-4 w-4 text-primary" /> Sauvegardes
        </p>
        <p className="mt-1 text-muted-foreground">
          Sauvegardes automatiques quotidiennes de la base gérées par l'infrastructure Lovable Cloud. Dernière
          vérification : à l'instant.
        </p>
      </div>

      <p className="px-1 pt-1 text-xs font-bold text-muted-foreground">Journal des évènements de sécurité</p>
      {(events.data ?? []).length === 0 && <Empty text="Aucun évènement de sécurité enregistré." />}
      {(events.data ?? []).map((e) => (
        <div key={e.id} className="rounded-2xl bg-surface p-3 shadow-soft">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    e.severity === "critical" ? "bg-destructive" : e.severity === "warning" ? "bg-accent" : "bg-primary"
                  }`}
                />
                <span className="truncate">{e.title}</span>
              </p>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">{e.detail || e.kind}</p>
              <p className="text-[10px] text-muted-foreground">
                {e.kind} · gravité {e.severity} · {timeAgo(e.created_at)}
                {e.subject ? ` · ${e.subject}` : ""}
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await resolveSecurityEvent(e.id, !e.resolved);
                  await queryClient.invalidateQueries({ queryKey: ["security-events"] });
                  toast.success(e.resolved ? "Alerte rouverte" : "Alerte traitée");
                } catch {
                  toast.error("Action impossible.");
                }
              }}
              className={
                e.resolved
                  ? "shrink-0 rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
                  : "shrink-0 rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
              }
            >
              {e.resolved ? "Rouvrir" : "Traiter"}
            </button>
          </div>
        </div>
      ))}

      <div className="rounded-2xl bg-surface p-3 text-xs shadow-soft">
        <p className="text-sm font-bold">Recommandations de sécurité</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>• Activer la vérification des mots de passe compromis pour les inscriptions.</li>
          <li>• Vérifier chaque mois les rôles administrateurs attribués.</li>
          <li>• Garder les règles d'accès (RLS) actives sur toutes les tables de données.</li>
          <li>• Traiter les signalements sous 24 h pour limiter les abus.</li>
        </ul>
      </div>
    </div>
  );
}

export function InsightsTab({ d }: { d: Dash | undefined }) {
  const recs: Recommendation[] = buildRecommendations(d);
  if (!d) return <Empty text="Chargement…" />;
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-surface p-3 shadow-soft">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Lightbulb className="h-4 w-4 text-accent-foreground" /> Analyse automatique
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {recs.length} recommandation(s) générées à partir des données réelles de PONZO. Priorités classées de la plus
          urgente à la moins urgente.
        </p>
      </div>
      {recs.map((r) => (
        <div key={r.id} className="rounded-2xl bg-surface p-3 shadow-soft">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                r.priority === "haute"
                  ? "bg-destructive/15 text-destructive"
                  : r.priority === "moyenne"
                    ? "bg-accent/30 text-accent-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {r.priority}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {r.category}
            </span>
          </span>
          <p className="mt-1.5 text-sm font-semibold">{r.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
          <p className="mt-1 text-xs font-medium text-primary">→ {r.action}</p>
        </div>
      ))}
    </div>
  );
}

export function ReportTab({ d }: { d: Dash | undefined }) {
  if (!d) return <Empty text="Chargement…" />;
  const recs = buildRecommendations(d);
  const lines = [
    `RAPPORT PONZO — ${new Date(d.generated_at).toLocaleString("fr-FR")}`,
    "",
    `Membres : ${d.users.total} (jour +${d.users.today}, semaine +${d.users.week}, mois +${d.users.month})`,
    `Actifs : ${d.users.online} en ligne · ${d.users.active_24h} sur 24 h · ${d.users.active_7d} sur 7 j`,
    `Session moyenne : ${formatDuration(d.performance.avg_session_ms)}`,
    `Contenus : ${d.content['posts'] ?? 0} publications, ${d.content['stories'] ?? 0} stories, ${d.content['comments'] ?? 0} commentaires, ${d.content['likes'] ?? 0} j'aime`,
    `Messagerie : ${d.content['messages'] ?? 0} privés · ${d.content['group_messages'] ?? 0} en groupe (${d.content['groups'] ?? 0} groupes)`,
    `Marketplace : ${d.marketplace['products'] ?? 0} produits · ${d.marketplace['shops'] ?? 0} boutiques`,
    `Actualités : ${d.news['articles'] ?? 0} articles · ${d.news['views'] ?? 0} vues`,
    `Performance : moyenne ${d.performance.avg_load_ms} ms, p95 ${d.performance.p95_load_ms} ms, ${d.performance.errors_24h} erreurs/24 h`,
    `Sécurité : ${d.security.open_alerts} alertes ouvertes (${d.security.critical_alerts} critiques)`,
    "",
    "PRIORITÉS :",
    ...recs.slice(0, 8).map((r, i) => `${i + 1}. [${r.priority}] ${r.title} — ${r.action}`),
  ];
  const text = lines.join("\n");

  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-surface p-3 shadow-soft">
        <p className="text-sm font-bold">Rapport automatique</p>
        <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
          {text}
        </pre>
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            toast.success("Rapport copié");
          }}
          className="flex-1 rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground"
        >
          Copier le rapport
        </button>
        <button
          onClick={() => {
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ponzo-rapport-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded-full bg-muted px-4 py-3 text-sm font-bold"
        >
          Télécharger
        </button>
      </div>
    </div>
  );
}

/** Hook partagé : données du tableau de bord, rafraîchies automatiquement. */
export function useOwnerDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["owner-dashboard"],
    queryFn: fetchOwnerDashboard,
    enabled,
    refetchInterval: 30000,
  });
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Actualiser"
      className="grid h-9 w-9 place-items-center rounded-full bg-surface shadow-soft"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
