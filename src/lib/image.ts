/**
 * Optimisation des images stockées sur le backend.
 *
 * Le point d'entrée `/storage/v1/render/image/...` renvoie automatiquement une
 * version WebP compressée de l'image (souvent 10 à 20 fois plus légère que le
 * PNG/JPEG d'origine). C'est le gain le plus important pour la vitesse
 * d'affichage du fil sur mobile et pour la consommation de données.
 *
 * En cas d'indisponibilité, `SmartImg` retombe sur l'URL d'origine : aucune
 * image ne peut disparaître à cause de cette optimisation.
 */
export function optimizedImage(
  url: string | null | undefined,
  opts: { width?: number; quality?: number } = {},
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("/storage/v1/object/")) return url;
  // Les vidéos ne passent jamais par le transformateur d'images.
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return url;

  const rendered = url.replace("/storage/v1/object/", "/storage/v1/render/image/");
  const sep = rendered.includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(Math.round(opts.width)));
  params.set("quality", String(opts.quality ?? 70));
  params.set("resize", "contain");
  return `${rendered}${sep}${params.toString()}`;
}
