import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, Heart, MessageCircle, Music2, Play, Send } from "lucide-react";

import { BottomNav } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { reels } from "@/data/demo";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Vidéos courtes — PONZO" },
      { name: "description", content: "Découvre les vidéos courtes PONZO en défilement vertical : créateurs, projets et conseils business." },
      { property: "og:title", content: "Vidéos courtes — PONZO" },
      { property: "og:description", content: "Défilement vertical, lecture automatique, réactions et partages." },
    ],
  }),
  component: Videos,
});

function Videos() {
  return (
    <div className="min-h-screen bg-foreground pb-20">
      <div className="snap-y-page h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar">
        {reels.map((r, i) => (
          <section
            key={r.id}
            className="relative flex h-[calc(100vh-5rem)] snap-start items-end"
            style={{
              background:
                i % 2 === 0
                  ? "linear-gradient(160deg, oklch(0.34 0.08 168), oklch(0.24 0.04 165))"
                  : "linear-gradient(160deg, oklch(0.5 0.12 90), oklch(0.28 0.05 100))",
            }}
          >
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-20 w-20 place-items-center rounded-full bg-background/15 backdrop-blur-sm">
                <Play className="h-8 w-8 fill-background text-background" />
              </span>
            </span>

            <div className="relative z-10 flex w-full items-end justify-between gap-4 p-5 pb-8">
              <div className="min-w-0 flex-1 text-background">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar person={r.author} size={38} />
                  <span className="truncate text-sm font-bold">{r.author.name}</span>
                  <button className="shrink-0 rounded-full border border-background/60 px-3 py-1 text-xs font-semibold">
                    Suivre
                  </button>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed">{r.caption}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs opacity-80">
                  <Music2 className="h-3.5 w-3.5" /> {r.music}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-4 text-background">
                <ReelAction icon={<Heart className="h-7 w-7" />} value={r.likes} />
                <ReelAction icon={<MessageCircle className="h-7 w-7" />} value={r.comments} />
                <ReelAction icon={<Send className="h-7 w-7" />} value={r.shares} />
                <ReelAction icon={<Bookmark className="h-7 w-7" />} value="Enreg." />
              </div>
            </div>
          </section>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}

function ReelAction({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
      {icon}
      <span className="text-[11px] font-semibold">{value}</span>
    </button>
  );
}
