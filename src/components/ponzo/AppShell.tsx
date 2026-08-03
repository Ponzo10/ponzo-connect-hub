import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Compass, Home, MessageCircle, Plus, Search, Settings, User } from "lucide-react";
import type { ReactNode } from "react";

import { PonzoLogo } from "./PonzoLogo";
import { Avatar } from "./Avatar";
import { me } from "@/data/demo";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/decouvrir", label: "Découvrir", icon: Compass },
  { to: "/publier", label: "Publier", icon: Plus, primary: true },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: 2 },
  { to: "/notifications", label: "Alertes", icon: Bell, badge: 3 },
  { to: "/profil", label: "Profil", icon: User },
] as const;

export function TopBar({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {title ? (
            <h1 className="truncate text-xl font-bold">{title}</h1>
          ) : (
            <Link to="/" aria-label="PONZO — accueil">
              <PonzoLogo />
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
            className="grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              3
            </span>
          </Link>
          <Link
            to="/parametres"
            aria-label="Paramètres"
            className="grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Settings className="h-5 w-5" />
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
                <span className="relative">
                  <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                  {"badge" in item && item.badge ? (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
                <span
                  className={cn(
                    "h-0.5 w-6 rounded-full transition-colors",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  children,
  title,
  bare,
}: {
  children: ReactNode;
  title?: string;
  bare?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background pb-24">
      {!bare && <TopBar title={title} />}
      <main className="mx-auto max-w-2xl px-0 pb-4">{children}</main>
      <BottomNav />
    </div>
  );
}

export function MeAvatar({ size = 40 }: { size?: number }) {
  return <Avatar person={me} size={size} />;
}
