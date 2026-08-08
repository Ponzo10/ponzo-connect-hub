/**
 * Accès serveur à Lovable AI Gateway (API Responses).
 * La clé reste strictement côté serveur.
 */
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";

export const ASSISTANT_MODEL = "openai/gpt-5.6-sol";

type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

/** Appelle le modèle et renvoie le texte produit. */
export async function askGateway(messages: GatewayMessage[]): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Assistant indisponible : clé IA manquante.");

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: ASSISTANT_MODEL,
      input: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });

  if (response.status === 429) throw new Error("Trop de requêtes IA. Réessaie dans un instant.");
  if (response.status === 402) throw new Error("Crédits IA épuisés. Recharge ton espace de travail.");
  if (!response.ok) throw new Error(`Assistant indisponible (${response.status}).`);

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  const text = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Réponse IA vide.");
  return text;
}

/** Extrait un objet JSON d'une réponse textuelle éventuellement encadrée. */
export function parseJsonBlock<T>(text: string, fallback: T): T {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
