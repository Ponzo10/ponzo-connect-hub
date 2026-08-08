import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import {
  ContentTab,
  InsightsTab,
  OverviewTab,
  PerformanceTab,
  ReportTab,
  SecurityTab,
  UsageTab,
  useOwnerDashboard,
} from "@/components/ponzo/OwnerDashboard";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import {
  asPerson,
  broadcastNotification,
  deletePost,
  fetchActivityLog,
  fetchAllRoles,
  fetchFeed,
  fetchProfiles,
  fetchReports,
  fetchShops,
  setUserRole,
  timeAgo,
  updateReportStatus,
} from "@/lib/ponzo-api";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Espace administrateur — PONZO" },
      {
        name: "description",
        content: "Gestion des membres, publications, signalements, boutiques, statistiques et notifications globales.",
      },
      { property: "og:title", content: "Espace administrateur — PONZO" },
      { property: "og:description", content: "Pilotage complet de la plateforme PONZO." },
    ],
  }),
  component: Admin,
});

const tabs = [
  "Vue d'ensemble",
  "Assistant IA",
  "Contenu",
  "Usage",
  "Performance",
  "Sécurité",
  "Analyse",
  "Rapport",
  "Membres",
  "Publications",
  "Signalements",
  "Boutiques",
  "Journal",
  "Diffusion",
] as const;

function Admin() {
  const { user, isStaff, isOwner } = useAuth();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Vue d'ensemble");
  const queryClient = useQueryClient();

  const dashboard = useOwnerDashboard(isStaff);
  const people = useQuery({ queryKey: ["admin-people"], queryFn: () => fetchProfiles(), enabled: isStaff });
  const roles = useQuery({ queryKey: ["admin-roles"], queryFn: fetchAllRoles, enabled: isStaff });
  const posts = useQuery({ queryKey: ["admin-posts"], queryFn: fetchFeed, enabled: isStaff });
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: fetchReports, enabled: isStaff });
  const shops = useQuery({ queryKey: ["admin-shops"], queryFn: () => fetchShops(), enabled: isStaff });
  const log = useQuery({ queryKey: ["admin-log"], queryFn: fetchActivityLog, enabled: isStaff });
  const [broadcast, setBroadcast] = useState("");

  if (!isStaff) {
    return (
      <AppShell title="Administration">
        <div className="px-6 py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Cet espace est réservé au propriétaire et aux administrateurs autorisés.
          </p>
          <Link to="/" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Retour à l'accueil
          </Link>
        </div>
      </AppShell>
    );
  }

  const roleOf = (id: string) => (roles.data ?? []).filter((r) => r.user_id === id).map((r) => r.role);

  return (
    <AppShell title="Administration">
      <div className="px-3 pt-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground"
                  : "shrink-0 rounded-full bg-surface px-4 py-2 text-xs font-semibold text-muted-foreground shadow-soft"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-3 py-4">
        {tab === "Vue d'ensemble" && <OverviewTab d={dashboard.data} />}
        {tab === "Contenu" && <ContentTab d={dashboard.data} />}
        {tab === "Usage" && <UsageTab d={dashboard.data} />}
        {tab === "Performance" && <PerformanceTab d={dashboard.data} />}
        {tab === "Sécurité" && <SecurityTab />}
        {tab === "Analyse" && <InsightsTab d={dashboard.data} />}
        {tab === "Rapport" && <ReportTab d={dashboard.data} />}

        {tab === "Membres" &&
          (people.data ?? []).map((p) => {
            const rs = roleOf(p.id);
            return (
              <div key={p.id} className="rounded-2xl bg-surface p-3 shadow-soft">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                  <Avatar person={asPerson(p)} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rs.length ? rs.join(", ") : "membre"} {p.city ? `· ${p.city}` : ""}
                    </p>
                  </div>
                </div>
                {isOwner && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["admin", "moderator"] as const).map((role) => {
                      const has = rs.includes(role);
                      return (
                        <button
                          key={role}
                          onClick={async () => {
                            try {
                              await setUserRole(p.id, role, !has);
                              await queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
                              toast.success(has ? `Rôle ${role} retiré` : `Rôle ${role} attribué`);
                            } catch {
                              toast.error("Action impossible.");
                            }
                          }}
                          className={
                            has
                              ? "rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                              : "rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
                          }
                        >
                          {has ? `Retirer ${role}` : `Nommer ${role}`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

        {tab === "Publications" &&
          (posts.data ?? []).map((p) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{p.author?.full_name ?? "Membre"}</span>
                <span className="block truncate text-xs text-muted-foreground">{p.body}</span>
              </span>
              <button
                aria-label="Supprimer la publication"
                onClick={async () => {
                  await deletePost(p.id);
                  await queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
                  void queryClient.invalidateQueries({ queryKey: ["feed"] });
                  toast.success("Publication supprimée");
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

        {tab === "Signalements" && (
          <>
            {(reports.data ?? []).map((r) => (
              <div key={r.id} className="rounded-2xl bg-surface p-3 shadow-soft">
                <p className="text-sm font-semibold">
                  {r.entity_type} · {r.status}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                <div className="mt-2 flex gap-2">
                  {(["reviewed", "dismissed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={async () => {
                        await updateReportStatus(r.id, s);
                        await queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
                        toast.success("Signalement mis à jour");
                      }}
                      className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
                    >
                      {s === "reviewed" ? "Traité" : "Rejeter"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {(reports.data ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun signalement.</p>
            )}
          </>
        )}

        {tab === "Boutiques" &&
          (shops.data ?? []).map((s) => (
            <div key={s.id} className="rounded-2xl bg-surface p-3 shadow-soft">
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.city ?? "Ville non renseignée"} · {s.phone ?? "sans téléphone"}
              </p>
            </div>
          ))}

        {tab === "Journal" &&
          (log.data ?? []).map((a) => (
            <div key={a.id} className="rounded-2xl bg-surface p-3 shadow-soft">
              <p className="text-sm font-semibold">{a.action}</p>
              <p className="text-xs text-muted-foreground">
                {a.entity_type ?? "—"} · {timeAgo(a.created_at)}
              </p>
            </div>
          ))}

        {tab === "Diffusion" && (
          <div className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Bell className="h-4 w-4 text-primary" /> Notification globale
            </p>
            <textarea
              value={broadcast}
              rows={4}
              onChange={(e) => setBroadcast(e.target.value)}
              placeholder="Message envoyé à tous les membres…"
              className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={async () => {
                if (!user || !broadcast.trim()) return;
                try {
                  await broadcastNotification(user.id, broadcast.trim());
                  setBroadcast("");
                  toast.success("Notification envoyée à tous les membres");
                } catch {
                  toast.error("Diffusion impossible.");
                }
              }}
              className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground"
            >
              Envoyer à tous
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

