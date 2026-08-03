import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { useAuth } from "@/lib/auth";
import {
  asPerson,
  buildConversations,
  fetchMessages,
  fetchProfiles,
  markConversationRead,
  notify,
  sendMessage,
  timeAgo,
} from "@/lib/ponzo-api";

export const Route = createFileRoute("/messages")({
  validateSearch: z.object({ to: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Messagerie — PONZO" },
      { name: "description", content: "Messages privés entre membres PONZO : discussions en temps réel, contacts et historique." },
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

  const messages = useQuery({
    queryKey: ["messages", user?.id],
    queryFn: () => fetchMessages(user!.id),
    enabled: !!user,
    refetchInterval: 5000,
  });
  const members = useQuery({ queryKey: ["profiles", "recent"], queryFn: () => fetchProfiles(), enabled: !!user });

  const conversations = useMemo(
    () => (user ? buildConversations(messages.data ?? [], user.id) : []),
    [messages.data, user],
  );

  const thread = useMemo(
    () =>
      (messages.data ?? []).filter(
        (m) => to && (m.sender_id === to || m.recipient_id === to),
      ),
    [messages.data, to],
  );

  const peer =
    conversations.find((c) => c.peerId === to)?.peer ??
    (members.data ?? []).find((p) => p.id === to) ??
    null;

  useEffect(() => {
    if (user && to) void markConversationRead(user.id, to);
  }, [user, to, messages.data]);

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
  });

  if (!user) {
    return (
      <AppShell title="Messages">
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Connecte-toi pour discuter avec la communauté.</p>
          <Link to="/auth" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Se connecter
          </Link>
        </div>
      </AppShell>
    );
  }

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
              const mine = m.sender_id === user.id;
              return (
                <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                  <span
                    className={
                      mine
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[80%] rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-sm shadow-soft"
                    }
                  >
                    {m.body}
                    <span className="mt-1 block text-[10px] opacity-70">{timeAgo(m.created_at)}</span>
                  </span>
                </li>
              );
            })}
            {thread.length === 0 && (
              <li className="py-8 text-center text-sm text-muted-foreground">Démarre la conversation 👋</li>
            )}
          </ul>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
            className="sticky bottom-2 mt-3 flex items-center gap-2 rounded-full bg-surface px-3 py-2 shadow-soft"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
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

  const filtered = conversations.filter((c) =>
    (c.peer?.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

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
            .filter((p) => p.id !== user.id)
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
                  <span className="block truncate text-sm font-semibold">{c.peer?.full_name ?? "Membre PONZO"}</span>
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
