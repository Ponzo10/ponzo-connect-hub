import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  FileText,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  Moon,
  ShieldCheck,
  Trash2,
  UserCog,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — PONZO" },
      { name: "description", content: "Compte, sécurité, langue, thème, confidentialité, notifications et aide sur PONZO." },
      { property: "og:title", content: "Paramètres — PONZO" },
      { property: "og:description", content: "Gère ton compte, ta sécurité et tes préférences PONZO." },
    ],
  }),
  component: Parametres,
});

const groups = [
  {
    title: "Compte",
    items: [
      { label: "Modifier le profil", icon: UserCog },
      { label: "Modifier le mot de passe", icon: KeyRound },
      { label: "Langue", icon: Globe, hint: "Français" },
    ],
  },
  {
    title: "Confidentialité et sécurité",
    items: [
      { label: "Confidentialité", icon: ShieldCheck },
      { label: "Sécurité", icon: KeyRound },
      { label: "Gestion des notifications", icon: Bell },
      { label: "Comptes bloqués", icon: UserX },
    ],
  },
  {
    title: "Assistance",
    items: [
      { label: "Centre d'aide", icon: HelpCircle },
      { label: "Signaler un problème", icon: FileText },
      { label: "À propos de PONZO", icon: Info },
      { label: "Conditions d'utilisation", icon: FileText },
      { label: "Politique de confidentialité", icon: FileText },
    ],
  },
] as const;

function Parametres() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <AppShell title="Paramètres">
      <div className="space-y-5 px-3 pt-4">
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-soft">
          <span className="flex items-center gap-3 text-sm font-semibold">
            <Moon className="h-5 w-5 text-primary" /> Mode sombre
          </span>
          <button
            role="switch"
            aria-checked={dark}
            onClick={() => setDark((v) => !v)}
            className={`h-7 w-12 rounded-full p-1 transition-colors ${dark ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-surface transition-transform ${dark ? "translate-x-5" : ""}`}
            />
          </button>
        </div>

        {groups.map((g) => (
          <section key={g.title}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
            <div className="overflow-hidden rounded-2xl bg-surface shadow-soft">
              {g.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.label}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 p-4 text-left last:border-0"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="truncate text-sm">{it.label}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {"hint" in it ? it.hint : null}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <div className="space-y-2 pb-4">
          <Link
            to="/bienvenue"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface py-3.5 text-sm font-semibold shadow-soft"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </Link>
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-destructive">
            <Trash2 className="h-4 w-4" /> Supprimer le compte
          </button>
        </div>
      </div>
    </AppShell>
  );
}
