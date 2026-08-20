import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { Avatar } from "@/components/ponzo/Avatar";
import { UploadBar, uploadLabel } from "@/components/ponzo/UploadProgress";
import { useAuth } from "@/lib/auth";
import { asPerson } from "@/lib/ponzo-api";
import {
  getPreviewUrl,
  getQueueSnapshot,
  retryItem,
  removeItem,
  setPublishedCallback,
  startPublishQueue,
  subscribeQueue,
} from "@/lib/publish-queue";

const EMPTY: ReturnType<typeof getQueueSnapshot> = [];

export function usePublishQueue() {
  return useSyncExternalStore(subscribeQueue, getQueueSnapshot, () => EMPTY);
}

/** Démarre la file d'attente et rafraîchit le fil dès qu'une publication part. */
export function PublishQueueRunner() {
  const queryClient = useQueryClient();
  useEffect(() => {
    setPublishedCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    });
    startPublishQueue();
  }, [queryClient]);
  return null;
}

/** Publications en cours d'envoi, affichées en tête du fil. Aucun écran bloquant. */
export function PendingPosts() {
  const items = usePublishQueue();
  const { profile } = useAuth();
  if (items.length === 0) return null;

  return (
    <div className="space-y-3 px-3 sm:px-0">
      {items.map((item) => {
        const preview = getPreviewUrl(item.id);
        const failed = item.status === "failed";
        return (
          <article key={item.id} className="rounded-2xl bg-surface p-4 opacity-80 shadow-soft">
            <div className="flex items-center gap-3">
              <Avatar person={asPerson(profile)} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profile?.full_name ?? "Membre PONZO"}</p>
                <p className="text-[11px] text-muted-foreground" aria-live="polite">
                  {uploadLabel(item.status, item.progress)}
                </p>
              </div>
            </div>

            {item.body && <p className="mt-2 whitespace-pre-wrap text-[15px] text-muted-foreground">{item.body}</p>}

            {preview && (
              <div className="relative mt-2 overflow-hidden rounded-xl">
                {item.mediaType === "video" ? (
                  <video src={preview} muted playsInline className="max-h-72 w-full bg-black object-contain" />
                ) : (
                  <img src={preview} alt="" className="max-h-72 w-full object-cover" />
                )}
                {!failed && (
                  <div className="absolute inset-x-0 bottom-0 h-[2px] bg-muted">
                    <div
                      className="h-full bg-brand transition-[width] duration-200"
                      style={{ width: `${Math.max(4, Math.round(item.progress * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {failed && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => retryItem(item.id)}
                  className="rounded-full bg-destructive px-3 py-1.5 text-[11px] font-bold text-destructive-foreground"
                >
                  Réessayer
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-[11px] font-semibold text-muted-foreground"
                >
                  Supprimer
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
