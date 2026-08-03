import { Check, Crown } from "lucide-react";

import { cn } from "@/lib/utils";

export type BadgeKind = "none" | "blue" | "white" | "crown";

export const BADGES: { kind: BadgeKind; label: string; hint: string }[] = [
  { kind: "none", label: "Aucun badge", hint: "Profil sans badge" },
  { kind: "blue", label: "Badge Bleu", hint: "Membre actif de la communauté" },
  { kind: "white", label: "Badge Blanc", hint: "Profil élégant et discret" },
  { kind: "crown", label: "Badge Couronne", hint: "Prestige · effet premium 3D" },
];

const sizes = { sm: "h-4 w-4 text-[9px]", md: "h-5 w-5 text-[10px]", lg: "h-7 w-7 text-xs" } as const;

export function Badge3D({
  kind,
  size = "sm",
  className,
}: {
  kind: string | null | undefined;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (!kind || kind === "none") return null;

  const base = cn(
    "inline-grid shrink-0 place-items-center rounded-full ring-1 transition-transform",
    sizes[size],
    className,
  );

  if (kind === "crown") {
    return (
      <span
        aria-label="Badge couronne"
        title="Badge Couronne"
        className={cn(
          base,
          "bg-[linear-gradient(145deg,oklch(0.93_0.16_95),oklch(0.78_0.17_78))] text-[oklch(0.28_0.06_80)] ring-[oklch(0.98_0.05_95)/0.9]",
          "shadow-[0_2px_5px_oklch(0.55_0.15_80/0.55),inset_0_1px_1px_oklch(1_0_0/0.85),inset_0_-1px_2px_oklch(0.45_0.12_80/0.5)]",
        )}
      >
        <Crown className="h-[62%] w-[62%]" strokeWidth={2.5} />
      </span>
    );
  }

  if (kind === "white") {
    return (
      <span
        aria-label="Badge blanc"
        title="Badge Blanc"
        className={cn(
          base,
          "bg-[linear-gradient(145deg,oklch(1_0_0),oklch(0.9_0.01_240))] text-foreground ring-border",
          "shadow-[0_2px_4px_oklch(0.2_0_0/0.2),inset_0_1px_1px_oklch(1_0_0),inset_0_-1px_2px_oklch(0.75_0.01_240/0.7)]",
        )}
      >
        <Check className="h-[62%] w-[62%]" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      aria-label="Badge bleu"
      title="Badge Bleu"
      className={cn(
        base,
        "bg-[linear-gradient(145deg,oklch(0.75_0.15_240),oklch(0.52_0.18_255))] text-white ring-[oklch(0.85_0.1_240)/0.8]",
        "shadow-[0_2px_5px_oklch(0.45_0.16_255/0.55),inset_0_1px_1px_oklch(1_0_0/0.7),inset_0_-1px_2px_oklch(0.35_0.14_255/0.6)]",
      )}
    >
      <Check className="h-[62%] w-[62%]" strokeWidth={3} />
    </span>
  );
}

export function BadgePreview({ kind }: { kind: BadgeKind }) {
  if (kind === "none") {
    return <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px]">—</span>;
  }
  return <Badge3D kind={kind} size="lg" />;
}
