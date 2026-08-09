import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Liste des corrections exécutables (catalogue fermé), pour l'interface admin. */
export const listRemediationActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Accès réservé à l'équipe d'administration.");
    const { REMEDIATION_ACTIONS } = await import("@/lib/ai-remediation.server");
    return REMEDIATION_ACTIONS.map(({ key, label, plan, areas, sensitive }) => ({ key, label, plan, areas, sensitive }));
  });

/**
 * Exécute UNE correction du catalogue, uniquement après autorisation explicite
 * de l'administrateur. Les actions sensibles exigent une seconde confirmation.
 */
export const executeRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        findingId: z.string().uuid(),
        actionKey: z.string().min(1).max(80),
        confirmSensitive: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Accès réservé à l'équipe d'administration.");

    const { findAction } = await import("@/lib/ai-remediation.server");
    const action = findAction(data.actionKey);
    if (!action) throw new Error("Action inconnue : exécution refusée.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. L'autorisation doit exister en base : l'IA ne peut pas s'autoriser elle-même.
    const { data: finding, error: findingError } = await supabaseAdmin
      .from("ai_findings")
      .select("*")
      .eq("id", data.findingId)
      .maybeSingle();
    if (findingError || !finding) throw new Error("Anomalie introuvable.");
    if (finding.status !== "authorized") throw new Error("Cette correction n'a pas été autorisée.");

    // 2. Contrôle de cohérence : l'action doit correspondre au domaine de l'anomalie.
    const area = (finding.area ?? "").toLowerCase();
    if (area && !action.areas.some((a) => area.includes(a) || a.includes(area))) {
      throw new Error("La correction proposée ne correspond pas au problème détecté.");
    }

    // 3. Double confirmation pour les opérations sensibles.
    if (action.sensitive && !data.confirmSensitive) {
      return { requiresConfirmation: true as const, plan: action.plan, label: action.label };
    }

    let result;
    try {
      result = await action.run({ admin: supabaseAdmin });
    } catch (error) {
      result = {
        applied: "Aucune modification appliquée (échec).",
        targets: action.label,
        tests: [],
        outcome: "failed" as const,
        detail: error instanceof Error ? error.message : "Erreur inconnue.",
        recommendations: "Opération interrompue : aucune autre modification n'a été tentée.",
      };
    }

    // 4. Traçabilité systématique.
    await supabaseAdmin.from("ai_remediations").insert({
      finding_id: finding.id,
      action_key: action.key,
      authorized_by: context.userId,
      confirmed_sensitive: action.sensitive ? data.confirmSensitive : false,
      problem: finding.title,
      cause: finding.cause,
      applied: result.applied,
      targets: result.targets,
      tests: result.tests as never,
      outcome: result.outcome,
      detail: result.detail,
      recommendations: result.recommendations,
    });

    await supabaseAdmin
      .from("ai_findings")
      .update({ status: result.outcome === "resolved" ? "resolved" : "authorized" })
      .eq("id", finding.id);

    return { requiresConfirmation: false as const, label: action.label, ...result };
  });
