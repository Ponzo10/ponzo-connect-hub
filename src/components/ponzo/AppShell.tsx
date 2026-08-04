import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Compass, Home, MessageCircle, Plus, Search, Settings, User } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { PonzoLogo, PonzoMark } from "./PonzoLogo";
import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { asPerson, unreadCounts } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/decouvrir", label: "Découvrir", icon: Compass },
  { to: "/publier", label: "Publier", icon: Plus, primary: true },
  { to: "/marketplace", label: "Boutique", icon: Search },
  { to: "/profil", label: "Profil", icon: User },
] as const;

function useUnread() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: () => unreadCounts(user!.id),
    enabled: !!user,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void query.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => void query.refetch())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return query.data ?? { notifications: 0, messages: 0 };
}

function Count({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function TopBar({ title }: { title?: string | undefined }) {
  const unread = useUnread();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {title ? (
            <span className="flex min-w-0 items-center gap-2">
              <PonzoMark size={30} />
              <h1 className="truncate text-xl font-bold">{title}</h1>
            </span>
          ) : (
            <Link to="/" aria-label="PONZO — accueil">
              <PonzoLogo size={38} />
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/recherche"
            aria-label="Rechercher"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            to="/messages"
            aria-label="Messages"
            className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5" />
            <Count n={unread.messages} />
          </Link>
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            <Count n={unread.notifications} />
          </Link>
          <Link
            to="/parametres"
            aria-label="Paramètres"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <Link to="/profil" aria-label="Mon profil" className="ml-1">
            <Avatar person={asPerson(profile)} size={30} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-2xl items-end justify-between px-2 py-1.5">
        {navItems.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;

          if ("primary" in item && item.primary) {
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className="mx-auto flex w-full flex-col items-center gap-1 py-1"
                  aria-label={item.label}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-primary-foreground shadow-lift transition-transform active:scale-95">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                <span>{item.label}</span>
                <span
                  className={cn("h-0.5 w-6 rounded-full transition-colors", active ? "bg-primary" : "bg-transparent")}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Empêche l'accès au contenu PONZO sans compte connecté. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const redirected = useRef(false);
  const initialHref = useRef(href);

  useEffect(() => {
    if (loading || user || redirected.current) return;
    const target = initialHref.current;
    if (target.startsWith("/bienvenue") || target.startsWith("/auth")) return;
    redirected.current = true;
    void navigate({ to: "/bienvenue", search: { redirect: target }, replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <PonzoMark size={72} className="animate-pulse" />
          <p className="text-xs text-muted-foreground">Chargement de PONZO…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AppShell({
  children,
  title,
  bare,
  publicAccess,
}: {
  children: ReactNode;
  title?: string | undefined;
  bare?: boolean | undefined;
  publicAccess?: boolean | undefined;
}) {
  const content = (
    <div className="min-h-screen bg-background pb-24">
      {!bare && <TopBar title={title} />}
      <main className="mx-auto max-w-2xl px-0 pb-4">{children}</main>
      <BottomNav />
    </div>
  );

  if (publicAccess) return content;
  return <AuthGate>{content}</AuthGate>;
}

export function MeAvatar({ size = 40 }: { size?: number }) {
  const { profile } = useAuth();
  return <Avatar person={asPerson(profile)} size={size} />;
}
