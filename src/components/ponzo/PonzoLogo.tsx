import logoUrl from "@/assets/ponzo-logo.png";
import { cn } from "@/lib/utils";

export const PONZO_LOGO_URL = logoUrl;

export function PonzoMark({ size = 40, className }: { size?: number | undefined; className?: string | undefined }) {
  return (
    <img
      src={logoUrl}
      alt="Logo officiel PONZO"
      width={size}
      height={size}
      decoding="async"
      className={cn("shrink-0 rounded-full object-cover shadow-soft", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PonzoLogo({
  className,
  tagline = true,
  size = 40,
}: {
  className?: string | undefined;
  tagline?: boolean | undefined;
  size?: number | undefined;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PonzoMark size={size} />
      <span className="inline-flex flex-col leading-none">
        <span className="font-display text-2xl font-extrabold tracking-tight text-primary">PONZO</span>
        {tagline && (
          <span className="mt-1 text-[9px] font-semibold tracking-tight text-primary/70">
            Connecte-toi. Crée. Construis.
          </span>
        )}
      </span>
    </span>
  );
}
