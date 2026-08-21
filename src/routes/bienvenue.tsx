import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, Rocket, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { PonzoMark } from "@/components/ponzo/PonzoLogo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/bienvenue")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bienvenue sur PONZO — Réseau social professionnel" },
      {
        name: "description",
        content: "Rejoins PONZO : publie, échange, vends et développe ton réseau professionnel en toute sécurité.",
      },
      { property: "og:title", content: "Bienvenue sur PONZO" },
      { property: "og:description", content: "Rejoins la communauté PONZO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Bienvenue,
});

const slides = [
  { title: "Connecte-toi", text: "Rejoins une communauté de professionnels, créateurs et entrepreneurs.", icon: Users },
  { title: "Crée", text: "Publie tes idées, tes photos, tes vidéos et tes projets.", icon: Rocket },
  { title: "Construis", text: "Vends, collabore et développe ton activité en toute sécurité.", icon: ShieldCheck },
];

function safePath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function Bienvenue() {
  const [step, setStep] = useState(0);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/bienvenue" });
  const target = safePath(search.redirect);
  const slide = slides[Math.min(step, slides.length - 1)]!;
  const Icon = slide.icon;

  useEffect(() => {
    if (!loading && user) void navigate({ to: target, replace: true });
  }, [loading, user, navigate, target]);

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-10">
      <div className="flex flex-col items-center pt-8">
        <PonzoMark size={112} />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-primary">PONZO</h1>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto w-full max-w-sm text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary-soft text-primary">
            <Icon className="h-9 w-9" />
          </span>
          <h2 className="mt-5 text-2xl font-extrabold">{slide.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{slide.text}</p>

          <div className="mt-6 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 rounded-full transition-all", i === step ? "w-6 bg-primary" : "w-1.5 bg-border")}
              />
            ))}
          </div>

          {step < slides.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/auth"
              search={{ redirect: target }}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-primary-foreground shadow-lift"
            >
              Commencer <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <Link
            to="/auth"
            search={{ redirect: target }}
            className="mt-3 block text-xs font-semibold text-muted-foreground"
          >
            J'ai déjà un compte — Se connecter
          </Link>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Un compte est nécessaire pour accéder au contenu PONZO.
          </p>
        </div>
      </div>
    </div>
  );
}
