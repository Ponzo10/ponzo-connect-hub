import { createFileRoute } from "@tanstack/react-router";
import { Heart, Plus, Search, Star, Store } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/ponzo/AppShell";
import { products } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — PONZO" },
      { name: "description", content: "Achetez et vendez en toute sécurité sur la marketplace PONZO : produits, services, avis et boutiques." },
      { property: "og:title", content: "Marketplace — PONZO" },
      { property: "og:description", content: "Produits et services de la communauté PONZO, avec avis et boutiques vérifiées." },
    ],
  }),
  component: Marketplace,
});

const categories = ["Tout", "Électronique", "Mode", "Maison", "Services", "Sport", "Formation"];

function Marketplace() {
  const [cat, setCat] = useState("Tout");
  const [favs, setFavs] = useState<string[]>([]);
  const list = cat === "Tout" ? products : products.filter((p) => p.category === cat);

  return (
    <AppShell title="Marketplace">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Rechercher un produit"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                cat === c ? "bg-brand text-primary-foreground" : "bg-surface text-muted-foreground shadow-soft",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-bold text-accent-foreground shadow-soft">
          <Plus className="h-4 w-4" /> Vendre un produit
        </button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {list.map((p) => {
            const fav = favs.includes(p.id);
            return (
              <article key={p.id} className="overflow-hidden rounded-2xl bg-surface shadow-soft">
                <div className="relative h-28 bg-brand">
                  <button
                    onClick={() => setFavs((f) => (fav ? f.filter((x) => x !== p.id) : [...f, p.id]))}
                    aria-label="Ajouter aux favoris"
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-surface/90 text-foreground"
                  >
                    <Heart className={cn("h-4 w-4", fav && "fill-current text-destructive")} />
                  </button>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-base font-bold text-primary">{p.price}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Store className="h-3 w-3 shrink-0" /> {p.seller}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-accent-foreground">
                    <Star className="h-3 w-3 fill-current" /> {p.rating.toFixed(1)}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
