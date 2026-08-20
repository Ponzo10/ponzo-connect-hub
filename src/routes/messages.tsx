import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  Copy,
  Flag,
  Forward,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  Paperclip,
  Pencil,
  Pin,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { Badge3D } from "@/components/ponzo/Badge3D";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  QUICK_REACTIONS,
  STICKERS,
  canDeleteForEveryone,
  copyText,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage,
  fetchBlocked,
  fetchConversationSettings,
  forwardMessages,
  setBlocked,
  setConversationFlag,
  toggleReaction,
} from "@/lib/messaging-api";
import {
  asPerson,
  buildConversations,
  conversationChannel,
  fetchMessages,
  fetchPresence,
  fetchProfiles,
  markConversationRead,
  markMessagesDelivered,
  notify,
  reportContent,
  sendMedia,
  sendMessage,
  type Message,
} from "@/lib/ponzo-api";
import { fetchGroups } from "@/lib/groups-api";
import { uploadMedia } from "@/lib/upload";
import { SmartImg } from "@/components/ponzo/SmartImg";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ to: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Messagerie — PONZO" },
      {
        name: "description",
        content:
          "Messagerie moderne PONZO : réponses, réactions, stickers, GIF, transfert, édition, suppression, recherche, épinglage et archivage en temps réel.",
      },
      { property: "og:title", content: "Messagerie — PONZO" },
      { property: "og:description", content: "Discute en privé avec les membres de la communauté PONZO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Messages,
});

type PeerActivity = { typing: boolean; recording: boolean };

function Ticks({ deliveredAt, readAt }: { deliveredAt: string | null; readAt: string | null }) {
  const { t } = useI18n();
  if (readAt) return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label={t("msg.read")} />;
  if (deliveredAt) return <CheckCheck className="h-3.5 w-3.5 opacity-70" aria-label={t("msg.delivered")} />;
  return <Check className="h-3.5 w-3.5 opacity-70" aria-label={t("msg.sent")} />;
}

function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { to } = Route.useSearch();
  const queryClient = useQueryClient();
  const { t, locale, formatTimeAgo } = useI18n();

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [activity, setActivity] = useState<PeerActivity>({ typing: false, recording: false });
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sheet, setSheet] = useState<Message | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [chatSearch, setChatSearch] = useState<string | null>(null);
  const [stickers, setStickers] = useState(false);
  const [forwardOpen, setForwardOpen] = useState<Message[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [upload, setUpload] = useState<{ name: string; progress: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearActivity = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: () => fetchMessages(user!.id),
    enabled: !!user,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const members = useQuery({ queryKey: ["profiles", "recent"], queryFn: () => fetchProfiles(), enabled: !!user });
  const groups = useQuery({
    queryKey: ["groups", user?.id],
    queryFn: () => fetchGroups(user!.id),
    // Groupes temporairement désactivés dans l'app utilisateur (code conservé).
    enabled: false,
    staleTime: 60_000,
  });
  const settings = useQuery({
    queryKey: ["conversation-settings", user?.id],
    queryFn: () => fetchConversationSettings(user!.id),
    enabled: !!user,
  });
  const blocked = useQuery({
    queryKey: ["blocked", user?.id],
    queryFn: () => fetchBlocked(user!.id),
    enabled: !!user,
  });

  const presence = useQuery({
    queryKey: ["presence", to],
    queryFn: () => fetchPresence(to!),
    enabled: !!user && !!to,
    refetchInterval: 30000,
  });

  const refreshMessages = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["messages"] });
  }, [queryClient]);

  /** Ajoute immédiatement un message envoyé au cache : affichage instantané, sans attendre le réseau. */
  const pushMessage = useCallback(
    (message: Message) => {
      queryClient.setQueryData<Message[]>(["messages", user?.id], (prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === message.id)) return list;
        return [...list, message];
      });
    },
    [queryClient, user?.id],
  );

  useEffect(() => {
    if (!user) return;
    void markMessagesDelivered().then(refreshMessages);
  }, [user, messages.data?.length, refreshMessages]);

  useEffect(() => {
    if (!user) return;
    // Filtres serveur : seuls mes messages traversent le realtime (le flux
    // global renvoyait auparavant tous les évènements de la table).
    const onChange = () => {
      refreshMessages();
      void queryClient.invalidateQueries({ queryKey: ["unread"] });
    };
    const channel = supabase
      .channel(`messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `sender_id=eq.${user.id}` },
        onChange,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, refreshMessages)
      .subscribe();
    // Reprise après coupure réseau : on resynchronise le fil et les accusés.
    const resync = () => {
      void markMessagesDelivered().then(refreshMessages);
    };
    window.addEventListener("online", resync);
    return () => {
      window.removeEventListener("online", resync);
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient, refreshMessages]);


  useEffect(() => {
    if (!user || !to) {
      setActivity({ typing: false, recording: false });
      return;
    }
    const channel = supabase.channel(conversationChannel(user.id, to), {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const p = payload as { from: string; typing?: boolean; recording?: boolean };
        if (p.from !== to) return;
        setActivity({ typing: !!p.typing, recording: !!p.recording });
        if (clearActivity.current) clearTimeout(clearActivity.current);
        clearActivity.current = setTimeout(() => setActivity({ typing: false, recording: false }), 6000);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      if (clearActivity.current) clearTimeout(clearActivity.current);
      void supabase.removeChannel(channel);
    };
  }, [user, to]);

  // Réinitialise les modes contextuels au changement de conversation
  useEffect(() => {
    setSelection([]);
    setReplyTo(null);
    setEditing(null);
    setChatSearch(null);
    setStickers(false);
    setMenuOpen(false);
  }, [to]);

  const broadcast = useCallback(
    (payload: { typing?: boolean; recording?: boolean }) => {
      if (!user || !channelRef.current) return;
      void channelRef.current.send({
        type: "broadcast",
        event: "activity",
        payload: { from: user.id, ...payload },
      });
    },
    [user],
  );

  const onDraftChange = (value: string) => {
    setDraft(value);
    broadcast({ typing: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => broadcast({ typing: false }), 2500);
  };

  const visible = useMemo(
    () => (messages.data ?? []).filter((m) => !user || !(m.deleted_for ?? []).includes(user.id)),
    [messages.data, user],
  );

  const conversations = useMemo(
    () => (user ? buildConversations(visible, user.id) : []),
    [visible, user],
  );

  const settingOf = useCallback(
    (peerId: string) => (settings.data ?? []).find((s) => s.peer_id === peerId),
    [settings.data],
  );

  const thread = useMemo(
    () => visible.filter((m) => to && (m.sender_id === to || m.recipient_id === to)),
    [visible, to],
  );

  const shownThread = useMemo(() => {
    const term = (chatSearch ?? "").trim().toLowerCase();
    if (!term) return thread;
    return thread.filter((m) => (m.body ?? "").toLowerCase().includes(term));
  }, [thread, chatSearch]);

  const peer =
    conversations.find((c) => c.peerId === to)?.peer ?? (members.data ?? []).find((p) => p.id === to) ?? null;
  const isBlocked = !!to && (blocked.data ?? []).includes(to);

  useEffect(() => {
    if (user && to) {
      void markConversationRead(user.id, to).then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }));
    }
  }, [user, to, messages.data, queryClient]);

  useEffect(() => {
    if (!chatSearch) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [shownThread.length, activity.typing, activity.recording, chatSearch]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !to || !draft.trim()) return;
      const text = draft.trim();
      const quoted = replyTo?.id ?? null;
      const edited = editing;
      // Le champ est vidé tout de suite : l'envoi paraît instantané.
      setDraft("");
      setReplyTo(null);
      setEditing(null);
      broadcast({ typing: false });
      if (edited) {
        await editMessage(edited.id, text);
        refreshMessages();
        return;
      }
      const created = await sendMessage(user.id, to, text, quoted);
      pushMessage(created);
      void notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un message" });
    },
    onError: () => {
      toast.error(t("msg.sendFailed"));
      refreshMessages();
    },
  });

  const sendFile = async (file: File | undefined, kindOverride?: string) => {
    if (!file || !user || !to) return;
    setUpload({ name: file.name, progress: 0 });
    try {
      const res = await uploadMedia(user.id, file, "messages", undefined, (p) =>
        setUpload((prev) => (prev ? { ...prev, progress: p } : prev)),
      );
      const created = await sendMedia(user.id, to, file.name, res.url, kindOverride ?? res.kind, replyTo?.id ?? null);
      pushMessage(created);
      setReplyTo(null);
      void notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un fichier" });
    } catch {
      toast.error(t("msg.fileFailed"));
    }
  };

  const sendSticker = async (emoji: string) => {
    if (!user || !to) return;
    try {
      const created = await sendMedia(user.id, to, emoji, null, "sticker", replyTo?.id ?? null);
      pushMessage(created);
      setStickers(false);
      setReplyTo(null);
    } catch {
      toast.error(t("msg.sendFailed"));
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      broadcast({ recording: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `vocal-${Date.now()}.webm`, { type: "audio/webm" });
        await sendFile(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      broadcast({ recording: true });
    } catch {
      toast.error(t("msg.micFailed"));
    }
  };

  const run = async (fn: () => Promise<unknown>, okMessage?: string) => {
    try {
      await fn();
      if (okMessage) toast.success(okMessage);
      refreshMessages();
      void queryClient.invalidateQueries({ queryKey: ["conversation-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["blocked"] });
    } catch {
      toast.error(t("msg.actionFailed"));
    }
  };

  const react = (m: Message, emoji: string) => {
    if (!user) return;
    const active = (m.message_reactions ?? []).some((r) => r.user_id === user.id && r.emoji === emoji);
    void run(() => toggleReaction(m.id, user.id, emoji, active));
    setSheet(null);
  };

  const doForward = async (recipientIds: string[]) => {
    if (!user || !forwardOpen) return;
    await run(
      () =>
        forwardMessages(
          user.id,
          recipientIds,
          forwardOpen.map((m) => ({ body: m.body, media_url: m.media_url, media_type: m.media_type })),
        ),
      t("msg.forwarded"),
    );
    setForwardOpen(null);
    setSelection([]);
  };

  const shareSelection = async () => {
    const text = thread
      .filter((m) => selection.includes(m.id))
      .map((m) => `${m.sender_id === user?.id ? "Moi" : (peer?.full_name ?? "")}: ${m.body}`)
      .join("\n");
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* annulé */
      }
    }
    await copyText(text);
    toast.success(t("msg.copied"));
  };

  const formatStamp = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ---------- Vue conversation ----------
  if (to) {
    const status = activity.recording
      ? t("msg.recording")
      : activity.typing
        ? t("msg.typing")
        : presence.data?.online
          ? t("msg.online")
          : presence.data?.last_seen
            ? t("msg.lastSeen", { time: formatTimeAgo(presence.data.last_seen) })
            : "";
    const setting = settingOf(to);

    return (
      <AppShell title={peer?.full_name ?? t("msg.conversation")}>
        <div className="flex min-h-[60vh] flex-col px-3 pt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              onClick={() => navigate({ to: "/messages", search: {} })}
              className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-soft"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {t("msg.conversations")}
            </button>
            <div className="flex min-w-0 items-center gap-2">
              {status && (
                <span
                  className={
                    activity.typing || activity.recording || presence.data?.online
                      ? "flex items-center gap-1.5 truncate text-[11px] font-semibold text-primary"
                      : "truncate text-[11px] text-muted-foreground"
                  }
                >
                  {(activity.typing || activity.recording || presence.data?.online) && (
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
                  )}
                  {status}
                </span>
              )}
              <button
                onClick={() => setChatSearch((s) => (s === null ? "" : null))}
                aria-label={t("msg.searchInChat")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface shadow-soft"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={t("msg.actions")}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface shadow-soft"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="mb-3 grid gap-1 rounded-2xl bg-surface p-2 shadow-soft">
              <MenuItem
                icon={<Pin className="h-4 w-4" />}
                label={setting?.pinned ? t("msg.unpin") : t("msg.pin")}
                onClick={() => {
                  setMenuOpen(false);
                  void run(() => setConversationFlag(user!.id, to, { pinned: !setting?.pinned }));
                }}
              />
              <MenuItem
                icon={<Archive className="h-4 w-4" />}
                label={setting?.archived ? t("msg.unarchive") : t("msg.archive")}
                onClick={() => {
                  setMenuOpen(false);
                  void run(() => setConversationFlag(user!.id, to, { archived: !setting?.archived }));
                }}
              />
              <MenuItem
                icon={<Ban className="h-4 w-4" />}
                label={isBlocked ? t("msg.unblock") : t("msg.block")}
                onClick={() => {
                  setMenuOpen(false);
                  void run(() => setBlocked(user!.id, to, !isBlocked));
                }}
              />
              <MenuItem
                icon={<Flag className="h-4 w-4" />}
                label={t("msg.report")}
                onClick={() => {
                  setMenuOpen(false);
                  void run(() => reportContent(user!.id, "profile", to, "Signalement depuis la messagerie"), t("msg.reported"));
                }}
              />
            </div>
          )}

          {chatSearch !== null && (
            <label className="mb-3 flex items-center gap-2 rounded-full bg-surface px-4 py-2 shadow-soft">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder={t("msg.searchInChat")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button onClick={() => setChatSearch(null)} aria-label={t("msg.close")}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </label>
          )}

          {selection.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-primary-soft px-3 py-2">
              <span className="text-xs font-semibold text-primary">
                {t("msg.selected", { count: selection.length })}
              </span>
              <span className="flex items-center gap-1">
                <IconAction
                  label={t("msg.forward")}
                  onClick={() => setForwardOpen(thread.filter((m) => selection.includes(m.id)))}
                >
                  <Forward className="h-4 w-4" />
                </IconAction>
                <IconAction label={t("msg.share")} onClick={() => void shareSelection()}>
                  <Copy className="h-4 w-4" />
                </IconAction>
                <IconAction
                  label={t("msg.deleteForMe")}
                  onClick={() =>
                    void run(async () => {
                      for (const m of thread.filter((x) => selection.includes(x.id))) {
                        await deleteMessageForMe(m.id, user!.id, m.deleted_for ?? []);
                      }
                      setSelection([]);
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </IconAction>
                <IconAction label={t("msg.close")} onClick={() => setSelection([])}>
                  <X className="h-4 w-4" />
                </IconAction>
              </span>
            </div>
          )}

          <ul className="flex-1 space-y-2">
            {shownThread.map((m) => {
              const mine = m.sender_id === user?.id;
              const removed = !!m.deleted_at;
              const selected = selection.includes(m.id);
              const reactions = Object.entries(
                (m.message_reactions ?? []).reduce<Record<string, number>>((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                  return acc;
                }, {}),
              );
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"} ${selected ? "rounded-2xl bg-primary-soft/60" : ""}`}
                >
                  <div className="max-w-[82%]">
                    <button
                      type="button"
                      onClick={() => {
                        if (selection.length > 0) {
                          setSelection((s) => (selected ? s.filter((x) => x !== m.id) : [...s, m.id]));
                        } else if (!removed) {
                          setSheet(m);
                        }
                      }}
                      className={
                        m.media_type === "sticker"
                          ? "block text-left text-5xl"
                          : mine
                            ? "block rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-left text-sm text-primary-foreground"
                            : "block rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-left text-sm shadow-soft"
                      }
                    >
                      {removed ? (
                        <span className="italic opacity-70">{t("msg.deleted")}</span>
                      ) : (
                        <>
                          {m.forwarded && (
                            <span className="mb-1 block text-[10px] italic opacity-70">↪ {t("msg.forwarded")}</span>
                          )}
                          {m.reply_to && (
                            <span className="mb-1 block truncate rounded-lg border-s-2 border-primary/60 bg-black/10 px-2 py-1 text-[11px] opacity-80">
                              {m.reply_to.body || t("msg.attachment")}
                            </span>
                          )}
                          {m.media_url && (m.media_type === "image" || m.media_type === "gif") && (
                            <SmartImg src={m.media_url} alt={t("msg.attachment")} width={480} quality={65} className="mb-1 max-h-64 rounded-xl object-cover" />
                          )}
                          {m.media_url && m.media_type === "video" && (
                            <video src={m.media_url} controls playsInline className="mb-1 max-h-64 rounded-xl" />
                          )}
                          {m.media_url && m.media_type === "audio" && (
                            <audio src={m.media_url} controls className="mb-1 w-56" />
                          )}
                          {m.media_url && m.media_type === "file" && (
                            <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 block underline">
                              {t("msg.download")}
                            </a>
                          )}
                          {m.body}
                          {m.media_type !== "sticker" && (
                            <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                              {m.edited_at && <span className="italic">{t("msg.edited")}</span>}
                              {formatStamp(m.created_at)}
                              {mine && <Ticks deliveredAt={m.delivered_at} readAt={m.read_at} />}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {reactions.length > 0 && (
                      <span className={`mt-0.5 flex gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                        {reactions.map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => react(m, emoji)}
                            className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] shadow-soft"
                          >
                            {emoji} {count > 1 ? count : ""}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            {shownThread.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">
                {chatSearch ? t("msg.noResults") : t("msg.start")}
              </li>
            )}
            {(activity.typing || activity.recording) && (
              <li className="flex justify-start">
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-xs text-muted-foreground shadow-soft">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                  <span className="ms-1">{activity.recording ? t("msg.recording") : t("msg.typing")}</span>
                </span>
              </li>
            )}
            <div ref={bottomRef} />
          </ul>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => void sendFile(e.target.files?.[0])}
          />
          <input
            ref={gifRef}
            type="file"
            accept="image/gif"
            className="hidden"
            onChange={(e) => void sendFile(e.target.files?.[0], "gif")}
          />

          {stickers && (
            <div className="mt-3 grid grid-cols-8 gap-1 rounded-2xl bg-surface p-2 shadow-soft">
              {STICKERS.map((s) => (
                <button key={s} onClick={() => void sendSticker(s)} className="rounded-lg py-1 text-2xl hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          )}

          {(replyTo || editing) && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-xs shadow-soft">
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-primary">{editing ? t("msg.editing") : t("msg.reply")} · </span>
                {(editing ?? replyTo)?.body || t("msg.attachment")}
              </span>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setEditing(null);
                  setDraft("");
                }}
                aria-label={t("msg.close")}
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {isBlocked ? (
            <div className="sticky bottom-2 mt-3 rounded-2xl bg-surface px-3 py-3 text-center text-xs text-muted-foreground shadow-soft">
              {t("msg.blockedNotice")}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send.mutate();
              }}
              className="sticky bottom-2 mt-3 flex items-center gap-1 rounded-full bg-surface px-2 py-2 shadow-soft"
            >
              <IconAction label={t("msg.attach")} onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4" />
              </IconAction>
              <IconAction label={t("msg.gif")} onClick={() => gifRef.current?.click()}>
                <ImageIcon className="h-4 w-4" />
              </IconAction>
              <IconAction label={t("msg.sticker")} onClick={() => setStickers((v) => !v)}>
                <Smile className="h-4 w-4" />
              </IconAction>
              <input
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onBlur={() => broadcast({ typing: false })}
                placeholder={t("msg.write")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={toggleRecording}
                aria-label={recording ? t("msg.stopRecording") : t("msg.voice")}
                className={
                  recording
                    ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground"
                    : "grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                }
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || send.isPending}
                aria-label={t("msg.send")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        {sheet && (
          <Sheet onClose={() => setSheet(null)}>
            <div className="mb-3 flex justify-center gap-1">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => react(sheet, emoji)} className="rounded-full p-1.5 text-2xl hover:bg-muted">
                  {emoji}
                </button>
              ))}
            </div>
            <MenuItem
              icon={<Reply className="h-4 w-4" />}
              label={t("msg.reply")}
              onClick={() => {
                setReplyTo(sheet);
                setEditing(null);
                setSheet(null);
              }}
            />
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              label={t("msg.copy")}
              onClick={() => {
                void copyText(sheet.body ?? "");
                toast.success(t("msg.copied"));
                setSheet(null);
              }}
            />
            <MenuItem
              icon={<Forward className="h-4 w-4" />}
              label={t("msg.forward")}
              onClick={() => {
                setForwardOpen([sheet]);
                setSheet(null);
              }}
            />
            <MenuItem
              icon={<Check className="h-4 w-4" />}
              label={t("msg.select")}
              onClick={() => {
                setSelection([sheet.id]);
                setSheet(null);
              }}
            />
            {sheet.sender_id === user?.id && !sheet.media_url && (
              <MenuItem
                icon={<Pencil className="h-4 w-4" />}
                label={t("msg.edit")}
                onClick={() => {
                  setEditing(sheet);
                  setReplyTo(null);
                  setDraft(sheet.body ?? "");
                  setSheet(null);
                }}
              />
            )}
            <MenuItem
              icon={<Trash2 className="h-4 w-4" />}
              label={t("msg.deleteForMe")}
              onClick={() => {
                void run(() => deleteMessageForMe(sheet.id, user!.id, sheet.deleted_for ?? []));
                setSheet(null);
              }}
            />
            {canDeleteForEveryone(sheet.created_at, sheet.sender_id === user?.id) && (
              <MenuItem
                icon={<Trash2 className="h-4 w-4 text-destructive" />}
                label={t("msg.deleteForAll")}
                onClick={() => {
                  void run(() => deleteMessageForEveryone(sheet.id));
                  setSheet(null);
                }}
              />
            )}
          </Sheet>
        )}

        {forwardOpen && (
          <Sheet onClose={() => setForwardOpen(null)}>
            <p className="mb-2 text-center text-sm font-semibold">{t("msg.forwardTo")}</p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {(members.data ?? [])
                .filter((p) => p.id !== user?.id)
                .map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => void doForward([p.id])}
                      className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-muted"
                    >
                      <Avatar person={asPerson(p)} size={40} />
                      <span className="truncate text-sm font-medium">{p.full_name}</span>
                    </button>
                  </li>
                ))}
            </ul>
          </Sheet>
        )}
      </AppShell>
    );
  }

  // ---------- Liste des conversations ----------
  const filtered = conversations
    .filter((c) => (c.peer?.full_name ?? "").toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !!settingOf(c.peerId)?.archived === showArchived)
    .sort((a, b) => Number(!!settingOf(b.peerId)?.pinned) - Number(!!settingOf(a.peerId)?.pinned));

  return (
    <AppShell title={t("msg.title")}>
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("msg.searchConversation")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="mt-3 flex gap-2">
          {[false, true].map((archived) => (
            <button
              key={String(archived)}
              onClick={() => setShowArchived(archived)}
              className={
                showArchived === archived
                  ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  : "rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-soft"
              }
            >
              {archived ? t("msg.archived") : t("msg.title")}
            </button>
          ))}
        </div>

        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          <span className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
              <Users className="h-6 w-6" />
            </span>
            <span className="text-[10px] font-semibold">{t("msg.members")}</span>
          </span>
          {(members.data ?? [])
            .filter((p) => p.id !== user?.id)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => navigate({ to: "/messages", search: { to: p.id } })}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <Avatar person={asPerson(p)} size={56} />
                <span className="w-full truncate text-[10px] font-medium">{p.full_name.split(" ")[0]}</span>
              </button>
            ))}
        </div>

        {!showArchived && (groups.data?.memberGroups ?? []).length > 0 && (
          <ul className="mt-4 space-y-1">
            {(groups.data?.memberGroups ?? [])
              .filter((g) => g.name.toLowerCase().includes(q.toLowerCase()))
              .map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => navigate({ to: "/groupe/$id", params: { id: g.id } })}
                    className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft"
                  >
                    <span className="grid h-[50px] w-[50px] shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft text-primary">
                      {g.photo_url ? (
                        <img src={g.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users className="h-6 w-6" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="truncate text-sm font-semibold">{g.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {g.description || t("msg.members")}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                      Groupe
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}

        <ul className="mt-4 space-y-1">
          {filtered.map((c) => {
            const setting = settingOf(c.peerId);
            return (
              <li key={c.peerId} className="relative">
                <button
                  onClick={() => navigate({ to: "/messages", search: { to: c.peerId } })}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft"
                >
                  <Avatar person={asPerson(c.peer)} size={50} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      {setting?.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      {c.peer?.full_name ?? "Membre PONZO"}
                      <Badge3D kind={c.peer?.badge} />
                    </span>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {c.last.sender_id === user?.id && (
                        <Ticks deliveredAt={c.last.delivered_at} readAt={c.last.read_at} />
                      )}
                      <span className="truncate">{c.last.deleted_at ? t("msg.deleted") : c.last.body}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[11px] text-muted-foreground">{formatTimeAgo(c.last.created_at)}</span>
                    {c.unread > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-primary-foreground">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </button>
                <span className="absolute end-2 top-1 flex gap-1">
                  <IconAction
                    label={setting?.pinned ? t("msg.unpin") : t("msg.pin")}
                    onClick={() => void run(() => setConversationFlag(user!.id, c.peerId, { pinned: !setting?.pinned }))}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </IconAction>
                  <IconAction
                    label={setting?.archived ? t("msg.unarchive") : t("msg.archive")}
                    onClick={() =>
                      void run(() => setConversationFlag(user!.id, c.peerId, { archived: !setting?.archived }))
                    }
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </IconAction>
                </span>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">{t("msg.empty")}</li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium hover:bg-muted"
    >
      {icon}
      {label}
    </button>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-surface p-3 pb-6 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted" />
        {children}
      </div>
    </div>
  );
}
