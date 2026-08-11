import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PonzoLogo } from "@/components/ponzo/PonzoLogo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { regenerateRecoveryCodes, resetPasswordWithRecoveryCode } from "@/lib/account-security.functions";
import { logSecurityEvent } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { normalizePhone, phoneToEmail } from "@/lib/phone-auth";
import { cn } from "@/lib/utils";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search['redirect'] === "string" ? (search['redirect'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion — PONZO" },
      {
        name: "description",
        content:
          "Crée ton compte PONZO en quelques secondes avec ton numéro de téléphone, ton e-mail, Google ou Apple, et développe ton réseau professionnel.",
      },
      { property: "og:title", content: "Connexion — PONZO" },
      { property: "og:description", content: "Rejoins la communauté PONZO : opportunités, services et projets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

type Step = "form" | "confirm" | "codes" | "recover";

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [recoveryCode, setRecoveryCode] = useState("");

  const { user } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const target = safePath(search.redirect);

  const makeCodes = useServerFn(regenerateRecoveryCodes);
  const resetWithCode = useServerFn(resetPasswordWithRecoveryCode);

  useEffect(() => {
    if (user && step !== "codes") void navigate({ to: target, replace: true });
  }, [user, navigate, target, step]);

  const failure = (message: string, subject: string) => {
    void logSecurityEvent({ kind: "auth_failure", severity: "warning", title: "Échec de connexion", detail: message, subject });
    toast.error(message);
  };

  /** Connexion / inscription par e-mail. */
  const submitEmail = async () => {
    if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName || email.split("@")[0], role } },
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
  };

  /** Connexion par numéro + mot de passe (sans SMS). */
  const signInPhone = async () => {
    const cleaned = normalizePhone(phone);
    if (!cleaned) throw new Error("Saisis un numéro valide, ex. 0990000000 ou +243990000000");
    const { error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(cleaned), password });
    if (error) throw new Error("Numéro ou mot de passe incorrect.");
    toast.success("Bienvenue sur PONZO 👋");
  };

  /** Création définitive du compte téléphone, après confirmation des informations. */
  const createPhoneAccount = async () => {
    const cleaned = normalizePhone(phone);
    if (!cleaned) throw new Error("Saisis un numéro valide, ex. 0990000000 ou +243990000000");
    const { data, error } = await supabase.auth.signUp({
      email: phoneToEmail(cleaned),
      password,
      options: { data: { full_name: fullName || `Membre ${cleaned.slice(-4)}`, role, phone: cleaned } },
    });
    if (error) {
      if (/registered|exists/i.test(error.message)) {
        throw new Error("Ce numéro est déjà associé à un compte. Connecte-toi plutôt.");
      }
      throw error;
    }
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(cleaned),
        password,
      });
      if (signInError) throw new Error("Ce numéro est déjà associé à un compte. Connecte-toi plutôt.");
    }
    await supabase.from("profiles").update({ phone: cleaned }).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    const result = await makeCodes();
    setCodes(result.codes);
    setPassword("");
    setStep("codes");
    toast.success("Compte créé 🎉 Conserve tes codes de récupération.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (channel === "email") await submitEmail();
      else if (mode === "signup") {
        const cleaned = normalizePhone(phone);
        if (!cleaned) throw new Error("Saisis un numéro valide, ex. 0990000000 ou +243990000000");
        if (password.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");
        setStep("confirm");
      } else await signInPhone();
    } catch (error) {
      failure(
        error instanceof Error ? error.message : "Une erreur est survenue",
        channel === "email" ? email.trim().toLowerCase() : phone.trim(),
      );
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) toast.error(`Connexion ${provider === "google" ? "Google" : "Apple"} impossible pour le moment.`);
  };

  const recover = async () => {
    setBusy(true);
    try {
      const result = await resetWithCode({ data: { phone, code: recoveryCode, newPassword: password } });
      const { error } = await supabase.auth.signInWithPassword({ email: result.email, password });
      if (error) throw error;
      toast.success("Mot de passe réinitialisé ✅");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réinitialisation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center pb-6">
          <PonzoLogo />
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-lift">
          {step === "codes" ? (
            <div className="space-y-3">
              <h1 className="text-base font-bold">Tes 10 codes de récupération</h1>
              <p className="text-xs text-muted-foreground">
                Note-les et garde-les en lieu sûr. Chaque code ne fonctionne qu'une seule fois et permet de
                réinitialiser ton mot de passe si tu l'oublies.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {codes.map((c) => (
                  <span key={c} className="rounded-xl bg-muted px-2 py-2 text-center font-mono text-xs font-semibold">
                    {c}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(codes.join("\n"));
                  toast.success("Codes copiés");
                }}
                className="w-full rounded-full border border-border py-2.5 text-sm font-semibold"
              >
                Copier les codes
              </button>
              <button
                type="button"
                onClick={() => void navigate({ to: target, replace: true })}
                className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground"
              >
                J'ai noté mes codes, continuer
              </button>
            </div>
          ) : step === "confirm" ? (
            <div className="space-y-3">
              <h1 className="text-base font-bold">Vérifiez vos informations avant de créer votre compte</h1>
              <div className="space-y-2 rounded-2xl bg-muted p-3 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Numéro de téléphone</p>
                  <p className="font-semibold">{normalizePhone(phone) ?? phone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">Mot de passe</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono font-semibold">{showPassword ? password : "•".repeat(password.length)}</p>
                    <button
                      type="button"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowPassword((v) => !v)}
                      className="grid h-9 w-9 place-items-center rounded-full bg-surface"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="rounded-full border border-border py-3 text-sm font-semibold"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await createPhoneAccount();
                    } catch (error) {
                      failure(error instanceof Error ? error.message : "Création impossible", phone);
                      setStep("form");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-full bg-brand py-3 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "Création…" : "Tout est correct, créer mon compte"}
                </button>
              </div>
            </div>
          ) : step === "recover" ? (
            <div className="space-y-3">
              <h1 className="text-base font-bold">Réinitialiser mon mot de passe</h1>
              <p className="text-xs text-muted-foreground">
                Saisis ton numéro, l'un de tes codes de récupération et ton nouveau mot de passe.
              </p>
               <Field label="Numéro de téléphone" type="tel" value={phone} onChange={setPhone} placeholder="099 000 00 00" />
              <Field label="Code de récupération" value={recoveryCode} onChange={setRecoveryCode} placeholder="ABCD-EFGH-JKLM" />
              <PasswordField
                label="Nouveau mot de passe (6 caractères min.)"
                value={password}
                onChange={setPassword}
                visible={showPassword}
                toggle={() => setShowPassword((v) => !v)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void recover()}
                className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Un instant…" : "Réinitialiser"}
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full text-center text-xs font-semibold text-muted-foreground underline"
              >
                Retour
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setSent(false);
                    }}
                    className={cn(
                      "rounded-full py-2 transition-colors",
                      mode === m ? "bg-brand text-primary-foreground" : "text-muted-foreground",
                    )}
                  >
                    {m === "signin" ? "Connexion" : "Inscription"}
                  </button>
                ))}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border p-1 text-xs font-semibold">
                {(["phone", "email"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setChannel(c);
                      setSent(false);
                    }}
                    className={cn(
                      "rounded-full py-2 transition-colors",
                      channel === c ? "bg-primary-soft text-primary" : "text-muted-foreground",
                    )}
                  >
                    {c === "phone" ? "Téléphone" : "E-mail"}
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

                  {channel === "email" ? (
                    <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="toi@exemple.com" required />
                  ) : (
                    <Field
                      label="Numéro de téléphone"
                      type="tel"
                      value={phone}
                      onChange={setPhone}
                       placeholder="099 000 00 00"
                      required
                    />
                  )}

                  <PasswordField
                    label="Mot de passe (6 caractères min.)"
                    value={password}
                    onChange={setPassword}
                    visible={showPassword}
                    toggle={() => setShowPassword((v) => !v)}
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground shadow-lift disabled:opacity-50"
                  >
                    {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Continuer"}
                  </button>

                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (channel === "phone") {
                          setStep("recover");
                          return;
                        }
                        if (!email) {
                          toast.error("Saisis d'abord ton adresse e-mail.");
                          return;
                        }
                        const { error } = await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/parametres`,
                        });
                        if (error) toast.error(error.message);
                        else toast.success("E-mail de récupération envoyé.");
                      }}
                      className="w-full text-center text-xs font-semibold text-muted-foreground underline"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </form>
              )}

              <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void oauth("google")}
                  className="w-full rounded-full border border-border bg-background py-3 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Continuer avec Google
                </button>
                <button
                  type="button"
                  onClick={() => void oauth("apple")}
                  className="w-full rounded-full border border-border bg-foreground py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                   Continuer avec Apple
                </button>
              </div>
            </>
          )}
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

function PasswordField({
  label,
  value,
  onChange,
  visible,
  toggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  toggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          required
          placeholder="••••••"
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-11 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
