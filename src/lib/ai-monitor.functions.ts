import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeMetrics, answerAdmin, collectMetrics } from "@/lib/ai-monitor.server";

/** Lance une analyse complète et enregistre le rapport + les anomalies détectées. */
export const runDiagnosticScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ trigger: z.string().default("manual") }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Accès réservé à l'équipe d'administration.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const metrics = await collectMetrics();
    const analysis = await analyzeMetrics(metrics);

    const { data: scan, error } = await supabaseAdmin
      .from("ai_scans")
      .insert({
        requested_by: context.userId,
        trigger: data.trigger,
        model: analysis.model,
        summary: analysis.summary,
        health_score: analysis.health_score,
        findings_count: analysis.findings.length,
        metrics: metrics as never,
      })
      .select("*")
      .single();
    if (error || !scan) throw new Error("Enregistrement du rapport impossible.");

    if (analysis.findings.length) {
      await supabaseAdmin
        .from("ai_findings")
        .insert(analysis.findings.map((f) => ({ ...f, scan_id: scan.id, evidence: {} as never })));
    }

    return { scanId: scan.id, summary: analysis.summary, healthScore: analysis.health_score, findings: analysis.findings.length };
  });

/** Conversation avec l'assistant : diagnostic et conseils, sans aucune modification. */
export const askAdminAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Accès réservé à l'équipe d'administration.");

    const metrics = await collectMetrics();
    const reply = await answerAdmin(data.messages, metrics);
    return { reply };
  });
