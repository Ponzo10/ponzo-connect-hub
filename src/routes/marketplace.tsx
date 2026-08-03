import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Plus, Search, Store, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { useAuth } from "@/lib/auth";
import { createProduct, fetchProducts, formatPrice } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — PONZO" },
      { name: "description", content: "Achetez et vendez en toute sécurité sur la marketplace PONZO : produits, services et boutiques de la communauté." },
      { property: "og:title", content: "Marketplace — PONZO" },
      { property: "og:description", content: "Produits et services de la communauté PONZO." },
    ],
  }),
  component: Marketplace,
});

const categories = ["Tout", "Électronique", "Mode", "Maison", "Services", "Sport", "Formation"];

function Marketplace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cat, setCat] = useState("Tout");
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const products = useQuery({ queryKey: ["products", cat], queryFn: () => fetchProducts(cat) });
  const list = (products.data ?? []).filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell title="Marketplace">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
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

        {user ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-bold text-accent-foreground shadow-soft"
          >
            {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {open ? "Annuler" : "Vendre un produit"}
          </button>
        ) : (
          <Link
            to="/auth"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 text-sm font-bold text-accent-foreground shadow-soft"
          >
            <Plus className="h-4 w-4" /> Connecte-toi pour vendre
          </Link>
        )}

        {open && user && (
          <SellForm
            onDone={() => {
              setOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["products"] });
            }}
            sellerId={user.id}
          />
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {list.map((p) => {
            const fav = favs.includes(p.id);
            return (
              <article key={p.id} className="overflow-hidden rounded-2xl bg-surface shadow-soft">
                <div className="relative h-28 bg-brand">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  )}
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
                  <p className="mt-0.5 text-base font-bold text-primary">{formatPrice(Number(p.price), p.currency)}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Store className="h-3 w-3 shrink-0" /> {p.seller?.full_name ?? "Membre PONZO"}
                  </p>
                  {p.seller && (
                    <Link
                      to="/messages"
                      search={{ to: p.seller.id }}
                      className="mt-2 block rounded-full bg-primary-soft py-1.5 text-center text-[11px] font-semibold text-primary"
                    >
                      Contacter
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {!products.isLoading && list.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun produit dans cette catégorie.</p>
        )}
      </div>
    </AppShell>
  );
}

function SellForm({ sellerId, onDone }: { sellerId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Services");
  const [city, setCity] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createProduct({
        sellerId,
        title: title.trim(),
        price: Number(price) || 0,
        category,
        city: city.trim(),
        imageUrl: imageUrl.trim(),
        description: description.trim(),
      }),
    onSuccess: () => {
      toast.success("Produit publié");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        create.mutate();
      }}
      className="mt-3 space-y-2 rounded-2xl bg-surface p-3 shadow-soft"
    >
      <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du produit" maxLength={100} />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="Prix (FCFA)" />
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.slice(1).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" maxLength={60} />
      <input className={field} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Lien de l'image (optionnel)" />
      <textarea
        className={cn(field, "min-h-20 resize-none")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        maxLength={500}
      />
      <button
        type="submit"
        disabled={!title.trim() || create.isPending}
        className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Publier le produit
      </button>
    </form>
  );
}
