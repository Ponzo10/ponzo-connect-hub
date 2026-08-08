/**
 * Outils partagés pour l'authentification par numéro de téléphone.
 *
 * PONZO crée les comptes téléphone sans SMS : le numéro normalisé sert
 * d'identifiant déterministe côté Supabase Auth. Le jour où la vérification
 * SMS/OTP sera activée, le numéro reste identique et les comptes, profils et
 * données existants sont conservés.
 */

/** Domaine interne réservé aux identifiants dérivés d'un numéro. */
export const PHONE_EMAIL_DOMAIN = "phone.ponzo.app";

/** Normalise un numéro au format international (+ suivi de chiffres). */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (!cleaned.startsWith("+") || digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Identifiant Supabase déterministe dérivé du numéro normalisé. */
export function phoneToEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`;
}

/** Vrai si l'identifiant du compte provient d'un numéro de téléphone. */
export function isPhoneAccount(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${PHONE_EMAIL_DOMAIN}`));
}

/** Masque un numéro pour l'affichage (+243 •• •• 1234). */
export function maskPhone(phone: string): string {
  return phone.length > 4 ? `${phone.slice(0, 4)}${"•".repeat(Math.max(0, phone.length - 8))}${phone.slice(-4)}` : phone;
}
