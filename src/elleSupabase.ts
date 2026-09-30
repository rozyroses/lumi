import { createClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yrammmjnviozydebshbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ecQn0VjaNhnsJR_Kys_Efg_z-CQvzin";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type ElleProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
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
    .select("id, username, display_name, bio")
    .eq("id", user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as ElleProfileRow;

  const displayName = fallbackProfileName(user);
  const base = normalizeElleUsername(displayName);
  const first = await supabase
    .from("elle_profiles")
    .insert({ id: user.id, username: base, display_name: displayName, bio: "" })
    .select("id, username, display_name, bio")
    .single();

  if (!first.error && first.data) return first.data as ElleProfileRow;
  if (first.error?.code !== "23505") throw first.error;

  const suffix = user.id.replace(/-/g, "").slice(0, 6);
  const username = normalizeElleUsername(`${base.slice(0, Math.max(3, 23 - suffix.length))}_${suffix}`);
  const retry = await supabase
    .from("elle_profiles")
    .insert({ id: user.id, username, display_name: displayName, bio: "" })
    .select("id, username, display_name, bio")
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
    ? await supabase.from("elle_profiles").select("id, username, display_name, bio").in("id", profileIds)
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

export async function saveElleProfile(profile: ElleProfileRow) {
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
    .select("id, username, display_name, bio")
    .single();

  if (result.error) throw result.error;
  return result.data as ElleProfileRow;
}
