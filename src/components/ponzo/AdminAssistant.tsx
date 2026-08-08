import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { askAdminAssistant, runDiagnosticScan } from "@/lib/ai-monitor.functions";
import { timeAgo } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "ponzo.admin.assistant";
const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Bonjour 👋 Je surveille PONZO en continu : erreurs, publications, médias, messagerie, notifications, performances et sécurité. Lance une analyse ou pose-moi une question. Je ne modifie jamais l'application : je détecte, j'explique et je propose — la correction reste soumise à ton autorisation.",
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-600",
  medium: "bg-primary-soft text-primary",
  low: "bg-muted text-muted-foreground",
};

/** Assistant IA de surveillance : diagnostic en lecture seule. */
export function AdminAssistant() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const scan = useServerFn(runDiagnosticScan);
  const ask = useServerFn(askAdminAssistant);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      } catch {
        /* conversation illisible : on repart du message d'accueil */
      }
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const findings = useQuery({
    queryKey: ["ai-findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_findings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const scans = useQuery({
    queryKey: ["ai-scans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scans")
        .select("id, summary, health_score, findings_count, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const analyze = useMutation({
    mutationFn: () => scan({ data: { trigger: "manual" } }),
    onSuccess: async (result) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🩺 Analyse terminée — santé ${result.healthScore}/100, ${result.findings} anomalie(s) détectée(s).\n\n${result.summary}`,
        },
      ]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-findings"] }),
        queryClient.invalidateQueries({ queryKey: ["ai-scans"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Analyse impossible."),
  });

  const send = useMutation({
    mutationFn: async (text: string) => {
      const next = [...messages.filter((m) => m !== GREETING), { role: "user" as const, content: text }];
      const result = await ask({ data: { messages: next.slice(-12) } });
      return result.reply;
    },
    onSuccess: (reply) => {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      inputRef.current?.focus();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Assistant indisponible.");
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const submit = () => {
    const text = input.trim();
    if (!text || send.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    send.mutate(text);
  };

  const open = (findings.data ?? []).filter((f) => f.status === "new");

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("ai_findings")
      .update({ status, ...(status === "authorized" ? { authorized_at: new Date().toISOString() } : {}) })
      .eq("id", id);
    if (error) {
      toast.error("Mise à jour impossible.");
      return;
    }
    toast.success(
      status === "authorized"
        ? "Correction autorisée — elle sera appliquée à l'étape suivante de l'assistant."
        : "Anomalie mise à jour.",
    );
    void queryClient.invalidateQueries({ queryKey: ["ai-findings"] });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-surface p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Bot className="h-4 w-4 text-primary" /> Assistant IA de surveillance
          </p>
          <button
            onClick={() => analyze.mutate()}
            disabled={analyze.isPending}
            className="flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", analyze.isPending && "animate-spin")} />
            {analyze.isPending ? "Analyse…" : "Analyser maintenant"}
          </button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Lecture seule : surveillance → détection → analyse → proposition → ton autorisation → correction → vérification.
        </p>
      </div>

      {open.length > 0 && (
        <div className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> {open.length} anomalie(s) en attente de ta décision.
        </div>
      )}

      {(findings.data ?? []).map((f) => (
        <div key={f.id} className="rounded-2xl bg-surface p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", PRIORITY_STYLE[f.priority] ?? PRIORITY_STYLE['medium'])}>
              {f.priority}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{f.area}</span>
            <span className="text-[10px] text-muted-foreground">{timeAgo(f.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-bold">{f.title}</p>
          <dl className="mt-2 space-y-1.5 text-xs">
            <Row label="Cause probable" value={f.cause} />
            <Row label="Impact utilisateurs" value={f.impact} />
            <Row label="Solution recommandée" value={f.recommendation} />
          </dl>
          {f.status === "new" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => void setStatus(f.id, "authorized")}
                className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
              >
                Autoriser la correction
              </button>
              <button
                onClick={() => void setStatus(f.id, "acknowledged")}
                className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold"
              >
                Noté
              </button>
              <button
                onClick={() => void setStatus(f.id, "dismissed")}
                className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
              >
                Ignorer
              </button>
            </div>
          ) : (
            <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
              Statut : {f.status === "authorized" ? "correction autorisée (en attente de l'étape 2)" : f.status}
            </p>
          )}
        </div>
      ))}

      <div className="rounded-2xl bg-surface p-3 shadow-soft">
        <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                m.role === "user" ? "ml-auto bg-brand text-primary-foreground" : "bg-muted",
              )}
            >
              {m.content}
            </div>
          ))}
          {send.isPending && <div className="w-16 rounded-2xl bg-muted px-3 py-2 text-sm">•••</div>}
          <div ref={endRef} />
        </div>
        <div className="mt-2 flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ex : pourquoi les vidéos échouent-elles ?"
            className="max-h-28 flex-1 resize-none rounded-xl bg-muted px-3 py-2.5 text-sm outline-none"
          />
          <button
            onClick={submit}
            disabled={send.isPending || !input.trim()}
            aria-label="Envoyer"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4 shadow-soft">
        <p className="text-sm font-bold">Historique des analyses</p>
        {(scans.data ?? []).length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Aucune analyse enregistrée pour le moment.</p>
        )}
        {(scans.data ?? []).map((s) => (
          <div key={s.id} className="mt-2 border-t border-border pt-2 first:border-0 first:pt-0">
            <p className="text-xs font-semibold">
              Santé {s.health_score}/100 · {s.findings_count} anomalie(s) · {timeAgo(s.created_at)}
            </p>
            <p className="text-[11px] text-muted-foreground">{s.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}
