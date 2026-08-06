import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

/** Émojis de réaction rapides proposés sous chaque message. */
export const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡", "🙏", "🔥"] as const;

/** Stickers PONZO (emoji grand format, envoyés comme messages « sticker »). */
export const STICKERS = [
  "😀", "😍", "🤩", "😎", "🥳", "😭", "🤔", "😴",
  "👏", "🙌", "💪", "🤝", "🙏", "👀", "💯", "🔥",
  "❤️", "💚", "💛", "✨", "🎉", "⚽", "🍲", "🚀",
] as const;

export type MessageReaction = Tables<"message_reactions">;
export type ConversationSetting = Tables<"conversation_settings">;
export type BlockedUser = Tables<"blocked_users">;

/** Modifie le corps d'un message envoyé (expéditeur uniquement). */
export async function editMessage(messageId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

/** Supprime un message pour moi uniquement (il reste visible pour l'autre). */
export async function deleteMessageForMe(messageId: string, userId: string, currentDeletedFor: string[]) {
  const next = Array.from(new Set([...(currentDeletedFor ?? []), userId]));
  const { error } = await supabase.from("messages").update({ deleted_for: next }).eq("id", messageId);
  if (error) throw error;
}

/** Supprime un message pour tout le monde (expéditeur, dans un délai raisonnable). */
export async function deleteMessageForEveryone(messageId: string) {
  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), body: "", media_url: null, media_type: null })
    .eq("id", messageId);
  if (error) throw error;
}

/** Fenêtre autorisée pour supprimer pour tout le monde : 24 h. */
export const DELETE_FOR_EVERYONE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canDeleteForEveryone(createdAt: string, mine: boolean) {
  return mine && Date.now() - new Date(createdAt).getTime() < DELETE_FOR_EVERYONE_WINDOW_MS;
}

/** Ajoute/retire une réaction emoji sur un message. */
export async function toggleReaction(messageId: string, userId: string, emoji: string, active: boolean) {
  if (active) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("message_reactions")
    .insert({ message_id: messageId, user_id: userId, emoji });
  if (error) throw error;
}

/** Transfère des messages vers un ou plusieurs destinataires. */
export async function forwardMessages(
  senderId: string,
  recipientIds: string[],
  items: { body: string | null; media_url: string | null; media_type: string | null }[],
) {
  const rows = recipientIds.flatMap((recipient_id) =>
    items.map((m) => ({
      sender_id: senderId,
      recipient_id,
      body: m.body ?? "",
      media_url: m.media_url,
      media_type: m.media_type,
      forwarded: true,
    })),
  );
  if (rows.length === 0) return;
  const { error } = await supabase.from("messages").insert(rows);
  if (error) throw error;
}

/** Réglages (épinglé / archivé) de toutes mes conversations. */
export async function fetchConversationSettings(userId: string): Promise<ConversationSetting[]> {
  const { data, error } = await supabase.from("conversation_settings").select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function setConversationFlag(
  userId: string,
  peerId: string,
  patch: { pinned?: boolean; archived?: boolean },
) {
  const { error } = await supabase
    .from("conversation_settings")
    .upsert({ user_id: userId, peer_id: peerId, ...patch }, { onConflict: "user_id,peer_id" });
  if (error) throw error;
}

/** Membres que j'ai bloqués. */
export async function fetchBlocked(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_id);
}

export async function setBlocked(userId: string, peerId: string, blocked: boolean) {
  if (blocked) {
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: userId, blocked_id: peerId });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", peerId);
  if (error) throw error;
}

/** Copie un texte dans le presse-papiers (avec repli pour les vieux navigateurs). */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}
