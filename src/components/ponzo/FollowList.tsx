import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { Avatar } from "./Avatar";
import { asPerson, fetchFollowProfiles } from "@/lib/ponzo-api";

/** Feuille modale listant les abonnés ou les abonnements d'un membre. */
export function FollowList({
  userId,
  kind,
  onClose,
}: {
  userId: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const list = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () => fetchFollowProfiles(userId, kind),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[75vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface p-4 shadow-lift"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">{kind === "followers" ? "Abonnés" : "Abonnements"}</p>
          <button type="button" aria-label="Fermer" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {list.isLoading && <p className="py-6 text-center text-xs text-muted-foreground">Chargement…</p>}
        {!list.isLoading && (list.data ?? []).length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {kind === "followers" ? "Aucun abonné pour l'instant." : "Aucun abonnement pour l'instant."}
          </p>
        )}

        <ul className="space-y-1">
          {(list.data ?? []).map((p) => (
            <li key={p.id}>
              <Link
                to="/membre/$id"
                params={{ id: p.id }}
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted"
              >
                <Avatar person={asPerson(p)} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.role ?? p.handle ?? "Membre"}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
