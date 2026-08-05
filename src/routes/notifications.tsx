import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AtSign, Bell, Heart, MessageSquare, Repeat2, UserPlus } from "lucide-react";
import { useEffect } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import { asPerson, fetchNotifications, markNotificationsRead, timeAgo } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — PONZO" },
      { name: "description", content: "Abonnés, réactions, commentaires, mentions et messages : toute l'activité de ta communauté PONZO." },
      { property: "og:title", content: "Notifications — PONZO" },
      { property: "og:description", content: "Reste au courant de toute l'activité de ta communauté." },
    ],
  }),
  component: Notifications,
});

const icons: Record<string, typeof Bell> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  share: Repeat2,
  mention: AtSign,
  message: MessageSquare,
  system: Bell,
};

/** Cible de navigation d'une notification (publication, profil, story, actualité…). */
function notificationTarget(n: { kind: string; entity_id: string | null; actor_id: string | null }) {
  const entity = n.entity_id;
  switch (n.kind) {
    case "like":
    case "comment":
    case "share":
    case "mention":
      return entity ? ({ to: "/publication/$id", params: { id: entity } } as const) : ({ to: "/" } as const);
    case "follow":
      return n.actor_id
        ? ({ to: "/membre/$id", params: { id: n.actor_id } } as const)
        : ({ to: "/" } as const);
    case "message":
      return { to: "/messages" } as const;
    case "story_like":
    case "story_comment":
    case "story_share":
    case "story_view":
      return { to: "/" } as const;
    case "news":
      return entity ? ({ to: "/actualite/$id", params: { id: entity } } as const) : ({ to: "/actualites" } as const);
    default:
      return { to: "/" } as const;
  }
}


function Notifications() {
  const { user } = useAuth();
  const list = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (user && (list.data ?? []).some((n) => !n.read_at)) void markNotificationsRead(user.id);
  }, [user, list.data]);

  if (!user) {
    return (
      <AppShell title="Notifications">
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Connecte-toi pour voir tes notifications.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Se connecter
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Notifications">
      <ul className="space-y-1 px-3 pt-3">
        {(list.data ?? []).map((n) => {
          const Icon = icons[n.kind] ?? Bell;
          const target = notificationTarget(n);
          return (
            <li key={n.id}>
              <Link
                {...target}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-3 shadow-soft transition-colors hover:bg-muted",
                  n.read_at ? "bg-surface" : "bg-primary-soft/60",
                )}
              >
                <span className="relative shrink-0">
                  {n.actor ? (
                    <Avatar person={asPerson(n.actor)} size={46} />
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
                  {n.actor && <span className="font-semibold">{n.actor.full_name} </span>}
                  <span className="text-muted-foreground">{n.body}</span>
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
              </Link>
            </li>
          );
        })}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">Pas encore de notification.</li>
        )}
      </ul>
    </AppShell>
  );
}
