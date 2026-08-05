import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Check, Crown, FileText, Loader2, LogOut, Shield, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import {
  deleteGroup,
  fetchJoinRequests,
  joinGroup,
  leaveGroup,
  removeMember,
  respondJoinRequest,
  searchPeople,
  setMemberRole,
  setMuted,
  updateGroup,
  type FullMessage,
  type Group,
  type GroupMember,
} from "@/lib/groups-api";
import { cn } from "@/lib/utils";

const TABS = ["Infos", "Membres", "Demandes", "Médias", "Réglages"] as const;
type Tab = (typeof TABS)[number];

export function isOnline(iso: string) {
  return Date.now() - new Date(iso).getTime() < 2 * 60 * 1000;
}

export function GroupInfoPanel({
  group,
  members,
  messages,
  isAdmin,
  onClose,
  onLeft,
  onDeleted,
}: {
  group: Group;
  members: GroupMember[];
  messages: FullMessage[];
  isAdmin: boolean;
  onClose: () => void;
  onLeft: () => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Infos");
  const [busy, setBusy] = useState(false);

  const me = members.find((m) => m.user_id === user?.id);
  const canEditInfo = isAdmin || group.who_can_edit_info === "all";
  const canInvite = isAdmin || group.who_can_invite === "all";

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["group", group.id] });
    await queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
    await queryClient.invalidateQueries({ queryKey: ["group-requests", group.id] });
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
  };

  const patch = async (values: Partial<Group>) => {
    setBusy(true);
    try {
      await updateGroup(group.id, values);
      await refresh();
      toast.success("Groupe mis à jour");
    } catch {
      toast.error("Modification impossible.");
    } finally {
      setBusy(false);
    }
  };

  const media = messages.filter((m) => m.media_url && !m.deleted_at);
  const links = messages.filter((m) => m.body && /https?:\/\//.test(m.body));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border/70 bg-surface px-3 py-3">
        <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
        <p className="flex-1 truncate text-sm font-bold">Infos du groupe</p>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-border/70 px-3 py-2">
        {TABS.filter((t) => t !== "Demandes" || isAdmin).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
              tab === t ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 pb-24">
        {tab === "Infos" && (
          <InfoTab group={group} canEdit={canEditInfo} onSave={patch} />
        )}

        {tab === "Membres" && (
          <MembersTab
            group={group}
            members={members}
            isAdmin={isAdmin}
            canInvite={canInvite}
            onChanged={refresh}
          />
        )}

        {tab === "Demandes" && isAdmin && <RequestsTab groupId={group.id} onChanged={refresh} />}

        {tab === "Médias" && (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Médias et fichiers</h3>
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) =>
                  m.media_type === "image" ? (
                    <img key={m.id} src={m.media_url!} alt="Média" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                  ) : m.media_type === "video" ? (
                    <video key={m.id} src={m.media_url!} className="aspect-square w-full rounded-xl bg-black object-cover" />
                  ) : (
                    <a
                      key={m.id}
                      href={m.media_url!}
                      target="_blank"
                      rel="noreferrer"
                      className="grid aspect-square w-full place-items-center rounded-xl bg-muted text-muted-foreground"
                    >
                      <FileText className="h-5 w-5" />
                    </a>
                  ),
                )}
              </div>
              {media.length === 0 && <p className="text-xs text-muted-foreground">Aucun média partagé.</p>}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-bold uppercase text-muted-foreground">Liens</h3>
              <ul className="space-y-1">
                {links.map((m) => (
                  <li key={m.id} className="truncate rounded-xl bg-surface p-2 text-xs shadow-soft">
                    {m.body}
                  </li>
                ))}
              </ul>
              {links.length === 0 && <p className="text-xs text-muted-foreground">Aucun lien partagé.</p>}
            </div>
          </div>
        )}

        {tab === "Réglages" && (
          <div className="space-y-4">
            {isAdmin ? (
              <>
                <Permission
                  label="Qui peut envoyer des messages"
                  value={group.who_can_send}
                  onChange={(v) => void patch({ who_can_send: v })}
                />
                <Permission
                  label="Qui peut modifier les infos du groupe"
                  value={group.who_can_edit_info}
                  onChange={(v) => void patch({ who_can_edit_info: v })}
                />
                <Permission
                  label="Qui peut inviter des membres"
                  value={group.who_can_invite}
                  onChange={(v) => void patch({ who_can_invite: v })}
                />
                <div className="rounded-2xl bg-surface p-3 shadow-soft">
                  <p className="mb-2 text-xs font-semibold">Confidentialité</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Public", value: true },
                      { label: "Privé", value: false },
                    ].map((o) => (
                      <button
                        key={o.label}
                        onClick={() => void patch({ is_public: o.value })}
                        className={cn(
                          "rounded-xl px-3 py-2 text-xs font-semibold",
                          group.is_public === o.value ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Seuls les administrateurs peuvent modifier les autorisations.</p>
            )}

            {me && (
              <button
                onClick={async () => {
                  await setMuted(group.id, me.user_id, !me.notifications_muted);
                  await refresh();
                }}
                className="flex w-full items-center gap-2 rounded-2xl bg-surface p-3 text-sm font-semibold shadow-soft"
              >
                {me.notifications_muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {me.notifications_muted ? "Réactiver les notifications" : "Désactiver les notifications"}
              </button>
            )}

            {me && group.owner_id !== me.user_id && (
              <button
                onClick={async () => {
                  await leaveGroup(group.id, me.user_id);
                  toast.success("Groupe quitté");
                  onLeft();
                }}
                className="flex w-full items-center gap-2 rounded-2xl bg-surface p-3 text-sm font-semibold text-destructive shadow-soft"
              >
                <LogOut className="h-4 w-4" /> Quitter le groupe
              </button>
            )}

            {isAdmin && (
              <button
                onClick={async () => {
                  if (!window.confirm("Supprimer définitivement ce groupe ?")) return;
                  await deleteGroup(group.id);
                  toast.success("Groupe supprimé");
                  onDeleted();
                }}
                className="flex w-full items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Supprimer le groupe
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Permission({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-soft">
      <p className="mb-2 text-xs font-semibold">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Tous les membres", value: "all" },
          { label: "Administrateurs", value: "admins" },
        ].map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold",
              value === o.value ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoTab({ group, canEdit, onSave }: { group: Group; canEdit: boolean; onSave: (v: Partial<Group>) => Promise<void> }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [rules, setRules] = useState(group.rules ?? "");

  if (!canEdit) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-surface p-3 shadow-soft">
          <p className="text-sm font-bold">{group.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{group.description || "Aucune description."}</p>
        </div>
        <div className="rounded-2xl bg-surface p-3 shadow-soft">
          <p className="text-xs font-bold uppercase text-muted-foreground">Règles</p>
          <p className="mt-1 whitespace-pre-wrap text-xs">{group.rules || "Aucune règle définie."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du groupe"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Description"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={rules}
        onChange={(e) => setRules(e.target.value)}
        rows={4}
        placeholder="Règles du groupe"
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={() => void onSave({ name: name.trim() || group.name, description: description.trim() || null, rules: rules.trim() || null })}
        className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground"
      >
        Enregistrer
      </button>
    </div>
  );
}

function MembersTab({
  group,
  members,
  isAdmin,
  canInvite,
  onChanged,
}: {
  group: Group;
  members: GroupMember[];
  isAdmin: boolean;
  canInvite: boolean;
  onChanged: () => Promise<void>;
}) {
  const [term, setTerm] = useState("");
  const results = useQuery({
    queryKey: ["group-people", term],
    queryFn: () => searchPeople(term),
    enabled: canInvite && term.trim().length >= 2,
  });
  const memberIds = new Set(members.map((m) => m.user_id));

  return (
    <div className="space-y-3">
      {canInvite && (
        <div className="space-y-2 rounded-2xl bg-surface p-3 shadow-soft">
          <p className="text-xs font-bold uppercase text-muted-foreground">Ajouter des membres</p>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher un membre PONZO…"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <ul className="space-y-1">
            {(results.data ?? [])
              .filter((p) => !memberIds.has(p.id))
              .map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <Avatar person={{ name: p.full_name, tone: "green" as const, src: p.avatar_url }} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm">{p.full_name}</span>
                  <button
                    onClick={async () => {
                      try {
                        await joinGroup(group.id, p.id);
                        await onChanged();
                        toast.success(`${p.full_name} ajouté`);
                      } catch {
                        toast.error("Ajout impossible.");
                      }
                    }}
                    className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2 rounded-2xl bg-surface p-3 shadow-soft">
            <span className="relative">
              <Avatar person={{ name: m.person?.full_name ?? "Membre", tone: "green" as const, src: m.person?.avatar_url ?? null }} size={36} />
              {isOnline(m.last_seen_at) && (
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{m.person?.full_name ?? "Membre"}</p>
              <p className="text-[11px] text-muted-foreground">
                {m.role === "owner" ? "Propriétaire" : m.role === "admin" ? "Administrateur" : "Membre"}
                {isOnline(m.last_seen_at) ? " · en ligne" : ""}
              </p>
            </div>
            {isAdmin && m.role !== "owner" && (
              <>
                <button
                  aria-label={m.role === "admin" ? "Retirer admin" : "Nommer admin"}
                  onClick={async () => {
                    await setMemberRole(group.id, m.user_id, m.role === "admin" ? "member" : "admin");
                    await onChanged();
                  }}
                  className={cn("grid h-8 w-8 place-items-center rounded-full", m.role === "admin" ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground")}
                >
                  {m.role === "admin" ? <Crown className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                </button>
                <button
                  aria-label="Exclure"
                  onClick={async () => {
                    await removeMember(group.id, m.user_id);
                    await onChanged();
                  }}
                  className="grid h-8 w-8 place-items-center rounded-full bg-destructive/10 text-destructive"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequestsTab({ groupId, onChanged }: { groupId: string; onChanged: () => Promise<void> }) {
  const requests = useQuery({ queryKey: ["group-requests", groupId], queryFn: () => fetchJoinRequests(groupId) });

  if (requests.isLoading) return <p className="text-xs text-muted-foreground">Chargement…</p>;
  if ((requests.data ?? []).length === 0) return <p className="text-xs text-muted-foreground">Aucune demande en attente.</p>;

  return (
    <ul className="space-y-2">
      {requests.data!.map((r) => (
        <li key={r.id} className="flex items-center gap-2 rounded-2xl bg-surface p-3 shadow-soft">
          <Avatar person={{ name: r.person?.full_name ?? "Membre", tone: "green" as const, src: r.person?.avatar_url ?? null }} size={36} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.person?.full_name ?? "Membre"}</span>
          <button
            aria-label="Accepter"
            onClick={async () => {
              await respondJoinRequest(r, true);
              await onChanged();
              await requests.refetch();
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-brand text-primary-foreground"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            aria-label="Refuser"
            onClick={async () => {
              await respondJoinRequest(r, false);
              await requests.refetch();
            }}
            className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
