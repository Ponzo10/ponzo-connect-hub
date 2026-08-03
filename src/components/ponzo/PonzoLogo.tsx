import { cn } from "@/lib/utils";

export function PonzoLogo({ className, tagline = true }: { className?: string; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex flex-col leading-none", className)}>
      <span className="font-display text-2xl font-extrabold tracking-tight text-primary">
        PONZ
        <span className="relative inline-block">
          <span className="invisible">O</span>
          <span className="absolute inset-0 grid place-items-center">
            <span className="block h-[0.72em] w-[0.72em] rounded-full bg-gold" />
          </span>
        </span>
      </span>
      {tagline && (
        <span className="mt-1 text-[9px] font-semibold tracking-tight text-primary/70">
          Connecte-toi. Crée. Construis.
        </span>
      )}
    </span>
  );
}

export function PonzoMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-brand font-display font-extrabold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      P
    </span>
  );
}
