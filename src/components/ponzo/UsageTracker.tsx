import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";

/** Nom lisible de la fonctionnalité correspondant à une route. */
function featureFor(pathname: string): string {
  if (pathname === "/") return "Fil d'accueil";
  const map: Record<string, string> = {
    actualites: "Actualités",
    actualite: "Actualités",
    videos: "Vidéos",
    groupes: "Groupes",
    groupe: "Groupes",
    marketplace: "Marketplace",
    boutique: "Boutique",
    messages: "Messagerie",
    notifications: "Notifications",
    publier: "Publication",
    recherche: "Recherche",
    decouvrir: "Découvrir",
    profil: "Profil",
    membre: "Profils membres",
    favoris: "Favoris",
    parametres: "Paramètres",
    admin: "Administration",
  };
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  return map[segment] ?? segment ?? "Autre";
}

/**
 * Collecte l'usage réel de PONZO : pages visitées, fonctionnalités,
 * performances de navigation, erreurs et durée de session.
 */
export function UsageTracker() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const startedAt = useRef(Date.now());
  const sent = useRef(false);

  // Pages + fonctionnalités
  useEffect(() => {
    if (!user) return;
    const enter = performance.now();
    void trackEvent({ kind: "page_view", name: featureFor(pathname), path: pathname });
    void trackEvent({ kind: "feature", name: featureFor(pathname), path: pathname });

    const raf = requestAnimationFrame(() => {
      void trackEvent({
        kind: "perf",
        name: featureFor(pathname),
        path: pathname,
        durationMs: Math.round(performance.now() - enter),
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, user]);

  // Erreurs client
  useEffect(() => {
    if (!user) return;
    const onError = (event: ErrorEvent) => {
      void trackEvent({
        kind: "error",
        name: (event.filename || "app").split("/").pop() ?? "app",
        path: window.location.pathname,
        metadata: { message: event.message?.slice(0, 300) ?? "" },
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      void trackEvent({
        kind: "error",
        name: "promise",
        path: window.location.pathname,
        metadata: { message: String(event.reason).slice(0, 300) },
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [user]);

  // Durée de session + battement de présence
  useEffect(() => {
    if (!user) return;
    startedAt.current = Date.now();
    sent.current = false;

    const heartbeat = setInterval(() => {
      void trackEvent({ kind: "page_view", name: "heartbeat", path: window.location.pathname });
    }, 120_000);

    const flush = () => {
      if (sent.current) return;
      sent.current = true;
      void trackEvent({
        kind: "session",
        name: "session",
        durationMs: Date.now() - startedAt.current,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [user]);

  return null;
}
