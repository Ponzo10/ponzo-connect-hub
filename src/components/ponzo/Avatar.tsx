import { cn } from "@/lib/utils";
import type { Person } from "@/data/demo";

const toneClass: Record<Person["tone"], string> = {
  green: "bg-brand text-primary-foreground",
  gold: "bg-gold text-accent-foreground",
  teal: "bg-secondary text-secondary-foreground",
  sand: "bg-accent-soft text-accent-foreground",
};

export function Avatar({
  person,
  size = 44,
  ring,
  className,
}: {
  person: Pick<Person, "name" | "tone">;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        toneClass[person.tone],
        ring && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
