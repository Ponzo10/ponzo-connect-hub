import { supabase } from "@/integrations/supabase/client";

export type Group = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  rules: string | null;
  photo_url: string | null;
  is_public: boolean;
  who_can_send: string;
  who_can_edit_info: string;
  who_can_invite: string;
  created_at: string;
};

export type Reaction = { message_id: string; user_id: string; emoji: string };

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  reply_to_id: string | null;
  mentions: string[];
  pinned: boolean;
  is_announcement: boolean;
  forwarded: boolean;
  deleted_at: string | null;
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

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: string;
  notifications_muted: boolean;
  last_seen_at: string;
  person: GroupPerson | null;
};

export type JoinRequest = {
  id: string;
  group_id: string;
  user_id: string;
  status: string;
  created_at: string;
  person: GroupPerson | null;
};

export async function fetchGroups(userId: string) {
  const [mine, publics, requests] = await Promise.all([
    supabase.from("group_members").select("group_id, role, groups(*)").eq("user_id", userId),
    supabase.from("groups").select("*").order("created_at", { ascending: false }).limit(60),
    supabase.from("group_join_requests").select("group_id, status").eq("user_id", userId),
  ]);
  if (mine.error) throw mine.error;
  if (publics.error) throw publics.error;

  const memberGroups = (mine.data ?? [])
    .map((row) => row.groups as unknown as Group | null)
    .filter((g): g is Group => !!g)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const memberIds = new Set(memberGroups.map((g) => g.id));
  const discover = ((publics.data ?? []) as Group[]).filter((g) => !memberIds.has(g.id));
  const pending = new Set((requests.data ?? []).filter((r) => r.status === "pending").map((r) => r.group_id));

  return { memberGroups, discover, pending };
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
  rules?: string | null;
  photoUrl?: string | null;
  isPublic: boolean;
}) {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      rules: input.rules ?? null,
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

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, "name" | "description" | "rules" | "photo_url" | "is_public" | "who_can_send" | "who_can_edit_info" | "who_can_invite">>,
) {
  const { error } = await supabase.from("groups").update(patch).eq("id", groupId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function joinGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function requestJoin(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_join_requests")
    .upsert({ group_id: groupId, user_id: userId, status: "pending" }, { onConflict: "group_id,user_id" });
  if (error) throw error;
}

export async function fetchJoinRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as Omit<JoinRequest, "person">[];
  const people = await fetchPeople(rows.map((r) => r.user_id));
  return rows.map((r) => ({ ...r, person: people[r.user_id] ?? null }));
}

export async function respondJoinRequest(request: { id: string; group_id: string; user_id: string }, accept: boolean) {
  if (accept) await joinGroup(request.group_id, request.user_id);
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status: accept ? "accepted" : "refused" })
    .eq("id", request.id);
  if (error) throw error;
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(groupId: string, userId: string) {
  return leaveGroup(groupId, userId);
}

export async function setMemberRole(groupId: string, userId: string, role: "admin" | "member") {
  const { error } = await supabase.from("group_members").update({ role }).eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function setMuted(groupId: string, userId: string, muted: boolean) {
  const { error } = await supabase
    .from("group_members")
    .update({ notifications_muted: muted })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function touchPresence(groupId: string, userId: string) {
  await supabase
    .from("group_members")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("group_id", groupId)
    .eq("user_id", userId);
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, user_id, role, notifications_muted, last_seen_at")
    .eq("group_id", groupId);
  if (error) throw error;
  const rows = (data ?? []) as Omit<GroupMember, "person">[];
  const people = await fetchPeople(rows.map((r) => r.user_id));
  return rows
    .map((r) => ({ ...r, person: people[r.user_id] ?? null }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.role === "admin" ? -1 : 1));
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

export async function searchPeople(query: string): Promise<GroupPerson[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, badge, verified, role")
    .ilike("full_name", `%${term}%`)
    .limit(15);
  if (error) throw error;
  return (data ?? []) as GroupPerson[];
}

export type FullMessage = GroupMessage & {
  sender: GroupPerson | null;
  reactions: Reaction[];
  replyTo: { id: string; body: string | null; media_type: string | null; author: string } | null;
};

export async function fetchGroupMessages(groupId: string): Promise<FullMessage[]> {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(400);
  if (error) throw error;
  const rows = (data ?? []) as GroupMessage[];
  const people = await fetchPeople(rows.map((m) => m.sender_id));

  let reactions: Reaction[] = [];
  if (rows.length) {
    const { data: reactionRows } = await supabase
      .from("group_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", rows.map((m) => m.id));
    reactions = (reactionRows ?? []) as Reaction[];
  }

  const byId = new Map(rows.map((m) => [m.id, m]));

  return rows.map((m) => {
    const parent = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
    return {
      ...m,
      sender: people[m.sender_id] ?? null,
      reactions: reactions.filter((r) => r.message_id === m.id),
      replyTo: parent
        ? {
            id: parent.id,
            body: parent.body,
            media_type: parent.media_type,
            author: people[parent.sender_id]?.full_name ?? "Membre",
          }
        : null,
    };
  });
}

export async function sendGroupMessage(input: {
  groupId: string;
  senderId: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  replyToId?: string | null;
  mentions?: string[];
  isAnnouncement?: boolean;
  forwarded?: boolean;
}) {
  const { error } = await supabase.from("group_messages").insert({
    group_id: input.groupId,
    sender_id: input.senderId,
    body: input.body?.trim() ? input.body.trim() : null,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
    reply_to_id: input.replyToId ?? null,
    mentions: input.mentions ?? [],
    is_announcement: input.isAnnouncement ?? false,
    forwarded: input.forwarded ?? false,
  });
  if (error) throw error;

  const targets = input.mentions ?? [];
  if (targets.length) {
    await supabase.from("notifications").insert(
      targets
        .filter((t) => t !== input.senderId)
        .map((t) => ({
          user_id: t,
          actor_id: input.senderId,
          kind: "group_mention",
          body: "t'a mentionné dans un groupe",
          entity_id: input.groupId,
        })),
    );
  }
}

export async function deleteForEveryone(id: string) {
  const { error } = await supabase
    .from("group_messages")
    .update({ deleted_at: new Date().toISOString(), body: null, media_url: null, media_type: null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteGroupMessage(id: string) {
  const { error } = await supabase.from("group_messages").delete().eq("id", id);
  if (error) throw error;
}

export async function togglePin(id: string, pinned: boolean) {
  const { error } = await supabase.from("group_messages").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji = "❤️", active = false) {
  if (active) {
    const { error } = await supabase
      .from("group_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("group_message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== "23505") throw error;
}
