import { cn } from "@/lib/utils";

/** Libellé clair de l'état d'un envoi (avec pourcentage quand il est connu). */
export function uploadLabel(status: "pending" | "uploading" | "failed", progress: number) {
  const pct = Math.round(progress * 100);
  if (status === "failed") return "Envoi interrompu";
  if (status === "pending") return progress > 0 ? `Reprise à ${pct}%…` : "En attente de réseau…";
  return progress > 0 ? `Envoi… ${pct}%` : "Envoi…";
}

/** Barre fine de 2px, purement visuelle : ne bloque jamais le défilement. */
export function UploadBar({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cn("pointer-events-none h-[2px] w-full bg-muted", className)}>
      <div
        className="h-full bg-brand transition-[width] duration-200"
        style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      />
    </div>
  );
}

/** Pastille flottante non bloquante : « Envoi… 42% ». */
export function UploadPill({
  label,
  progress,
  className,
  tone = "light",
}: {
  label: string;
  progress: number;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-soft",
        tone === "dark" ? "bg-foreground/80 text-background" : "bg-surface text-muted-foreground",
        className,
      )}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
      <span className="truncate">{label}</span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted/60">
        <span
          className="block h-full bg-brand transition-[width] duration-200"
          style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }}
        />
      </span>
    </div>
  );
}
