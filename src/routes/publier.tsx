import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase, Image as ImageIcon, MapPin, Radio, Search, Sparkles, Users, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { asPerson } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/publier")({
  head: () => ({
    meta: [
      { title: "Créer une publication — PONZO" },
      { name: "description", content: "Publie un texte, une photo, une vidéo, un besoin, un service ou un projet sur PONZO." },
      { property: "og:title", content: "Créer une publication — PONZO" },
      { property: "og:description", content: "Partage tes idées, tes services et tes projets avec la communauté PONZO." },
    ],
  }),
  component: Publier,
});

const kinds = [
  { label: "Publication", icon: Sparkles },
  { label: "Je cherche", icon: Search },
  { label: "Je propose", icon: Users },
  { label: "Mon projet", icon: Briefcase },
] as const;

function Publier() {
  const [kind, setKind] = useState<(typeof kinds)[number]["label"]>("Publication");
  const [text, setText] = useState("");

  return (
    <AppShell title="Créer">
      <div className="space-y-4 px-3 pt-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {kinds.map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.label}
                onClick={() => setKind(k.label)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                  kind === k.label ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground shadow-soft",
                )}
              >
                <Icon className="h-4 w-4" />
                {k.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl bg-surface p-4 shadow-soft">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <Avatar person={me} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs text-muted-foreground">Public · Tous les membres</p>
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={
              kind === "Je cherche"
                ? "Décris ce que tu recherches…"
                : kind === "Je propose"
                  ? "Décris le service que tu proposes…"
                  : kind === "Mon projet"
                    ? "Présente ton projet et ce dont tu as besoin…"
                    : "À quoi pensez-vous ?"
            }
            className="mt-3 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <div className="grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
            <Attach icon={<ImageIcon className="h-4 w-4 text-primary" />} label="Photo" />
            <Attach icon={<Video className="h-4 w-4 text-destructive" />} label="Vidéo" />
            <Attach icon={<Radio className="h-4 w-4 text-accent-foreground" />} label="Live" />
            <Attach icon={<MapPin className="h-4 w-4 text-primary" />} label="Lieu" />
          </div>
        </div>

        <button
          disabled={!text.trim()}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift transition-opacity disabled:opacity-40"
        >
          Publier
        </button>
      </div>
    </AppShell>
  );
}

function Attach({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold">
      {icon}
      {label}
    </button>
  );
}
