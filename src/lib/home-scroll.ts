const HOME_SCROLL_KEY = "ponzo.home.scrollY";

export function saveHomeScroll() {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY));
}

export function restoreHomeScroll() {
  if (typeof window === "undefined") return;
  const raw = window.sessionStorage.getItem(HOME_SCROLL_KEY);
  if (!raw) return;
  const position = Number(raw);
  if (!Number.isFinite(position) || position < 0) return;
  window.requestAnimationFrame(() => window.scrollTo({ top: position, behavior: "instant" }));
}