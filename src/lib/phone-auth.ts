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

const DEFAULT_COUNTRY_CODE = "243";

/** Normalise un numéro au format international (+ suivi de chiffres). */
export function normalizePhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s().-]/g, "");
  if (!compact || /[^\d+]/.test(compact) || (compact.match(/\+/g)?.length ?? 0) > 1) return null;

  let digits = compact.replace(/\D/g, "");
  if (compact.startsWith("00")) digits = digits.slice(2);
  else if (!compact.startsWith("+")) {
    if (digits.startsWith("0")) digits = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
    else if (digits.length === 9) digits = `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
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
