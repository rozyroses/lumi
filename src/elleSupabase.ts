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

export type ElleFeedPostRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  profile: ElleProfileRow | null;
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

export async function fetchEllePosts() {
  const posts = await supabase
    .from("elle_posts")
    .select("id, author_id, body, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (posts.error) throw posts.error;
  const rows = posts.data || [];
  const authorIds = [...new Set(rows.map((row) => row.author_id))];
  if (!authorIds.length) return [] as ElleFeedPostRow[];

  const profiles = await supabase
    .from("elle_profiles")
    .select("id, username, display_name, bio")
    .in("id", authorIds);

  if (profiles.error) throw profiles.error;
  const byId = new Map((profiles.data || []).map((profile) => [profile.id, profile as ElleProfileRow]));

  return rows.map((row) => ({
    ...row,
    profile: byId.get(row.author_id) || null,
  })) as ElleFeedPostRow[];
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
