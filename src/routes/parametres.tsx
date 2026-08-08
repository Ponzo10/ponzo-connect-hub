import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BookMarked,
  ChevronDown,
  FileText,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  Moon,
  Shield,
  ShieldCheck,
  Store,
  Trash2,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RecoveryCodesCard } from "@/components/ponzo/RecoveryCodesCard";

import { AppShell } from "@/components/ponzo/AppShell";
import { BADGES, BadgePreview } from "@/components/ponzo/Badge3D";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LOCALES, useI18n } from "@/lib/i18n";
import { reportContent, updateProfile } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — PONZO" },
      {
        name: "description",
        content: "Compte, badges, sécurité, langue, thème, confidentialité, notifications et aide sur PONZO.",
      },
      { property: "og:title", content: "Paramètres — PONZO" },
      { property: "og:description", content: "Gère ton compte, ta sécurité et tes préférences PONZO." },
    ],
  }),
  component: Parametres,
});

function usePref(key: string, initial: boolean) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) setValue(stored === "1");
  }, [key]);
  const update = (next: boolean) => {
    setValue(next);
    window.localStorage.setItem(key, next ? "1" : "0");
  };
  return [value, update] as const;
}

function Toggle({ checked, onChange, label, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 p-4 last:border-0">
      <span className="flex items-center gap-3 text-sm font-medium">
        {icon}
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("h-7 w-12 shrink-0 rounded-full p-1 transition-colors", checked ? "bg-primary" : "bg-muted")}
      >
        <span className={cn("block h-5 w-5 rounded-full bg-surface transition-transform", checked && "translate-x-5")} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-soft">{children}</div>
    </section>
  );
}

function Expandable({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        {icon}
        <span className="truncate text-sm">{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
}

function Parametres() {
  const { user, profile, isStaff, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();

  const showOnline = (profile as { show_online?: boolean } | null)?.show_online ?? true;
  const showLastSeen = (profile as { show_last_seen?: boolean } | null)?.show_last_seen ?? true;

  const savePrivacy = async (patch: Record<string, boolean>) => {
    if (!user) return;
    try {
      await updateProfile(user.id, patch);
      await refreshProfile();
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveFailed"));
    }
  };

  const chooseLanguage = async (code: (typeof LOCALES)[number]["code"]) => {
    await setLocale(code);
    await refreshProfile();
    toast.success(t("settings.languageSaved"));
  };

  const [dark, setDark] = usePref("ponzo:dark", false);
  const [notifPush, setNotifPush] = usePref("ponzo:notif-push", true);
  const [notifEmail, setNotifEmail] = usePref("ponzo:notif-email", false);
  const [privateAccount, setPrivateAccount] = usePref("ponzo:private", false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [savingBadge, setSavingBadge] = useState(false);
  const allowDownload = profile?.allow_photo_download ?? true;
  const allowVideoDownload = profile?.allow_video_download ?? true;

  const toggleVideoDownload = async (value: boolean) => {
    if (!user) return;
    try {
      await updateProfile(user.id, { allow_video_download: value });
      await refreshProfile();
      toast.success(value ? "Téléchargement de tes vidéos autorisé" : "Téléchargement de tes vidéos désactivé");
    } catch {
      toast.error("Modification impossible pour le moment.");
    }
  };

  const toggleDownload = async (value: boolean) => {
    if (!user) return;
    try {
      await updateProfile(user.id, { allow_photo_download: value });
      await refreshProfile();
      toast.success(value ? "Téléchargement de tes photos autorisé" : "Téléchargement de tes photos désactivé");
    } catch {
      toast.error("Modification impossible pour le moment.");
    }
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    setEmail(user?.email ?? "");
    setPhone(profile?.phone ?? "");
  }, [user?.email, profile?.phone]);

  const chooseBadge = async (kind: string) => {
    if (!user) return;
    setSavingBadge(true);
    try {
      await updateProfile(user.id, { badge: kind });
      await refreshProfile();
      toast.success("Badge mis à jour");
    } catch {
      toast.error("Impossible de changer le badge.");
    } finally {
      setSavingBadge(false);
    }
  };

  const saveEmail = async () => {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) toast.error(error.message);
    else toast.success("Vérifie ta boîte mail pour confirmer la nouvelle adresse.");
  };

  const savePhone = async () => {
    if (!user) return;
    try {
      await updateProfile(user.id, { phone });
      await refreshProfile();
      toast.success("Numéro enregistré");
    } catch {
      toast.error("Enregistrement impossible.");
    }
  };

  const savePassword = async () => {
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      setPassword("");
      toast.success("Mot de passe mis à jour");
    }
  };

  const requestDeletion = async () => {
    if (!user) return;
    if (!window.confirm("Demander la suppression définitive de ton compte PONZO ?")) return;
    try {
      await reportContent(user.id, "account_deletion", user.id, "Demande de suppression de compte");
      toast.success("Demande envoyée. Ton compte sera supprimé sous 48 h.");
    } catch {
      toast.error("Demande impossible pour le moment.");
    }
  };

  return (
    <AppShell title={t("settings.title")}>
      <div className="space-y-5 px-3 pt-4">
        <Section title={t("settings.appearance")}>
          <Toggle checked={dark} onChange={setDark} label={t("settings.dark")} icon={<Moon className="h-5 w-5 text-primary" />} />
          <Toggle
            checked={notifPush}
            onChange={setNotifPush}
            label={t("settings.notifInApp")}
            icon={<Bell className="h-5 w-5 text-primary" />}
          />
          <Toggle
            checked={notifEmail}
            onChange={setNotifEmail}
            label={t("settings.notifEmail")}
            icon={<Bell className="h-5 w-5 text-primary" />}
          />
          <Toggle
            checked={allowDownload}
            onChange={(v) => void toggleDownload(v)}
            label={t("settings.allowPhoto")}
            icon={<Shield className="h-5 w-5 text-primary" />}
          />
          <Toggle
            checked={allowVideoDownload}
            onChange={(v) => void toggleVideoDownload(v)}
            label={t("settings.allowVideo")}
            icon={<Shield className="h-5 w-5 text-primary" />}
          />
          <Toggle
            checked={privateAccount}
            onChange={setPrivateAccount}
            label={t("settings.private")}
            icon={<Shield className="h-5 w-5 text-primary" />}
          />
        </Section>

        <Section title={t("settings.languageSection")}>
          <div className="flex items-center gap-3 border-b border-border/60 p-4">
            <Globe className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t("settings.language")}</span>
              <span className="block text-[11px] text-muted-foreground">{t("settings.languageHint")}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => void chooseLanguage(l.code)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border-2 p-3 text-left text-sm font-semibold transition-colors",
                  locale === l.code ? "border-primary bg-primary-soft/50" : "border-transparent bg-muted",
                )}
              >
                <span className="text-lg">{l.flag}</span>
                <span className="truncate">{l.label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title={t("settings.privacy")}>
          <Toggle
            checked={showOnline}
            onChange={(v) => void savePrivacy({ show_online: v })}
            label={t("settings.showOnline")}
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
          />
          <Toggle
            checked={showLastSeen}
            onChange={(v) => void savePrivacy({ show_last_seen: v })}
            label={t("settings.showLastSeen")}
            icon={<ShieldCheck className="h-5 w-5 text-primary" />}
          />
        </Section>

        <Section title="Mon badge">
          <div className="grid grid-cols-2 gap-2 p-3">
            {BADGES.map((b) => {
              const active = (profile?.badge ?? "none") === b.kind;
              return (
                <button
                  key={b.kind}
                  disabled={savingBadge}
                  onClick={() => void chooseBadge(b.kind)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
                    active ? "border-primary bg-primary-soft/50" : "border-transparent bg-muted",
                  )}
                >
                  <BadgePreview kind={b.kind} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{b.label}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{b.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="px-4 pb-4 text-[11px] text-muted-foreground">
            Tous les badges sont gratuits et visibles à côté de ton nom.
          </p>
        </Section>

        <Section title="Compte">
          <Link to="/profil" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border/60 p-4">
            <UserCog className="h-5 w-5 text-primary" />
            <span className="text-sm">Modifier le profil, la photo et la couverture</span>
          </Link>
          <Link to="/favoris" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border/60 p-4">
            <BookMarked className="h-5 w-5 text-primary" />
            <span className="text-sm">Publications enregistrées</span>
          </Link>
          <Link to="/boutique" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border/60 p-4">
            <Store className="h-5 w-5 text-primary" />
            <span className="text-sm">Ma boutique</span>
          </Link>
          {isStaff && (
            <Link to="/admin" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border/60 p-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm">Espace administrateur</span>
            </Link>
          )}

          <div className="space-y-2 border-b border-border/60 p-4">
            <label className="text-xs font-semibold text-muted-foreground">Adresse e-mail</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
              />
              <button onClick={saveEmail} className="rounded-xl bg-brand px-3 text-xs font-bold text-primary-foreground">
                OK
              </button>
            </div>
          </div>

          <div className="space-y-2 border-b border-border/60 p-4">
            <label className="text-xs font-semibold text-muted-foreground">Numéro de téléphone</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
              />
              <button onClick={savePhone} className="rounded-xl bg-brand px-3 text-xs font-bold text-primary-foreground">
                OK
              </button>
            </div>
          </div>

          <div className="space-y-2 p-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" /> Nouveau mot de passe
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
              />
              <button onClick={savePassword} className="rounded-xl bg-brand px-3 text-xs font-bold text-primary-foreground">
                OK
              </button>
            </div>
          </div>
        </Section>

        <Section title="Sécurité du compte">
          <RecoveryCodesCard />
        </Section>

        <Section title="Assistance et informations">
          <Expandable icon={<HelpCircle className="h-5 w-5 text-primary" />} label="Centre d'aide">
            Besoin d'aide ? Écris-nous depuis la messagerie ou signale un contenu directement depuis le menu « … » d'une
            publication. Notre équipe répond sous 24 h.
          </Expandable>
          <Expandable icon={<FileText className="h-5 w-5 text-primary" />} label="Signaler un problème">
            Utilise l'option « Signaler » présente sur chaque publication, profil ou produit. Chaque signalement est
            enregistré et traité par la modération PONZO.
          </Expandable>
          <Expandable icon={<Info className="h-5 w-5 text-primary" />} label="À propos de PONZO">
            PONZO est le réseau social professionnel qui connecte membres, créateurs, vendeurs et entrepreneurs :
            publications, vidéos, messagerie, boutiques et opportunités.
          </Expandable>
          <Expandable icon={<FileText className="h-5 w-5 text-primary" />} label="Conditions d'utilisation">
            En utilisant PONZO, tu t'engages à publier des contenus légaux, à respecter les autres membres et à ne pas
            utiliser la plateforme à des fins de spam ou de fraude.
          </Expandable>
          <Expandable icon={<Shield className="h-5 w-5 text-primary" />} label="Politique de confidentialité">
            Tes données sont protégées : accès restreint par des règles de sécurité, contenus privés réservés à leur
            propriétaire, messages accessibles uniquement aux participants, et journal d'activité pour la modération.
          </Expandable>
        </Section>

        <div className="space-y-2 pb-4">
          <button
            onClick={async () => {
              await signOut();
              void navigate({ to: "/bienvenue", search: {}, replace: true });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface py-3.5 text-sm font-semibold shadow-soft"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
          <button
            onClick={requestDeletion}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Supprimer le compte
          </button>
        </div>
      </div>
    </AppShell>
  );
}
