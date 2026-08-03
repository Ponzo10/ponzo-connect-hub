import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PonzoLogo } from "@/components/ponzo/PonzoLogo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search['redirect'] === "string" ? (search['redirect'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion — PONZO" },
      { name: "description", content: "Connecte-toi ou crée ton compte PONZO pour publier, échanger et développer ton réseau professionnel." },
      { property: "og:title", content: "Connexion — PONZO" },
      { property: "og:description", content: "Rejoins la communauté PONZO : opportunités, services et projets." },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const target = safePath(search.redirect);

  useEffect(() => {
    if (user) void navigate({ to: target, replace: true });
  }, [user, navigate, target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName || email.split("@")[0], role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Compte créé — confirme ton adresse e-mail pour continuer.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bienvenue sur PONZO 👋");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Connexion Google impossible pour le moment.");
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center pb-6">
          <PonzoLogo />
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-lift">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full py-2 transition-colors",
                  mode === m ? "bg-brand text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {m === "signin" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          {sent ? (
            <p className="rounded-2xl bg-primary-soft p-4 text-sm text-primary">
              Vérifie ta boîte mail : un lien de confirmation t'a été envoyé à {email}.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <>
                  <Field label="Nom complet" value={fullName} onChange={setFullName} placeholder="Amina Diallo" />
                  <Field label="Métier" value={role} onChange={setRole} placeholder="Designer produit • Dakar" />
                </>
              )}
              <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="toi@exemple.com" required />
              <Field
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                required
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground shadow-lift disabled:opacity-50"
              >
                {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
              </button>
            </form>
          )}

          <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={google}
            className="w-full rounded-full border border-border bg-background py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Continuer avec Google
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
