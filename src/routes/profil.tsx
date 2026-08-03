import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { PostCard } from "@/components/ponzo/PostCard";
import { useAuth } from "@/lib/auth";
import { asPerson, fetchFollowCounts, fetchPostsByAuthor, updateProfile } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Profil — PONZO" },
      { name: "description", content: "Ton profil PONZO : bio, ville, publications, abonnés et paramètres de confidentialité." },
      { property: "og:title", content: "Profil — PONZO" },
      { property: "og:description", content: "Ton identité professionnelle sur PONZO." },
    ],
  }),
  component: Profil,
});

function Profil() {
  const { user, profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);

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

  if (!user) {
    return (
      <AppShell title="Profil">
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Connecte-toi pour accéder à ton profil PONZO.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Se connecter
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profil">
      <div className="relative">
        <div className="h-36 w-full bg-brand" />
        <div className="px-4">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <Avatar person={asPerson(profile)} size={88} className="border-4 border-background" />
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
            {profile?.verified && (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">✓</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile?.handle ? `@${profile.handle}` : user.email}
            {profile?.role ? ` · ${profile.role}` : ""}
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
            <Stat value={String(counts.data?.followers ?? 0)} label="Abonnés" />
            <Stat value={String(counts.data?.following ?? 0)} label="Abonnements" />
          </div>

          <Link
            to="/parametres"
            className="mt-3 flex items-center gap-2 rounded-2xl bg-surface p-3 text-xs font-semibold shadow-soft"
          >
            <ShieldCheck className="h-4 w-4 text-primary" /> Paramètres de confidentialité
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-2 px-3 py-3">
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

function EditForm({
  profile,
  onDone,
}: {
  profile: { id: string; full_name: string; handle: string | null; role: string | null; bio: string | null; city: string | null };
  onDone: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile.full_name);
  const [handle, setHandle] = useState(profile.handle ?? "");
  const [role, setRole] = useState(profile.role ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");

  const save = useMutation({
    mutationFn: () =>
      updateProfile(profile.id, {
        full_name: fullName.trim() || "Membre PONZO",
        handle: handle.trim() || null,
        role: role.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Profil mis à jour");
      void queryClient.invalidateQueries();
      await onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const field = "w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="mt-3 space-y-2 rounded-2xl bg-surface p-3 shadow-soft"
    >
      <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" maxLength={80} />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="Pseudo" maxLength={30} />
        <input className={field} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" maxLength={60} />
      </div>
      <input className={field} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Métier / rôle" maxLength={60} />
      <textarea
        className={cn(field, "min-h-20 resize-none")}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio"
        maxLength={300}
      />
      <button
        type="submit"
        disabled={save.isPending}
        className="w-full rounded-full bg-brand py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Enregistrer
      </button>
    </form>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-base font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
