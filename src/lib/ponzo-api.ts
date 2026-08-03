import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Post = Tables<"posts">;
export type Product = Tables<"products">;

export type FeedPost = Post & {
  author: Profile | null;
  post_likes: { user_id: string }[];
  post_comments: { id: string }[];
};

const AUTHOR = "author:profiles!posts_author_profile_fkey(*)";

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

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id)`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as FeedPost[];
}

export async function fetchPostsByAuthor(authorId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, ${AUTHOR}, post_likes(user_id), post_comments(id)`)
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

export type Message = Tables<"messages"> & { sender: Profile | null; recipient: Profile | null };

export async function fetchMessages(userId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "*, sender:profiles!messages_sender_profile_fkey(*), recipient:profiles!messages_recipient_profile_fkey(*)",
    )
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Message[];
}

export async function sendMessage(senderId: string, recipientId: string, body: string) {
  const { error } = await supabase.from("messages").insert({ sender_id: senderId, recipient_id: recipientId, body });
  if (error) throw error;
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
