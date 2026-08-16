import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    // Le profil et les rôles ne sont chargés qu'une seule fois par utilisateur :
    // avant, l'évènement de session initiale et `getSession()` déclenchaient
    // deux paires de requêtes identiques au démarrage.
    let loadedFor: string | null = null;

    const loadProfile = async (userId: string | undefined, force = false) => {
      if (!userId) {
        loadedFor = null;
        if (active) {
          setProfile(null);
          setRoles([]);
        }
        return;
      }
      if (!force && loadedFor === userId) return;
      loadedFor = userId;
      const [{ data }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!active) return;
      setProfile(data ?? null);
      setRoles((roleRows ?? []).map((r) => r.role as string));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      const changedUser = loadedFor !== null && next?.user.id !== loadedFor;
      setSession(next);
      setLoading(false);
      void loadProfile(next?.user.id, event === "USER_UPDATED");
      // Changement réel de compte : on repart d'un cache propre.
      if (changedUser && next?.user.id) void queryClient.invalidateQueries();
      // Un rafraîchissement de jeton (très fréquent) ne doit plus vider tout le
      // cache : cela relançait toutes les requêtes de l'application.
      if (event === "SIGNED_OUT") queryClient.clear();
      else if (event === "USER_UPDATED") void queryClient.invalidateQueries();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      void loadProfile(data.session?.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      roles,
      isOwner: roles.includes("owner"),
      isAdmin: roles.includes("owner") || roles.includes("admin"),
      isStaff: roles.some((r) => r === "owner" || r === "admin" || r === "moderator"),
      loading,
      refreshProfile: async () => {
        const id = session?.user.id;
        if (!id) return;
        const [{ data }, { data: roleRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", id),
        ]);
        setProfile(data ?? null);
        setRoles((roleRows ?? []).map((r) => r.role as string));
      },
      signOut: async () => {
        await queryClient.cancelQueries();
        queryClient.clear();
        await supabase.auth.signOut();
      },
    }),
    [session, profile, roles, loading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
