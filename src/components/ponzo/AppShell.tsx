import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Compass, Home, MessageCircle, Plus, Search, Settings, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { PonzoLogo, PonzoMark } from "./PonzoLogo";
import { Avatar } from "./Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { asPerson, markMessagesDelivered, touchPresence, unreadCounts } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/videos", key: "nav.discover", icon: Compass },
  { to: "/publier", key: "nav.publish", icon: Plus, primary: true },
  { to: "/recherche", key: "nav.search", icon: Search },
  { to: "/profil", key: "nav.profile", icon: User },
] as const satisfies readonly { to: string; key: TranslationKey; icon: typeof Home; primary?: boolean }[];


/** Maintient la présence « en ligne » et marque les messages reçus comme distribués. */
function usePresenceHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      void touchPresence();
      void markMessagesDelivered();
    };
    beat();
    const id = window.setInterval(beat, 45000);
    document.addEventListener("visibilitychange", beat);
    // Retour de réseau : on rattrape immédiatement les accusés de réception
    // au lieu d'attendre le prochain battement.
    window.addEventListener("online", beat);
    window.addEventListener("focus", beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("online", beat);
      window.removeEventListener("focus", beat);
    };
  }, [user]);
}

function useUnread() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["unread", user?.id],
    queryFn: () => unreadCounts(user!.id),
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!user) return;
    // Filtres serveur : seuls les évènements qui me concernent traversent le
    // réseau (moins de trafic realtime, moins de refetch inutiles).
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => {
          // Accusé de réception immédiat : le message est réellement arrivé
          // sur cet appareil, on peut le marquer « distribué ».
          void markMessagesDelivered();
          void query.refetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        () => void query.refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void query.refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  return query.data ?? { notifications: 0, messages: 0 };
}

const SEEN_KEY = "ponzo:feed-seen-at";

function seenAt() {
  if (typeof window === "undefined") return new Date().toISOString();
  return window.localStorage.getItem(SEEN_KEY) ?? new Date(Date.now() - 86_400_000).toISOString();
}

/** Compte les publications parues depuis la dernière consultation du fil. */
function useNewPosts() {
  const { user } = useAuth();
  const [since, setSince] = useState<string>(() => seenAt());

  const query = useQuery({
    queryKey: ["feed-new", since],
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const reset = useCallback(() => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(SEEN_KEY, now);
    setSince(now);
  }, []);

  return { count: query.data ?? 0, reset };
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else void navigate({ to: "/" });
  };
  const { profile } = useAuth();
  const { t } = useI18n();
  usePresenceHeartbeat();


  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {title ? (
            <span className="flex min-w-0 items-center gap-2">
              {pathname !== "/" && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Retour"
                  className="-ms-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
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
            aria-label={t("nav.search")}
            className="grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            to="/messages"
            aria-label={t("nav.messages")}
            className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5" />
            <Count n={unread.messages} />
          </Link>

          <Link
            to="/notifications"
            aria-label={t("nav.notifications")}
            className="relative grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            <Count n={unread.notifications} />
          </Link>
          <Link
            to="/parametres"
            aria-label={t("nav.settings")}
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const newPosts = useNewPosts();

  /** Appui sur Accueil : remonte en haut et recharge le fil, comme sur les grands réseaux. */
  const refreshHome = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
    void queryClient.invalidateQueries({ queryKey: ["stories"] });
    newPosts.reset();
  };


  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex h-[72px] max-w-2xl items-center justify-between px-2">
        {navItems.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;

          if ("primary" in item && item.primary) {
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className="mx-auto flex w-full translate-y-[-10px] flex-col items-center gap-1 py-1"
                  aria-label={t(item.key)}
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand text-primary-foreground shadow-lift transition-transform active:scale-95">
                    <Icon className="h-7 w-7" />
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">{t(item.key)}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                onClick={item.to === "/" ? refreshHome : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-[22px] w-[22px]", active && "stroke-[2.4]")} />
                  {item.to === "/" && newPosts.count > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground">
                      {newPosts.count > 99 ? "99+" : newPosts.count}
                    </span>
                  )}
                </span>
                <span>{item.to === "/" && newPosts.count > 0 ? `${t(item.key)} (${newPosts.count})` : t(item.key)}</span>
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
  const { t } = useI18n();
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
      <div className="grid min-h-screen place-items-center bg-background pb-[90px]">
        <div className="flex flex-col items-center gap-3">
          <PonzoMark size={72} className="animate-pulse" />
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        </div>
        <BottomNav />
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
    <div className="min-h-screen bg-background pb-[90px]">
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
