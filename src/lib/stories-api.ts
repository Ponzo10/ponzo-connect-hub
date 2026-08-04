import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Profile } from "@/lib/ponzo-api";

export type Story = Tables<"stories"> & {
  author: Profile | null;
  story_likes: { user_id: string }[];
  story_views: { viewer_id: string }[];
  story_comments: { id: string }[];
};

export type StoryGroup = {
  authorId: string;
  author: Profile | null;
  stories: Story[];
  seen: boolean;
};

const SELECT =
  "*, author:profiles!stories_author_profile_fkey(*), story_likes(user_id), story_views(viewer_id), story_comments(id)";

export async function fetchStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(SELECT)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Story[];
}

export function groupStories(stories: Story[], userId: string | undefined): StoryGroup[] {
  const map = new Map<string, StoryGroup>();
  for (const s of stories) {
    const g = map.get(s.author_id) ?? {
      authorId: s.author_id,
      author: s.author,
      stories: [],
      seen: true,
    };
    g.stories.push(s);
    if (!userId || !s.story_views.some((v) => v.viewer_id === userId)) g.seen = false;
    map.set(s.author_id, g);
  }
  const groups = [...map.values()];
  // Les miennes en premier, puis les non vues.
  return groups.sort((a, b) => {
    if (a.authorId === userId) return -1;
    if (b.authorId === userId) return 1;
    return Number(a.seen) - Number(b.seen);
  });
}

export async function createStory(input: {
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string;
  allowShare?: boolean;
}) {
  const { error } = await supabase.from("stories").insert({
    author_id: input.authorId,
    media_url: input.mediaUrl,
    media_type: input.mediaType,
    caption: input.caption?.trim() || null,
    allow_share: input.allowShare ?? true,
  });
  if (error) throw error;
}

export async function deleteStory(id: string) {
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
}

export async function recordStoryView(storyId: string, viewerId: string) {
  await supabase.from("story_views").upsert({ story_id: storyId, viewer_id: viewerId }, { ignoreDuplicates: true });
}

export type StoryViewer = Tables<"story_views"> & { viewer: Profile | null };

export async function fetchStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const { data, error } = await supabase
    .from("story_views")
    .select("*, viewer:profiles!story_views_viewer_profile_fkey(*)")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as StoryViewer[];
}

export async function toggleStoryLike(storyId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from("story_likes").delete().eq("story_id", storyId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("story_likes").insert({ story_id: storyId, user_id: userId });
    if (error) throw error;
  }
}

export type StoryComment = Tables<"story_comments"> & { author: Profile | null };

export async function fetchStoryComments(storyId: string): Promise<StoryComment[]> {
  const { data, error } = await supabase
    .from("story_comments")
    .select("*, author:profiles!story_comments_author_profile_fkey(*)")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as StoryComment[];
}

export async function addStoryComment(storyId: string, authorId: string, body: string, parentId?: string | null) {
  const { error } = await supabase
    .from("story_comments")
    .insert({ story_id: storyId, author_id: authorId, body, parent_id: parentId ?? null });
  if (error) throw error;
}

export async function deleteStoryComment(id: string) {
  const { error } = await supabase.from("story_comments").delete().eq("id", id);
  if (error) throw error;
}
