import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Post = Tables<"posts">;
export type Product = Tables<"products">;

export type FeedPost = Post & {
  author: Profile | null;
  post_likes: { user_id: string }[];
  post_comments: { id: string }[];
  post_saves: { user_id: string }[];
  /** Compteurs agrégés côté base (évite de rapatrier toutes les lignes). */
  like_count?: number;
  comment_count?: number;
  save_count?: number;
};

const PROFILE_FIELDS = "id,full_name,handle,role,bio,city,avatar_url,cover_url,verified,created_at,updated_at,badge,follower_boost,title,allow_photo_download,allow_video_download,language,last_seen_at,show_online,show_last_seen";
const AUTHOR = `author:profiles!posts_author_profile_fkey(${PROFILE_FIELDS})`;

export const tones = ["green", "gold", "teal", "sand"] as const;
export type Tone = (typeof tones)[number];

export function toneFor(id: string | null | undefined): Tone {
  if (!id) return "green";
  let sum = 0;
  for (const c of id) sum += c.charCodeAt(0);
  return tones[sum % tones.length]!;
}

export function asPerson(profile: Profile | null | undefined, fallback = "Membre PONZO") {
  return {
    name: profile?.full_name ?? fallback,
    tone: toneFor(profile?.id),
    src: profile?.avatar_url ?? null,
  };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export const FEED_PAGE_SIZE = 15;

/**
 * Fil paginé par curseur (created_at). Charger 15 publications à la fois garde
 * l'affichage initial rapide même quand la base grossit.
 */
export async function fetchFeed(
  cursor?: string | null,
  limit = FEED_PAGE_SIZE,
  userId?: string | null,
): Promise<FeedPost[]> {
  // Optimisation clé du fil : on ne rapatrie plus toutes les lignes de likes /
  // commentaires / enregistrements (une publication virale en compte des
  // milliers), seulement leurs compteurs agrégés + mes propres lignes.
  let query = supabase
    .from("posts")
    .select(
      `*, ${AUTHOR}, likes:post_likes(count), comments:post_comments(count), saves:post_saves(count),` +
        ` mine_likes:post_likes(user_id), mine_saves:post_saves(user_id)`,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt("created_at", cursor);
  if (userId) {
    query = query.eq("mine_likes.user_id", userId).eq("mine_saves.user_id", userId);
  }
  const { data, error } = await query;
  if (error) throw error;

  type Row = Record<string, unknown> & {
    likes?: { count: number }[];
    comments?: { count: number }[];
    saves?: { count: number }[];
    mine_likes?: { user_id: string }[];
    mine_saves?: { user_id: string }[];
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const { likes, comments, saves, mine_likes, mine_saves, ...post } = row;
    return {
      ...post,
      like_count: likes?.[0]?.count ?? 0,
      comment_count: comments?.[0]?.count ?? 0,
      save_count: saves?.[0]?.count ?? 0,
      post_likes: userId ? (mine_likes ?? []) : [],
      post_comments: [],
      post_saves: userId ? (mine_saves ?? []) : [],
    } as unknown as FeedPost;
  });
}


export async function fetchPostsByAuthor(authorId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id), post_saves(user_id)`)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export type Comment = Tables<"post_comments"> & { author: Profile | null };

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("*, author:profiles!comments_author_profile_fkey(*)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(postId: string, authorId: string, body: string) {
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, author_id: authorId, body });
  if (error) throw error;
}

export async function fetchProfiles(search?: string): Promise<Profile[]> {
  let q = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50);
  if (search) q = q.or(`full_name.ilike.%${search}%,handle.ilike.%${search}%,role.ilike.%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export type ProductWithSeller = Product & { seller: Profile | null };

export async function fetchProducts(category?: string): Promise<ProductWithSeller[]> {
  let q = supabase
    .from("products")
    .select("*, seller:profiles!products_seller_profile_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (category && category !== "Tout") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithSeller[];
}

export type MessageQuote = { id: string; body: string; sender_id: string; media_type: string | null } | null;

export type Message = Tables<"messages"> & {
  sender: Profile | null;
  recipient: Profile | null;
  reply_to: MessageQuote;
  message_reactions: { user_id: string; emoji: string }[];
};

const MESSAGE_SELECT =
  "*, sender:profiles!messages_sender_profile_fkey(*), recipient:profiles!messages_recipient_profile_fkey(*), reply_to:messages!reply_to_id(id, body, sender_id, media_type), message_reactions(user_id, emoji)";

export async function fetchMessages(userId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Message[];
}

/** Insère un message et renvoie la ligne complète pour un affichage immédiat. */
/** UUID sûr (crypto.randomUUID absent de certains WebView Android). */
function newMessageId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[(Math.floor(Math.random() * 4) + 8)]!;
    else out += hex[Math.floor(Math.random() * 16)]!;
  }
  return out;
}

/** Trace technique d'un échec d'envoi (sans le contenu du message). */
function logSendFailure(meta: Record<string, unknown>) {
  void trackEvent({ kind: "error", name: "message_send_fail", metadata: meta });
}

/**
 * Envoie un message avec réessais idempotents.
 *
 * L'identifiant est généré côté client : un réessai après une coupure réseau
 * réutilise le même id, donc un message déjà enregistré n'est jamais dupliqué
 * (il est simplement relu). Écrire → Enregistrer → Distribuer reste garanti.
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string,
  replyToId?: string | null,
  messageId?: string,
): Promise<Message> {
  const id = messageId ?? newMessageId();
  const row = { id, sender_id: senderId, recipient_id: recipientId, body, reply_to_id: replyToId ?? null };
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from("messages").insert(row).select(MESSAGE_SELECT).single();
    if (!error && data) return data as unknown as Message;
    lastError = error;

    // Doublon : le message est bien passé lors d'une tentative précédente.
    if (error?.code === "23505") {
      const existing = await supabase.from("messages").select(MESSAGE_SELECT).eq("id", id).maybeSingle();
      if (existing.data) return existing.data as unknown as Message;
    }

    logSendFailure({
      message_id: id,
      sender_id: senderId,
      recipient_id: recipientId,
      attempt: attempt + 1,
      stage: "insert",
      code: error?.code ?? null,
      error: error?.message?.slice(0, 200) ?? null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
    });

    if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }

  throw lastError instanceof Error ? lastError : new Error("Envoi du message impossible");
}

export type Notification = Tables<"notifications"> & { actor: Profile | null };

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*, actor:profiles!notifications_actor_profile_fkey(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as Notification[];
}

export async function notify(params: {
  userId: string;
  actorId: string;
  kind: string;
  body: string;
  entityId?: string | null;
}) {
  if (params.userId === params.actorId) return;
  await supabase.from("notifications").insert({
    user_id: params.userId,
    actor_id: params.actorId,
    kind: params.kind,
    body: params.body,
    entity_id: params.entityId ?? null,
  });
}

export async function fetchFollowing(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.following_id);
}

export async function toggleFollow(followerId: string, followingId: string, following: boolean) {
  if (following) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("follows").insert({ follower_id: followerId, following_id: followingId });
    if (error) throw error;
  }
}

export async function fetchFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function createProduct(input: {
  sellerId: string;
  title: string;
  description?: string;
  price: number;
  category?: string;
  city?: string;
  imageUrl?: string;
}) {
  const { error } = await supabase.from("products").insert({
    seller_id: input.sellerId,
    title: input.title,
    description: input.description ?? null,
    price: input.price,
    category: input.category ?? null,
    city: input.city ?? null,
    image_url: input.imageUrl || null,
  });
  if (error) throw error;
}

export async function markNotificationsRead(userId: string) {
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}

export async function markConversationRead(userId: string, peerId: string) {
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("sender_id", peerId)
    .is("read_at", null);
}

export type Conversation = {
  peer: Profile | null;
  peerId: string;
  last: Message;
  unread: number;
};

export function buildConversations(messages: Message[], userId: string): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const m of messages) {
    const peerId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    const peer = m.sender_id === userId ? m.recipient : m.sender;
    const current = map.get(peerId);
    const unread = (current?.unread ?? 0) + (m.recipient_id === userId && !m.read_at ? 1 : 0);
    map.set(peerId, { peerId, peer: peer ?? current?.peer ?? null, last: m, unread });
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime(),
  );
}

export async function searchPosts(term: string): Promise<FeedPost[]> {
  let q = supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id), post_saves(user_id)`)
    .order("created_at", { ascending: false })
    .limit(30);
  if (term) q = q.ilike("body", `%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function searchProducts(term: string): Promise<ProductWithSeller[]> {
  let q = supabase
    .from("products")
    .select("*, seller:profiles!products_seller_profile_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (term) q = q.ilike("title", `%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithSeller[];
}

export function formatPrice(price: number, currency: string) {
  return `${new Intl.NumberFormat("fr-FR").format(price)} ${currency}`;
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------- Saves / partages / gestion des publications ----------

export async function toggleSave(postId: string, userId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_saves").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function fetchSavedPosts(userId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase.from("post_saves").select("post_id").eq("user_id", userId);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.post_id);
  if (ids.length === 0) return [];
  const { data: posts, error: e2 } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id), post_saves(user_id)`)
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (e2) throw e2;
  return (posts ?? []) as unknown as FeedPost[];
}

export async function sharePost(postId: string) {
  const { data, error } = await supabase.rpc("increment_share", { _post_id: postId });
  if (error) throw error;
  return data as number;
}

export async function updatePost(id: string, patch: { body?: string; tag?: string | null }) {
  const { error } = await supabase.from("posts").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function createPost(input: {
  authorId: string;
  body: string;
  tag?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}) {
  // randomUUID / crypto peuvent manquer dans certains WebView Android. L'ID reste
  // un UUID valide afin que l'upsert idempotent puisse être repris sans doublon.
  const bytes = new Uint8Array(16);
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
  } catch {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const row = {
    id,
    author_id: input.authorId,
    body: input.body,
    tag: input.tag ?? null,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase.from("posts").upsert(row, { onConflict: "id" });
    if (!error) return id;

    const { data: existing } = await supabase.from("posts").select("id").eq("id", id).maybeSingle();
    if (existing) return id;
    lastError = error;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
  }
  throw lastError ?? new Error("Publication non enregistrée");
}

// ---------- Commentaires imbriqués ----------

export async function addReply(postId: string, authorId: string, body: string, parentId: string | null) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: authorId, body, parent_id: parentId });
  if (error) throw error;
}

export async function updateComment(id: string, body: string) {
  const { error } = await supabase
    .from("post_comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Messagerie avec médias ----------

export async function sendMedia(
  senderId: string,
  recipientId: string,
  body: string,
  mediaUrl: string | null,
  mediaType: string,
  replyToId?: string | null,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      media_url: mediaUrl,
      media_type: mediaType,
      reply_to_id: replyToId ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as Message;
}

export async function unreadCounts(userId: string) {
  const [notifs, msgs] = await Promise.all([
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("messages").select("*", { count: "exact", head: true }).eq("recipient_id", userId).is("read_at", null),
  ]);
  return { notifications: notifs.count ?? 0, messages: msgs.count ?? 0 };
}

// ---------- Boutiques ----------

export type Shop = Tables<"shops">;

export async function fetchShops(search?: string): Promise<Shop[]> {
  let q = supabase.from("shops").select("*").order("created_at", { ascending: false }).limit(50);
  if (search) q = q.ilike("name", `%${search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchShop(id: string): Promise<Shop | null> {
  const { data, error } = await supabase.from("shops").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyShop(ownerId: string): Promise<Shop | null> {
  const { data, error } = await supabase.from("shops").select("*").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertShop(ownerId: string, patch: Partial<Shop> & { name: string }) {
  const existing = await fetchMyShop(ownerId);
  if (existing) {
    const { error } = await supabase.from("shops").update(patch).eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase
    .from("shops")
    .insert({ ...patch, owner_id: ownerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchShopProducts(shopId: string): Promise<ProductWithSeller[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, seller:profiles!products_seller_profile_fkey(*)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProductWithSeller[];
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Signalements & rôles ----------

export async function reportContent(reporterId: string, entityType: string, entityId: string, reason: string) {
  const { error } = await supabase
    .from("reports")
    .insert({ reporter_id: reporterId, entity_type: entityType, entity_id: entityId, reason });
  if (error) throw error;
}

export type Report = Tables<"reports">;

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function updateReportStatus(id: string, status: string) {
  const { error } = await supabase.from("reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchMyRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((r) => r.role as string);
}

export async function setUserRole(userId: string, role: "owner" | "admin" | "moderator" | "user", grant: boolean) {
  const { error } = await supabase.rpc("set_user_role", { _user_id: userId, _role: role, _grant: grant });
  if (error) throw error;
}

export async function fetchAllRoles() {
  const { data, error } = await supabase.from("user_roles").select("user_id, role");
  if (error) throw error;
  return data ?? [];
}

// ---------- Statistiques admin ----------

export async function fetchAppStats() {
  const tables = ["profiles", "posts", "post_comments", "products", "shops", "messages", "reports"] as const;
  const results = await Promise.all(
    tables.map((t) => supabase.from(t).select("*", { count: "exact", head: true })),
  );
  const out: Record<string, number> = {};
  tables.forEach((t, i) => (out[t] = results[i]?.count ?? 0));
  return out;
}

export type ActivityRow = Tables<"activity_log">;

export async function fetchActivityLog(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function broadcastNotification(actorId: string, body: string) {
  const { data, error } = await supabase.from("profiles").select("id").limit(1000);
  if (error) throw error;
  const rows = (data ?? [])
    .filter((p) => p.id !== actorId)
    .map((p) => ({ user_id: p.id, actor_id: actorId, kind: "system", body }));
  if (rows.length === 0) return 0;
  const { error: e2 } = await supabase.from("notifications").insert(rows);
  if (e2) throw e2;
  return rows.length;
}

export function displayFollowers(count: number, profile?: Profile | null) {
  const total = count + (profile?.follower_boost ?? 0);
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(total % 1_000_000 === 0 ? 0 : 1)} M+`;
  if (total >= 1000) return `${(total / 1000).toFixed(total % 1000 === 0 ? 0 : 1)} k`;
  return String(total);
}

// ---------- Vidéos ----------

export async function fetchVideoPosts(): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id), post_saves(user_id)`)
    .eq("media_type", "video")
    .not("media_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function incrementView(postId: string) {
  const { data } = await supabase.rpc("increment_view", { _post_id: postId });
  return (data as number | null) ?? 0;
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id), post_saves(user_id)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as FeedPost | null;
}

/** Marque comme distribués tous les messages reçus par l'utilisateur connecté. */
export async function markMessagesDelivered() {
  await supabase.rpc("mark_messages_delivered");
}

/** Met à jour la présence (dernière activité) de l'utilisateur connecté. */
export async function touchPresence() {
  await supabase.rpc("touch_presence");
}

export type Presence = { online: boolean; last_seen: string | null };

/** Présence d'un membre, filtrée par ses réglages de confidentialité. */
export async function fetchPresence(userId: string): Promise<Presence> {
  const { data, error } = await supabase.rpc("presence_of", { _user_id: userId });
  if (error) throw error;
  return (data as unknown as Presence) ?? { online: false, last_seen: null };
}

/** Nom de canal temps réel stable pour une conversation entre deux membres. */
export function conversationChannel(a: string, b: string) {
  return `dm:${[a, b].sort().join(":")}`;
}
