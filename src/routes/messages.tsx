import { createFileRoute } from "@tanstack/react-router";
import { Camera, FileText, Mic, Phone, Search, Send, Users, Video } from "lucide-react";

import { AppShell } from "@/components/ponzo/AppShell";
import { Avatar } from "@/components/ponzo/Avatar";
import { chats, people } from "@/data/demo";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messagerie — PONZO" },
      { name: "description", content: "Messages privés, groupes, photos, vidéos, messages vocaux et appels audio/vidéo sur PONZO." },
      { property: "og:title", content: "Messagerie — PONZO" },
      { property: "og:description", content: "Discute en privé ou en groupe, partage des fichiers et lance des appels." },
    ],
  }),
  component: Messages,
});

function Messages() {
  return (
    <AppShell title="Messages">
      <div className="px-3 pt-3">
        <label className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 shadow-soft">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Rechercher une conversation"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          <button className="flex w-16 shrink-0 flex-col items-center gap-1.5">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary">
              <Users className="h-6 w-6" />
            </span>
            <span className="text-[10px] font-semibold">Groupe</span>
          </button>
          {people.map((p) => (
            <button key={p.id} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <span className="relative">
                <Avatar person={p} size={56} />
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-primary" />
              </span>
              <span className="w-full truncate text-[10px] font-medium">{p.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        <ul className="mt-4 space-y-1">
          {chats.map((c) => (
            <li key={c.id}>
              <button className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-surface p-3 text-left shadow-soft">
                <span className="relative">
                  <Avatar person={c.person} size={50} />
                  {c.online && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.preview}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-muted-foreground">{c.time}</span>
                  {c.unread ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-2xl bg-surface p-4 shadow-soft">
          <p className="text-sm font-semibold">Dans une conversation</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold">
            <Feature icon={<Camera className="h-4 w-4" />} label="Photo" />
            <Feature icon={<Video className="h-4 w-4" />} label="Vidéo" />
            <Feature icon={<Mic className="h-4 w-4" />} label="Vocal" />
            <Feature icon={<FileText className="h-4 w-4" />} label="Document" />
            <Feature icon={<Phone className="h-4 w-4" />} label="Appel audio" />
            <Feature icon={<Send className="h-4 w-4" />} label="Partage" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5 rounded-xl bg-muted py-3 text-center text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}
