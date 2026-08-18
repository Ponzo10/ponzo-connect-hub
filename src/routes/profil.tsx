import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Camera, Pencil, Settings, ShieldCheck, Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { Badge3D } from "@/components/ponzo/Badge3D";
import { FollowList } from "@/components/ponzo/FollowList";
import { PostCard } from "@/components/ponzo/PostCard";
import { useAuth } from "@/lib/auth";
import {
  asPerson,
  displayFollowers,
  fetchFollowCounts,
  fetchPostsByAuthor,
  updateProfile,
  type Profile,
} from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";
import { SmartImg } from "@/components/ponzo/SmartImg";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — PONZO" },
      {
        name: "description",
        content: "Ton profil PONZO : photo, couverture, bio, badge, publications, abonnés et boutique.",
      },
      { property: "og:title", content: "Mon profil — PONZO" },
      { property: "og:description", content: "Ton identité professionnelle sur PONZO." },
    ],
  }),
  component: Profil,
});

function Profil() {
  const { user, profile, isStaff, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [followList, setFollowList] = useState<"followers" | "following" | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const posts = useQuery({
    queryKey: ["posts", "mine", user?.id],
    queryFn: () => fetchPostsByAuthor(user!.id),
    enabled: !!user,
  });
  const counts = useQuery({
    queryKey: ["follow-counts", user?.id],
    queryFn: () => fetchFollowCounts(user!.id),
    enabled: !!user,
  });

  const pick = async (file: File | undefined, field: "avatar_url" | "cover_url") => {
    if (!file || !user) return;
    try {
      const res = await uploadMedia(user.id, file, "profil");
      await updateProfile(user.id, { [field]: res.url } as Partial<Profile>);
      await refreshProfile();
      toast.success(field === "avatar_url" ? "Photo de profil mise à jour" : "Photo de couverture mise à jour");
    } catch {
      toast.error("Envoi de l'image impossible.");
    }
  };

  return (
    <AppShell title="Profil">
      <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0], "avatar_url")} />
      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0], "cover_url")} />

      <div className="relative">
        <button onClick={() => coverRef.current?.click()} className="relative block h-36 w-full bg-brand" aria-label="Changer la couverture">
          {profile?.cover_url && <SmartImg src={profile.cover_url} alt="Couverture" width={720} quality={65} className="h-full w-full object-cover" />}
          <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85">
            <Camera className="h-4 w-4" />
          </span>
        </button>

        <div className="px-4">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <button onClick={() => avatarRef.current?.click()} className="relative" aria-label="Changer la photo de profil">
              <Avatar person={asPerson(profile)} size={88} className="border-4 border-background" />
              <span className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full bg-brand text-primary-foreground">
                <Camera className="h-3.5 w-3.5" />
              </span>
            </button>
            <div className="flex gap-2 pb-1">
              <Link
                to="/parametres"
                className="grid h-10 w-10 place-items-center rounded-full bg-surface text-foreground shadow-soft"
                aria-label="Paramètres"
              >
                <Settings className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setEditing((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-soft"
              >
                <Pencil className="h-4 w-4" /> {editing ? "Fermer" : "Modifier le profil"}
              </button>
            </div>
          </div>

          <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
            {profile?.full_name ?? "Membre PONZO"}
            <Badge3D kind={profile?.badge} size="md" />
            {profile?.verified && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">✓</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile?.handle ? `@${profile.handle}` : user?.email}
            {profile?.title ? ` · ${profile.title}` : profile?.role ? ` · ${profile.role}` : ""}
          </p>
          {profile?.bio && <p className="mt-2 text-sm leading-relaxed">{profile.bio}</p>}

          {editing && profile && (
            <EditForm
              profile={profile}
              onDone={async () => {
                setEditing(false);
                await refreshProfile();
              }}
            />
          )}

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface p-3 text-center shadow-soft">
            <Stat value={String(posts.data?.length ?? 0)} label="Publications" />
            <button type="button" onClick={() => setFollowList("followers")}>
              <Stat value={displayFollowers(counts.data?.followers ?? 0, profile)} label="Abonnés" />
            </button>
            <button type="button" onClick={() => setFollowList("following")}>
              <Stat value={String(counts.data?.following ?? 0)} label="Abonnements" />
            </button>
          </div>

          {followList && user && (
            <FollowList userId={user.id} kind={followList} onClose={() => setFollowList(null)} />
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link to="/favoris" className="flex items-center gap-2 rounded-2xl bg-surface p-3 text-xs font-semibold shadow-soft">
              <BookMarked className="h-4 w-4 text-primary" /> Favoris
            </Link>
            {isStaff && (
              <Link to="/admin" className="flex items-center gap-2 rounded-2xl bg-surface p-3 text-xs font-semibold shadow-soft">
                <ShieldCheck className="h-4 w-4 text-primary" /> Administration
              </Link>
            )}
            <Link to="/parametres" className="flex items-center gap-2 rounded-2xl bg-surface p-3 text-xs font-semibold shadow-soft">
              <ShieldCheck className="h-4 w-4 text-primary" /> Confidentialité
            </Link>
          </div>

        </div>
      </div>

      <div className="mt-4 space-y-2 px-0 py-3 sm:px-3">
        {(posts.data ?? []).map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
        {!posts.isLoading && (posts.data ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tu n'as pas encore publié.{" "}
            <Link to="/publier" className="font-semibold text-primary">
              Publier maintenant
            </Link>
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="block">
      <span className="block text-base font-extrabold">{value}</span>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function EditForm({ profile, onDone }: { profile: Profile; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    handle: profile.handle ?? "",
    role: profile.role ?? "",
    bio: profile.bio ?? "",
    city: profile.city ?? "",
    phone: profile.phone ?? "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile.full_name ?? "",
      handle: profile.handle ?? "",
      role: profile.role ?? "",
      bio: profile.bio ?? "",
      city: profile.city ?? "",
      phone: profile.phone ?? "",
    });
  }, [profile]);

  const save = async () => {
    setBusy(true);
    try {
      await updateProfile(profile.id, {
        full_name: form.full_name.trim() || "Membre PONZO",
        handle: form.handle.trim() || null,
        role: form.role.trim() || null,
        bio: form.bio.trim() || null,
        city: form.city.trim() || null,
        phone: form.phone.trim() || null,
        updated_at: new Date().toISOString(),
      });
      toast.success("Profil mis à jour ✅");
      await onDone();
    } catch {
      toast.error("Mise à jour impossible (pseudo déjà utilisé ?).");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-surface p-4 shadow-soft">
      {(
        [
          ["full_name", "Nom complet"],
          ["handle", "Pseudo"],
          ["role", "Métier / rôle"],
          ["city", "Ville"],
          ["phone", "Téléphone"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
          <input
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            className="w-full rounded-xl bg-muted px-3 py-2 text-sm outline-none"
          />
        </label>
      ))}
      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Bio</span>
        <textarea
          value={form.bio}
          rows={3}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          className="w-full resize-none rounded-xl bg-muted px-3 py-2 text-sm outline-none"
        />
      </label>
      <button
        onClick={save}
        disabled={busy}
        className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
