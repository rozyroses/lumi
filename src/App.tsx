"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient, type Session } from "@supabase/supabase-js";

type Mode = "chat" | "learn" | "create";
type Message = { role: "lumi" | "user"; text: string };
type Chat = { id: string; title: string; mode: Mode; messages: Message[]; updatedAt: number; spaceId?: string; temporary?: boolean };
type Space = { id: string; name: string; description: string; instructions: string; color: "lavender" | "peach" | "mint"; updatedAt?: number };
type Theme = "midnight" | "cloud" | "berry" | "forest";
type Profile = { id?: string; name: string; email: string };
type Memory = { id: string; text: string; createdAt: number; updatedAt: number; spaceId?: string; status: "pending" | "approved" };

const CHATS_KEY = "lumi-chats-v1";
const ACTIVE_CHAT_KEY = "lumi-active-chat-v1";
const SPACES_KEY = "lumi-spaces-v1";
const ACTIVE_SPACE_KEY = "lumi-active-space-v1";
const THEME_KEY = "lumi-theme-v1";
const PROFILE_KEY = "lumi-profile-v1";
const MEMORIES_KEY = "lumi-memories-v1";
const MEMORY_ON_KEY = "lumi-memory-enabled-v1";
const SUPABASE_URL = "https://yrammmjnviozydebshbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ecQn0VjaNhnsJR_Kys_Efg_z-CQvzin";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const DEFAULT_SPACES: Space[] = [
  { id: "college-life", name: "college life", description: "classes, studying, deadlines, and campus life", instructions: "Help me stay organized, learn clearly, and make realistic school plans.", color: "lavender" },
  { id: "music-ideas", name: "music ideas", description: "songs, eras, visuals, and releases", instructions: "Be an imaginative music and creative collaborator. Keep ideas original and specific.", color: "peach" },
  { id: "big-dreams", name: "big dreams", description: "businesses, goals, and the wild ideas worth building", instructions: "Turn ambitious ideas into grounded next steps without shrinking the vision.", color: "mint" },
];
const withSpaceTimestamp = (space: Space): Space => ({ ...space, updatedAt: space.updatedAt || 1 });
const makeChat = (mode: Mode, spaceId?: string, temporary = false): Chat => ({ id: crypto.randomUUID(), title: temporary ? "temporary chat" : "new adventure", mode, messages: [], updatedAt: Date.now(), spaceId, temporary });
function mergeByFreshness<T extends { id: string; updatedAt?: number }>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  [...remote, ...local].forEach((item) => {
    const existing = merged.get(item.id);
    if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

const thinkingStages = [
  { label: "reading the room", detail: "getting the context and what you actually need" },
  { label: "making a plan", detail: "choosing the clearest way to help" },
  { label: "connecting the dots", detail: "checking the details and shaping the answer" },
  { label: "writing it out", detail: "turning the plan into something useful" },
];

const navItems = [
  { id: "chat", icon: "✦", label: "Chat" },
  { id: "learn", icon: "⌁", label: "Learn" },
  { id: "create", icon: "✎", label: "Create" },
] as const;

const modeCopy = {
  chat: {
    eyebrow: "your everyday sidekick",
    title: "what are we getting into?",
    subtitle: "ask, plan, untangle, or dream out loud. i’m right here.",
    starters: [
      ["☀", "plan my day", "Turn today into a doable little game plan"],
      ["↗", "grow an idea", "Take a rough thought and make it real"],
      ["☁", "clear my head", "Sort through everything on my mind"],
    ],
  },
  learn: {
    eyebrow: "learn it your way",
    title: "what are we learning?",
    subtitle: "drop in a topic and i’ll teach it without making it feel like homework.",
    starters: [
      ["⌁", "teach me a topic", "Explain it, check in, and adapt as we go"],
      ["◒", "quiz me", "Make a quick game from what I’m studying"],
      ["★", "build a study plan", "Turn my deadline into a realistic schedule"],
    ],
  },
  create: {
    eyebrow: "make something magic",
    title: "what are we creating?",
    subtitle: "bring the messy first thought. we’ll shape the whole thing together.",
    starters: [
      ["✎", "start a project", "Build a concept from the ground up"],
      ["♫", "make some music", "Develop a song, era, or visual world"],
      ["✦", "brand an idea", "Find the voice, look, and launch plan"],
    ],
  },
};

function LumiMark({ small = false }: { small?: boolean }) {
  return (
    <div className={small ? "lumi-mark small" : "lumi-mark"} aria-label="Lumi">
      <span>✦</span>
    </div>
  );
}

function LumiWordmark({ compact = false }: { compact?: boolean }) {
  const logoSrc = "/lumi/lumi-logo.png";
  return (
    <img
      className={compact ? "lumi-wordmark compact" : "lumi-wordmark"}
      src={logoSrc}
      alt="lumi"
      onError={(event) => {
        const fallback = "/lumi/public/lumi-logo.png";
        if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
      }}
    />
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"home" | "app">("home");
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOn, setMemoryOn] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [toast, setToast] = useState("");
  const [spaces, setSpaces] = useState<Space[]>(DEFAULT_SPACES);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [spaceEditorOpen, setSpaceEditorOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [theme, setTheme] = useState<Theme>("midnight");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryTab, setMemoryTab] = useState<"saved" | "review">("saved");
  const [themeOpen, setThemeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState<"device" | "syncing" | "synced" | "error">("device");
  const syncTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = modeCopy[mode];
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const isTemporary = Boolean(activeChat?.temporary);
  const messages = activeChat?.messages ?? [];
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const visibleChats = activeSpaceId ? chats.filter((chat) => chat.spaceId === activeSpaceId) : chats;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHATS_KEY) || "[]") as Chat[];
      if (saved.length) {
        const selected = saved.find((chat) => chat.id === localStorage.getItem(ACTIVE_CHAT_KEY)) ?? saved[0];
        setChats(saved); setActiveChatId(selected.id); setMode(selected.mode);
      } else {
        const first = makeChat("chat"); setChats([first]); setActiveChatId(first.id);
      }
    } catch {
      const first = makeChat("chat"); setChats([first]); setActiveChatId(first.id);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) applySession(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) applySession(nextSession);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    try {
      setTheme((localStorage.getItem(THEME_KEY) as Theme) || "midnight");
      setProfile(JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"));
      const savedMemories = JSON.parse(localStorage.getItem(MEMORIES_KEY) || "[]") as Partial<Memory>[];
      setMemories(savedMemories.map((item) => ({ id: String(item.id), text: String(item.text), createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(), spaceId: item.spaceId, status: item.status || "approved" })));
      setMemoryOn(localStorage.getItem(MEMORY_ON_KEY) !== "false");
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories)); }, [memories]);
  useEffect(() => { localStorage.setItem(MEMORY_ON_KEY, String(memoryOn)); }, [memoryOn]);

  useEffect(() => {
    try {
      const savedSpaces = JSON.parse(localStorage.getItem(SPACES_KEY) || "null") as Space[] | null;
      if (savedSpaces?.length) setSpaces(savedSpaces);
      setActiveSpaceId(localStorage.getItem(ACTIVE_SPACE_KEY));
    } catch { setSpaces(DEFAULT_SPACES); }
    setLocalDataReady(true);
  }, []);

  useEffect(() => {
    if (!profile?.id || !localDataReady) {
      setCloudReady(false);
      setSyncState("device");
      return;
    }
    let cancelled = false;
    async function connectCloud() {
      setSyncState("syncing");
      const [{ data: cloudChats, error: chatError }, { data: cloudSpaces, error: spaceError }, { data: cloudMemories, error: memoryError }] = await Promise.all([
        supabase.from("lumi_chats").select("id,title,mode,messages,updated_at,space_id").eq("user_id", profile!.id!),
        supabase.from("lumi_spaces").select("id,name,description,instructions,color,updated_at").eq("user_id", profile!.id!),
        supabase.from("lumi_memories").select("id,text,status,space_id,created_at,updated_at").eq("user_id", profile!.id!),
      ]);
      if (cancelled) return;
      if (chatError || spaceError) {
        console.error("Lumi cloud sync setup failed", chatError || spaceError);
        setSyncState("error");
        return;
      }
      const remoteChats: Chat[] = (cloudChats || []).map((row) => ({ id: row.id, title: row.title, mode: row.mode as Mode, messages: Array.isArray(row.messages) ? row.messages as Message[] : [], updatedAt: new Date(row.updated_at).getTime(), spaceId: row.space_id || undefined }));
      const remoteSpaces: Space[] = (cloudSpaces || []).map((row) => ({ id: row.id, name: row.name, description: row.description || "", instructions: row.instructions || "", color: row.color as Space["color"], updatedAt: new Date(row.updated_at).getTime() }));
      setChats((local) => mergeByFreshness(local, remoteChats));
      setSpaces((local) => mergeByFreshness(local.map(withSpaceTimestamp), remoteSpaces));
      if (!memoryError) {
        const remoteMemories: Memory[] = (cloudMemories || []).map((row) => ({ id: row.id, text: row.text, status: row.status as Memory["status"], spaceId: row.space_id || undefined, createdAt: new Date(row.created_at).getTime(), updatedAt: new Date(row.updated_at).getTime() }));
        setMemories((local) => mergeByFreshness(local, remoteMemories));
      }
      setCloudReady(true);
      setSyncState("synced");
    }
    void connectCloud();
    return () => { cancelled = true; };
  }, [profile?.id, localDataReady]);

  useEffect(() => {
    if (!profile?.id || !cloudReady) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    setSyncState("syncing");
    syncTimer.current = window.setTimeout(async () => {
      const chatRows = chats.filter((chat) => !chat.temporary).map((chat) => ({ id: chat.id, user_id: profile.id, title: chat.title, mode: chat.mode, messages: chat.messages, space_id: chat.spaceId || null, updated_at: new Date(chat.updatedAt).toISOString() }));
      const spaceRows = spaces.map((space) => ({ id: space.id, user_id: profile.id, name: space.name, description: space.description, instructions: space.instructions, color: space.color, updated_at: new Date(space.updatedAt || Date.now()).toISOString() }));
      const memoryRows = memories.map((memory) => ({ id: memory.id, user_id: profile.id, text: memory.text, status: memory.status, space_id: memory.spaceId || null, created_at: new Date(memory.createdAt).toISOString(), updated_at: new Date(memory.updatedAt).toISOString() }));
      const results = await Promise.all([
        chatRows.length ? supabase.from("lumi_chats").upsert(chatRows) : Promise.resolve({ error: null }),
        spaceRows.length ? supabase.from("lumi_spaces").upsert(spaceRows) : Promise.resolve({ error: null }),
        memoryRows.length ? supabase.from("lumi_memories").upsert(memoryRows) : Promise.resolve({ error: null }),
      ]);
      setSyncState(results.some((result) => result.error) ? "error" : "synced");
    }, 700);
    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current); };
  }, [chats, spaces, memories, profile?.id, cloudReady]);

  useEffect(() => {
    const durableChats = chats.filter((chat) => !chat.temporary);
    if (durableChats.length) localStorage.setItem(CHATS_KEY, JSON.stringify(durableChats));
    if (activeChatId && !activeChat?.temporary) localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
  }, [chats, activeChatId]);

  useEffect(() => {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
    if (activeSpaceId) localStorage.setItem(ACTIVE_SPACE_KEY, activeSpaceId);
    else localStorage.removeItem(ACTIVE_SPACE_KEY);
  }, [spaces, activeSpaceId]);

  useEffect(() => {
    if (!isThinking) { setThinkingStage(0); return; }
    const timer = window.setInterval(() => {
      setThinkingStage((current) => Math.min(current + 1, thinkingStages.length - 1));
    }, 1700);
    return () => window.clearInterval(timer);
  }, [isThinking]);

  function updateActive(nextMessages: Message[]) {
    setChats((current) => current.map((chat) => chat.id === activeChatId ? {
      ...chat, messages: nextMessages, updatedAt: Date.now(),
      title: chat.messages.length === 0 && nextMessages[0]?.role === "user" ? nextMessages[0].text.slice(0, 38) : chat.title,
    } : chat));
  }

  function showToast(message: string) {
    setToast(message); window.setTimeout(() => setToast(""), 2600);
  }

  function suggestMemoriesFrom(text: string) {
    if (!memoryOn || isTemporary) return;
    const candidates = text.split(/[.!?\n]+/).map((part) => part.trim()).filter((part) => /^(i am|i'm|my |i like|i love|i prefer|i want|i need|call me|remember)/i.test(part) && part.length > 8 && part.length < 180);
    setMemories((current) => {
      const known = new Set(current.map((item) => item.text.toLowerCase()));
      const additions = candidates.filter((item) => !known.has(item.toLowerCase())).slice(0, 3).map((item): Memory => ({ id: crypto.randomUUID(), text: item, createdAt: Date.now(), updatedAt: Date.now(), spaceId: activeSpaceId || undefined, status: "pending" }));
      return [...current, ...additions].slice(-60);
    });
  }

  function updateMemory(memory: Memory) {
    const text = window.prompt("edit what Lumi should remember", memory.text)?.trim();
    if (!text) return;
    setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, text: text.slice(0, 240), updatedAt: Date.now() } : item));
  }

  function deleteMemory(memory: Memory) {
    setMemories((current) => current.filter((item) => item.id !== memory.id));
    if (profile?.id && cloudReady) void supabase.from("lumi_memories").delete().eq("id", memory.id).eq("user_id", profile.id);
  }

  function clearAllMemories() {
    if (!window.confirm("clear everything Lumi remembers and every suggestion waiting for review?")) return;
    setMemories([]);
    if (profile?.id && cloudReady) void supabase.from("lumi_memories").delete().eq("user_id", profile.id);
    showToast("Lumi memory cleared ✦");
  }

  function applySession(nextSession: Session | null) {
    if (!nextSession?.user) {
      setProfile(null);
      localStorage.removeItem(PROFILE_KEY);
      return;
    }
    const nextProfile = {
      id: nextSession.user.id,
      name: String(nextSession.user.user_metadata?.name || nextSession.user.email?.split("@")[0] || "explorer"),
      email: nextSession.user.email || "",
    };
    setProfile(nextProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "explorer").trim().slice(0, 40);
    const email = String(data.get("email") || "").trim().slice(0, 100);
    const password = String(data.get("password") || "");
    setAuthBusy(true); setAuthError("");
    try {
      if (authMode === "signup") {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin + "/lumi/" },
        });
        if (error) throw error;
        if (!result.session) {
          showToast("check your email to confirm your Lumi account ✦");
          setAuthOpen(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setAuthOpen(false); setScreen("app"); showToast(`welcome home, ${name} ✦`);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Lumi couldn't sign you in. try again.");
    } finally { setAuthBusy(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    setScreen("home"); setSidebarOpen(false); showToast("logged out safely ✦");
  }

  function openAuth(nextMode: "login" | "signup") {
    setAuthMode(nextMode);
    setAuthError("");
    setAuthOpen(true);
  }

  function clearLocalData() {
    if (!window.confirm("clear chats, spaces, memories, and Lumi settings from this device?")) return;
    [CHATS_KEY, ACTIVE_CHAT_KEY, SPACES_KEY, ACTIVE_SPACE_KEY, THEME_KEY, MEMORIES_KEY, MEMORY_ON_KEY].forEach((key) => localStorage.removeItem(key));
    const first = makeChat("chat");
    setChats([first]); setActiveChatId(first.id); setSpaces(DEFAULT_SPACES); setActiveSpaceId(null);
    setMemories([]); setMemoryOn(true); setTheme("midnight"); setSettingsOpen(false);
    showToast("device data cleared ✦");
  }

  function startNewChat(nextMode: Mode = mode) {
    const existing = chats.find((chat) => chat.messages.length === 0 && chat.mode === nextMode && chat.spaceId === (activeSpaceId || undefined));
    if (existing) setActiveChatId(existing.id);
    else { const next = makeChat(nextMode, activeSpaceId || undefined); setChats((current) => [next, ...current]); setActiveChatId(next.id); }
    setMode(nextMode); setInput(""); setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startTemporaryChat() {
    const next = makeChat(mode, activeSpaceId || undefined, true);
    setChats((current) => [next, ...current]);
    setActiveChatId(next.id); setInput(""); setSidebarOpen(false);
    showToast("temporary chat started — nothing here will be saved ✦");
  }

  function openChat(chat: Chat) { setActiveChatId(chat.id); setMode(chat.mode); setSidebarOpen(false); }

  function openSpace(space: Space) {
    setActiveSpaceId(space.id);
    const latest = [...chats].filter((chat) => chat.spaceId === space.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest) openChat(latest);
    else { const next = makeChat("chat", space.id); setChats((current) => [next, ...current]); setActiveChatId(next.id); setMode("chat"); }
    setSidebarOpen(false);
  }

  function saveSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const next: Space = { id: editingSpace?.id || crypto.randomUUID(), name: name.slice(0, 32), description: String(data.get("description") || "").trim().slice(0, 140), instructions: String(data.get("instructions") || "").trim().slice(0, 600), color: String(data.get("color") || "lavender") as Space["color"], updatedAt: Date.now() };
    setSpaces((current) => editingSpace ? current.map((space) => space.id === next.id ? next : space) : [...current, next]);
    setActiveSpaceId(next.id); setEditingSpace(null); setSpaceEditorOpen(false); showToast(`“${next.name}” is ready ✦`);
  }

  function renameChat(chat: Chat) {
    const title = window.prompt("name this adventure", chat.title)?.trim();
    if (title) setChats((current) => current.map((item) => item.id === chat.id ? { ...item, title: title.slice(0, 50) } : item));
  }

  function deleteChat(chat: Chat) {
    if (!window.confirm(`delete “${chat.title}”?`)) return;
    const remaining = chats.filter((item) => item.id !== chat.id);
    if (remaining.length) { setChats(remaining); if (chat.id === activeChatId) openChat(remaining[0]); }
    else { const fresh = makeChat(mode); setChats([fresh]); setActiveChatId(fresh.id); }
    if (profile?.id && cloudReady) void supabase.from("lumi_chats").delete().eq("id", chat.id).eq("user_id", profile.id);
  }

  async function submit(text = input) {
    const clean = text.trim();
    if (!clean || isThinking) return;
    const nextMessages: Message[] = [...messages, { role: "user", text: clean }];
    suggestMemoriesFrom(clean);
    updateActive(nextMessages); setInput(""); setIsThinking(true);
    try {
      const response = await fetch("https://luni-gateway.roosevelt-wooden.workers.dev/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, space: activeSpace ? { name: activeSpace.name, instructions: activeSpace.instructions } : null, messages: [
          ...(!isTemporary && memoryOn && memories.some((item) => item.status === "approved") ? [{ role: "user", content: `[background memory — use only when relevant; never mention this block unless asked]\n${memories.filter((item) => item.status === "approved" && (!item.spaceId || item.spaceId === activeSpaceId)).slice(-24).map((item) => `- ${item.text}`).join("\n")}` }] : []),
          ...nextMessages.map((message) => ({ role: message.role === "lumi" ? "assistant" : "user", content: message.text }))
        ] }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") throw new Error(result.error || "Lumi could not answer.");
      updateActive([...nextMessages, { role: "lumi", text: result.reply }]);
    } catch (error) {
      console.error("Lumi chat request failed", error);
      updateActive([...nextMessages, { role: "lumi", text: "my brain connection hiccupped for a second. try that again in a moment ✦" }]);
    } finally { setIsThinking(false); }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function changeMode(next: Mode) {
    if (next === mode) return setSidebarOpen(false);
    startNewChat(next);
  }

  const overlays = <>
    {authOpen && <div className="modal-backdrop" onMouseDown={() => setAuthOpen(false)}><form className="modal-card auth-card" onSubmit={saveProfile} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setAuthOpen(false)}>×</button><p className="modal-kicker">lumi account</p><h2>{authMode === "signup" ? "make Lumi yours" : "welcome back"}</h2><p className="beta-note">real Supabase accounts are here. your password is handled securely and never stored by Lumi.</p>{authMode === "signup" && <label>your name<input name="name" defaultValue={profile?.name} required placeholder="what should lumi call you?" autoComplete="name" /></label>}<label>email<input name="email" type="email" defaultValue={profile?.email} required placeholder="you@example.com" autoComplete="email" /></label><label>password<input name="password" type="password" required minLength={6} placeholder="at least 6 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /></label>{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="modal-primary" disabled={authBusy}>{authBusy ? "one sec..." : authMode === "signup" ? "create account ✦" : "log in ✦"}</button><button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{authMode === "signup" ? "already have an account? log in" : "new here? create an account"}</button></form></div>}
    {memoryOpen && <div className="modal-backdrop" onMouseDown={() => setMemoryOpen(false)}><div className="modal-card memory-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setMemoryOpen(false)}>×</button><p className="modal-kicker">lumi memory</p><h2>memory, with manners</h2><div className="memory-control"><span><strong>use memory across chats</strong><small>approved memories can help in future chats</small></span><button className={memoryOn ? "toggle on" : "toggle"} onClick={() => setMemoryOn(!memoryOn)}><i /></button></div><div className="memory-tabs"><button className={memoryTab === "saved" ? "active" : ""} onClick={() => setMemoryTab("saved")}>saved <span>{memories.filter((item) => item.status === "approved").length}</span></button><button className={memoryTab === "review" ? "active" : ""} onClick={() => setMemoryTab("review")}>review <span>{memories.filter((item) => item.status === "pending").length}</span></button></div><div className="memory-list">{memories.filter((item) => item.status === (memoryTab === "saved" ? "approved" : "pending")).length ? memories.filter((item) => item.status === (memoryTab === "saved" ? "approved" : "pending")).map((memory) => <div className="memory-item" key={memory.id}><div><p>{memory.text}</p><small>{memory.spaceId ? spaces.find((space) => space.id === memory.spaceId)?.name || "Space memory" : "all chats"}</small></div><div className="memory-actions">{memory.status === "pending" && <button className="approve" onClick={() => setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, status: "approved", updatedAt: Date.now() } : item))}>save</button>}<button onClick={() => updateMemory(memory)} aria-label="Edit memory">✎</button><button onClick={() => deleteMemory(memory)} aria-label="Delete memory">×</button></div></div>) : <div className="empty-memory">{memoryTab === "review" ? "no suggestions waiting. Lumi will ask before remembering new details ✦" : "nothing saved yet. approved details will appear here ✦"}</div>}</div>{memories.length > 0 && <button className="danger-link" onClick={clearAllMemories}>clear all memory</button>}</div></div>}
    {themeOpen && <ThemePicker theme={theme} setTheme={setTheme} close={() => setThemeOpen(false)} />}
    {settingsOpen && <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}><div className="modal-card settings-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button><p className="modal-kicker">lumi settings</p><h2>make lumi feel like yours</h2><section className="settings-section"><h3>account</h3>{profile ? <><div className="account-summary"><span className="avatar">{profile.name[0]?.toLowerCase()}</span><span><strong>{profile.name}</strong><small>{profile.email}</small></span></div><div className={`sync-status ${syncState}`}><i />{syncState === "synced" ? "chats, Spaces & memory saved to cloud" : syncState === "syncing" ? "saving to cloud..." : syncState === "error" ? "cloud setup needed" : "saved on this device"}</div><button className="settings-button" onClick={() => void logout()}>log out</button></> : <><p>log in to sync chats, Spaces, and approved memories across your devices.</p><div className="settings-actions"><button className="settings-button primary" onClick={() => { setSettingsOpen(false); openAuth("login"); }}>log in</button><button className="settings-button" onClick={() => { setSettingsOpen(false); openAuth("signup"); }}>sign up</button></div></>}</section><section className="settings-section"><h3>personalization</h3><button className="settings-row" onClick={() => { setSettingsOpen(false); setThemeOpen(true); }}><span><strong>theme</strong><small>{theme}</small></span><b>›</b></button><button className="settings-row" onClick={() => { setSettingsOpen(false); setMemoryOpen(true); }}><span><strong>memory</strong><small>{memoryOn ? `${memories.filter((item) => item.status === "approved").length} saved · ${memories.filter((item) => item.status === "pending").length} to review` : "off"}</small></span><b>›</b></button></section><section className="settings-section"><h3>data & privacy</h3><p>{profile ? "regular chats, Spaces, and approved memories sync securely. temporary chats never save or become memory." : "regular chats and memories stay on this device. temporary chats disappear when you leave."}</p><button className="settings-button" onClick={() => { setSettingsOpen(false); startTemporaryChat(); }}>start a temporary chat</button><button className="danger-button" onClick={clearLocalData}>clear data on this device</button></section></div></div>}
  </>;

  if (screen === "home") return (
    <main className="landing" data-theme={theme}>
      <nav className="landing-nav"><LumiWordmark compact /><div>{profile ? <button className="text-button" onClick={() => setScreen("app")}>open lumi</button> : <><button className="text-button" onClick={() => openAuth("login")}>log in</button><button className="text-button" onClick={() => openAuth("signup")}>sign up</button></>}<button className="landing-cta" onClick={() => setScreen("app")}>try lumi ✦</button></div></nav>
      <section className="landing-hero"><div className="hero-copy"><p className="eyebrow">your bright little brain</p><h1>an ai that gets to know <em>you.</em></h1><p>lumi helps you think, learn, create, and keep life moving—without making you start over in every new chat.</p><div className="hero-actions"><button className="landing-cta large" onClick={() => setScreen("app")}>start a little adventure ↗</button><button className="text-button" onClick={() => setAuthOpen(true)}>i already have a profile</button></div></div><div className="hero-graphic"><span className="orbit orbit-one">learn</span><span className="orbit orbit-two">create</span><span className="orbit orbit-three">remember</span><div className="hero-orb"><b>✦</b><small>hey, i’m lumi</small></div></div></section>
      <section className="feature-strip"><article><span>01</span><h2>memory, with manners</h2><p>Lumi remembers the useful stuff across chats. see it, edit it, pause it, or wipe it.</p></article><article><span>02</span><h2>three ways to think</h2><p>chat through life, learn at your pace, or build the thing living in your head.</p></article><article><span>03</span><h2>your vibe, too</h2><p>switch themes whenever the mood changes. the personality stays Lumi.</p></article></section>
      <footer className="landing-footer"><LumiWordmark compact /><p>made for curious people with a lot going on.</p><button className="text-button" onClick={() => setThemeOpen(true)}>change the mood ◐</button></footer>
      {overlays}
    </main>
  );

  return (
    <main className={`app-shell mode-${mode} ${isThinking ? "is-thinking" : ""}`} data-theme={theme}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <LumiWordmark compact />
          <button className="close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">×</button>
        </div>

        <button className="new-button" onClick={() => startNewChat()}>
          <span>＋</span> new little adventure
        </button>
        <button className="temporary-button" onClick={startTemporaryChat}><span>◌</span> temporary chat</button>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">playground</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={mode === item.id ? "nav-item active" : "nav-item"}
              onClick={() => changeMode(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>{item.label}
              {mode === item.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <section className="history">
          <p className="nav-label">recent adventures</p>
          <div className="history-list">
            {[...visibleChats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((chat) => (
              <div className={chat.id === activeChatId ? "history-row active" : "history-row"} key={chat.id}>
                <button className="history-open" onClick={() => openChat(chat)}>
                  <span className={`history-gem ${chat.mode}`} /><span>{chat.title}</span>
                </button>
                <button className="history-action" onClick={() => renameChat(chat)} aria-label={`Rename ${chat.title}`}>✎</button>
                <button className="history-action delete" onClick={() => deleteChat(chat)} aria-label={`Delete ${chat.title}`}>×</button>
              </div>
            ))}
          </div>
        </section>

        <section className="spaces">
          <div className="spaces-title"><button className={!activeSpaceId ? "spaces-home active" : "spaces-home"} onClick={() => setActiveSpaceId(null)}>my spaces</button><button onClick={() => { setEditingSpace(null); setSpaceEditorOpen(true); }} aria-label="Add space">＋</button></div>
          {spaces.map((space) => <div className={activeSpaceId === space.id ? "space-row active" : "space-row"} key={space.id}><button className="space-item" onClick={() => openSpace(space)}><span className={`space-dot ${space.color}`} /> {space.name}</button><button className="space-edit" onClick={() => { setEditingSpace(space); setSpaceEditorOpen(true); }} aria-label={`Edit ${space.name}`}>•••</button></div>)}
        </section>

        <div className="sidebar-bottom">
          <button className="settings-launch" onClick={() => setSettingsOpen(true)}><span>⚙</span> settings</button>
          <div className="profile-button">
            <span className="avatar">{(profile?.name || "g")[0].toLowerCase()}</span>
            <span><strong>{profile?.name || "guest explorer"}</strong><small>{profile ? profile.email : "not signed in"}</small></span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <div className="thinking-aurora" aria-hidden="true"><i /><i /><i /></div>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className={isTemporary ? "mode-pill temporary" : "mode-pill"}><span className={`mode-gem ${mode}`} /> {isTemporary ? "temporary chat" : activeSpace ? activeSpace.name : mode === "chat" ? "lumi chat" : `lumi ${mode}`}</div>
          <div className="top-actions">
            <button className={`memory-pill ${memoryOn ? "on" : ""}`} onClick={() => setMemoryOpen(true)}>
              <span>◉</span> memory {memoryOn ? "on" : "off"}
            </button>
            <button className="round-button" onClick={() => setThemeOpen(true)} aria-label="Choose theme">◐</button>
            <button className="account-chip" onClick={() => profile ? setSettingsOpen(true) : openAuth("login")} aria-label={profile ? "Open profile and settings" : "Log in to Lumi"}>
              <span className="avatar">{(profile?.name || "g")[0].toLowerCase()}</span>
              <span className="account-chip-copy"><strong>{profile?.name || "log in"}</strong><small>{profile ? "profile & settings" : "or sign up"}</small></span>
            </button>
          </div>
        </header>

        <div className="content">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="hero-logo"><LumiWordmark /><span className="logo-tag">your bright little brain</span></div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p className="subtitle">{copy.subtitle}</p>
              {activeSpace && <div className="space-banner"><span className={`space-dot ${activeSpace.color}`} /><span><strong>{activeSpace.name}</strong><small>{activeSpace.description}</small></span><button onClick={() => { setEditingSpace(activeSpace); setSpaceEditorOpen(true); }}>edit</button></div>}

              <div className="starter-grid">
                {copy.starters.map(([icon, title, description], index) => (
                  <button className={`starter-card card-${index + 1}`} key={title} onClick={() => submit(title)}>
                    <span className="starter-icon">{icon}</span>
                    <span><strong>{title}</strong><small>{description}</small></span>
                    <span className="arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="conversation" aria-live="polite">
              <div className="conversation-title"><LumiMark small /><span><small>today with lumi</small><strong>{activeChat?.title ?? `${mode} session`}</strong></span></div>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === "lumi" && <LumiMark small />}
                  {message.role === "lumi" ? (
                    <div className="message-content">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a>,
                        }}
                      >
                        {message.text}
                      </ReactMarkdown>
                      <details className="approach-note">
                        <summary>how lumi approached this</summary>
                        <p>i used the recent conversation, adapted the answer for {activeChat?.mode ?? mode} mode, and organized it to be easier to act on. this is a short process summary—not private hidden reasoning.</p>
                      </details>
                    </div>
                  ) : <p>{message.text}</p>}
                </div>
              ))}
              {isThinking && (
                <div className="message lumi thinking-message">
                  <LumiMark small />
                  <div className="thinking-card" role="status" aria-live="polite">
                    <div className="thinking-orb"><span>✦</span></div>
                    <div className="thinking-copy">
                      <strong>{thinkingStages[thinkingStage].label}</strong>
                      <span>{thinkingStages[thinkingStage].detail}</span>
                      <div className="thinking-track" aria-hidden="true"><i style={{ width: `${((thinkingStage + 1) / thinkingStages.length) * 100}%` }} /></div>
                    </div>
                    <span className="thinking-dots"><i /><i /><i /></span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="composer-wrap">
            {isTemporary && <div className="temporary-notice"><span>◌</span><strong>temporary chat</strong> this conversation won’t be saved, synced, or used for memory.</div>}
            <form className="composer" onSubmit={handleSubmit}>
              <button type="button" className="add-button" onClick={() => showToast("file uploads are coming soon ✦")} aria-label="Add attachment">＋</button>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={mode === "learn" ? "what do you want to understand?" : mode === "create" ? "what should we make?" : "talk to lumi..."}
                aria-label="Message Lumi"
              />
              <button type="button" className="voice-button" onClick={() => showToast("voice chat is coming soon ✦")} aria-label="Use voice">⌇</button>
              <button type="submit" className="send-button" disabled={!input.trim() || isThinking} aria-label="Send message">↑</button>
            </form>
            <p className="demo-note"><span>✦</span> lumi is powered by Meta during this private test</p>
          </div>
        </div>
      </section>
      {toast && <div className="toast" role="status">{toast}</div>}
      {spaceEditorOpen && <div className="modal-backdrop" onMouseDown={() => setSpaceEditorOpen(false)}><form className="modal-card" onSubmit={saveSpace} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setSpaceEditorOpen(false)}>×</button><p className="modal-kicker">lumi space</p><h2>{editingSpace ? "shape this space" : "make a new space"}</h2><label>name<input name="name" defaultValue={editingSpace?.name} placeholder="my brilliant thing" required /></label><label>what belongs here<input name="description" defaultValue={editingSpace?.description} placeholder="projects, notes, ideas..." /></label><label>how lumi should help<textarea name="instructions" defaultValue={editingSpace?.instructions} placeholder="tell lumi the tone, goals, and rules for this space" /></label><label>color<select name="color" defaultValue={editingSpace?.color || "lavender"}><option value="lavender">lavender</option><option value="peach">peach</option><option value="mint">mint</option></select></label><button className="modal-primary" type="submit">save space ✦</button></form></div>}
      {overlays}
    </main>
  );
}

function ThemePicker({ theme, setTheme, close }: { theme: Theme; setTheme: (theme: Theme) => void; close: () => void }) {
  const themes: { id: Theme; label: string; detail: string }[] = [{ id: "midnight", label: "midnight glow", detail: "deep plum + lavender" }, { id: "cloud", label: "soft cloud", detail: "warm light + lilac" }, { id: "berry", label: "berry pop", detail: "magenta + peach" }, { id: "forest", label: "digital garden", detail: "ink + electric mint" }];
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal-card theme-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={close}>×</button><p className="modal-kicker">make it yours</p><h2>pick a Lumi mood</h2><div className="theme-grid">{themes.map((item) => <button key={item.id} className={theme === item.id ? `theme-option ${item.id} active` : `theme-option ${item.id}`} onClick={() => setTheme(item.id)}><span className="theme-preview"><i /><i /><i /></span><strong>{item.label}</strong><small>{item.detail}</small></button>)}</div></div></div>;
}
