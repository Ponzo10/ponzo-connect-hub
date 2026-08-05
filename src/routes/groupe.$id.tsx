import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, LogOut, Mic, Paperclip, Send, Square, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthGate } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { GroupAvatar } from "@/routes/groupes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchGroup,
  fetchGroupMembers,
  fetchGroupMessages,
  joinGroup,
  leaveGroup,
  sendGroupMessage,
} from "@/lib/groups-api";
import { timeAgo } from "@/lib/ponzo-api";
import { uploadMedia } from "@/lib/upload";

export const Route = createFileRoute("/groupe/$id")({
  head: () => ({
    meta: [
      { title: "Discussion de groupe — PONZO" },
      { name: "description", content: "Discussion de groupe PONZO en temps réel : messages, photos, vidéos, documents et vocaux." },
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

  const isMember = !!user && (members.data ?? []).some((m) => m.user_id === user.id);

  useEffect(() => {
    const channel = supabase
      .channel(`group-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-messages", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["group-members", id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

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
      });
      setDraft("");
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-surface/90 px-3 py-3 backdrop-blur-xl">
        <button onClick={() => void navigate({ to: "/groupes" })} aria-label="Retour" className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <GroupAvatar group={group.data} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{group.data.name}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> {members.data?.length ?? 0} membre(s)
          </p>
        </div>
        {isMember && user && group.data.owner_id !== user.id && (
          <button
            aria-label="Quitter le groupe"
            onClick={async () => {
              await leaveGroup(id, user.id);
              toast.success("Groupe quitté");
              void navigate({ to: "/groupes" });
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </header>

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
              <p className="mt-1 text-xs text-muted-foreground">Ce groupe est privé : demande une invitation à un administrateur.</p>
            )}
          </div>
        )}

        {isMember &&
          (messages.data ?? []).map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <Avatar person={{ name: m.sender?.full_name ?? "Membre", avatar: m.sender?.avatar_url ?? null }} size={30} />}
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-brand text-primary-foreground" : "bg-surface shadow-soft"}`}>
                  {!mine && <p className="text-[11px] font-bold opacity-80">{m.sender?.full_name ?? "Membre"}</p>}
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
                  <p className="mt-1 text-[10px] opacity-70">{timeAgo(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        {isMember && (messages.data ?? []).length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Aucun message. Lance la discussion !</p>
        )}
        <div ref={bottomRef} />
      </div>

      {isMember && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="sticky bottom-0 flex items-center gap-2 border-t border-border/70 bg-surface px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
        >
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
          <button type="button" aria-label="Joindre un fichier" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            <Paperclip className="h-5 w-5" />
          </button>
          <button type="button" aria-label={recording ? "Arrêter" : "Message vocal"} onClick={() => void toggleRecord()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted">
            {recording ? <Square className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Votre message…"
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
      )}
    </div>
  );
}
