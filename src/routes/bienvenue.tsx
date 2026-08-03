import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, ArrowRight, Chrome, Mail, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { PonzoLogo } from "@/components/ponzo/PonzoLogo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bienvenue")({
  head: () => ({
    meta: [
      { title: "Bienvenue sur PONZO — Créer un compte" },
      { name: "description", content: "Rejoins PONZO : inscription par e-mail ou téléphone, connexion Google et Apple, vérification sécurisée." },
      { property: "og:title", content: "Bienvenue sur PONZO" },
      { property: "og:description", content: "Connecte-toi. Crée. Construis. Rejoins la communauté PONZO." },
    ],
  }),
  component: Bienvenue,
});

const slides = [
  { title: "Connecte-toi", text: "Rejoins une communauté de professionnels, créateurs et entrepreneurs." },
  { title: "Crée", text: "Publie tes idées, tes vidéos et tes projets. Fais-toi remarquer." },
  { title: "Construis", text: "Trouve des collaborations, des clients et des opportunités concrètes." },
];

function Bienvenue() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"email" | "phone">("email");
  const onboarding = step < slides.length;
  const slide = slides[Math.min(step, slides.length - 1)]!;

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-10">
      <div className="flex justify-center pt-6">
        <PonzoLogo className="scale-125" />
      </div>

      {onboarding ? (
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-sm text-center">
            <div className="mx-auto mb-8 h-44 w-44 rounded-full bg-brand shadow-lift" />
            <h1 className="text-3xl font-extrabold">{slide.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{slide.text}</p>
            <div className="mt-6 flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-primary" : "w-1.5 bg-border")}
                />
              ))}
            </div>
            <button
              onClick={() => setStep((s) => s + 1)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift"
            >
              {step === slides.length - 1 ? "Commencer" : "Suivant"} <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={() => setStep(slides.length)} className="mt-3 text-xs font-semibold text-muted-foreground">
              Passer
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-2xl font-extrabold">Créer un compte</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vérification par e-mail ou SMS en un instant.</p>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
              {(["email", "phone"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold transition-colors",
                    mode === m ? "bg-surface text-primary shadow-soft" : "text-muted-foreground",
                  )}
                >
                  {m === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {m === "email" ? "E-mail" : "Téléphone"}
                </button>
              ))}
            </div>

            <input
              type={mode === "email" ? "email" : "tel"}
              placeholder={mode === "email" ? "vous@exemple.com" : "+221 77 000 00 00"}
              className="mt-4 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm shadow-soft outline-none placeholder:text-muted-foreground"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm shadow-soft outline-none placeholder:text-muted-foreground"
            />

            <Link
              to="/"
              className="mt-4 block rounded-full bg-brand py-3.5 text-center text-sm font-bold text-primary-foreground shadow-lift"
            >
              Continuer
            </Link>

            <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-surface py-3.5 text-sm font-semibold shadow-soft">
                <Chrome className="h-4 w-4" /> Continuer avec Google
              </button>
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3.5 text-sm font-semibold text-background">
                <Apple className="h-4 w-4" /> Continuer avec Apple
              </button>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Mot de passe oublié ? Récupération par e-mail ou SMS.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
