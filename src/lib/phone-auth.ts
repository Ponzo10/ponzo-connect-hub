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

/** Indicatifs proposés à la saisie. Le premier est la valeur par défaut. */
export const COUNTRY_CODES = [
  { code: "243", label: "RD Congo", flag: "🇨🇩" },
  { code: "242", label: "Congo-Brazzaville", flag: "🇨🇬" },
  { code: "250", label: "Rwanda", flag: "🇷🇼" },
  { code: "257", label: "Burundi", flag: "🇧🇮" },
  { code: "256", label: "Ouganda", flag: "🇺🇬" },
  { code: "255", label: "Tanzanie", flag: "🇹🇿" },
  { code: "260", label: "Zambie", flag: "🇿🇲" },
  { code: "244", label: "Angola", flag: "🇦🇴" },
  { code: "237", label: "Cameroun", flag: "🇨🇲" },
  { code: "225", label: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "221", label: "Sénégal", flag: "🇸🇳" },
  { code: "223", label: "Mali", flag: "🇲🇱" },
  { code: "226", label: "Burkina Faso", flag: "🇧🇫" },
  { code: "229", label: "Bénin", flag: "🇧🇯" },
  { code: "228", label: "Togo", flag: "🇹🇬" },
  { code: "241", label: "Gabon", flag: "🇬🇦" },
  { code: "212", label: "Maroc", flag: "🇲🇦" },
  { code: "213", label: "Algérie", flag: "🇩🇿" },
  { code: "216", label: "Tunisie", flag: "🇹🇳" },
  { code: "20", label: "Égypte", flag: "🇪🇬" },
  { code: "27", label: "Afrique du Sud", flag: "🇿🇦" },
  { code: "234", label: "Nigéria", flag: "🇳🇬" },
  { code: "233", label: "Ghana", flag: "🇬🇭" },
  { code: "254", label: "Kenya", flag: "🇰🇪" },
  { code: "33", label: "France", flag: "🇫🇷" },
  { code: "32", label: "Belgique", flag: "🇧🇪" },
  { code: "41", label: "Suisse", flag: "🇨🇭" },
  { code: "351", label: "Portugal", flag: "🇵🇹" },
  { code: "34", label: "Espagne", flag: "🇪🇸" },
  { code: "39", label: "Italie", flag: "🇮🇹" },
  { code: "44", label: "Royaume-Uni", flag: "🇬🇧" },
  { code: "49", label: "Allemagne", flag: "🇩🇪" },
  { code: "1", label: "USA / Canada", flag: "🇺🇸" },
  { code: "55", label: "Brésil", flag: "🇧🇷" },
  { code: "86", label: "Chine", flag: "🇨🇳" },
  { code: "91", label: "Inde", flag: "🇮🇳" },
  { code: "971", label: "Émirats", flag: "🇦🇪" },
  { code: "90", label: "Turquie", flag: "🇹🇷" },
] as const;

export const DEFAULT_COUNTRY_CODE = "243";

const KNOWN_CODES = COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);

/**
 * Normalise un numéro au format international (+ suivi de chiffres).
 *
 * - `+…` ou `00…` : le numéro est déjà international, l'indicatif saisi fait foi
 *   (aucun pays n'est imposé).
 * - numéro local (`0…` ou chiffres seuls) : l'indicatif du pays sélectionné est
 *   appliqué. Par défaut la RDC, mais l'utilisateur peut choisir son pays.
 */
export function normalizePhone(raw: string, countryCode: string = DEFAULT_COUNTRY_CODE): string | null {
  const compact = raw.trim().replace(/[\s().\-\u2013\u2014]/g, "");
  if (!compact || /[^\d+]/.test(compact) || (compact.match(/\+/g)?.length ?? 0) > 1) return null;
  if (compact.includes("+") && !compact.startsWith("+")) return null;

  const dial = (countryCode || DEFAULT_COUNTRY_CODE).replace(/\D/g, "") || DEFAULT_COUNTRY_CODE;
  let digits = compact.replace(/\D/g, "");

  if (compact.startsWith("+")) {
    // Déjà international : on ne réécrit rien.
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `${dial}${digits.replace(/^0+/, "")}`;
  } else if (KNOWN_CODES.some((c) => digits.startsWith(c) && digits.length >= c.length + 6)) {
    // Numéro saisi avec son indicatif mais sans « + » : on le conserve tel quel.
  } else {
    digits = `${dial}${digits}`;
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
