import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, ImageIcon, Megaphone, Plus, Radio, Search, ShoppingBag, Video } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { PostCard } from "@/components/ponzo/PostCard";
import { me, posts, stories } from "@/data/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PONZO — Le réseau social professionnel africain" },
      {
        name: "description",
        content:
          "PONZO : connecte-toi, crée et construis. Fil d'actualité, stories, vidéos courtes, marketplace et opportunités professionnelles.",
      },
      { property: "og:title", content: "PONZO — Connecte-toi. Crée. Construis." },
      {
        property: "og:description",
        content: "Le réseau social professionnel pour trouver des opportunités, proposer ses services et lancer ses projets.",
      },
    ],
  }),
  component: Feed,
});

const quickActions = [
  { label: "Je cherche", hint: "Trouver ce dont vous avez besoin", icon: Search, to: "/recherche", tone: "text-primary" },
  { label: "Je propose", hint: "Proposer vos services", icon: Megaphone, to: "/publier", tone: "text-accent-foreground" },
  { label: "Mon projet", hint: "Partager vos projets", icon: Briefcase, to: "/publier", tone: "text-primary" },
  { label: "Marketplace", hint: "Acheter et vendre", icon: ShoppingBag, to: "/marketplace", tone: "text-foreground" },
  { label: "Vidéos", hint: "Regarder et partager", icon: Video, to: "/videos", tone: "text-destructive" },
  { label: "Live", hint: "Diffusions en direct", icon: Radio, to: "/decouvrir", tone: "text-primary" },
] as const;

function Feed() {
  return (
    <AppShell>
      <section className="px-3 pt-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
          <div className="relative">
            <Avatar person={me} size={44} />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
          </div>
          <Link
            to="/publier"
            className="min-w-0 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground"
          >
            À quoi pensez-vous ?
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <ComposerChip icon={<ImageIcon className="h-4 w-4 text-primary" />} label="Photo" />
          <ComposerChip icon={<Video className="h-4 w-4 text-destructive" />} label="Vidéo" />
          <ComposerChip icon={<Radio className="h-4 w-4 text-accent-foreground" />} label="Live" />
        </div>
      </section>

      <section className="mt-4">
        <h2 className="sr-only">Stories</h2>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-1">
          <Link
            to="/publier"
            className="relative flex h-44 w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl bg-brand text-primary-foreground shadow-soft"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-foreground/20">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-center text-xs font-semibold leading-tight">
              Créer
              <br />
              une story
            </span>
          </Link>
          {stories.map((s) => (
            <button
              key={s.id}
              className="relative flex h-44 w-28 shrink-0 flex-col items-center justify-end gap-1 overflow-hidden rounded-2xl bg-secondary p-2 shadow-soft"
            >
              <span className="absolute inset-x-0 top-0 flex justify-center pt-3">
                <Avatar person={s} size={56} ring />
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{s.name}</span>
              <span className="text-[10px] text-muted-foreground">{s.time}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 px-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-2xl bg-surface p-3 shadow-soft">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.label}
                to={a.to}
                className="flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition-colors hover:bg-muted"
              >
                <Icon className={`h-6 w-6 ${a.tone}`} />
                <span className="text-xs font-semibold">{a.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">{a.hint}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-4 sm:px-3">
        <h2 className="sr-only">Fil d'actualité</h2>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </section>
    </AppShell>
  );
}

function ComposerChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center justify-center gap-2 rounded-xl bg-surface py-2.5 text-xs font-semibold shadow-soft transition-colors hover:bg-muted">
      {icon}
      {label}
    </button>
  );
}
