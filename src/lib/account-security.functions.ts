import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePhone, phoneToEmail } from "@/lib/phone-auth";
import { generateCodes, hashCode } from "@/lib/recovery.server";

/** Régénère 10 codes de secours ; les anciens sont immédiatement invalidés. */
export const regenerateRecoveryCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const codes = generateCodes(10);
    const rows = await Promise.all(
      codes.map(async (code) => ({ user_id: userId, code_hash: await hashCode(userId, code) })),
    );
    await supabaseAdmin.from("recovery_codes").delete().eq("user_id", userId);
    const { error } = await supabaseAdmin.from("recovery_codes").insert(rows);
    if (error) throw new Error("Impossible de générer les codes de récupération.");
    return { codes };
  });

/** Réinitialise le mot de passe d'un compte téléphone avec un code de secours. */
export const resetPasswordWithRecoveryCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: z.string(), code: z.string(), newPassword: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Numéro invalide. Format attendu : +243900000000");
    if (data.newPassword.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = phoneToEmail(phone);
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((u) => u.email === email);
    if (!user) throw new Error("Aucun compte trouvé pour ce numéro.");

    const hash = await hashCode(user.id, data.code);
    const { data: row } = await supabaseAdmin
      .from("recovery_codes")
      .select("id")
      .eq("user_id", user.id)
      .eq("code_hash", hash)
      .is("used_at", null)
      .maybeSingle();
    if (!row) throw new Error("Code de récupération invalide ou déjà utilisé.");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.newPassword,
    });
    if (updateError) throw new Error("Réinitialisation impossible pour le moment.");
    await supabaseAdmin.from("recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    return { email };
  });
