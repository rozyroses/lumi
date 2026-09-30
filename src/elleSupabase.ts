import { createClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yrammmjnviozydebshbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ecQn0VjaNhnsJR_Kys_Efg_z-CQvzin";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type ElleProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  is_verified: boolean;
  role_label: string;
};

export type ElleReplyRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profile: ElleProfileRow | null;
};

export type ElleFeedPostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profile: ElleProfileRow | null;
  likes: number;
  reposts: number;
  replies: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
};

export type ElleNotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string;
  kind: "like" | "repost" | "reply" | "follow";
  post_id: string | null;
  reply_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: ElleProfileRow | null;
  post_body: string | null;
};

export type ElleDmMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ElleDmConversationRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  other_profile: ElleProfileRow | null;
  last_message: ElleDmMessageRow | null;
  unread_count: number;
};

export type ElleSocialSnapshot = {
  posts: ElleFeedPostRow[];
  replies: ElleReplyRow[];
  followingIds: string[];
  followingCount: number;
  followerCount: number;
  profiles: ElleProfileRow[];
};

export function normalizeElleUsername(value: string, fallback = "elleuser") {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
  const safe = cleaned || fallback;
  return safe.length >= 3 ? safe : (safe + "elle").slice(0, 24);
}

function fallbackProfileName(user: User) {
  return String(user.user_metadata?.display_name || user.email?.split("@")[0] || "elle user").trim().slice(0, 60) || "elle user";
}

export async function ensureElleProfile(user: User) {
  const existing = await supabase
    .from("elle_profiles")
    .select("id, username, display_name, bio, is_verified, role_label")
    .eq("id", user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as ElleProfileRow;

  const displayName = fallbackProfileName(user);
  const base = normalizeElleUsername(displayName);
  const first = await supabase
    .from("elle_profiles")
    .insert({ id: user.id, username: base, display_name: displayName, bio: "" })
    .select("id, username, display_name, bio, is_verified, role_label")
    .single();

  if (!first.error && first.data) return first.data as ElleProfileRow;
  if (first.error?.code !== "23505") throw first.error;

  const suffix = user.id.replace(/-/g, "").slice(0, 6);
  const username = normalizeElleUsername(`${base.slice(0, Math.max(3, 23 - suffix.length))}_${suffix}`);
  const retry = await supabase
    .from("elle_profiles")
    .insert({ id: user.id, username, display_name: displayName, bio: "" })
    .select("id, username, display_name, bio, is_verified, role_label")
    .single();

  if (retry.error) throw retry.error;
  return retry.data as ElleProfileRow;
}

function countByPost(rows: Array<{ post_id: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  return counts;
}

export async function fetchElleSocial(userId?: string): Promise<ElleSocialSnapshot> {
  const postsResult = await supabase
    .from("elle_posts")
    .select("id, author_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (postsResult.error) throw postsResult.error;

  const rows = postsResult.data || [];
  const postIds = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.map((row) => row.author_id))];

  const [likesResult, repostsResult, repliesResult, followsResult, bookmarksResult] = await Promise.all([
    postIds.length ? supabase.from("elle_post_likes").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from("elle_post_reposts").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from("elle_replies").select("id, post_id, author_id, body, created_at").in("post_id", postIds).order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
    supabase.from("elle_follows").select("follower_id, following_id"),
    userId && postIds.length ? supabase.from("elle_bookmarks").select("post_id, user_id").eq("user_id", userId).in("post_id", postIds) : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [likesResult, repostsResult, repliesResult, followsResult, bookmarksResult]) {
    if (result.error) throw result.error;
  }

  const replyRows = repliesResult.data || [];
  const replyAuthorIds = replyRows.map((row) => row.author_id);
  const followRows = followsResult.data || [];
  const profileIds = [...new Set([...authorIds, ...replyAuthorIds, ...followRows.flatMap((row) => [row.follower_id, row.following_id])])];

  const profilesResult = profileIds.length
    ? await supabase.from("elle_profiles").select("id, username, display_name, bio, is_verified, role_label").in("id", profileIds)
    : { data: [], error: null };
  if (profilesResult.error) throw profilesResult.error;

  const profiles = (profilesResult.data || []) as ElleProfileRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const likes = likesResult.data || [];
  const reposts = repostsResult.data || [];
  const bookmarks = bookmarksResult.data || [];
  const likeCounts = countByPost(likes);
  const repostCounts = countByPost(reposts);
  const replyCounts = countByPost(replyRows);
  const liked = new Set(likes.filter((row) => row.user_id === userId).map((row) => row.post_id));
  const reposted = new Set(reposts.filter((row) => row.user_id === userId).map((row) => row.post_id));
  const bookmarked = new Set(bookmarks.map((row) => row.post_id));
  const followingIds = userId ? followRows.filter((row) => row.follower_id === userId).map((row) => row.following_id) : [];
  const followingCount = followingIds.length;
  const followerCount = userId ? followRows.filter((row) => row.following_id === userId).length : 0;

  return {
    posts: rows.map((row) => ({
      ...row,
      profile: profileById.get(row.author_id) || null,
      likes: likeCounts.get(row.id) || 0,
      reposts: repostCounts.get(row.id) || 0,
      replies: replyCounts.get(row.id) || 0,
      liked: liked.has(row.id),
      reposted: reposted.has(row.id),
      bookmarked: bookmarked.has(row.id),
    })) as ElleFeedPostRow[],
    replies: replyRows.map((row) => ({ ...row, profile: profileById.get(row.author_id) || null })) as ElleReplyRow[],
    followingIds,
    followingCount,
    followerCount,
    profiles,
  };
}

export async function createEllePost(authorId: string, body: string) {
  const result = await supabase
    .from("elle_posts")
    .insert({ author_id: authorId, body })
    .select("id, author_id, body, created_at")
    .single();

  if (result.error) throw result.error;
  return result.data;
}

async function toggleJoin(table: "elle_post_likes" | "elle_post_reposts" | "elle_bookmarks", postId: string, userId: string, active: boolean) {
  const query = supabase.from(table);
  const result = active
    ? await query.delete().eq("post_id", postId).eq("user_id", userId)
    : await query.insert({ post_id: postId, user_id: userId });
  if (result.error) throw result.error;
}

export async function toggleElleLike(postId: string, userId: string, active: boolean) {
  return toggleJoin("elle_post_likes", postId, userId, active);
}

export async function toggleElleRepost(postId: string, userId: string, active: boolean) {
  return toggleJoin("elle_post_reposts", postId, userId, active);
}

export async function toggleElleBookmark(postId: string, userId: string, active: boolean) {
  return toggleJoin("elle_bookmarks", postId, userId, active);
}

export async function createElleReply(postId: string, authorId: string, body: string) {
  const result = await supabase
    .from("elle_replies")
    .insert({ post_id: postId, author_id: authorId, body })
    .select("id, post_id, author_id, body, created_at")
    .single();
  if (result.error) throw result.error;
  return result.data;
}

export async function toggleElleFollow(followerId: string, followingId: string, active: boolean) {
  const result = active
    ? await supabase.from("elle_follows").delete().eq("follower_id", followerId).eq("following_id", followingId)
    : await supabase.from("elle_follows").insert({ follower_id: followerId, following_id: followingId });
  if (result.error) throw result.error;
}

export async function saveElleProfile(profile: Pick<ElleProfileRow, "id" | "username" | "display_name" | "bio">) {
  const result = await supabase
    .from("elle_profiles")
    .upsert(
      {
        id: profile.id,
        username: normalizeElleUsername(profile.username),
        display_name: profile.display_name.trim().slice(0, 60),
        bio: profile.bio.trim().slice(0, 160),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, username, display_name, bio, is_verified, role_label")
    .single();

  if (result.error) throw result.error;
  return result.data as ElleProfileRow;
}


export async function fetchElleNotifications(userId: string) {
  const result = await supabase
    .from("elle_notifications")
    .select("id, recipient_id, actor_id, kind, post_id, reply_id, created_at, read_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (result.error) throw result.error;
  const rows = result.data || [];
  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const postIds = [...new Set(rows.map((row) => row.post_id).filter(Boolean))] as string[];

  const [profilesResult, postsResult] = await Promise.all([
    actorIds.length
      ? supabase.from("elle_profiles").select("id, username, display_name, bio, is_verified, role_label").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length
      ? supabase.from("elle_posts").select("id, body").in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (postsResult.error) throw postsResult.error;

  const actorById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile as ElleProfileRow]));
  const postById = new Map((postsResult.data || []).map((post) => [post.id, post.body as string]));

  return rows.map((row) => ({
    ...row,
    actor: actorById.get(row.actor_id) || null,
    post_body: row.post_id ? postById.get(row.post_id) || null : null,
  })) as ElleNotificationRow[];
}

export async function markElleNotificationsRead(userId: string) {
  const result = await supabase
    .from("elle_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null);
  if (result.error) throw result.error;
}


export async function fetchElleDmConversations(userId: string) {
  const conversations = await supabase
    .from("elle_dm_conversations")
    .select("id, user_a, user_b, created_at")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (conversations.error) throw conversations.error;
  const rows = conversations.data || [];
  const conversationIds = rows.map((row) => row.id);
  const otherIds = [...new Set(rows.map((row) => row.user_a === userId ? row.user_b : row.user_a))];

  const [profilesResult, messagesResult, readsResult] = await Promise.all([
    otherIds.length
      ? supabase.from("elle_profiles").select("id, username, display_name, bio, is_verified, role_label").in("id", otherIds)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? supabase.from("elle_dm_messages").select("id, conversation_id, sender_id, body, created_at").in("conversation_id", conversationIds).order("created_at", { ascending: true }).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? supabase.from("elle_dm_reads").select("conversation_id, user_id, last_read_at").eq("user_id", userId).in("conversation_id", conversationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [profilesResult, messagesResult, readsResult]) {
    if (result.error) throw result.error;
  }

  const profileById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile as ElleProfileRow]));
  const messages = (messagesResult.data || []) as ElleDmMessageRow[];
  const readByConversation = new Map((readsResult.data || []).map((row) => [row.conversation_id, row.last_read_at as string]));
  const messagesByConversation = new Map<string, ElleDmMessageRow[]>();
  for (const message of messages) {
    const list = messagesByConversation.get(message.conversation_id) || [];
    list.push(message);
    messagesByConversation.set(message.conversation_id, list);
  }

  return rows.map((row) => {
    const otherId = row.user_a === userId ? row.user_b : row.user_a;
    const convoMessages = messagesByConversation.get(row.id) || [];
    const lastMessage = convoMessages[convoMessages.length - 1] || null;
    const lastRead = readByConversation.get(row.id);
    const unreadCount = convoMessages.filter((message) =>
      message.sender_id !== userId && (!lastRead || new Date(message.created_at).getTime() > new Date(lastRead).getTime())
    ).length;
    return {
      ...row,
      other_profile: profileById.get(otherId) || null,
      last_message: lastMessage,
      unread_count: unreadCount,
    } as ElleDmConversationRow;
  }).sort((a, b) => {
    const aTime = a.last_message?.created_at || a.created_at;
    const bTime = b.last_message?.created_at || b.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export async function fetchElleDmMessages(conversationId: string) {
  const result = await supabase
    .from("elle_dm_messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (result.error) throw result.error;
  return (result.data || []) as ElleDmMessageRow[];
}

export async function fetchEllePeople(userId: string) {
  const result = await supabase
    .from("elle_profiles")
    .select("id, username, display_name, bio, is_verified, role_label")
    .neq("id", userId)
    .order("display_name", { ascending: true })
    .limit(50);
  if (result.error) throw result.error;
  return (result.data || []) as ElleProfileRow[];
}

export async function ensureElleDmConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw new Error("you can’t message yourself");
  const [user_a, user_b] = [userId, otherUserId].sort();
  const existing = await supabase
    .from("elle_dm_conversations")
    .select("id, user_a, user_b, created_at")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from("elle_dm_conversations")
    .insert({ user_a, user_b })
    .select("id, user_a, user_b, created_at")
    .single();

  if (!created.error && created.data) return created.data;
  if (created.error?.code !== "23505") throw created.error;

  const retry = await supabase
    .from("elle_dm_conversations")
    .select("id, user_a, user_b, created_at")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .single();
  if (retry.error) throw retry.error;
  return retry.data;
}

export async function sendElleDmMessage(conversationId: string, senderId: string, body: string) {
  const result = await supabase
    .from("elle_dm_messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: body.trim().slice(0, 2000) })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();
  if (result.error) throw result.error;
  return result.data as ElleDmMessageRow;
}

export async function markElleDmRead(conversationId: string, userId: string) {
  const result = await supabase
    .from("elle_dm_reads")
    .upsert(
      { conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" },
    );
  if (result.error) throw result.error;
}
