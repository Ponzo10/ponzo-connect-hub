import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Image as ImageIcon, MapPin, Phone, Plus, Store, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { useAuth } from "@/lib/auth";
import {
  createProduct,
  deleteProduct,
  fetchMyShop,
  fetchShopProducts,
  formatPrice,
  upsertShop,
} from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";

export const Route = createFileRoute("/boutique")({
  head: () => ({
    meta: [
      { title: "Ma boutique — PONZO" },
      {
        name: "description",
        content: "Crée et gère ta boutique PONZO : logo, couverture, produits, horaires, adresse et contact.",
      },
      { property: "og:title", content: "Ma boutique — PONZO" },
      { property: "og:description", content: "Vends tes produits et services auprès de la communauté PONZO." },
    ],
  }),
  component: Boutique,
});

function Boutique() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);

  const shop = useQuery({ queryKey: ["my-shop", user?.id], queryFn: () => fetchMyShop(user!.id), enabled: !!user });
  const products = useQuery({
    queryKey: ["shop-products", shop.data?.id],
    queryFn: () => fetchShopProducts(shop.data!.id),
    enabled: !!shop.data?.id,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
    city: "",
    hours: "",
    latitude: "",
    longitude: "",
    logo_url: "",
    cover_url: "",
  });
  const [product, setProduct] = useState({ title: "", price: "", category: "", description: "", image_url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = shop.data;
    if (!s) return;
    setForm({
      name: s.name ?? "",
      description: s.description ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      city: s.city ?? "",
      hours: s.hours ?? "",
      latitude: s.latitude != null ? String(s.latitude) : "",
      longitude: s.longitude != null ? String(s.longitude) : "",
      logo_url: s.logo_url ?? "",
      cover_url: s.cover_url ?? "",
    });
  }, [shop.data]);

  const upload = async (file: File | undefined, key: "logo_url" | "cover_url" | "product") => {
    if (!file || !user) return;
    try {
      const res = await uploadMedia(user.id, file, "shop");
      if (key === "product") setProduct((p) => ({ ...p, image_url: res.url }));
      else setForm((f) => ({ ...f, [key]: res.url }));
      toast.success("Image ajoutée");
    } catch {
      toast.error("Envoi impossible.");
    }
  };

  const saveShop = async () => {
    if (!user || !form.name.trim()) {
      toast.error("Le nom de la boutique est obligatoire.");
      return;
    }
    setBusy(true);
    try {
      await upsertShop(user.id, {
        name: form.name.trim(),
        description: form.description || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        hours: form.hours || null,
        logo_url: form.logo_url || null,
        cover_url: form.cover_url || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["my-shop"] });
      await queryClient.invalidateQueries({ queryKey: ["shops"] });
      toast.success("Boutique enregistrée ✅");
    } catch {
      toast.error("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const addProduct = async () => {
    if (!user || !shop.data) return;
    if (!product.title.trim()) {
      toast.error("Donne un nom à ton produit.");
      return;
    }
    try {
      await createProduct({
        sellerId: user.id,
        title: product.title.trim(),
        description: product.description,
        price: Number(product.price || 0),
        category: product.category,
        city: form.city,
        imageUrl: product.image_url,
      });
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("products")
        .update({ shop_id: shop.data.id })
        .eq("seller_id", user.id)
        .is("shop_id", null);
      setProduct({ title: "", price: "", category: "", description: "", image_url: "" });
      await queryClient.invalidateQueries({ queryKey: ["shop-products"] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit ajouté 🎉");
    } catch {
      toast.error("Ajout impossible.");
    }
  };

  const mapUrl =
    form.latitude && form.longitude
      ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}`
      : form.address
        ? `https://www.google.com/maps?q=${encodeURIComponent(`${form.address} ${form.city}`)}`
        : null;

  return (
    <AppShell title="Ma boutique">
      <div className="space-y-4 px-3 pt-4">
        <div className="overflow-hidden rounded-2xl bg-surface shadow-soft">
          <div className="relative h-28 bg-brand">
            {form.cover_url && <img src={form.cover_url} alt="Couverture" className="h-full w-full object-cover" />}
            <button
              onClick={() => coverRef.current?.click()}
              className="absolute right-2 top-2 rounded-full bg-background/85 px-3 py-1.5 text-[11px] font-semibold"
            >
              Couverture
            </button>
          </div>
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => logoRef.current?.click()} className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo boutique" className="h-full w-full object-cover" />
              ) : (
                <Store className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <p className="text-xs text-muted-foreground">Touche pour changer le logo et la couverture de ta boutique.</p>
          </div>
        </div>

        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0], "logo_url")} />
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0], "cover_url")} />
        <input ref={productRef} type="file" accept="image/*" className="hidden" onChange={(e) => void upload(e.target.files?.[0], "product")} />

        <div className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
          <Field label="Nom de la boutique" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} textarea />
          <Field label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Adresse" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Ville" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Horaires" value={form.hours} onChange={(v) => setForm({ ...form, hours: v })} placeholder="Lun-Sam 09:00-19:00" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} />
            <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} />
          </div>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-semibold text-primary">
              <MapPin className="h-4 w-4" /> Voir sur la carte
            </a>
          )}
          <button
            onClick={saveShop}
            disabled={busy}
            className="mt-2 w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {shop.data ? "Enregistrer les modifications" : "Créer ma boutique"}
          </button>
        </div>

        {shop.data && (
          <>
            <div className="space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
              <h2 className="text-sm font-bold">Ajouter un produit</h2>
              <Field label="Titre" value={product.title} onChange={(v) => setProduct({ ...product, title: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Prix (FCFA)" value={product.price} onChange={(v) => setProduct({ ...product, price: v })} />
                <Field label="Catégorie" value={product.category} onChange={(v) => setProduct({ ...product, category: v })} />
              </div>
              <Field label="Description" value={product.description} onChange={(v) => setProduct({ ...product, description: v })} textarea />
              <button
                onClick={() => productRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted py-2.5 text-xs font-semibold"
              >
                <ImageIcon className="h-4 w-4 text-primary" /> {product.image_url ? "Photo ajoutée ✓" : "Photo du produit"}
              </button>
              <button
                onClick={addProduct}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Ajouter le produit
              </button>
            </div>

            <div className="space-y-2">
              {(products.data ?? []).map((p) => (
                <div key={p.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gold">
                    {p.image_url && <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatPrice(Number(p.price), p.currency)}
                    </span>
                  </span>
                  <button
                    aria-label="Supprimer le produit"
                    onClick={async () => {
                      await deleteProduct(p.id);
                      void queryClient.invalidateQueries({ queryKey: ["shop-products"] });
                      toast.success("Produit supprimé");
                    }}
                    className="grid h-9 w-9 place-items-center rounded-full text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <p className="flex items-center gap-2 px-1 pb-4 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {form.hours || "Ajoute tes horaires pour rassurer tes clients."}
              <Phone className="ml-2 h-3.5 w-3.5" /> {form.phone || "Numéro non renseigné"}
            </p>
          </>
        )}

        <Link to="/marketplace" className="block pb-4 text-center text-xs font-semibold text-primary">
          Voir toutes les boutiques et produits
        </Link>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
  textarea?: boolean | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-sm outline-none"
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
        />
      )}
    </label>
  );
}
