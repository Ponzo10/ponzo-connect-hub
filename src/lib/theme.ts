/**
 * PONZO — Thème central (source de vérité côté JavaScript).
 * Les couleurs/polices vivent en tokens CSS dans `src/styles.css` (@theme) ;
 * ce module expose les mêmes valeurs au code (canvas, graphes, styles dynamiques)
 * afin d'éviter toute duplication ou valeur codée en dur dans les composants.
 */

export const colors = {
  primary: "oklch(0.46 0.11 165)", // vert PONZO
  primarySoft: "oklch(0.94 0.04 165)",
  accent: "oklch(0.83 0.16 88)", // jaune doré
  accentSoft: "oklch(0.96 0.07 95)",
  background: "oklch(0.985 0.006 120)", // blanc chaud
  foreground: "oklch(0.21 0.03 160)",
  mutedForeground: "oklch(0.53 0.02 160)",
  destructive: "oklch(0.6 0.22 25)",
  cineFrom: "oklch(0.55 0.27 300)",
  cineTo: "oklch(0.65 0.29 350)",
} as const;

export const fonts = {
  display: '"Outfit", ui-sans-serif, system-ui, sans-serif',
  sans: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
} as const;

export const radius = {
  base: "1rem",
  sm: "calc(1rem - 4px)",
  md: "calc(1rem - 2px)",
  lg: "1rem",
  xl: "calc(1rem + 4px)",
} as const;

/** Transitions fluides partagées (durée + easing). */
export const motion = {
  fast: "150ms",
  normal: "250ms",
  slow: "420ms",
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

export const gradients = {
  brand: "linear-gradient(135deg, oklch(0.42 0.1 168), oklch(0.56 0.13 158))",
  gold: "linear-gradient(135deg, oklch(0.86 0.16 92), oklch(0.78 0.16 70))",
  cine: `linear-gradient(90deg, ${colors.cineFrom}, ${colors.cineTo})`,
} as const;

export const theme = { colors, fonts, radius, motion, gradients } as const;
export default theme;
