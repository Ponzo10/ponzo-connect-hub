import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  CornerUpLeft,
  FileText,
  Forward,
  Heart,
  Info,
  Loader2,
  Megaphone,
  Mic,
  Paperclip,
  Pin,
  Search,
  Send,
  Smile,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { GroupInfoPanel, isOnline } from "@/components/ponzo/GroupInfo";
import { GroupAvatar } from "@/routes/groupes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  deleteForEveryone,
  fetchGroup,
  fetchGroupMembers,
  fetchGroupMessages,
  fetchGroups,
  joinGroup,
  requestJoin,
  sendGroupMessage,
  togglePin,
  toggleReaction,
  touchPresence,
  type FullMessage,
} from "@/lib/groups-api";
import { timeAgo } from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";
import { cn } from "@/lib/utils";

const EMOJIS = ["😀", "😂", "😍", "🥳", "😎", "🙏", "👏", "🔥", "💚", "💛", "👍", "👌", "🤝", "💡", "🚀", "🎯", "✅", "❤️"];
const STICKERS = ["🦁", "🐘", "🌍", "🌴", "☀️", "⚽", "🎉", "🏆", "💼", "📈", "🎶", "🍲"];

export const Route = createFileRoute("/groupe/$id")({
  head: () => ({
    meta: [
      { title: "Discussion de groupe — PONZO" },
      { name: "description", content: "Discussion de groupe PONZO en temps réel : messages, photos, vidéos, documents, vocaux, réactions et mentions." },
      { property: "og:title", content: "Discussion de groupe — PONZO" },
      { property: "og:description", content: "Échange en direct avec les membres de ton groupe PONZO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AuthGate>
      <GroupChat />
    </AuthGate>
  ),
});

function GroupChat() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [term, setTerm] = useState("");
  const [replyTo, setReplyTo] = useState<FullMessage | null>(null);
  const [announcement, setAnnouncement] = useState(false);
  const [picker, setPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [forwarding, setForwarding] = useState<FullMessage | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const group = useQuery({ queryKey: ["group", id], queryFn: () => fetchGroup(id) });
  const members = useQuery({ queryKey: ["group-members", id], queryFn: () => fetchGroupMembers(id) });
  const messages = useQuery({
    queryKey: ["group-messages", id],
    queryFn: () => fetchGroupMessages(id),
    refetchInterval: 20000,
  });

  const memberRow = (members.data ?? []).find((m) => m.user_id === user?.id);
  const isMember = !!memberRow;
  const isAdmin = memberRow?.role === "owner" || memberRow?.role === "admin";
  const canSend = isMember && (group.data?.who_can_send === "all" || isAdmin);

  useEffect(() => {
    const channel = supabase
      .channel(`group-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-messages", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-members", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_message_reactions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-messages", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_join_requests", filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-requests", id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (!user || !isMember) return;
    void touchPresence(id, user.id);
    const timer = setInterval(() => void touchPresence(id, user.id), 60000);
    return () => clearInterval(timer);
  }, [id, user, isMember]);

  useEffect(() => {
    if (!showSearch) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length, showSearch]);

  const visible = useMemo(() => {
    const all = messages.data ?? [];
    if (!term.trim()) return all;
    const q = term.trim().toLowerCase();
    return all.filter((m) => (m.body ?? "").toLowerCase().includes(q));
  }, [messages.data, term]);

  const pinned = (messages.data ?? []).filter((m) => m.pinned && !m.deleted_at);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return (members.data ?? [])
      .filter((m) => m.user_id !== user?.id && (m.person?.full_name ?? "").toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, members.data, user]);

  const onDraftChange = (value: string) => {
    setDraft(value);
    const match = /@([\p{L}\d ]{0,20})$/u.exec(value);
    setMentionQuery(match ? match[1] ?? "" : null);
  };

  const applyMention = (userId: string, name: string) => {
    setDraft((d) => d.replace(/@([\p{L}\d ]{0,20})$/u, `@${name} `));
    setMentioned((m) => [...new Set([...m, userId])]);
    setMentionQuery(null);
  };

  const send = async (payload?: { url: string; type: string }) => {
    if (!user) return;
    if (!payload && !draft.trim()) return;
    setSending(true);
    try {
      await sendGroupMessage({
        groupId: id,
        senderId: user.id,
        body: payload ? null : draft,
        mediaUrl: payload?.url ?? null,
        mediaType: payload?.type ?? null,
        replyToId: replyTo?.id ?? null,
        mentions: payload ? [] : mentioned.filter((m) => draft.includes("@")),
        isAnnouncement: announcement && isAdmin,
      });
      setDraft("");
      setReplyTo(null);
      setMentioned([]);
      setAnnouncement(false);
      setPicker(false);
      await messages.refetch();
    } catch {
      toast.error("Envoi impossible. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setSending(true);
    try {
      const result = await uploadMedia(user.id, file, "groupes");
      await send({ url: result.url, type: result.kind });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `vocal-${Date.now()}.webm`, { type: "audio/webm" });
        await pickFile(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Micro indisponible.");
    }
  };

  if (group.isLoading) return <p className="grid min-h-screen place-items-center text-sm text-muted-foreground">Chargement…</p>;
  if (!group.data)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-sm">
        <div>
          <p className="font-semibold">Groupe introuvable ou privé.</p>
          <Link to="/groupes" className="mt-3 inline-block rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground">
            Retour aux groupes
          </Link>
        </div>
      </div>
    );

  const onlineCount = (members.data ?? []).filter((m) => isOnline(m.last_seen_at)).length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/70 bg-surface/90 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => void navigate({ to: "/groupes" })} aria-label="Retour" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <GroupAvatar group={group.data} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{group.data.name}</span>
            <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" /> {members.data?.length ?? 0} membre(s)
              {onlineCount > 0 && <span className="text-brand">· {onlineCount} en ligne</span>}
            </span>
          </span>
        </button>
        <button onClick={() => setShowSearch((v) => !v)} aria-label="Rechercher" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <Search className="h-5 w-5" />
        </button>
        <button onClick={() => setShowInfo(true)} aria-label="Infos du groupe" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <Info className="h-5 w-5" />
        </button>
      </header>

      {showSearch && (
        <div className="sticky top-[64px] z-20 border-b border-border/70 bg-surface px-3 py-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Rechercher dans la discussion…"
            className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {pinned.length > 0 && (
        <div className="border-b border-border/70 bg-secondary/40 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground">
            <Pin className="h-3 w-3" /> Épinglé
          </p>
          {pinned.slice(-2).map((m) => (
            <p key={m.id} className="truncate text-xs">
              {m.body ?? "Média épinglé"}
            </p>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 px-3 py-4">
        {!isMember && (
          <div className="rounded-2xl bg-surface p-4 text-center shadow-soft">
            <p className="text-sm font-semibold">Rejoins le groupe pour discuter</p>
            {group.data.is_public ? (
              <button
                onClick={async () => {
                  if (!user) return;
                  await joinGroup(id, user.id);
                  await members.refetch();
                  await messages.refetch();
                  toast.success("Bienvenue dans le groupe !");
                }}
                className="mt-3 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground"
              >
                Rejoindre
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!user) return;
                  await requestJoin(id, user.id);
                  toast.success("Demande envoyée aux administrateurs.");
                }}
                className="mt-3 rounded-full bg-brand px-5 py-2.5 text-xs font-bold text-primary-foreground"
              >
                Demander à rejoindre
              </button>
            )}
          </div>
        )}

        {isMember &&
          visible.map((m) => {
            const mine = m.sender_id === user?.id;
            const liked = !!user && m.reactions.some((r) => r.user_id === user.id);
            return (
              <div key={m.id} className={cn("group/message flex gap-2", mine && "flex-row-reverse")}>
                {!mine && <Avatar person={{ name: m.sender?.full_name ?? "Membre", tone: "green" as const, src: m.sender?.avatar_url ?? null }} size={30} />}
                <div className="max-w-[78%]">
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2",
                      m.is_announcement
                        ? "border border-accent/50 bg-accent/15"
                        : mine
                          ? "bg-brand text-primary-foreground"
                          : "bg-surface shadow-soft",
                    )}
                  >
                    {!mine && <p className="text-[11px] font-bold opacity-80">{m.sender?.full_name ?? "Membre"}</p>}
                    {m.is_announcement && (
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase text-accent-foreground">
                        <Megaphone className="h-3 w-3" /> Annonce
                      </p>
                    )}
                    {m.forwarded && <p className="text-[10px] italic opacity-70">Transféré</p>}
                    {m.replyTo && (
                      <p className="mb-1 truncate rounded-lg border-l-2 border-current/40 bg-background/20 px-2 py-1 text-[11px] opacity-80">
                        {m.replyTo.author} : {m.replyTo.body ?? "Média"}
                      </p>
                    )}
                    {m.deleted_at ? (
                      <p className="text-xs italic opacity-70">Ce message a été supprimé</p>
                    ) : (
                      <>
                        {m.media_url && m.media_type === "image" && (
                          <img src={m.media_url} alt="Photo" loading="lazy" className="mt-1 max-h-64 rounded-xl object-cover" />
                        )}
                        {m.media_url && m.media_type === "video" && (
                          <video src={m.media_url} controls playsInline preload="metadata" className="mt-1 max-h-64 rounded-xl bg-black" />
                        )}
                        {m.media_url && m.media_type === "audio" && <audio src={m.media_url} controls className="mt-1 w-56" />}
                        {m.media_url && m.media_type === "file" && (
                          <a href={m.media_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 text-xs underline">
                            <FileText className="h-4 w-4" /> Ouvrir le document
                          </a>
                        )}
                        {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
                      </>
                    )}
                    <p className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                      {timeAgo(m.created_at)}
                      {m.pinned && <Pin className="h-3 w-3" />}
                    </p>
                  </div>

                  {m.reactions.length > 0 && (
                    <p className={cn("mt-1 text-xs", mine && "text-right")}>
                      ❤️ {m.reactions.length}
                    </p>
                  )}

                  {!m.deleted_at && (
                    <div className={cn("mt-1 flex gap-1 text-muted-foreground", mine && "justify-end")}>
                      <MsgAction
                        label="Réagir"
                        active={liked}
                        onClick={async () => {
                          if (!user) return;
                          await toggleReaction(m.id, user.id, "❤️", liked);
                          await messages.refetch();
                        }}
                      >
                        <Heart className={cn("h-3.5 w-3.5", liked && "fill-current text-destructive")} />
                      </MsgAction>
                      <MsgAction label="Répondre" onClick={() => setReplyTo(m)}>
                        <CornerUpLeft className="h-3.5 w-3.5" />
                      </MsgAction>
                      <MsgAction
                        label="Copier"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.body ?? m.media_url ?? "");
                          toast.success("Copié");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </MsgAction>
                      <MsgAction label="Transférer" onClick={() => setForwarding(m)}>
                        <Forward className="h-3.5 w-3.5" />
                      </MsgAction>
                      {isAdmin && (
                        <MsgAction
                          label={m.pinned ? "Désépingler" : "Épingler"}
                          active={m.pinned}
                          onClick={async () => {
                            await togglePin(m.id, !m.pinned);
                            await messages.refetch();
                          }}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </MsgAction>
                      )}
                      {(mine || isAdmin) && (
                        <MsgAction
                          label="Supprimer pour tout le monde"
                          onClick={async () => {
                            await deleteForEveryone(m.id);
                            await messages.refetch();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </MsgAction>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {isMember && visible.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {term ? "Aucun message trouvé." : "Aucun message. Lance la discussion !"}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {isMember && !canSend && (
        <p className="border-t border-border/70 bg-surface px-3 py-3 text-center text-xs text-muted-foreground">
          Seuls les administrateurs peuvent écrire dans ce groupe.
        </p>
      )}

      {canSend && (
        <div className="sticky bottom-0 border-t border-border/70 bg-surface pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          {replyTo && (
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5 text-xs">
              <CornerUpLeft className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{replyTo.body ?? "Média"}</span>
              <button onClick={() => setReplyTo(null)} aria-label="Annuler la réponse">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {mentionMatches.length > 0 && (
            <ul className="max-h-40 overflow-y-auto border-b border-border/60">
              {mentionMatches.map((m) => (
                <li key={m.user_id}>
                  <button
                    onClick={() => applyMention(m.user_id, m.person?.full_name ?? "membre")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Avatar person={{ name: m.person?.full_name ?? "Membre", tone: "green" as const, src: m.person?.avatar_url ?? null }} size={26} />
                    {m.person?.full_name ?? "Membre"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picker && (
            <div className="max-h-44 overflow-y-auto border-b border-border/60 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Emojis</p>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setDraft((d) => d + e)} className="rounded-lg px-1.5 py-1 text-xl hover:bg-muted">
                    {e}
                  </button>
                ))}
              </div>
              <p className="mb-1 mt-2 text-[10px] font-bold uppercase text-muted-foreground">Autocollants</p>
              <div className="flex flex-wrap gap-1">
                {STICKERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setDraft(s);
                      setPicker(false);
                    }}
                    className="rounded-xl bg-muted px-2 py-1 text-3xl"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-1.5 px-3 py-2.5"
          >
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
            <button type="button" aria-label="Joindre un fichier" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <Paperclip className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Emojis et autocollants" onClick={() => setPicker((v) => !v)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              <Smile className="h-5 w-5" />
            </button>
            <button type="button" aria-label={recording ? "Arrêter" : "Message vocal"} onClick={() => void toggleRecord()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
              {recording ? <Square className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
            </button>
            {isAdmin && (
              <button
                type="button"
                aria-label="Annonce importante"
                onClick={() => setAnnouncement((v) => !v)}
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                  announcement ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Megaphone className="h-5 w-5" />
              </button>
            )}
            <input
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={announcement ? "Annonce importante…" : "Votre message…"}
              className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}

      {showInfo && (
        <GroupInfoPanel
          group={group.data}
          members={members.data ?? []}
          messages={messages.data ?? []}
          isAdmin={!!isAdmin}
          onClose={() => setShowInfo(false)}
          onLeft={() => void navigate({ to: "/groupes" })}
          onDeleted={() => void navigate({ to: "/groupes" })}
        />
      )}

      {forwarding && user && (
        <ForwardDialog message={forwarding} userId={user.id} onClose={() => setForwarding(null)} />
      )}
    </div>
  );
}

function MsgAction({
  label,
  children,
  onClick,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void | Promise<void>;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => void onClick()}
      className={cn("grid h-7 w-7 place-items-center rounded-full hover:bg-muted", active && "text-brand")}
    >
      {children}
    </button>
  );
}

function ForwardDialog({ message, userId, onClose }: { message: FullMessage; userId: string; onClose: () => void }) {
  const groups = useQuery({ queryKey: ["groups", userId], queryFn: () => fetchGroups(userId) });

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/50 sm:place-items-center" onClick={onClose}>
      <div className="max-h-[70vh] w-full overflow-y-auto rounded-t-3xl bg-background p-4 sm:max-w-sm sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-bold">Transférer vers…</p>
        <ul className="space-y-2">
          {(groups.data?.memberGroups ?? [])
            .filter((g) => g.id !== message.group_id)
            .map((g) => (
              <li key={g.id}>
                <button
                  onClick={async () => {
                    try {
                      await sendGroupMessage({
                        groupId: g.id,
                        senderId: userId,
                        body: message.body,
                        mediaUrl: message.media_url,
                        mediaType: message.media_type,
                        forwarded: true,
                      });
                      toast.success(`Transféré vers ${g.name}`);
                      onClose();
                    } catch {
                      toast.error("Transfert impossible.");
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft"
                >
                  <GroupAvatar group={g} size={36} />
                  <span className="truncate text-sm font-semibold">{g.name}</span>
                </button>
              </li>
            ))}
        </ul>
        {(groups.data?.memberGroups ?? []).length <= 1 && (
          <p className="text-xs text-muted-foreground">Aucun autre groupe disponible.</p>
        )}
      </div>
    </div>
  );
}
