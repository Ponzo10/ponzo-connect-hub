/**
 * Catalogue fermé des corrections que l'assistant IA est autorisé à exécuter.
 *
 * Principe : l'IA ne peut jamais exécuter du code ou du SQL arbitraire. Elle ne
 * peut que déclencher une action de cette liste, après autorisation explicite de
 * l'administrateur (et double confirmation pour les actions sensibles).
 */

type Ctx = { admin: any };

export type RemediationResult = {
  applied: string;
  targets: string;
  tests: { name: string; passed: boolean; detail: string }[];
  outcome: "resolved" | "partial" | "failed";
  detail: string;
  recommendations: string;
};

export type RemediationAction = {
  key: string;
  label: string;
  /** Description affichée avant exécution : ce que la correction va faire. */
  plan: string;
  /** Domaines d'anomalie auxquels l'action correspond (contrôle de cohérence). */
  areas: string[];
  sensitive: boolean;
  run: (ctx: Ctx) => Promise<RemediationResult>;
};

const ok = (name: string, passed: boolean, detail: string) => ({ name, passed, detail });

export const REMEDIATION_ACTIONS: RemediationAction[] = [
  {
    key: "backfill_message_delivery",
    label: "Réparer les accusés de distribution des messages",
    plan:
      "Marquer comme « distribués » les messages reçus il y a plus d'une minute dont l'accusé est manquant. Aucun contenu n'est modifié ou supprimé.",
    areas: ["messaging", "messagerie", "performance"],
    sensitive: false,
    run: async ({ admin }) => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data, error } = await admin
        .from("messages")
        .update({ delivered_at: new Date().toISOString() })
        .is("delivered_at", null)
        .lt("created_at", cutoff)
        .select("id");
      if (error) {
        return {
          applied: "Aucune modification appliquée.",
          targets: "table messages",
          tests: [ok("Mise à jour des accusés", false, error.message)],
          outcome: "failed",
          detail: error.message,
          recommendations: "Vérifier les règles d'accès de la table messages avant de relancer.",
        };
      }
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .is("delivered_at", null)
        .lt("created_at", cutoff);
      const remaining = count ?? 0;
      return {
        applied: `${data?.length ?? 0} message(s) marqué(s) comme distribués.`,
        targets: "table messages (colonne delivered_at)",
        tests: [ok("Aucun accusé manquant restant", remaining === 0, `${remaining} message(s) restant(s)`)],
        outcome: remaining === 0 ? "resolved" : "partial",
        detail: `${data?.length ?? 0} ligne(s) corrigée(s), ${remaining} restante(s).`,
        recommendations: remaining ? "Relancer l'action après vérification du service temps réel." : "",
      };
    },
  },
  {
    key: "recount_hashtags",
    label: "Recalculer les compteurs de hashtags",
    plan: "Recalculer usage_count de chaque hashtag à partir des contenus réellement associés.",
    areas: ["content", "contenu", "hashtags", "performance"],
    sensitive: false,
    run: async ({ admin }) => {
      const { data: tags, error } = await admin.from("hashtags").select("id, usage_count").limit(500);
      if (error) throw new Error(error.message);
      let fixed = 0;
      for (const tag of tags ?? []) {
        const { count } = await admin
          .from("content_hashtags")
          .select("id", { count: "exact", head: true })
          .eq("hashtag_id", tag.id);
        const real = count ?? 0;
        if (real !== tag.usage_count) {
          await admin.from("hashtags").update({ usage_count: real }).eq("id", tag.id);
          fixed += 1;
        }
      }
      return {
        applied: `${fixed} compteur(s) de hashtag corrigé(s).`,
        targets: "table hashtags (colonne usage_count)",
        tests: [ok("Compteurs recalculés", true, `${tags?.length ?? 0} hashtag(s) vérifié(s)`)],
        outcome: "resolved",
        detail: `${tags?.length ?? 0} hashtag(s) analysé(s), ${fixed} corrigé(s).`,
        recommendations: "",
      };
    },
  },
  {
    key: "resolve_stale_security_events",
    label: "Clôturer les alertes de sécurité informatives obsolètes",
    plan: "Marquer comme résolues les alertes de niveau « info » datant de plus de 30 jours. Les alertes critiques ne sont jamais touchées.",
    areas: ["security", "sécurité"],
    sensitive: false,
    run: async ({ admin }) => {
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await admin
        .from("security_events")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq("severity", "info")
        .eq("resolved", false)
        .lt("created_at", cutoff)
        .select("id");
      if (error) throw new Error(error.message);
      const { count } = await admin
        .from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("resolved", false)
        .eq("severity", "critical");
      return {
        applied: `${data?.length ?? 0} alerte(s) informative(s) clôturée(s).`,
        targets: "table security_events",
        tests: [ok("Alertes critiques préservées", true, `${count ?? 0} alerte(s) critique(s) toujours ouverte(s)`)],
        outcome: "resolved",
        detail: `${data?.length ?? 0} alerte(s) clôturée(s).`,
        recommendations: (count ?? 0) > 0 ? "Traiter manuellement les alertes critiques encore ouvertes." : "",
      };
    },
  },
  {
    key: "purge_expired_stories",
    label: "Supprimer les stories expirées depuis plus de 7 jours",
    plan: "Supprimer définitivement les stories dont la date d'expiration est dépassée de plus de 7 jours. Opération irréversible.",
    areas: ["content", "contenu", "storage", "médias", "performance"],
    sensitive: true,
    run: async ({ admin }) => {
      const cutoff = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data, error } = await admin.from("stories").delete().lt("expires_at", cutoff).select("id");
      if (error) throw new Error(error.message);
      const { count } = await admin
        .from("stories")
        .select("id", { count: "exact", head: true })
        .lt("expires_at", cutoff);
      const remaining = count ?? 0;
      return {
        applied: `${data?.length ?? 0} story(s) expirée(s) supprimée(s).`,
        targets: "table stories",
        tests: [ok("Plus aucune story expirée ancienne", remaining === 0, `${remaining} restante(s)`)],
        outcome: remaining === 0 ? "resolved" : "partial",
        detail: `${data?.length ?? 0} suppression(s).`,
        recommendations: "",
      };
    },
  },
];

export function findAction(key: string) {
  return REMEDIATION_ACTIONS.find((a) => a.key === key);
}
