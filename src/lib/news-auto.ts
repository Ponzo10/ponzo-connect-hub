const PING_KEY = "ponzo.news.lastSync";
const INTERVAL_MS = 20 * 60_000;

/**
 * Déclenche la synchronisation automatique des actualités.
 * Aucune action manuelle n'est nécessaire : le premier visiteur d'une période
 * de 20 minutes réveille l'ingestion, le serveur ignore les appels trop proches.
 */
export function pingNewsSync() {
  if (typeof window === "undefined") return;
  try {
    const last = Number(window.localStorage.getItem(PING_KEY) ?? 0);
    if (Date.now() - last < INTERVAL_MS) return;
    window.localStorage.setItem(PING_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : on tente quand même une synchronisation */
  }
  void fetch("/api/public/hooks/news-sync", { method: "GET", cache: "no-store" }).catch(() => {});
}
