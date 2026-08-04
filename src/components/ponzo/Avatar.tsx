import { cn } from "@/lib/utils";
import type { Person } from "@/data/demo";
import { usePhotoViewer } from "./PhotoViewer";

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
  zoomable,
}: {
  person: Pick<Person, "name" | "tone"> & { src?: string | null | undefined };
  size?: number | undefined;
  ring?: boolean | undefined;
  className?: string | undefined;
  zoomable?: boolean | undefined;
}) {
  const viewer = usePhotoViewer();
  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();


  if (person.src) {
    const img = (
      <img
        src={person.src}
        alt={person.name}
        loading="lazy"
        decoding="async"
        className={cn(
          "h-full w-full shrink-0 rounded-full object-cover",
          ring && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
    if (!zoomable) return img;
    return (
      <button
        type="button"
        aria-label={`Voir la photo de ${person.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          viewer.open(person.src!, person.name);
        }}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
      >
        {img}
      </button>
    );
  }


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
