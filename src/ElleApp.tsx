import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";

type Tab = "home" | "explore" | "notifications" | "messages" | "bookmarks" | "communities" | "profile" | "ai";
type FeedMode = "for-you" | "following";
type Post = {
  id: string;
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

const SUPABASE_URL = "https://yrammmjnviozydebshbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ecQn0VjaNhnsJR_Kys_Efg_z-CQvzin";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const LOCAL_POSTS_KEY = "elle-local-posts-v1";

const starterPosts: Post[] = [
  {
    id: "p1",
    name: "Maya West",
    handle: "@mayawest",
    text: "sometimes the best ideas happen when you stop trying to make them perfect. posted the demo anyway ✨",
    time: "12m",
    avatar: "MW",
    verified: true,
    likes: 1240,
    reposts: 188,
    replies: 62,
    views: "18K",
    tag: "music",
  },
  {
    id: "p2",
    name: "Jordan Lee",
    handle: "@jordn",
    text: "hot take: social media should feel social again. less performance, more actual people talking to each other.",
    time: "27m",
    avatar: "JL",
    likes: 389,
    reposts: 71,
    replies: 94,
    views: "9.6K",
    tag: "culture",
  },
  {
    id: "p3",
    name: "The Creative Room",
    handle: "@creativeroom",
    text: "drop what you're working on today. music, design, school, business, anything. somebody in here might have the missing piece.",
    time: "1h",
    avatar: "CR",
    verified: true,
    likes: 902,
    reposts: 143,
    replies: 311,
    views: "22K",
    tag: "community",
  },
  {
    id: "p4",
    name: "Nia Brooks",
    handle: "@niab",
    text: "i asked an ai to explain my notes like a group chat and suddenly the chapter made sense 😭",
    time: "2h",
    avatar: "NB",
    likes: 518,
    reposts: 67,
    replies: 43,
    views: "11K",
    tag: "ai",
  },
];

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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function ElleApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [feedMode, setFeedMode] = useState<FeedMode>("for-you");
  const [session, setSession] = useState<Session | null>(null);
  const [posts, setPosts] = useState<Post[]>(starterPosts);
  const [draft, setDraft] = useState("");
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

  const displayName = String(session?.user.user_metadata?.display_name || session?.user.email?.split("@")[0] || "guest");
  const handle = "@" + displayName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18);

  useEffect(() => {
    document.documentElement.dataset.elleTheme = theme;
    localStorage.setItem("elle-theme", theme);
  }, [theme]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || "[]") as Post[];
      if (saved.length) setPosts([...saved, ...starterPosts]);
    } catch {}
  }, []);

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

  const visiblePosts = useMemo(() => {
    let next = posts;
    if (tab === "bookmarks") next = next.filter((post) => post.bookmarked);
    if (tab === "profile") next = next.filter((post) => post.mine);
    if (tab === "explore" && search.trim()) {
      const needle = search.toLowerCase();
      next = next.filter((post) => (post.name + " " + post.handle + " " + post.text + " " + (post.tag || "")).toLowerCase().includes(needle));
    }
    if (feedMode === "following" && tab === "home") next = next.filter((post) => ["@mayawest", "@jordn"].includes(post.handle) || post.mine);
    return next;
  }, [posts, tab, search, feedMode]);

  function nav(next: Tab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveMine(nextPosts: Post[]) {
    const mine = nextPosts.filter((post) => post.mine);
    localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(mine));
  }

  function publish() {
    const text = draft.trim();
    if (!text) return;
    if (!session) {
      setAuthMode("signup");
      setAuthOpen(true);
      return;
    }
    const nextPost: Post = {
      id: crypto.randomUUID(),
      name: displayName,
      handle,
      text,
      time: "now",
      avatar: initials(displayName),
      likes: 0,
      reposts: 0,
      replies: 0,
      views: "0",
      mine: true,
    };
    const next = [nextPost, ...posts];
    setPosts(next);
    saveMine(next);
    setDraft("");
    setTab("home");
    setFeedMode("for-you");
    setToast("posted to elle ✦");
  }

  function mutatePost(id: string, action: "like" | "repost" | "bookmark") {
    setPosts((current) => {
      const next = current.map((post) => {
        if (post.id !== id) return post;
        if (action === "like") {
          const liked = !post.liked;
          return { ...post, liked, likes: Math.max(0, post.likes + (liked ? 1 : -1)) };
        }
        if (action === "repost") {
          const reposted = !post.reposted;
          return { ...post, reposted, reposts: Math.max(0, post.reposts + (reposted ? 1 : -1)) };
        }
        return { ...post, bookmarked: !post.bookmarked };
      });
      saveMine(next);
      return next;
    });
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

  const headerTitle = tab === "home" ? "home" : tab === "ai" ? "elle ai" : tab;

  return (
    <main className="elle-shell">
      <aside className="elle-left">
        <button className="elle-logo" onClick={() => nav("home")} aria-label="Elle home"><span>e</span><b>elle</b></button>
        <nav className="elle-nav" aria-label="Main navigation">
          <button className={tab === "home" ? "active" : ""} onClick={() => nav("home")}><i>⌂</i><span>Home</span></button>
          <button className={tab === "explore" ? "active" : ""} onClick={() => nav("explore")}><i>⌕</i><span>Explore</span></button>
          <button className={tab === "notifications" ? "active" : ""} onClick={() => nav("notifications")}><i>♡</i><span>Notifications</span><em>3</em></button>
          <button className={tab === "messages" ? "active" : ""} onClick={() => nav("messages")}><i>✉</i><span>Messages</span></button>
          <button className={tab === "bookmarks" ? "active" : ""} onClick={() => nav("bookmarks")}><i>⌑</i><span>Bookmarks</span></button>
          <button className={tab === "communities" ? "active" : ""} onClick={() => nav("communities")}><i>◎</i><span>Communities</span></button>
          <button className={tab === "ai" ? "active ai-nav" : "ai-nav"} onClick={() => nav("ai")}><i>✦</i><span>Elle AI</span></button>
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
        <header className="elle-mobile-top"><button className="elle-logo mini" onClick={() => nav("home")}><span>e</span></button><strong>{headerTitle}</strong><button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>◐</button></header>

        {tab === "home" && (
          <>
            <header className="feed-header">
              <button className={feedMode === "for-you" ? "active" : ""} onClick={() => setFeedMode("for-you")}>For you</button>
              <button className={feedMode === "following" ? "active" : ""} onClick={() => setFeedMode("following")}>Following</button>
              <button className="feed-settings" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="Toggle theme">◐</button>
            </header>
            <section className="compose-card">
              <div className="avatar me">{initials(displayName)}</div>
              <div className="compose-main">
                <textarea id="elle-compose" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="what's happening?" maxLength={500} />
                <div className="compose-tools">
                  <div><button title="Add media">▧</button><button title="Add GIF">GIF</button><button title="Add poll">≡</button><button title="Add emoji">☺</button><button title="Schedule">◷</button></div>
                  <span>{draft.length ? 500 - draft.length : ""}</span>
                  <button className="publish" disabled={!draft.trim()} onClick={publish}>Post</button>
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
              <div className="profile-row"><div className="avatar profile-avatar">{initials(displayName)}</div><button>{session ? "edit profile" : "create account"}</button></div>
              <h1>{session ? displayName : "your profile"}</h1>
              <small>{session ? handle : "@you"}</small>
              <p>music, ideas, school, and whatever i’m building next ✦</p>
              <div className="profile-stats"><span><strong>{posts.filter((post) => post.mine).length}</strong> posts</span><span><strong>128</strong> following</span><span><strong>942</strong> followers</span></div>
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
                  <div className="post-meta"><strong>{post.name}{post.verified && <span className="verified">✓</span>}</strong><span>{post.handle}</span><i>·</i><span>{post.time}</span><button>•••</button></div>
                  <p className="post-text">{post.text}</p>
                  <div className="post-actions">
                    <button><i>◯</i><span>{post.replies || ""}</span></button>
                    <button className={post.reposted ? "active repost" : ""} onClick={() => mutatePost(post.id, "repost")}><i>⇄</i><span>{post.reposts ? compactNumber(post.reposts) : ""}</span></button>
                    <button className={post.liked ? "active like" : ""} onClick={() => mutatePost(post.id, "like")}><i>{post.liked ? "♥" : "♡"}</i><span>{post.likes ? compactNumber(post.likes) : ""}</span></button>
                    <button><i>▥</i><span>{post.views}</span></button>
                    <button className={post.bookmarked ? "active bookmark" : ""} onClick={() => mutatePost(post.id, "bookmark")}><i>{post.bookmarked ? "▰" : "⌑"}</i></button>
                    <button onClick={() => { setAiInput("help me respond to this post: " + post.text); nav("ai"); }}><i>✦</i></button>
                  </div>
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
          <h2>what’s happening</h2>
          {trends.map((trend, index) => <button key={trend[0]} onClick={() => { setSearch(trend[0].replace("#", "")); nav("explore"); }}><small>{index === 0 ? "trending now" : "trending"}</small><strong>{trend[0]}</strong><span>{trend[1]}</span></button>)}
          <button className="show-more" onClick={() => nav("explore")}>show more</button>
        </section>
        <section className="side-card who">
          <h2>who to follow</h2>
          {[["AR", "Ari Rivers", "@aririvers"], ["DV", "Devon Vale", "@devonvale"], ["KS", "Kai Studio", "@kaistudio"]].map((person) => <div key={person[2]}><span className="avatar">{person[0]}</span><span><strong>{person[1]}</strong><small>{person[2]}</small></span><button onClick={(event) => { event.currentTarget.textContent = event.currentTarget.textContent === "follow" ? "following" : "follow"; }}>follow</button></div>)}
        </section>
        <footer>Terms · Privacy · Accessibility · About · © 2026 Elle</footer>
      </aside>

      <nav className="mobile-dock">
        <button className={tab === "home" ? "active" : ""} onClick={() => nav("home")}><span>⌂</span></button>
        <button className={tab === "explore" ? "active" : ""} onClick={() => nav("explore")}><span>⌕</span></button>
        <button className={tab === "ai" ? "active ai" : "ai"} onClick={() => nav("ai")}><span>✦</span></button>
        <button className={tab === "notifications" ? "active" : ""} onClick={() => nav("notifications")}><span>♡</span></button>
        <button className={tab === "messages" ? "active" : ""} onClick={() => nav("messages")}><span>✉</span></button>
      </nav>

      {authOpen && (
        <div className="auth-backdrop" onMouseDown={() => setAuthOpen(false)}>
          <form className="elle-auth" onSubmit={submitAuth} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="auth-close" onClick={() => setAuthOpen(false)}>×</button>
            <div className="elle-logo auth-logo"><span>e</span><b>elle</b></div>
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

      {toast && <div className="elle-toast">{toast}</div>}
    </main>
  );
}
