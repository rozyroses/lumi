import { FormEvent, useEffect, useMemo, useState } from "react";
import ElleLanding from "./ElleLanding";
import { ElleMark, ElleWordmark } from "./ElleBrand";
import type { Session } from "@supabase/supabase-js";
import {
  createEllePost,
  createElleReply,
  ensureElleProfile,
  fetchElleSocial,
  normalizeElleUsername,
  saveElleProfile,
  supabase,
  toggleElleBookmark,
  toggleElleFollow,
  toggleElleLike,
  toggleElleRepost,
  type ElleFeedPostRow,
  type ElleProfileRow,
  type ElleReplyRow,
} from "./elleSupabase";

type Tab = "home" | "explore" | "notifications" | "messages" | "bookmarks" | "communities" | "profile" | "ai";
type FeedMode = "for-you" | "following";
type Post = {
  id: string;
  authorId?: string;
  name: string;
  handle: string;
  text: string;
  time: string;
  avatar: string;
  verified?: boolean;
  likes: number;
  reposts: number;
  replies: number;
  views: string;
  liked?: boolean;
  reposted?: boolean;
  bookmarked?: boolean;
  mine?: boolean;
  tag?: string;
};
type AiMessage = { role: "user" | "assistant"; text: string };

const trends = [
  ["#NewMusicFriday", "42.8K posts"],
  ["Creative Tech", "18.2K posts"],
  ["Indie Artists", "13.7K posts"],
  ["AI + School", "9,804 posts"],
  ["#BuildInPublic", "7,102 posts"],
];

const communities = [
  ["🎧", "music makers", "18.4K members", "songs, beats, rollouts, feedback"],
  ["🎨", "creative studio", "11.2K members", "design, film, photography, ideas"],
  ["📚", "study circle", "26.8K members", "school help without the boring part"],
  ["🚀", "builders club", "9.6K members", "apps, startups, experiments, launches"],
];

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "E";
}

function compactNumber(value: number) {
  if (value >= 1000000) return (value / 1000000).toFixed(1).replace(".0", "") + "M";
  if (value >= 1000) return (value / 1000).toFixed(1).replace(".0", "") + "K";
  return String(value);
}

function relativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "now";
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function feedPostFromRow(row: ElleFeedPostRow, userId?: string): Post {
  const name = row.profile?.display_name || "elle user";
  const username = row.profile?.username || "elleuser";
  return {
    id: row.id,
    authorId: row.author_id,
    name,
    handle: "@" + username,
    text: row.body,
    time: relativeTime(row.created_at),
    avatar: initials(name),
    likes: row.likes,
    reposts: row.reposts,
    replies: row.replies,
    views: "0",
    liked: row.liked,
    reposted: row.reposted,
    bookmarked: row.bookmarked,
    mine: Boolean(userId && row.author_id === userId),
  };
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ElleApp() {
  const [landing, setLanding] = useState(() => window.location.hash !== "#feed");
  const [tab, setTab] = useState<Tab>("home");
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ElleProfileRow | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<ElleReplyRow[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [socialProfiles, setSocialProfiles] = useState<ElleProfileRow[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileForm, setProfileForm] = useState({ display_name: "", username: "", bio: "" });
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("elle-theme") as "light" | "dark") || "light");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    { role: "assistant", text: "hey, i’m elle ✦ i can help you think through posts, explain what’s trending, study, brainstorm, or just talk it out." },
  ]);
  const [messageText, setMessageText] = useState("");

  const fallbackDisplayName = String(session?.user.user_metadata?.display_name || session?.user.email?.split("@")[0] || "guest");
  const displayName = profile?.display_name || fallbackDisplayName;
  const handle = profile ? "@" + profile.username : "@" + normalizeElleUsername(displayName);
  const profileBio = profile?.bio || "music, ideas, school, and whatever i’m building next ✦";

  useEffect(() => {
    document.documentElement.dataset.elleTheme = theme;
    localStorage.setItem("elle-theme", theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    void refreshSocial();
  }, [session?.user.id]);

  const visiblePosts = useMemo(() => {
    let next = posts;
    if (tab === "bookmarks") next = next.filter((post) => post.bookmarked);
    if (tab === "profile") next = next.filter((post) => post.mine);
    if (tab === "explore" && search.trim()) {
      const needle = search.toLowerCase();
      next = next.filter((post) => (post.name + " " + post.handle + " " + post.text + " " + (post.tag || "")).toLowerCase().includes(needle));
    }
    if (feedMode === "following" && tab === "home") next = next.filter((post) => post.mine || Boolean(post.authorId && followingIds.includes(post.authorId)));
    return next;
  }, [posts, tab, search, feedMode, followingIds]);

  function nav(next: Tab) {
    setLanding(false);
    window.history.replaceState(null, "", "#feed");
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function refreshSocial() {
    setSocialBusy(true);
    try {
      const nextProfile = session ? await ensureElleProfile(session.user) : null;
      const snapshot = await fetchElleSocial(session?.user.id);
      setProfile(nextProfile);
      setReplies(snapshot.replies);
      setFollowingIds(snapshot.followingIds);
      setFollowingCount(snapshot.followingCount);
      setFollowerCount(snapshot.followerCount);
      setSocialProfiles(snapshot.profiles);
      setPosts(snapshot.posts.map((row) => feedPostFromRow(row, session?.user.id)));
    } catch (error) {
      setToast(error instanceof Error ? error.message : "couldn’t refresh elle");
    } finally {
      setSocialBusy(false);
    }
  }

  async function publish() {
    const text = draft.trim();
    if (!text || posting) return;
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    setPosting(true);
    try {
      await ensureElleProfile(session.user);
      await createEllePost(session.user.id, text);
      setDraft("");
      setTab("home");
      setFeedMode("for-you");
      await refreshSocial();
      setToast("posted to elle ✦");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "couldn’t post to elle");
    } finally {
      setPosting(false);
    }
  }

  async function mutatePost(post: Post, action: "like" | "repost" | "bookmark") {
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    const key = `${action}:${post.id}`;
    if (actionBusy === key) return;
    setActionBusy(key);
    const active = action === "like" ? Boolean(post.liked) : action === "repost" ? Boolean(post.reposted) : Boolean(post.bookmarked);
    setPosts((current) => current.map((item) => {
      if (item.id !== post.id) return item;
      if (action === "like") return { ...item, liked: !active, likes: Math.max(0, item.likes + (active ? -1 : 1)) };
      if (action === "repost") return { ...item, reposted: !active, reposts: Math.max(0, item.reposts + (active ? -1 : 1)) };
      return { ...item, bookmarked: !active };
    }));
    try {
      await ensureElleProfile(session.user);
      if (action === "like") await toggleElleLike(post.id, session.user.id, active);
      if (action === "repost") await toggleElleRepost(post.id, session.user.id, active);
      if (action === "bookmark") await toggleElleBookmark(post.id, session.user.id, active);
    } catch (error) {
      await refreshSocial();
      setToast(error instanceof Error ? error.message : "couldn’t update that post");
    } finally {
      setActionBusy(null);
    }
  }

  async function submitReply(post: Post) {
    const body = replyText.trim();
    if (!body || replyBusy) return;
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    setReplyBusy(true);
    try {
      await ensureElleProfile(session.user);
      await createElleReply(post.id, session.user.id, body);
      setReplyText("");
      setReplyingTo(post.id);
      await refreshSocial();
      setToast("reply posted ✦");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "couldn’t post reply");
    } finally {
      setReplyBusy(false);
    }
  }

  async function toggleFollow(authorId: string) {
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    if (authorId === session.user.id) return;
    const active = followingIds.includes(authorId);
    const key = `follow:${authorId}`;
    if (actionBusy === key) return;
    setActionBusy(key);
    setFollowingIds((current) => active ? current.filter((id) => id !== authorId) : [...current, authorId]);
    try {
      await ensureElleProfile(session.user);
      await toggleElleFollow(session.user.id, authorId, active);
      await refreshSocial();
    } catch (error) {
      await refreshSocial();
      setToast(error instanceof Error ? error.message : "couldn’t update follow");
    } finally {
      setActionBusy(null);
    }
  }

  function openProfileEditor() {
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    setProfileError("");
    setProfileForm({
      display_name: profile?.display_name || displayName,
      username: profile?.username || normalizeElleUsername(displayName),
      bio: profile?.bio || "",
    });
    setProfileOpen(true);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || profileBusy) return;
    const username = normalizeElleUsername(profileForm.username);
    if (username.length < 3) {
      setProfileError("username needs at least 3 characters");
      return;
    }
    const display_name = profileForm.display_name.trim();
    if (!display_name) {
      setProfileError("add a display name");
      return;
    }
    setProfileBusy(true);
    setProfileError("");
    try {
      const saved = await saveElleProfile({
        id: session.user.id,
        username,
        display_name,
        bio: profileForm.bio,
      });
      const authUpdate = await supabase.auth.updateUser({ data: { display_name: saved.display_name } });
      if (authUpdate.error) throw authUpdate.error;
      setProfile(saved);
      setProfileOpen(false);
      await refreshSocial();
      setToast("profile updated ✦");
    } catch (error) {
      const message = error instanceof Error ? error.message : "couldn’t update profile";
      setProfileError(message.includes("duplicate") || message.includes("unique") ? "that @username is already taken" : message);
    } finally {
      setProfileBusy(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const name = String(data.get("name") || "").trim();
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "signup") {
        const result = await supabase.auth.signUp({ email, password, options: { data: { display_name: name || email.split("@")[0] } } });
        if (result.error) throw result.error;
        setToast(result.data.session ? "welcome to elle ✦" : "check your email to finish signing up");
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        setToast("welcome back ✦");
      }
      setAuthOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "couldn’t sign in");
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendAi(event?: FormEvent) {
    event?.preventDefault();
    const text = aiInput.trim();
    if (!text || aiBusy) return;
    const next: AiMessage[] = [...aiMessages, { role: "user", text }];
    setAiMessages(next);
    setAiInput("");
    setAiBusy(true);
    try {
      const response = await fetch("https://luni-gateway.roosevelt-wooden.workers.dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          space: { name: "elle social", instructions: "You are Elle, the built-in AI inside a social platform. Be useful, concise, current-sounding, and conversational. Help users understand conversations, write posts, brainstorm, study, and think clearly." },
          messages: next.map((message) => ({ role: message.role, content: message.text })),
        }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") throw new Error("Elle AI is unavailable.");
      setAiMessages((current) => [...current, { role: "assistant", text: result.reply }]);
    } catch {
      setAiMessages((current) => [...current, { role: "assistant", text: "i hit a connection snag. try me again in a sec ✦" }]);
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    function onHashChange() { setLanding(window.location.hash !== "#feed"); }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!authOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLFormElement>(".elle-auth");
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setAuthOpen(false);
      if (event.key !== "Tab" || !dialog) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [authOpen, authMode]);

  const showLanding = landing && !session;
  const headerTitle = tab === "home" ? "home" : tab === "ai" ? "elle ai" : tab;

  return (
    <>
      {showLanding && <ElleLanding onEnter={nav} onAuth={(mode) => { setAuthMode(mode); setAuthError(""); setAuthOpen(true); }} />}
    <main className="elle-shell" hidden={showLanding}>
      <aside className="elle-left">
        <button className="elle-logo" onClick={() => nav("home")} aria-label="Elle home"><ElleWordmark /></button>
        <nav className="elle-nav" aria-label="Main navigation">
          <button aria-label="home" className={tab === "home" ? "active" : ""} onClick={() => nav("home")}><i>⌂</i><span>Home</span></button>
          <button aria-label="explore" className={tab === "explore" ? "active" : ""} onClick={() => nav("explore")}><i>⌕</i><span>Explore</span></button>
          <button aria-label="notifications" className={tab === "notifications" ? "active" : ""} onClick={() => nav("notifications")}><i>♡</i><span>Notifications</span><em>3</em></button>
          <button aria-label="messages" className={tab === "messages" ? "active" : ""} onClick={() => nav("messages")}><i>✉</i><span>Messages</span></button>
          <button className={tab === "bookmarks" ? "active" : ""} onClick={() => nav("bookmarks")}><i>⌑</i><span>Bookmarks</span></button>
          <button className={tab === "communities" ? "active" : ""} onClick={() => nav("communities")}><i>◎</i><span>Communities</span></button>
          <button aria-label="ai" className={tab === "ai" ? "active ai-nav" : "ai-nav"} onClick={() => nav("ai")}><i>✦</i><span>Elle AI</span></button>
          <button className={tab === "profile" ? "active" : ""} onClick={() => nav("profile")}><i>◉</i><span>Profile</span></button>
        </nav>
        <button className="elle-post-button" onClick={() => { nav("home"); document.getElementById("elle-compose")?.focus(); }}>Post</button>
        <div className="elle-account">
          <div className="avatar me">{initials(displayName)}</div>
          <div><strong>{session ? displayName : "guest"}</strong><small>{session ? handle : "sign in to post"}</small></div>
          {session ? <button onClick={() => void supabase.auth.signOut()} aria-label="Sign out">•••</button> : <button onClick={() => setAuthOpen(true)}>sign in</button>}
        </div>
      </aside>

      <section className="elle-center">
        <header className="elle-mobile-top"><button className="elle-logo mini" aria-label="Elle home" onClick={() => nav("home")}><ElleMark /></button><strong>{headerTitle}</strong><button aria-label="Toggle theme" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>◐</button></header>

        {tab === "home" && (
          <>
            <div className="orbit-feed-heading"><div><span>your daily orbit</span><h1>make yourself at home.</h1></div><span aria-hidden="true">✦</span></div>
            <header className="feed-header">
              <button className={feedMode === "for-you" ? "active" : ""} onClick={() => setFeedMode("for-you")}>For you</button>
              <button className={feedMode === "following" ? "active" : ""} onClick={() => setFeedMode("following")}>Following</button>
              <button className="feed-settings" onClick={() => void refreshSocial()} aria-label="Refresh feed" title="Refresh feed" disabled={socialBusy}>{socialBusy ? "…" : "↻"}</button>
              <button className="feed-settings" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">◐</button>
            </header>
            <section className="compose-card">
              <div className="avatar me">{initials(displayName)}</div>
              <div className="compose-main">
                <textarea id="elle-compose" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Write a post" placeholder="what’s in your orbit?" maxLength={500} />
                <div className="compose-tools">
                  <div><button title="Add media">▧</button><button title="Add GIF">GIF</button><button title="Add poll">≡</button><button title="Add emoji">☺</button><button title="Schedule">◷</button></div>
                  <span>{draft.length ? 500 - draft.length : ""}</span>
                  <button className="publish" disabled={!draft.trim() || posting} onClick={() => void publish()}>{posting ? "Posting…" : "Post"}</button>
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "explore" && (
          <section className="explore-head">
            <label><span>⌕</span><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="search elle" /></label>
            <div className="explore-tabs"><button className="active">For you</button><button>Trending</button><button>News</button><button>Creators</button></div>
          </section>
        )}

        {tab === "ai" && (
          <section className="ai-page">
            <div className="ai-hero">
              <div className="ai-orb">✦</div>
              <p>ELLE AI</p>
              <h1>ask the timeline anything.</h1>
              <span>brainstorm, study, rewrite, explain a trend, or make sense of the noise.</span>
            </div>
            <div className="ai-thread">
              {aiMessages.map((message, index) => <div key={index} className={cx("ai-bubble", message.role)}>{message.role === "assistant" && <b>✦</b>}<p>{message.text}</p></div>)}
              {aiBusy && <div className="ai-bubble assistant"><b>✦</b><p className="typing">thinking<span>•••</span></p></div>}
            </div>
            <form className="ai-composer" onSubmit={sendAi}>
              <button type="button">＋</button>
              <input value={aiInput} onChange={(event) => setAiInput(event.target.value)} placeholder="ask elle anything..." />
              <button className="ai-send" disabled={!aiInput.trim() || aiBusy}>↑</button>
            </form>
          </section>
        )}

        {tab === "notifications" && (
          <section className="simple-page">
            <div className="page-title"><h1>notifications</h1><button>⚙</button></div>
            <div className="notification"><span className="notice-icon">♡</span><div><strong>Maya West and 18 others liked your post</strong><p>“working on something new today…”</p><small>8m</small></div></div>
            <div className="notification"><span className="notice-icon ai">✦</span><div><strong>Elle AI</strong><p>your saved topic “creative tech” is moving today.</p><small>31m</small></div></div>
            <div className="notification"><span className="avatar tiny">JL</span><div><strong>Jordan Lee followed you</strong><p>@jordn</p><small>2h</small></div></div>
          </section>
        )}

        {tab === "messages" && (
          <section className="messages-page">
            <div className="message-list">
              <div className="page-title"><h1>messages</h1><button>✎</button></div>
              {[
                ["MW", "Maya West", "send me that track when you’re done 👀", "4m"],
                ["CR", "Creative Room", "you joining the feedback space tonight?", "1h"],
                ["JL", "Jordan Lee", "that idea actually could work", "3h"],
              ].map((item, index) => <button className={index === 0 ? "dm active" : "dm"} key={item[1]}><span className="avatar">{item[0]}</span><span><strong>{item[1]}</strong><small>{item[2]}</small></span><em>{item[3]}</em></button>)}
            </div>
            <div className="message-chat">
              <header><span className="avatar">MW</span><div><strong>Maya West</strong><small>@mayawest</small></div></header>
              <div className="dm-thread"><p className="theirs">you still working on that app idea?</p><p className="mine">yeahhh we changing the whole look 😭</p><p className="theirs">send me that track when you’re done 👀</p></div>
              <form onSubmit={(event) => { event.preventDefault(); if (messageText.trim()) { setToast("message sent ✦"); setMessageText(""); } }}>
                <button type="button">＋</button><input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="start a message" /><button>↑</button>
              </form>
            </div>
          </section>
        )}

        {tab === "communities" && (
          <section className="simple-page">
            <div className="page-title"><div><h1>communities</h1><p>find your people without leaving the timeline.</p></div><button>＋</button></div>
            <div className="community-grid">
              {communities.map((community) => <article key={community[1]}><span>{community[0]}</span><div><h2>{community[1]}</h2><small>{community[2]}</small><p>{community[3]}</p></div><button>join</button></article>)}
            </div>
          </section>
        )}

        {tab === "profile" && (
          <>
            <section className="profile-hero">
              <div className="profile-cover" />
              <div className="profile-row"><div className="avatar profile-avatar">{initials(displayName)}</div><button onClick={openProfileEditor}>{session ? "edit profile" : "create account"}</button></div>
              <h1>{session ? displayName : "your profile"}</h1>
              <small>{session ? handle : "@you"}</small>
              <p>{session ? profileBio : "make a profile to start building your orbit ✦"}</p>
              <div className="profile-stats"><span><strong>{posts.filter((post) => post.mine).length}</strong> posts</span><span><strong>{followingCount}</strong> following</span><span><strong>{followerCount}</strong> followers</span></div>
            </section>
            <div className="profile-tabs"><button className="active">Posts</button><button>Replies</button><button>Media</button><button>Likes</button></div>
          </>
        )}

        {tab === "bookmarks" && <div className="page-title standalone"><div><h1>bookmarks</h1><p>only you can see what you save.</p></div></div>}

        {["home", "explore", "bookmarks", "profile"].includes(tab) && (
          <section className="feed">
            {visiblePosts.length ? visiblePosts.map((post) => (
              <article className="post" key={post.id}>
                <div className={cx("avatar", post.mine && "me")}>{post.avatar}</div>
                <div className="post-body">
                  <div className="post-meta">
                    <strong>{post.name}{post.verified && <span className="verified">✓</span>}</strong><span>{post.handle}</span><i>·</i><span>{post.time}</span>
                    {post.authorId && !post.mine && <button className={cx("post-follow", followingIds.includes(post.authorId) && "following")} onClick={() => void toggleFollow(post.authorId!)}>{followingIds.includes(post.authorId) ? "following" : "follow"}</button>}
                    <button>•••</button>
                  </div>
                  <p className="post-text">{post.text}</p>
                  <div className="post-actions">
                    <button className={replyingTo === post.id ? "active" : ""} onClick={() => { setReplyingTo(replyingTo === post.id ? null : post.id); setReplyText(""); }}><i>◯</i><span>{post.replies || ""}</span></button>
                    <button className={post.reposted ? "active repost" : ""} disabled={actionBusy === `repost:${post.id}`} onClick={() => void mutatePost(post, "repost")}><i>⇄</i><span>{post.reposts ? compactNumber(post.reposts) : ""}</span></button>
                    <button className={post.liked ? "active like" : ""} disabled={actionBusy === `like:${post.id}`} onClick={() => void mutatePost(post, "like")}><i>{post.liked ? "♥" : "♡"}</i><span>{post.likes ? compactNumber(post.likes) : ""}</span></button>
                    <button><i>▥</i><span>{post.views}</span></button>
                    <button className={post.bookmarked ? "active bookmark" : ""} disabled={actionBusy === `bookmark:${post.id}`} onClick={() => void mutatePost(post, "bookmark")}><i>{post.bookmarked ? "▰" : "⌑"}</i></button>
                    <button onClick={() => { setAiInput("help me respond to this post: " + post.text); nav("ai"); }}><i>✦</i></button>
                  </div>
                  {replyingTo === post.id && (
                    <div className="reply-panel">
                      <form onSubmit={(event) => { event.preventDefault(); void submitReply(post); }}>
                        <div className="avatar me tiny">{initials(displayName)}</div>
                        <input value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={500} placeholder={session ? `reply to ${post.handle}` : "sign in to reply"} />
                        <button disabled={!replyText.trim() || replyBusy}>{replyBusy ? "…" : "reply"}</button>
                      </form>
                      <div className="reply-list">
                        {replies.filter((reply) => reply.post_id === post.id).map((reply) => (
                          <div className="reply-item" key={reply.id}>
                            <div className="avatar tiny">{initials(reply.profile?.display_name || "elle user")}</div>
                            <div><strong>{reply.profile?.display_name || "elle user"}</strong><small>@{reply.profile?.username || "elleuser"} · {relativeTime(reply.created_at)}</small><p>{reply.body}</p></div>
                          </div>
                        ))}
                        {!replies.some((reply) => reply.post_id === post.id) && <small className="reply-empty">be the first reply ✦</small>}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )) : <div className="empty-state"><span>⌑</span><h2>nothing here yet</h2><p>{tab === "bookmarks" ? "save a post and it’ll show up here." : "try a different search."}</p></div>}
          </section>
        )}
      </section>

      <aside className="elle-right">
        <label className="right-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} onFocus={() => nav("explore")} placeholder="Search" /></label>
        <section className="ai-card">
          <div className="ai-card-top"><span>✦</span><small>ELLE AI</small></div>
          <h2>need a second brain?</h2>
          <p>ask about a post, write something better, study, brainstorm, or untangle a thought.</p>
          <button onClick={() => nav("ai")}>ask elle <span>↗</span></button>
        </section>
        <section className="side-card trends">
          <h2>trending in your orbit</h2>
          {trends.map((trend, index) => <button key={trend[0]} onClick={() => { setSearch(trend[0].replace("#", "")); nav("explore"); }}><small>{index === 0 ? "trending now" : "trending"}</small><strong>{trend[0]}</strong><span>{trend[1]}</span></button>)}
          <button className="show-more" onClick={() => nav("explore")}>show more</button>
        </section>
        <section className="side-card who">
          <h2>who to follow</h2>
          {socialProfiles.filter((person) => person.id !== session?.user.id).slice(0, 3).map((person) => (
            <div key={person.id}>
              <span className="avatar">{initials(person.display_name)}</span>
              <span><strong>{person.display_name}</strong><small>@{person.username}</small></span>
              <button className={followingIds.includes(person.id) ? "following" : ""} onClick={() => void toggleFollow(person.id)}>{followingIds.includes(person.id) ? "following" : "follow"}</button>
            </div>
          ))}
          {!socialProfiles.some((person) => person.id !== session?.user.id) && <p className="who-empty">new people will show up here as elle grows ✦</p>}
        </section>
        <footer>Terms · Privacy · Accessibility · About · © 2026 Elle</footer>
      </aside>

      <nav className="mobile-dock" aria-label="Mobile navigation">
        <button aria-label="home" className={tab === "home" ? "active" : ""} onClick={() => nav("home")}><span>⌂</span></button>
        <button aria-label="explore" className={tab === "explore" ? "active" : ""} onClick={() => nav("explore")}><span>⌕</span></button>
        <button aria-label="ai" className={tab === "ai" ? "active ai" : "ai"} onClick={() => nav("ai")}><span>✦</span></button>
        <button aria-label="notifications" className={tab === "notifications" ? "active" : ""} onClick={() => nav("notifications")}><span>♡</span></button>
        <button aria-label="messages" className={tab === "messages" ? "active" : ""} onClick={() => nav("messages")}><span>✉</span></button>
      </nav>

    </main>

      {authOpen && (
        <div className="auth-backdrop" onMouseDown={() => setAuthOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label={authMode === "signup" ? "Join elle" : "Sign in to elle"} className="elle-auth" onSubmit={submitAuth} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="auth-close" aria-label="Close sign in" onClick={() => setAuthOpen(false)}>×</button>
            <div className="elle-logo auth-logo"><ElleWordmark /></div>
            <p>{authMode === "signup" ? "JOIN THE CONVERSATION" : "WELCOME BACK"}</p>
            <h2>{authMode === "signup" ? "make your corner of elle." : "sign in to elle."}</h2>
            {authMode === "signup" && <label>display name<input name="name" placeholder="what should people call you?" required /></label>}
            <label>email<input type="email" name="email" placeholder="you@example.com" required /></label>
            <label>password<input type="password" name="password" minLength={6} placeholder="at least 6 characters" required /></label>
            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" disabled={authBusy}>{authBusy ? "one sec..." : authMode === "signup" ? "create account" : "sign in"}</button>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{authMode === "signup" ? "already on elle? sign in" : "new here? create an account"}</button>
          </form>
        </div>
      )}

      {profileOpen && session && (
        <div className="auth-backdrop" onMouseDown={() => setProfileOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Edit Elle profile" className="elle-auth profile-editor" onSubmit={submitProfile} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="auth-close" aria-label="Close profile editor" onClick={() => setProfileOpen(false)}>×</button>
            <div className="elle-logo auth-logo"><ElleWordmark /></div>
            <p>YOUR CORNER OF ELLE</p>
            <h2>make it feel like you.</h2>
            <label>display name<input value={profileForm.display_name} onChange={(event) => setProfileForm((current) => ({ ...current, display_name: event.target.value }))} maxLength={60} required /></label>
            <label>username<input value={profileForm.username} onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))} maxLength={24} pattern="[A-Za-z0-9_]{3,24}" required /></label>
            <label>bio<textarea value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} maxLength={160} placeholder="what are you into?" /></label>
            <small className="profile-editor-count">{profileForm.bio.length}/160</small>
            {profileError && <div className="auth-error">{profileError}</div>}
            <button className="auth-submit" disabled={profileBusy}>{profileBusy ? "saving..." : "save profile"}</button>
          </form>
        </div>
      )}

      {toast && <div className="elle-toast">{toast}</div>}
    </>
  );
}
