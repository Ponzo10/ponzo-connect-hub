import { supabase } from "@/integrations/supabase/client";
import type { FeedPost } from "@/lib/ponzo-api";

export type TrendingHashtag = { id: string; tag: string; usage_count: number; recent_count: number };

export type TrendingPost = {
  id: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  score: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  save_count: number;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  allow_download?: boolean;
};

export type TrendingProduct = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image_url: string | null;
  city: string | null;
  shop_id: string | null;
  seller_name: string | null;
};

export type TrendingShop = {
  id: string;
  name: string;
  logo_url: string | null;
  city: string | null;
  product_count: number;
};

export type TrendingCreator = {
  id: string;
  full_name: string;
  handle: string | null;
  avatar_url: string | null;
  verified: boolean;
  badge: string;
  role: string | null;
  followers: number;
  new_followers: number;
  engagement: number;
};

export type TrendingOverview = {
  hashtags: TrendingHashtag[];
  videos: TrendingPost[];
  posts: TrendingPost[];
  products: TrendingProduct[];
  shops: TrendingShop[];
  creators: TrendingCreator[];
  generated_at: string;
};

export async function fetchTrending(limit = 12): Promise<TrendingOverview> {
  const { data, error } = await supabase.rpc("trending_overview", { _limit: limit });
  if (error) throw error;
  return data as unknown as TrendingOverview;
}

export type Hashtag = { id: string; tag: string; usage_count: number };

export async function searchHashtags(term = "", limit = 30): Promise<Hashtag[]> {
  const { data, error } = await supabase.rpc("search_hashtags", { _term: term, _limit: limit });
  if (error) throw error;
  return (data ?? []) as Hashtag[];
}

export function normalizeTag(tag: string) {
  return tag.replace(/#/g, "").trim().toLowerCase();
}

export function extractHashtags(text: string): string[] {
  const found = text.match(/#([A-Za-z0-9_À-ÿ]{2,50})/g) ?? [];
  return [...new Set(found.map((t) => normalizeTag(t)))];
}

/** Publications contenant un hashtag, enrichies de leur auteur et de leurs compteurs. */
export async function fetchHashtagPosts(tag: string): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc("hashtag_posts", { _tag: normalizeTag(tag), _limit: 60 });
  if (error) throw error;
  const ids = (data ?? []).map((p) => p.id);
  if (ids.length === 0) return [];
  const { data: posts, error: e2 } = await supabase
    .from("posts")
    .select(
      "*, author:profiles!posts_author_profile_fkey(*), post_likes(user_id), post_comments(id), post_saves(user_id)",
    )
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (e2) throw e2;
  return (posts ?? []) as unknown as FeedPost[];
}

/** Téléchargement fiable d'un média (garde la qualité d'origine). */
export async function downloadMedia(url: string, filename: string) {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error("Téléchargement impossible");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  } catch {
    // Repli : ouverture directe (WebView Android / iOS Safari)
    window.open(url, "_blank", "noopener");
  }
}
