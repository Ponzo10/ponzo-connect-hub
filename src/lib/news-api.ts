import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

import type { Profile } from "./ponzo-api";

export type NewsArticle = Tables<"news_articles">;

export type NewsItem = NewsArticle & {
  news_likes: { user_id: string }[];
  news_comments: { id: string }[];
  news_saves: { user_id: string }[];
};

export type NewsComment = Tables<"news_comments"> & { author: Profile | null };

export const NEWS_CATEGORIES = [
  "Tout",
  "Politique",
  "Économie",
  "Sport",
  "Technologie",
  "Santé",
  "Culture",
  "Divertissement",
  "Monde",
] as const;

const SELECT = "*, news_likes(user_id), news_comments(id), news_saves(user_id)";

export function newsDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export async function fetchNews(opts: { category?: string; search?: string; limit?: number } = {}): Promise<NewsItem[]> {
  let q = supabase
    .from("news_articles")
    .select(SELECT)
    // Tri strictement chronologique : la dernière actualité publiée arrive en tête.
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.category && opts.category !== "Tout") q = q.eq("category", opts.category);
  if (opts.search) {
    const s = opts.search.replace(/[%,]/g, " ");
    q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%,source.ilike.%${s}%,category.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as NewsItem[];
}

export async function fetchNewsArticle(id: string): Promise<NewsItem | null> {
  const { data, error } = await supabase.from("news_articles").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as unknown as NewsItem) ?? null;
}

export async function fetchSavedNews(userId: string): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from("news_saves")
    .select(`article:news_articles(${SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { article: NewsItem | null }[])
    .map((r) => r.article)
    .filter((a): a is NewsItem => !!a);
}

export async function toggleNewsLike(articleId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from("news_likes").delete().eq("article_id", articleId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("news_likes").insert({ article_id: articleId, user_id: userId });
    if (error) throw error;
  }
}

export async function toggleNewsSave(articleId: string, userId: string, saved: boolean) {
  if (saved) {
    const { error } = await supabase.from("news_saves").delete().eq("article_id", articleId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("news_saves").insert({ article_id: articleId, user_id: userId });
    if (error) throw error;
  }
}

async function bump(articleId: string, field: "view" | "share" | "repost") {
  const { error } = await supabase.rpc("increment_news_counter", { _article_id: articleId, _field: field });
  if (error) throw error;
}

export const viewNews = (id: string) => bump(id, "view");
export const shareNewsCount = (id: string) => bump(id, "share");

export async function shareNews(article: NewsArticle) {
  const url = `${window.location.origin}/actualite/${article.id}`;
  try {
    if (navigator.share) await navigator.share({ title: article.title, text: article.summary ?? "", url });
    else await navigator.clipboard.writeText(url);
  } catch {
    /* annulé par l'utilisateur */
  }
  await bump(article.id, "share");
}

export async function repostNews(article: NewsArticle, userId: string) {
  const body = `📰 ${article.title}\n\n${article.summary ?? ""}\n\nSource : ${article.source}`.trim();
  const { error } = await supabase.from("posts").insert({
    author_id: userId,
    body,
    tag: "Actualité",
    media_type: article.image_url ? "image" : null,
    media_url: article.image_url,
  });
  if (error) throw error;
  await bump(article.id, "repost");
}

export async function fetchNewsComments(articleId: string): Promise<NewsComment[]> {
  const { data, error } = await supabase
    .from("news_comments")
    .select("*, author:profiles(*)")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as NewsComment[];
}

export async function addNewsComment(articleId: string, authorId: string, body: string, parentId?: string | null) {
  const { error } = await supabase
    .from("news_comments")
    .insert({ article_id: articleId, author_id: authorId, body, parent_id: parentId ?? null });
  if (error) throw error;
}

export async function updateNewsComment(id: string, body: string) {
  const { error } = await supabase.from("news_comments").update({ body }).eq("id", id);
  if (error) throw error;
}

export async function deleteNewsComment(id: string) {
  const { error } = await supabase.from("news_comments").delete().eq("id", id);
  if (error) throw error;
}
