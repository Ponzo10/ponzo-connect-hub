/**
 * Logique serveur des codes de récupération PONZO.
 * Les codes ne sont jamais stockés en clair : seule une empreinte SHA-256
 * salée par l'identifiant du compte est enregistrée en base.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Empreinte irréversible d'un code, liée à l'utilisateur. */
export async function hashCode(userId: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${code.toUpperCase().replace(/[^A-Z0-9]/g, "")}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Génère 10 codes uniques et cryptographiquement aléatoires. */
export function generateCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const raw = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    codes.add(`${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`);
  }
  return [...codes];
}
