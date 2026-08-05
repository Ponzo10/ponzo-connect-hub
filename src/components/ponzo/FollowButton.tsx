import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { notify, toggleFollow } from "@/lib/ponzo-api";
import { cn } from "@/lib/utils";

export function FollowButton({
  targetId,
  initialFollowing,
  size = "md",
  className,
}: {
  targetId: string;
  initialFollowing?: boolean | undefined;
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: ["following", user?.id ?? "anon", targetId],
    enabled: !!user && user.id !== targetId,
    initialData: initialFollowing,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user!.id)
        .eq("following_id", targetId)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  const following = !!status.data;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("auth");
      await toggleFollow(user.id, targetId, following);
      if (!following) {
        await notify({
          userId: targetId,
          actorId: user.id,
          kind: "follow",
          body: `${profile?.full_name ?? "Un membre"} vous suit désormais.`,
          entityId: user.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["following", user?.id ?? "anon", targetId], !following);
      void queryClient.invalidateQueries({ queryKey: ["follow-counts"] });
    },
    onError: () => toast.error("Action impossible pour le moment."),
  });

  if (!user || user.id === targetId) return null;

  return (
    <button
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition-colors disabled:opacity-60",
        size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-xs",
        following
          ? "border border-border bg-background text-muted-foreground"
          : "bg-brand text-primary-foreground shadow-soft",
        className,
      )}
    >
      {following ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {following ? "Abonné" : "Suivre"}
    </button>
  );
}
