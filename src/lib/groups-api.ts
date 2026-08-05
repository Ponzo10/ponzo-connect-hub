import { supabase } from "@/integrations/supabase/client";

export type Group = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  is_public: boolean;
  created_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
};

export type GroupPerson = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  badge: string;
  verified: boolean;
  role: string | null;
};

export async function fetchGroups(userId: string) {
  const [mine, publics] = await Promise.all([
    supabase.from("group_members").select("group_id, role, groups(*)").eq("user_id", userId),
    supabase.from("groups").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(50),
  ]);
  if (mine.error) throw mine.error;
  if (publics.error) throw publics.error;

  const memberGroups = (mine.data ?? [])
    .map((row) => row.groups as unknown as Group | null)
    .filter((g): g is Group => !!g)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const memberIds = new Set(memberGroups.map((g) => g.id));
  const discover = (publics.data ?? []).filter((g) => !memberIds.has(g.id)) as Group[];

  return { memberGroups, discover };
}

export async function fetchGroup(groupId: string) {
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw error;
  return (data as Group | null) ?? null;
}

export async function createGroup(input: {
  ownerId: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  isPublic: boolean;
}) {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      photo_url: input.photoUrl ?? null,
      is_public: input.isPublic,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: data.id, user_id: input.ownerId, role: "owner" });
  if (memberError) throw memberError;

  return data as Group;
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await supabase.from("group_members").select("user_id, role").eq("group_id", groupId);
  if (error) throw error;
  const rows = data ?? [];
  const people = await fetchPeople(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, person: people[r.user_id] ?? null }));
}

export async function fetchPeople(ids: string[]): Promise<Record<string, GroupPerson>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, badge, verified, role")
    .in("id", unique);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.id, p as GroupPerson]));
}

export async function fetchGroupMessages(groupId: string) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  const rows = (data ?? []) as GroupMessage[];
  const people = await fetchPeople(rows.map((m) => m.sender_id));
  return rows.map((m) => ({ ...m, sender: people[m.sender_id] ?? null }));
}

export async function sendGroupMessage(input: {
  groupId: string;
  senderId: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}) {
  const { error } = await supabase.from("group_messages").insert({
    group_id: input.groupId,
    sender_id: input.senderId,
    body: input.body?.trim() ? input.body.trim() : null,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
  });
  if (error) throw error;
}

export async function deleteGroupMessage(id: string) {
  const { error } = await supabase.from("group_messages").delete().eq("id", id);
  if (error) throw error;
}
