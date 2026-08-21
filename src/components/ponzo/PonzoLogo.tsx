import logoAsset from "@/assets/ponzo-logo.png.asset.json";
import { cn } from "@/lib/utils";

const logoUrl = logoAsset.url;

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
  size = 40,
}: {
  className?: string | undefined;
  size?: number | undefined;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PonzoMark size={size} />
      <span className="font-display text-2xl font-extrabold tracking-tight text-primary">PONZO</span>
    </span>
  );
}
