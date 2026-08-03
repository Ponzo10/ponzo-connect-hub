import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mic, Paperclip, Search, Send, Square, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { Badge3D } from "@/components/ponzo/Badge3D";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  asPerson,
  buildConversations,
  fetchMessages,
  fetchProfiles,
  markConversationRead,
  notify,
  sendMedia,
  sendMessage,
  timeAgo,
} from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ to: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Messagerie — PONZO" },
      {
        name: "description",
        content: "Messages privés en temps réel : textes, photos, vidéos, messages vocaux et fichiers.",
      },
      { property: "og:title", content: "Messagerie — PONZO" },
      { property: "og:description", content: "Discute en privé avec les membres de la communauté PONZO." },
    ],
  }),
  component: Messages,
});

function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { to } = Route.useSearch();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: () => fetchMessages(user!.id),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const members = useQuery({ queryKey: ["profiles", "recent"], queryFn: () => fetchProfiles(), enabled: !!user });

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
  }, [thread.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user || !to || !draft.trim()) return;
      await sendMessage(user.id, to, draft.trim());
      await notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un message" });
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: () => toast.error("Envoi impossible."),
  });

  const sendFile = async (file: File | undefined) => {
    if (!file || !user || !to) return;
    try {
      const res = await uploadMedia(user.id, file, "messages");
      await sendMedia(user.id, to, file.name, res.url, res.kind);
      await notify({ userId: to, actorId: user.id, kind: "message", body: "t'a envoyé un fichier" });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch {
      toast.error("Envoi du fichier impossible.");
    }
  };

  const toggleRecording = async () => {
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
        await sendFile(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Micro indisponible.");
    }
  };

  if (to) {
    return (
      <AppShell title={peer?.full_name ?? "Conversation"}>
        <div className="flex min-h-[60vh] flex-col px-3 pt-3">
          <button
            onClick={() => navigate({ to: "/messages", search: {} })}
            className="mb-3 flex items-center gap-2 self-start rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-soft"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Conversations
          </button>

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
                      <img src={m.media_url} alt="Pièce jointe" className="mb-1 max-h-64 rounded-xl object-cover" />
                    )}
                    {m.media_url && m.media_type === "video" && (
                      <video src={m.media_url} controls playsInline className="mb-1 max-h-64 rounded-xl" />
                    )}
                    {m.media_url && m.media_type === "audio" && (
                      <audio src={m.media_url} controls className="mb-1 w-56" />
                    )}
                    {m.media_url && m.media_type === "file" && (
                      <a href={m.media_url} target="_blank" rel="noreferrer" className="mb-1 block underline">
                        Télécharger le fichier
                      </a>
                    )}
                    {m.body}
                    <span className="mt-1 block text-[10px] opacity-70">{timeAgo(m.created_at)}</span>
                  </span>
                </li>
              );
            })}
            {thread.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">Démarre la conversation 👋</li>
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
              aria-label="Joindre un fichier"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={toggleRecording}
              aria-label={recording ? "Arrêter l'enregistrement" : "Message vocal"}
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
              aria-label="Envoyer"
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
    <AppShell title="Messages">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une conversation"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          <span className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
              <Users className="h-6 w-6" />
            </span>
            <span className="text-[10px] font-semibold">Membres</span>
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
                  <span className="block truncate text-xs text-muted-foreground">{c.last.body}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-muted-foreground">{timeAgo(c.last.created_at)}</span>
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
            <li className="py-8 text-center text-sm text-muted-foreground">
              Aucune conversation pour l'instant. Choisis un membre ci-dessus.
            </li>
          )}
        </ul>
      </div>
    </AppShell>
  );
}
