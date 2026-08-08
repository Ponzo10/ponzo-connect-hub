import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { regenerateRecoveryCodes } from "@/lib/account-security.functions";

/** Génération et affichage des 10 codes de récupération du compte. */
export function RecoveryCodesCard() {
  const regenerate = useServerFn(regenerateRecoveryCodes);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-5 w-5 text-primary" /> Codes de récupération
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        10 codes à usage unique pour retrouver ton compte si tu oublies ton mot de passe. Ils sont stockés de façon
        chiffrée : personne, pas même PONZO, ne peut les relire. Générer une nouvelle série annule immédiatement
        l'ancienne.
      </p>
      {codes.length > 0 && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {codes.map((c) => (
              <span key={c} className="rounded-xl bg-muted px-2 py-2 text-center font-mono text-xs font-semibold">
                {c}
              </span>
            ))}
          </div>
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(codes.join("\n"));
              toast.success("Codes copiés");
            }}
            className="mt-2 w-full rounded-full border border-border py-2.5 text-xs font-semibold"
          >
            Copier les codes
          </button>
        </>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await regenerate();
            setCodes(result.codes);
            toast.success("Nouveaux codes générés — note-les maintenant.");
          } catch {
            toast.error("Génération impossible pour le moment.");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 w-full rounded-full bg-brand py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Génération…" : codes.length ? "Régénérer 10 nouveaux codes" : "Générer mes codes"}
      </button>
    </div>
  );
}
