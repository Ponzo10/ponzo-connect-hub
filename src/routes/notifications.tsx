import { createFileRoute } from "@tanstack/react-router";
import { AtSign, Bell, Heart, MessageSquare, Repeat2, UserPlus } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { notifications } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — PONZO" },
      { name: "description", content: "Abonnés, réactions, commentaires, mentions, partages et alertes système sur PONZO." },
      { property: "og:title", content: "Notifications — PONZO" },
      { property: "og:description", content: "Reste au courant de toute l'activité de ta communauté." },
    ],
  }),
  component: Notifications,
});

const icons = {
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  share: Repeat2,
  mention: AtSign,
  system: Bell,
} as const;

function Notifications() {
  return (
    <AppShell title="Notifications">
      <ul className="space-y-1 px-3 pt-3">
        {notifications.map((n) => {
          const Icon = icons[n.kind];
          return (
            <li
              key={n.id}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3 shadow-soft",
                n.unread ? "bg-primary-soft/60" : "bg-surface",
              )}
            >
              <span className="relative shrink-0">
                {n.person ? (
                  <Avatar person={n.person} size={46} />
                ) : (
                  <span className="grid h-[46px] w-[46px] place-items-center rounded-full bg-brand text-primary-foreground">
                    <Bell className="h-5 w-5" />
                  </span>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface text-primary shadow-soft">
                  <Icon className="h-3 w-3" />
                </span>
              </span>
              <p className="min-w-0 text-sm">
                {n.person && <span className="font-semibold">{n.person.name} </span>}
                <span className="text-muted-foreground">{n.text}</span>
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
