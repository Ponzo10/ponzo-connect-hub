import { Check } from "lucide-react";
import { toast } from "sonner";

import { OFFLINE_LIMIT } from "@/lib/offline-videos";

/** Toast de succès animé : pastille verte qui « pop » puis coche qui apparaît. */
export function offlineSuccessToast(count: number) {
  toast.custom(
    () => (
      <div className="animate-scale-in flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 shadow-lift">
        <span className="animate-scale-in grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="animate-fade-in h-5 w-5" strokeWidth={3} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Vidéo sauvegardée pour hors-ligne</p>
          <p className="text-xs text-muted-foreground">
            {count} / {OFFLINE_LIMIT} vidéos enregistrées
          </p>
        </div>
      </div>
    ),
    { duration: 2600 },
  );
}
