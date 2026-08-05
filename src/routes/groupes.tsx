import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Lock, Plus, Users } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/ponzo/AppShell";
import { useAuth } from "@/lib/auth";
import { createGroup, fetchGroups, joinGroup, requestJoin, type Group } from "@/lib/groups-api";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/groupes")({
  head: () => ({
    meta: [
      { title: "Groupes — PONZO" },
      {
        name: "description",
        content: "Crée ou rejoins des groupes de discussion PONZO : messages, photos, vidéos, documents et vocaux en temps réel.",
      },
      { property: "og:title", content: "Groupes — PONZO" },
      { property: "og:description", content: "Discute en groupe avec la communauté PONZO, en temps réel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const groups = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => fetchGroups(user!.id),
    enabled: !!user,
  });

  const join = async (group: Group) => {
    if (!user) return;
    try {
      if (group.is_public) {
        await joinGroup(group.id, user.id);
        toast.success(`Tu as rejoint ${group.name}`);
      } else {
        await requestJoin(group.id, user.id);
        toast.success("Demande envoyée aux administrateurs.");
      }
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
    } catch {
      toast.error("Action impossible.");
    }
  };


  return (
    <AppShell title="Groupes">
      <div className="space-y-5 px-3 pt-4">
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground shadow-lift"
        >
          <Plus className="h-4 w-4" /> Créer un groupe
        </button>

        {creating && <CreateGroupForm onDone={() => setCreating(false)} />}

        <section>
          <h2 className="mb-2 text-sm font-bold">Mes groupes</h2>
          {groups.isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}
          {groups.data?.memberGroups.length === 0 && (
            <p className="rounded-2xl bg-surface p-4 text-xs text-muted-foreground shadow-soft">
              Tu n'as pas encore de groupe. Crées-en un ou rejoins-en un ci-dessous.
            </p>
          )}
          <ul className="space-y-2">
            {groups.data?.memberGroups.map((g) => (
              <li key={g.id}>
                <Link
                  to="/groupe/$id"
                  params={{ id: g.id }}
                  className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft"
                >
                  <GroupAvatar group={g} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {g.name}
                      {!g.is_public && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{g.description ?? "Groupe PONZO"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Groupes à découvrir</h2>
          {groups.data?.discover.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun autre groupe public pour le moment.</p>
          )}
          <ul className="space-y-2">
            {groups.data?.discover.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-soft">
                <GroupAvatar group={g} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.name}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{g.description ?? "Groupe public"}</p>
                </div>
                <button
                  onClick={() => void join(g)}
                  className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  Rejoindre
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

export function GroupAvatar({ group, size = 48 }: { group: { name: string; photo_url: string | null }; size?: number }) {
  if (group.photo_url) {
    return (
      <img
        src={group.photo_url}
        alt={group.name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-2xl object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-2xl bg-secondary text-primary"
    >
      <Users className="h-5 w-5" />
    </span>
  );
}

function CreateGroupForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const result = await uploadMedia(user.id, file, "groupes", "image");
      setPhoto(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!user || !name.trim()) {
      toast.error("Donne un nom à ton groupe.");
      return;
    }
    setBusy(true);
    try {
      await createGroup({
        ownerId: user.id,
        name: name.trim(),
        description: description.trim() || null,
        photoUrl: photo,
        isPublic,
      });
      await queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Groupe créé 🎉");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted text-muted-foreground"
          aria-label="Photo du groupe"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : photo ? (
            <img src={photo} alt="Photo du groupe" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du groupe"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Description du groupe…"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Public", value: true, hint: "Tout le monde peut rejoindre" },
          { label: "Privé", value: false, hint: "Sur invitation" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setIsPublic(o.value)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold",
              isPublic === o.value ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {o.label}
            <span className="block text-[10px] font-normal opacity-80">{o.hint}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => void submit()}
        disabled={busy || uploading}
        className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Création…" : "Créer le groupe"}
      </button>
    </div>
  );
}
