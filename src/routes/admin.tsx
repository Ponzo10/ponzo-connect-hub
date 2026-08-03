import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Flag, LayoutDashboard, MessageSquare, Megaphone, ShieldCheck, Tags, Users } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — PONZO" },
      { name: "description", content: "Tableau de bord PONZO : utilisateurs, publications, signalements, vérifications, publicités et statistiques." },
      { property: "og:title", content: "Administration — PONZO" },
      { property: "og:description", content: "Modération et pilotage de la plateforme PONZO." },
    ],
  }),
  component: Admin,
});

const stats = [
  { label: "Utilisateurs", value: "48 320", delta: "+4,2 %" },
  { label: "Publications / jour", value: "12 940", delta: "+8,1 %" },
  { label: "Signalements", value: "37", delta: "-12 %" },
  { label: "Ventes Marketplace", value: "2 108", delta: "+15 %" },
];

const tools = [
  { label: "Gestion des utilisateurs", icon: Users },
  { label: "Gestion des publications", icon: LayoutDashboard },
  { label: "Gestion des commentaires", icon: MessageSquare },
  { label: "Gestion des signalements", icon: Flag },
  { label: "Vérification des comptes", icon: ShieldCheck },
  { label: "Gestion des publicités", icon: Megaphone },
  { label: "Gestion des catégories", icon: Tags },
  { label: "Statistiques complètes", icon: BarChart3 },
];

function Admin() {
  return (
    <AppShell title="Administration">
      <div className="space-y-5 px-3 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-surface p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-bold">{s.value}</p>
              <p className="text-[11px] font-semibold text-primary">{s.delta}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Modération</h2>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.label} className="rounded-2xl bg-surface p-4 text-left shadow-soft">
                  <Icon className="h-5 w-5 text-primary" />
                  <p className="mt-3 text-sm font-semibold leading-tight">{t.label}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-surface p-4 shadow-soft">
          <h2 className="text-sm font-bold">File de modération</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {["Publication signalée · contenu trompeur", "Commentaire signalé · harcèlement", "Produit signalé · contrefaçon"].map(
              (row) => (
                <li key={row} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-muted p-3">
                  <span className="truncate text-xs">{row}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground">Valider</span>
                    <span className="rounded-full bg-destructive px-3 py-1 text-[11px] font-semibold text-destructive-foreground">
                      Retirer
                    </span>
                  </span>
                </li>
              ),
            )}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
