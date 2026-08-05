import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, CheckCheck, Mic, Paperclip, Search, Send, Square, Users } from "lucide-react";
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
  asPerson,
  buildConversations,
  conversationChannel,
  fetchMessages,
  fetchPresence,
  fetchProfiles,
  markConversationRead,
  markMessagesDelivered,
  notify,
  sendMedia,
  sendMessage,
} from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ to: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Messagerie — PONZO" },
      {
        name: "description",
        content: "Messages privés en temps réel : accusés de lecture, indicateur d'écriture, statut en ligne, photos, vidéos et messages vocaux.",
      },
      { property: "og:title", content: "Messagerie — PONZO" },
      { property: "og:description", content: "Discute en privé avec les membres de la communauté PONZO." },
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
  const { t, formatTimeAgo } = useI18n();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [activity, setActivity] = useState<PeerActivity>({ typing: false, recording: false });
  const fileRef = useRef<HTMLInputElement>(null);
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
    refetchInterval: 15000,
  });
  const members = useQuery({ queryKey: ["profiles", "recent"], queryFn: () => fetchProfiles(), enabled: !!user });

  const presence = useQuery({
    queryKey: ["presence", to],
    queryFn: () => fetchPresence(to!),
    enabled: !!user && !!to,
    refetchInterval: 30000,
  });

  // Messages reçus => distribués (✓✓)
  useEffect(() => {
    if (!user) return;
    void markMessagesDelivered().then(() => queryClient.invalidateQueries({ queryKey: ["messages"] }));
  }, [user, messages.data?.length, queryClient]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["messages"] });
        void queryClient.invalidateQueries({ queryKey: ["unread"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // Canal temps réel dédié à la conversation : « écrit… » / « enregistre… »
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

  const conversations = useMemo(
    () => (user ? buildConversations(messages.data ?? [], user.id) : []),
    [messages.data, user],
  );

  const thread = useMemo(
    () => (messages.data ?? []).filter((m) => to && (m.sender_id === to || m.recipient_id === to)),
    [messages.data, to],
  );

  const peer =
    conversations.find((c) => c.peerId === to)?.peer ?? (members.data ?? []).find((p) => p.id === to) ?? null;

  useEffect(() => {
    if (user && to) {
      void markConversationRead(user.id, to).then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }));
    }
  }, [user, to, messages.data, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, activity.typing, activity.recording]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !to || !draft.trim()) return;
      await sendMessage(user.id, to, draft.trim());
      await notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un message" });
    },
    onSuccess: () => {
      setDraft("");
      broadcast({ typing: false });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => toast.error(t("msg.sendFailed")),
  });

  const sendFile = async (file: File | undefined) => {
    if (!file || !user || !to) return;
    try {
      const res = await uploadMedia(user.id, file, "messages");
      await sendMedia(user.id, to, file.name, res.url, res.kind);
      await notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un fichier" });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch {
      toast.error(t("msg.fileFailed"));
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
          </div>

          <ul className="flex-1 space-y-2">
            {thread.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <span
                    className={
                      mine
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[80%] rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm shadow-soft"
                    }
                  >
                    {m.media_url && m.media_type === "image" && (
                      <img src={m.media_url} alt={t("msg.attachment")} className="mb-1 max-h-64 rounded-xl object-cover" />
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
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                      {formatTimeAgo(m.created_at)}
                      {mine && <Ticks deliveredAt={m.delivered_at} readAt={m.read_at} />}
                    </span>
                  </span>
                </li>
              );
            })}
            {thread.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">{t("msg.start")}</li>
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
            accept="image/*,video/*,audio/*,application/pdf"
            className="hidden"
            onChange={(e) => void sendFile(e.target.files?.[0])}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
            className="sticky bottom-2 mt-3 flex items-center gap-2 rounded-full bg-surface px-3 py-2 shadow-soft"
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={t("msg.attach")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Paperclip className="h-4 w-4" />
            </button>
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
        </div>
      </AppShell>
    );
  }

  const filtered = conversations.filter((c) => (c.peer?.full_name ?? "").toLowerCase().includes(q.toLowerCase()));

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

        <ul className="mt-4 space-y-1">
          {filtered.map((c) => (
            <li key={c.peerId}>
              <button
                onClick={() => navigate({ to: "/messages", search: { to: c.peerId } })}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft"
              >
                <Avatar person={asPerson(c.peer)} size={50} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">
                    {c.peer?.full_name ?? "Membre PONZO"}
                    <Badge3D kind={c.peer?.badge} />
                  </span>
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {c.last.sender_id === user?.id && (
                      <Ticks deliveredAt={c.last.delivered_at} readAt={c.last.read_at} />
                    )}
                    <span className="truncate">{c.last.body}</span>
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
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">{t("msg.empty")}</li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
