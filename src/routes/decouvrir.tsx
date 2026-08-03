import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Handshake, Lightbulb, Search, Sparkles, Users, Video } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { people } from "@/data/demo";

export const Route = createFileRoute("/decouvrir")({
  head: () => ({
    meta: [
      { title: "Découvrir — PONZO" },
      { name: "description", content: "Opportunités, collaborations, groupes, communautés et événements : découvre l'écosystème PONZO." },
      { property: "og:title", content: "Découvrir — PONZO" },
      { property: "og:description", content: "Opportunités, collaborations, communautés et événements près de chez toi." },
    ],
  }),
  component: Decouvrir,
});

const hubs = [
  { label: "Je cherche", desc: "Publier un besoin", icon: Search, to: "/publier" },
  { label: "Je propose", desc: "Offrir un service", icon: Sparkles, to: "/publier" },
  { label: "Mon projet", desc: "Présenter un projet", icon: Lightbulb, to: "/publier" },
  { label: "Opportunités", desc: "Missions et emplois", icon: Handshake, to: "/decouvrir" },
  { label: "Communautés", desc: "Groupes thématiques", icon: Users, to: "/decouvrir" },
  { label: "Événements", desc: "Rencontres et lives", icon: CalendarDays, to: "/decouvrir" },
] as const;

const events = [
  { id: "e1", title: "Meetup créateurs — Dakar", date: "Sam. 12 sept · 16h", people: 128 },
  { id: "e2", title: "Atelier financement de projet", date: "Mar. 15 sept · 19h", people: 74 },
  { id: "e3", title: "Live : réussir sa boutique", date: "Jeu. 17 sept · 20h", people: 342 },
];

function Decouvrir() {
  return (
    <AppShell title="Découvrir">
      <div className="space-y-5 px-3 pt-4">
        <section className="rounded-3xl bg-brand p-5 text-primary-foreground shadow-lift">
          <h2 className="text-lg font-bold">L'écosystème PONZO</h2>
          <p className="mt-1 text-sm opacity-90">
            Exprime un besoin, propose une compétence ou lance un projet — la communauté répond.
          </p>
          <Link
            to="/publier"
            className="mt-4 inline-flex rounded-full bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary"
          >
            Publier maintenant
          </Link>
        </section>

        <section className="grid grid-cols-2 gap-2">
          {hubs.map((h) => {
            const Icon = h.icon;
            return (
              <Link key={h.label} to={h.to} className="rounded-2xl bg-surface p-4 shadow-soft">
                <Icon className="h-6 w-6 text-primary" />
                <p className="mt-3 text-sm font-semibold">{h.label}</p>
                <p className="text-xs text-muted-foreground">{h.desc}</p>
              </Link>
            );
          })}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Suggestions de collaboration</h2>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {people.map((p) => (
              <div key={p.id} className="w-36 shrink-0 rounded-2xl bg-surface p-4 text-center shadow-soft">
                <Avatar person={p} size={56} className="mx-auto" />
                <p className="mt-2 truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{p.role}</p>
                <button className="mt-3 w-full rounded-full bg-primary-soft py-1.5 text-xs font-semibold text-primary">
                  Collaborer
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Événements à venir</h2>
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-foreground">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.date} · {e.people} participants
                  </p>
                </div>
                <button className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  Rejoindre
                </button>
              </div>
            ))}
          </div>
        </section>

        <Link
          to="/videos"
          className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-soft"
        >
          <span className="flex items-center gap-3 text-sm font-semibold">
            <Video className="h-5 w-5 text-destructive" /> Vidéos courtes PONZO
          </span>
          <span className="text-xs text-muted-foreground">Voir</span>
        </Link>
      </div>
    </AppShell>
  );
}
