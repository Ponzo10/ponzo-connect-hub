import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid3x3, Pencil, PlaySquare, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { me, posts } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — PONZO" },
      { name: "description", content: "Photo de profil, couverture, bio, publications, abonnés et paramètres de confidentialité PONZO." },
      { property: "og:title", content: "Profil — PONZO" },
      { property: "og:description", content: "Ton identité professionnelle sur PONZO." },
    ],
  }),
  component: Profil,
});

const tabs = ["Publications", "Vidéos", "Enregistrés"] as const;

function Profil() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Publications");

  return (
    <AppShell title="Profil">
      <div className="relative">
        <div className="h-36 w-full bg-brand" />
        <div className="px-4">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <Avatar person={me} size={88} className="border-4 border-background" />
            <div className="flex gap-2 pb-1">
              <Link
                to="/parametres"
                className="grid h-10 w-10 place-items-center rounded-full bg-surface text-foreground shadow-soft"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-soft">
                <Pencil className="h-4 w-4" /> Modifier le profil
              </button>
            </div>
          </div>

          <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
            {me.name}
            <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">✓</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {me.handle} · {me.role}
          </p>
          <p className="mt-2 text-sm leading-relaxed">
            Je conçois des produits numériques utiles. Ouverte aux collaborations et aux projets à impact. 🇸🇳
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface p-3 text-center shadow-soft">
            <Stat value="184" label="Publications" />
            <Stat value="12,4 K" label="Abonnés" />
            <Stat value="486" label="Abonnements" />
          </div>

          <Link
            to="/parametres"
            className="mt-3 flex items-center gap-2 rounded-2xl bg-surface p-3 text-xs font-semibold shadow-soft"
          >
            <ShieldCheck className="h-4 w-4 text-primary" /> Paramètres de confidentialité
          </Link>
        </div>
      </div>

      <div className="mt-4 flex border-b border-border px-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 border-b-2 pb-3 text-xs font-semibold transition-colors",
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-3 py-3">
        {tab === "Publications" && (
          <div className="space-y-2">
            {posts.slice(1).map((p) => (
              <div key={p.id} className="rounded-2xl bg-surface p-4 shadow-soft">
                <p className="text-xs text-muted-foreground">{p.time}</p>
                <p className="mt-1 line-clamp-3 text-sm">{p.text}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "Vidéos" && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid aspect-[9/16] place-items-center rounded-xl bg-brand text-primary-foreground">
                <PlaySquare className="h-6 w-6" />
              </div>
            ))}
          </div>
        )}
        {tab === "Enregistrés" && (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid aspect-square place-items-center rounded-xl bg-accent-soft text-accent-foreground">
                <Grid3x3 className="h-6 w-6" />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
