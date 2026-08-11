"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient, type Session } from "@supabase/supabase-js";

type Mode = "chat" | "learn" | "create";
type Attachment = { id: string; name: string; type: string; size: number; kind: "image" | "pdf" | "document" | "text"; dataUrl?: string; extractedText?: string; pageCount?: number };
type Message = { role: "lumi" | "user"; text: string; attachments?: Attachment[] };
type Chat = { id: string; title: string; mode: Mode; messages: Message[]; updatedAt: number; spaceId?: string; temporary?: boolean; pinned?: boolean; archived?: boolean };
type Space = { id: string; name: string; description: string; instructions: string; color: "lavender" | "peach" | "mint"; updatedAt?: number };
type Theme = "midnight" | "cloud" | "berry" | "forest";
type Mood = "calm" | "bright" | "focused" | "tender" | "creative" | "urgent";
type Profile = { id?: string; name: string; email: string };
type Memory = { id: string; text: string; createdAt: number; updatedAt: number; spaceId?: string; status: "pending" | "approved" };
type Onboarding = { name: string; pronouns: string; style: string; interests: string };

const CHATS_KEY = "lumi-chats-v1";
const ACTIVE_CHAT_KEY = "lumi-active-chat-v1";
const SPACES_KEY = "lumi-spaces-v1";
const ACTIVE_SPACE_KEY = "lumi-active-space-v1";
const THEME_KEY = "lumi-theme-v1";
const MEMORIES_KEY = "lumi-memories-v1";
const MEMORY_ON_KEY = "lumi-memory-enabled-v1";
const CHAT_PREFS_KEY = "lumi-chat-preferences-v1";
const ONBOARDING_KEY = "lumi-onboarding-v1";
const GUEST_OWNER = "guest";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const ACCEPTED_ATTACHMENTS = "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SUPABASE_URL = "https://yrammmjnviozydebshbd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ecQn0VjaNhnsJR_Kys_Efg_z-CQvzin";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const DEFAULT_SPACES: Space[] = [
  { id: "college-life", name: "college life", description: "classes, studying, deadlines, and campus life", instructions: "Help me stay organized, learn clearly, and make realistic school plans.", color: "lavender" },
  { id: "music-ideas", name: "music ideas", description: "songs, eras, visuals, and releases", instructions: "Be an imaginative music and creative collaborator. Keep ideas original and specific.", color: "peach" },
  { id: "big-dreams", name: "big dreams", description: "businesses, goals, and the wild ideas worth building", instructions: "Turn ambitious ideas into grounded next steps without shrinking the vision.", color: "mint" },
];
const withSpaceTimestamp = (space: Space): Space => ({ ...space, updatedAt: space.updatedAt || 1 });
const storageKey = (key: string, ownerId: string) => `${key}:${ownerId}`;
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
  { label: "i’m with you", detail: "taking in what you said and what may help most" },
  { label: "finding our next step", detail: "balancing support, clarity, and action" },
  { label: "connecting the dots", detail: "using the context you’ve shared with me" },
  { label: "putting it together", detail: "making this useful, honest, and like you" },
];

const COMPANION_GUIDE = `[Lumi companion behavior — follow quietly]
Be a grounded, warm AI companion, not a mascot, fictional character, therapist, or obedient assistant. Work with the person instead of performing at them. Match their energy without copying it excessively. When a message could call for listening, advice, or practical help and the intent is unclear, briefly ask which they want. Validate feelings without diagnosing, encouraging dependency, claiming consciousness, or implying you replace human relationships. Use remembered context only when it genuinely helps. Be candid, specific, and collaborative; say "we can" naturally, but never pretend to have a human life or feelings.`;

const moodCopy: Record<Mood, string> = {
  calm: "soft & steady",
  bright: "good energy",
  focused: "locked in",
  tender: "gentle mode",
  creative: "ideas sparking",
  urgent: "moving with you",
};

function detectMood(text: string, mode: Mode): Mood {
  const value = text.toLowerCase();
  if (/\b(urgent|asap|emergency|quick|hurry|deadline|stressed|panic|help!)\b/.test(value)) return "urgent";
  if (/\b(sad|hurt|cry|grief|miss|lonely|anxious|overwhelmed|scared|love you)\b/.test(value)) return "tender";
  if (/\b(excited|yay|yass|omg|amazing|happy|celebrate|period|lmao|lol)\b/.test(value)) return "bright";
  if (mode === "create" || /\b(create|design|song|music|idea|write|art|brand|story|visual)\b/.test(value)) return "creative";
  if (mode === "learn" || /\b(study|learn|quiz|explain|homework|test|plan|research|focus)\b/.test(value)) return "focused";
  return "calm";
}

const navItems = [
  { id: "chat", icon: "✦", label: "Chat" },
  { id: "learn", icon: "⌁", label: "Learn" },
  { id: "create", icon: "✎", label: "Create" },
] as const;

const modeCopy = {
  chat: {
    eyebrow: "a companion for whatever’s real today",
    title: "what’s on your mind?",
    subtitle: "talk it out, get unstuck, or make a plan. we can meet the moment together.",
    starters: [
      ["☁", "just listen for a minute", "Help me say it before we try to solve it"],
      ["↗", "help me figure this out", "Think beside me and find a grounded next step"],
      ["☀", "help me lock in", "Turn the noise into one doable plan"],
    ],
  },
  learn: {
    eyebrow: "learn it your way",
    title: "what are we learning?",
    subtitle: "bring what’s confusing. we’ll slow it down and learn it your way.",
    starters: [
      ["⌁", "teach me a topic", "Explain it, check in, and adapt as we go"],
      ["◒", "quiz me", "Make a quick game from what I’m studying"],
      ["★", "build a study plan", "Turn my deadline into a realistic schedule"],
    ],
  },
  create: {
    eyebrow: "make something magic",
    title: "what are we creating?",
    subtitle: "bring the messy first thought. we’ll stay with it until it feels like yours.",
    starters: [
      ["✎", "start a project", "Build a concept from the ground up"],
      ["♫", "make some music", "Develop a song, era, or visual world"],
      ["✦", "brand an idea", "Find the voice, look, and launch plan"],
    ],
  },
};

function LumiMark({ small = false, thinking = false }: { small?: boolean; thinking?: boolean }) {
  return (
    <div className={`${small ? "lumi-mark small" : "lumi-mark"}${thinking ? " avatar-thinking" : ""}`} aria-label="Lumi">
      <img src="/lumi/lumi-avatar.png" alt="" />
      <span className="avatar-spark">✦</span>
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

function attachmentKind(file: File): Attachment["kind"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name)) return "text";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) return "document";
  return null;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("file could not be read"));
    reader.readAsDataURL(file);
  });
}

async function extractAttachment(file: File, kind: Attachment["kind"]): Promise<Pick<Attachment, "dataUrl" | "extractedText" | "pageCount">> {
  if (kind === "image") return { dataUrl: await readAsDataUrl(file) };
  if (kind === "text") return { extractedText: (await file.text()).slice(0, 80000) };
  if (kind === "document") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { extractedText: result.value.slice(0, 80000) };
  }
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
    pages.push(`[page ${pageNumber}]\n${text}`);
    if (pages.join("\n\n").length > 80000) break;
  }
  return { extractedText: pages.join("\n\n").slice(0, 80000), pageCount: pdf.numPages };
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [screen, setScreen] = useState<"home" | "app">("home");
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [chatError, setChatError] = useState("");
  const [lastFailedMessages, setLastFailedMessages] = useState<Message[] | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [localDataReady, setLocalDataReady] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState<"device" | "syncing" | "synced" | "error">("device");
  const syncTimer = useRef<number | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copy = modeCopy[mode];
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const isTemporary = Boolean(activeChat?.temporary);
  const messages = activeChat?.messages ?? [];
  const activeSpace = spaces.find((space) => space.id === activeSpaceId);
  const searchNeedle = chatSearch.trim().toLowerCase();
  const visibleChats = chats.filter((chat) => {
    if (chat.temporary || Boolean(chat.archived) !== showArchived) return false;
    if (activeSpaceId && chat.spaceId !== activeSpaceId) return false;
    if (!searchNeedle) return true;
    return chat.title.toLowerCase().includes(searchNeedle) || chat.messages.some((message) => message.text.toLowerCase().includes(searchNeedle));
  });
  const latestUserText = [...messages].reverse().find((message) => message.role === "user")?.text || "";
  const mood = detectMood(input || latestUserText, mode);

  useEffect(() => {
    const online = () => { setIsOnline(true); setChatError(""); };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
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
    if (!dataOwnerId) return;
    setLocalDataReady(false);
    setCloudReady(false);
    try {
      const get = (key: string) => localStorage.getItem(storageKey(key, dataOwnerId));
      const saved = JSON.parse(get(CHATS_KEY) || "[]") as Chat[];
      const preferences = JSON.parse(get(CHAT_PREFS_KEY) || "{}") as Record<string, { pinned?: boolean; archived?: boolean }>;
      const restored = saved.map((chat) => ({ ...chat, ...preferences[chat.id] }));
      const selected = restored.find((chat) => chat.id === get(ACTIVE_CHAT_KEY)) ?? restored.find((chat) => !chat.archived) ?? restored[0];
      if (selected) {
        setChats(restored); setActiveChatId(selected.id); setMode(selected.mode);
      } else {
        const first = makeChat("chat"); setChats([first]); setActiveChatId(first.id); setMode("chat");
      }
      const savedSpaces = JSON.parse(get(SPACES_KEY) || "null") as Space[] | null;
      setSpaces(savedSpaces?.length ? savedSpaces : DEFAULT_SPACES);
      setActiveSpaceId(get(ACTIVE_SPACE_KEY));
      const savedMemories = JSON.parse(get(MEMORIES_KEY) || "[]") as Partial<Memory>[];
      setMemories(savedMemories.map((item) => ({ id: String(item.id), text: String(item.text), createdAt: Number(item.createdAt) || Date.now(), updatedAt: Number(item.updatedAt) || Number(item.createdAt) || Date.now(), spaceId: item.spaceId, status: item.status || "approved" })));
      setTheme((get(THEME_KEY) as Theme) || "midnight");
      setMemoryOn(get(MEMORY_ON_KEY) !== "false");
      setOnboardingOpen(!get(ONBOARDING_KEY));
    } catch {
      const first = makeChat("chat");
      setChats([first]); setActiveChatId(first.id); setMode("chat"); setSpaces(DEFAULT_SPACES); setActiveSpaceId(null);
      setMemories([]); setTheme("midnight"); setMemoryOn(true); setOnboardingOpen(true);
    }
    setLocalDataReady(true);
  }, [dataOwnerId]);

  useEffect(() => { if (dataOwnerId && localDataReady) localStorage.setItem(storageKey(THEME_KEY, dataOwnerId), theme); }, [theme, dataOwnerId, localDataReady]);
  useEffect(() => { if (dataOwnerId && localDataReady) localStorage.setItem(storageKey(MEMORIES_KEY, dataOwnerId), JSON.stringify(memories)); }, [memories, dataOwnerId, localDataReady]);
  useEffect(() => { if (dataOwnerId && localDataReady) localStorage.setItem(storageKey(MEMORY_ON_KEY, dataOwnerId), String(memoryOn)); }, [memoryOn, dataOwnerId, localDataReady]);
  useEffect(() => {
    if (profile?.id && cloudReady) saveCloudPreferences(theme, memoryOn);
  }, [theme, memoryOn, profile?.id, cloudReady]);
  useEffect(() => {
    const preferences = Object.fromEntries(chats.filter((chat) => chat.pinned || chat.archived).map((chat) => [chat.id, { pinned: chat.pinned, archived: chat.archived }]));
    if (dataOwnerId && localDataReady) localStorage.setItem(storageKey(CHAT_PREFS_KEY, dataOwnerId), JSON.stringify(preferences));
  }, [chats, dataOwnerId, localDataReady]);

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
    if (!dataOwnerId || !localDataReady) return;
    localStorage.setItem(storageKey(CHATS_KEY, dataOwnerId), JSON.stringify(durableChats));
    if (activeChatId && !activeChat?.temporary) localStorage.setItem(storageKey(ACTIVE_CHAT_KEY, dataOwnerId), activeChatId);
  }, [chats, activeChatId, dataOwnerId, localDataReady]);

  useEffect(() => {
    if (!dataOwnerId || !localDataReady) return;
    localStorage.setItem(storageKey(SPACES_KEY, dataOwnerId), JSON.stringify(spaces));
    if (activeSpaceId) localStorage.setItem(storageKey(ACTIVE_SPACE_KEY, dataOwnerId), activeSpaceId);
    else localStorage.removeItem(storageKey(ACTIVE_SPACE_KEY, dataOwnerId));
  }, [spaces, activeSpaceId, dataOwnerId, localDataReady]);

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

  function saveMemoriesFrom(text: string) {
    if (!memoryOn || isTemporary) return;
    const memoryCue = /\b(i am|i'm|i study|i work|i live|i have|i like|i love|i hate|i prefer|i want|i need|i plan|i hope|my (?:name|goal|birthday|school|job|project|business|family|friend|partner|favorite)|call me|remember(?: that)?)\b/i;
    const sensitiveCue = /\b(password|passcode|pin|social security|ssn|credit card|debit card|bank account|routing number|api key|secret key|access token|private key)\b/i;
    const candidates = text
      .split(/[.!?\n]+/)
      .map((part) => part.trim())
      .filter((part) => memoryCue.test(part) && !sensitiveCue.test(part) && part.length > 8 && part.length < 220);
    setMemories((current) => {
      const known = new Set(current.map((item) => item.text.toLowerCase()));
      const now = Date.now();
      const memoryKind = (item: string) => {
        const rules: [string, RegExp][] = [["name", /\b(my name is|call me)\b/i], ["location", /\b(i live|i moved|i'm from|i am from)\b/i], ["school", /\b(i study|my school|i attend)\b/i], ["work", /\b(i work|my job)\b/i], ["goal", /\b(my goal|i want to|i plan to|i hope to)\b/i], ["preference", /\b(i prefer|my favorite|i like|i love|i hate)\b/i]];
        return rules.find(([, pattern]) => pattern.test(item))?.[0] || "detail";
      };
      const replacingKinds = new Set(candidates.map(memoryKind).filter((kind) => kind !== "detail" && kind !== "preference"));
      const replaced = current.filter((item) => replacingKinds.has(memoryKind(item.text)) && candidates.every((candidate) => candidate.toLowerCase() !== item.text.toLowerCase()));
      if (replaced.length && profile?.id && cloudReady) void supabase.from("lumi_memories").delete().in("id", replaced.map((item) => item.id)).eq("user_id", profile.id);
      const kept = current.filter((item) => !replaced.some((old) => old.id === item.id));
      const additions = candidates.filter((item) => !known.has(item.toLowerCase())).slice(0, 3).map((item): Memory => ({ id: crypto.randomUUID(), text: item, createdAt: now, updatedAt: now, spaceId: activeSpaceId || undefined, status: "approved" }));
      if (additions.length) showToast(`memory saved automatically ${additions.length > 1 ? `(${additions.length}) ` : ""}✦`);
      return [...kept, ...additions].slice(-100);
    });
  }

  function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: Onboarding = { name: String(data.get("name") || profile?.name || "explorer").trim().slice(0, 40), pronouns: String(data.get("pronouns") || "").trim().slice(0, 30), style: String(data.get("style") || "warm and playful"), interests: String(data.get("interests") || "").trim().slice(0, 180) };
    if (dataOwnerId) localStorage.setItem(storageKey(ONBOARDING_KEY, dataOwnerId), JSON.stringify(values));
    const now = Date.now();
    const starterMemories = [`call me ${values.name}`, values.pronouns && `my pronouns are ${values.pronouns}`, `i prefer Lumi to communicate in a ${values.style} style`, values.interests && `my interests include ${values.interests}`].filter(Boolean);
    setMemories((current) => {
      const known = new Set(current.map((item) => item.text.toLowerCase()));
      return [...current, ...starterMemories.filter((item) => !known.has(item.toLowerCase())).map((item): Memory => ({ id: crypto.randomUUID(), text: item, createdAt: now, updatedAt: now, status: "approved" }))];
    });
    if (profile?.id) void supabase.auth.updateUser({ data: { name: values.name, lumi_onboarding: values, lumi_onboarding_complete: true } });
    setProfile((current) => current ? { ...current, name: values.name } : current);
    setOnboardingOpen(false);
    showToast("Lumi is tuned to you ✦");
  }

  function skipOnboarding() { if (dataOwnerId) localStorage.setItem(storageKey(ONBOARDING_KEY, dataOwnerId), "skipped"); setOnboardingOpen(false); }

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
      setDataOwnerId(GUEST_OWNER);
      return;
    }
    const nextProfile = {
      id: nextSession.user.id,
      name: String(nextSession.user.user_metadata?.name || nextSession.user.email?.split("@")[0] || "explorer"),
      email: nextSession.user.email || "",
    };
    const metadata = nextSession.user.user_metadata || {};
    if (metadata.lumi_theme) localStorage.setItem(storageKey(THEME_KEY, nextSession.user.id), String(metadata.lumi_theme));
    if (typeof metadata.lumi_memory_on === "boolean") localStorage.setItem(storageKey(MEMORY_ON_KEY, nextSession.user.id), String(metadata.lumi_memory_on));
    if (metadata.lumi_chat_preferences && typeof metadata.lumi_chat_preferences === "object") {
      const preferences = metadata.lumi_chat_preferences as Record<string, { pinned?: boolean; archived?: boolean }>;
      setChats((current) => current.map((chat) => ({ ...chat, ...preferences[chat.id] })));
      localStorage.setItem(storageKey(CHAT_PREFS_KEY, nextSession.user.id), JSON.stringify(preferences));
    }
    if (metadata.lumi_onboarding_complete) localStorage.setItem(storageKey(ONBOARDING_KEY, nextSession.user.id), JSON.stringify(metadata.lumi_onboarding || { complete: true }));
    setDataOwnerId(nextSession.user.id);
    setProfile(nextProfile);
  }

  function saveCloudPreferences(nextTheme = theme, nextMemoryOn = memoryOn, nextChats = chats) {
    if (!profile?.id) return;
    const chatPreferences = Object.fromEntries(nextChats.filter((chat) => chat.pinned || chat.archived).map((chat) => [chat.id, { pinned: chat.pinned, archived: chat.archived }]));
    void supabase.auth.updateUser({ data: { lumi_theme: nextTheme, lumi_memory_on: nextMemoryOn, lumi_chat_preferences: chatPreferences } });
  }

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    saveCloudPreferences(nextTheme, memoryOn);
  }

  function toggleMemory() {
    const next = !memoryOn;
    setMemoryOn(next);
    saveCloudPreferences(theme, next);
  }

  function updateChatPreference(chat: Chat, patch: Pick<Chat, "pinned" | "archived">) {
    const next = chats.map((item) => item.id === chat.id ? { ...item, ...patch, updatedAt: Date.now() } : item);
    setChats(next);
    saveCloudPreferences(theme, memoryOn, next);
    if (patch.archived && chat.id === activeChatId) startNewChat();
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
    setLocalDataReady(false); setCloudReady(false); setProfile(null); setDataOwnerId(null);
    setChats([]); setActiveChatId(""); setSpaces(DEFAULT_SPACES); setActiveSpaceId(null); setMemories([]);
    await supabase.auth.signOut();
    setScreen("home"); setSidebarOpen(false); showToast("logged out safely ✦");
  }

  async function sendPasswordReset() {
    if (!profile?.email) return;
    setAccountBusy(true); setAccountError("");
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo: `${window.location.origin}/lumi/` });
    setAccountBusy(false);
    if (error) setAccountError(error.message);
    else showToast("password reset email sent ✦");
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    if (!email) return;
    setAccountBusy(true); setAccountError("");
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: `${window.location.origin}/lumi/` });
    setAccountBusy(false);
    if (error) setAccountError(error.message);
    else showToast("check both inboxes to confirm your new email ✦");
  }

  function exportMyData() {
    const payload = { exportedAt: new Date().toISOString(), profile, chats: chats.filter((chat) => !chat.temporary), spaces, memories, preferences: { theme, memoryOn } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = `lumi-data-${new Date().toISOString().slice(0, 10)}.json`; link.click();
    URL.revokeObjectURL(url); showToast("your Lumi data is downloaded ✦");
  }

  async function deleteAccount() {
    if (!profile?.id || !window.confirm("permanently delete your Lumi account and cloud data? this cannot be undone.")) return;
    if (window.prompt("type DELETE to confirm") !== "DELETE") return;
    setAccountBusy(true); setAccountError("");
    const { error } = await supabase.rpc("delete_lumi_account");
    setAccountBusy(false);
    if (error) { setAccountError("account deletion is not available yet. your account was not changed."); return; }
    if (dataOwnerId) [CHATS_KEY, ACTIVE_CHAT_KEY, SPACES_KEY, ACTIVE_SPACE_KEY, THEME_KEY, MEMORIES_KEY, MEMORY_ON_KEY, CHAT_PREFS_KEY, ONBOARDING_KEY].forEach((key) => localStorage.removeItem(storageKey(key, dataOwnerId)));
    setAccountOpen(false); setSettingsOpen(false); setProfile(null); setScreen("home"); showToast("your Lumi account was deleted");
  }

  function openAuth(nextMode: "login" | "signup") {
    setAuthMode(nextMode);
    setAuthError("");
    setAuthOpen(true);
  }

  function clearLocalData() {
    if (!window.confirm("clear chats, spaces, memories, and Lumi settings from this device?")) return;
    if (dataOwnerId) [CHATS_KEY, ACTIVE_CHAT_KEY, SPACES_KEY, ACTIVE_SPACE_KEY, THEME_KEY, MEMORIES_KEY, MEMORY_ON_KEY, CHAT_PREFS_KEY, ONBOARDING_KEY].forEach((key) => localStorage.removeItem(storageKey(key, dataOwnerId)));
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

  async function generateReply(nextMessages: Message[]) {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setIsThinking(true);
    setChatError("");
    setLastFailedMessages(null);
    try {
      const response = await fetch("https://luni-gateway.roosevelt-wooden.workers.dev/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ mode, space: activeSpace ? { name: activeSpace.name, instructions: activeSpace.instructions } : null, messages: [
          { role: "user", content: COMPANION_GUIDE },
          ...(!isTemporary && memoryOn && memories.some((item) => item.status === "approved") ? [{ role: "user", content: `[background memory — use only when relevant; never mention this block unless asked]\n${memories.filter((item) => item.status === "approved" && (!item.spaceId || item.spaceId === activeSpaceId)).slice(-24).map((item) => `- ${item.text}`).join("\n")}` }] : []),
          ...nextMessages.map((message) => {
            const attachmentParts = message.attachments?.map((attachment) => attachment.kind === "image"
              ? { type: "image_url", image_url: { url: attachment.dataUrl, detail: "auto" }, name: attachment.name }
              : { type: "text", text: `[attachment: ${attachment.name}${attachment.pageCount ? ` · ${attachment.pageCount} pages` : ""}]\n${attachment.extractedText || "No readable text was found."}\n[end attachment — cite this filename${attachment.kind === "pdf" ? " and the provided page markers" : ""} when using it]` }) || [];
            const hasImage = message.attachments?.some((attachment) => attachment.kind === "image");
            const text = [message.text || "Please examine the attached file(s).", ...attachmentParts.filter((part) => part.type === "text").map((part) => part.text)].join("\n\n");
            return {
              role: message.role === "lumi" ? "assistant" : "user",
              // Keep document-only requests compatible with the existing text gateway.
              // Image requests use the multimodal shape accepted by the upgraded gateway.
              content: hasImage ? [{ type: "text", text }, ...attachmentParts.filter((part) => part.type === "image_url")] : text,
            };
          })
        ] }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== "string") throw new Error(result.error || "Lumi could not answer.");
      updateActive([...nextMessages, { role: "lumi", text: result.reply }]);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Lumi chat request failed", error);
        setLastFailedMessages(nextMessages);
        setChatError(navigator.onLine ? "Lumi couldn’t reach her brain right now." : "you’re offline. your message is safe on this device.");
      }
    } finally { requestController.current = null; setIsThinking(false); }
  }

  async function submit(text = input) {
    const clean = text.trim();
    if ((!clean && !attachments.length) || isThinking || attachmentsBusy) return;
    const messageAttachments = attachments;
    const messageText = clean || `please look at ${messageAttachments.length === 1 ? "this attachment" : "these attachments"}`;
    const nextMessages: Message[] = [...messages, { role: "user", text: messageText, attachments: messageAttachments }];
    saveMemoriesFrom(clean);
    updateActive(nextMessages); setInput(""); setAttachments([]);
    await generateReply(nextMessages);
  }

  async function chooseAttachments(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) return showToast(`up to ${MAX_ATTACHMENTS} files per message ✦`);
    const accepted: Attachment[] = [];
    let totalBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
    setAttachmentsBusy(true);
    try {
      for (const file of files.slice(0, room)) {
        const kind = attachmentKind(file);
        if (!kind) { showToast(`${file.name} isn’t a supported file type`); continue; }
        if (file.size > MAX_ATTACHMENT_BYTES) { showToast(`${file.name} is over the 8 MB limit`); continue; }
        if (totalBytes + file.size > MAX_ATTACHMENT_TOTAL_BYTES) { showToast("attachments can total up to 12 MB per message"); continue; }
        try {
          const content = await extractAttachment(file, kind);
          accepted.push({ id: crypto.randomUUID(), name: file.name, type: file.type || "application/octet-stream", size: file.size, kind, ...content });
          totalBytes += file.size;
        } catch { showToast(`${file.name} couldn’t be read`); }
      }
      setAttachments((current) => [...current, ...accepted]);
      if (files.length > room) showToast(`only the first ${room} file${room === 1 ? "" : "s"} fit`);
    } finally {
      setAttachmentsBusy(false);
    }
  }

  function stopReply() { requestController.current?.abort(); showToast("generation stopped ✦"); }
  function copyMessage(text: string) { void navigator.clipboard.writeText(text).then(() => showToast("copied ✦")); }
  function regenerateMessage(index: number) {
    const base = messages.slice(0, index);
    if (!base.length || base[base.length - 1]?.role !== "user") return;
    updateActive(base); void generateReply(base);
  }
  function editUserMessage(index: number) {
    const edited = window.prompt("edit your message", messages[index].text)?.trim();
    if (!edited) return;
    const base: Message[] = [...messages.slice(0, index), { role: "user", text: edited }];
    updateActive(base); void generateReply(base);
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
    {onboardingOpen && <div className="modal-backdrop onboarding-backdrop"><form className="modal-card onboarding-card" onSubmit={finishOnboarding}><p className="modal-kicker">meet lumi</p><h2>how should we work together?</h2><p className="onboarding-intro">a few quick choices help Lumi support you without taking over. you can change all of this later.</p><label>what should Lumi call you?<input name="name" defaultValue={profile?.name || ""} placeholder="your name" required autoFocus /></label><label>pronouns <span>(optional)</span><input name="pronouns" placeholder="she/her, he/him, they/them…" /></label><label>what kind of support feels best?<select name="style" defaultValue="warm and playful"><option value="warm and playful">warm + playful</option><option value="direct and concise">direct + concise</option><option value="patient and detailed">patient + detailed</option><option value="creative and energetic">creative + energetic</option></select></label><label>what matters in your world? <span>(optional)</span><textarea name="interests" placeholder="music, school, people, goals, projects…" /></label><div className="onboarding-actions"><button type="button" className="text-button" onClick={skipOnboarding}>skip for now</button><button className="modal-primary">start together ✦</button></div></form></div>}
    {authOpen && <div className="modal-backdrop" onMouseDown={() => setAuthOpen(false)}><form className="modal-card auth-card" onSubmit={saveProfile} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setAuthOpen(false)}>×</button><p className="modal-kicker">lumi account</p><h2>{authMode === "signup" ? "make Lumi yours" : "welcome back"}</h2><p className="beta-note">real Supabase accounts are here. your password is handled securely and never stored by Lumi.</p>{authMode === "signup" && <label>your name<input name="name" defaultValue={profile?.name} required placeholder="what should lumi call you?" autoComplete="name" /></label>}<label>email<input name="email" type="email" defaultValue={profile?.email} required placeholder="you@example.com" autoComplete="email" /></label><label>password<input name="password" type="password" required minLength={6} placeholder="at least 6 characters" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /></label>{authError && <p className="auth-error" role="alert">{authError}</p>}<button className="modal-primary" disabled={authBusy}>{authBusy ? "one sec..." : authMode === "signup" ? "create account ✦" : "log in ✦"}</button><button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === "signup" ? "login" : "signup"); setAuthError(""); }}>{authMode === "signup" ? "already have an account? log in" : "new here? create an account"}</button></form></div>}
    {memoryOpen && <div className="modal-backdrop" onMouseDown={() => setMemoryOpen(false)}><div className="modal-card memory-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setMemoryOpen(false)}>×</button><p className="modal-kicker">lumi memory</p><h2>memory, with manners</h2><div className="memory-control"><span><strong>use memory across chats</strong><small>approved memories can help in future chats</small></span><button className={memoryOn ? "toggle on" : "toggle"} onClick={() => setMemoryOn(!memoryOn)}><i /></button></div><div className="memory-tabs"><button className={memoryTab === "saved" ? "active" : ""} onClick={() => setMemoryTab("saved")}>saved <span>{memories.filter((item) => item.status === "approved").length}</span></button><button className={memoryTab === "review" ? "active" : ""} onClick={() => setMemoryTab("review")}>review <span>{memories.filter((item) => item.status === "pending").length}</span></button></div><div className="memory-list">{memories.filter((item) => item.status === (memoryTab === "saved" ? "approved" : "pending")).length ? memories.filter((item) => item.status === (memoryTab === "saved" ? "approved" : "pending")).map((memory) => <div className="memory-item" key={memory.id}><div><p>{memory.text}</p><small>{memory.spaceId ? spaces.find((space) => space.id === memory.spaceId)?.name || "Space memory" : "all chats"}</small></div><div className="memory-actions">{memory.status === "pending" && <button className="approve" onClick={() => setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, status: "approved", updatedAt: Date.now() } : item))}>save</button>}<button onClick={() => updateMemory(memory)} aria-label="Edit memory">✎</button><button onClick={() => deleteMemory(memory)} aria-label="Delete memory">×</button></div></div>) : <div className="empty-memory">{memoryTab === "review" ? "no suggestions waiting. Lumi will ask before remembering new details ✦" : "nothing saved yet. approved details will appear here ✦"}</div>}</div>{memories.length > 0 && <button className="danger-link" onClick={clearAllMemories}>clear all memory</button>}</div></div>}
    {themeOpen && <ThemePicker theme={theme} setTheme={chooseTheme} close={() => setThemeOpen(false)} />}
    {accountOpen && <div className="modal-backdrop" onMouseDown={() => setAccountOpen(false)}><div className="modal-card account-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setAccountOpen(false)}>×</button><p className="modal-kicker">account & security</p><h2>you’re in control</h2><section className="settings-section"><h3>email</h3><form className="account-form" onSubmit={changeEmail}><input name="email" type="email" defaultValue={profile?.email} required aria-label="New email" /><button className="settings-button primary" disabled={accountBusy}>change email</button></form><button className="settings-button" disabled={accountBusy} onClick={() => void sendPasswordReset()}>send password reset email</button></section><section className="settings-section"><h3>your data</h3><button className="settings-button" onClick={exportMyData}>download my data</button><button className="danger-button" disabled={accountBusy} onClick={() => void deleteAccount()}>permanently delete account</button>{accountError && <p className="auth-error" role="alert">{accountError}</p>}</section></div></div>}
    {settingsOpen && <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}><div className="modal-card settings-card" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button><p className="modal-kicker">lumi settings</p><h2>make lumi feel like yours</h2><section className="settings-section"><h3>account</h3>{profile ? <><div className="account-summary"><span className="avatar">{profile.name[0]?.toLowerCase()}</span><span><strong>{profile.name}</strong><small>{profile.email}</small></span></div><div className={`sync-status ${syncState}`}><i />{syncState === "synced" ? "chats, Spaces & memory saved to cloud" : syncState === "syncing" ? "saving to cloud..." : syncState === "error" ? "cloud setup needed" : "saved on this device"}</div><div className="settings-actions"><button className="settings-button primary" onClick={() => { setSettingsOpen(false); setAccountOpen(true); }}>manage account</button><button className="settings-button" onClick={() => void logout()}>log out</button></div></> : <><p>log in to sync chats, Spaces, and approved memories across your devices.</p><div className="settings-actions"><button className="settings-button primary" onClick={() => { setSettingsOpen(false); openAuth("login"); }}>log in</button><button className="settings-button" onClick={() => { setSettingsOpen(false); openAuth("signup"); }}>sign up</button></div></>}</section><section className="settings-section"><h3>personalization</h3><button className="settings-row" onClick={() => { setSettingsOpen(false); setThemeOpen(true); }}><span><strong>theme</strong><small>{theme}</small></span><b>›</b></button><button className="settings-row" onClick={() => { setSettingsOpen(false); setMemoryOpen(true); }}><span><strong>memory</strong><small>{memoryOn ? `${memories.filter((item) => item.status === "approved").length} saved · ${memories.filter((item) => item.status === "pending").length} to review` : "off"}</small></span><b>›</b></button></section><section className="settings-section"><h3>data & privacy</h3><p>{profile ? "regular chats, Spaces, and approved memories sync securely. temporary chats never save or become memory." : "regular chats and memories stay on this device. temporary chats disappear when you leave."}</p><button className="settings-button" onClick={() => { setSettingsOpen(false); startTemporaryChat(); }}>start a temporary chat</button><button className="danger-button" onClick={clearLocalData}>clear data on this device</button></section></div></div>}
  </>;

  if (screen === "home") return (
    <main className="landing" data-theme={theme} data-mood="bright">
      <nav className="landing-nav"><LumiWordmark compact /><div>{profile ? <button className="text-button" onClick={() => setScreen("app")}>open lumi</button> : <><button className="text-button" onClick={() => openAuth("login")}>log in</button><button className="text-button" onClick={() => openAuth("signup")}>sign up</button></>}<button className="landing-cta" onClick={() => setScreen("app")}>try lumi ✦</button></div></nav>
      <section className="landing-hero"><div className="hero-copy"><p className="eyebrow"><span /> an ai companion that meets you where you are</p><h1>you bring the moment.<br/><em>we’ll meet it together.</em></h1><p>talk things through, learn, create, or find your next step—with support that adapts to you without taking over.</p><div className="hero-actions"><button className="landing-cta large" onClick={() => setScreen("app")}>talk to lumi <span>↗</span></button><button className="hero-demo" onClick={() => setScreen("app")}><i>▶</i> see how lumi helps</button></div><div className="trust-row"><span>✦ remembers with permission</span><span>◌ private temporary chats</span><span>⌁ you stay in control</span></div></div><div className="hero-graphic"><div className="hero-halo"/><span className="orbit orbit-one">“just listen for a minute”</span><span className="orbit orbit-two">“think this through with me”</span><span className="orbit orbit-three">“help me take one step”</span><img className="hero-avatar" src="/lumi/lumi-avatar.png" alt="Lumi, your AI companion"/><div className="hero-status"><i/><span><strong>lumi is here</strong><small>ready to listen, think, or help you move</small></span></div></div></section>
      <section className="home-marquee" aria-label="Ways to use Lumi"><span>chat through it ✦</span><span>study smarter ✦</span><span>make something wild ✦</span><span>plan the next move ✦</span></section>
      <section className="feature-strip"><article className="feature-memory"><span>01 / CONTEXT</span><h2>continuity,<br/>not surveillance.</h2><p>your goals, preferences, and projects can follow you across chats—always visible, editable, and yours to erase.</p><div className="mini-memory"><i>✦</i><span><strong>tour wardrobe</strong><small>Bijou · music ideas</small></span><b>remembered</b></div></article><article className="feature-mood"><span>02 / PRESENCE</span><h2>the room meets<br/>the moment.</h2><p>the living background responds gently to the conversation while your chosen theme stays yours.</p><div className="mood-dots"><i/><i/><i/><i/><i/><i/></div></article><article className="feature-think"><span>03 / SUPPORT</span><h2>listen, think,<br/>then move.</h2><p>Lumi can make room for the feeling, reason beside you, or help turn it into one grounded next step.</p><div className="mini-thinking"><LumiMark small thinking/><span><strong>finding our next step</strong><small>supporting without taking over</small></span></div></article></section>
      <footer className="landing-footer"><LumiWordmark compact /><p>made for curious people with a lot going on.</p><button className="text-button" onClick={() => setThemeOpen(true)}>change the mood ◐</button></footer>
      {overlays}
    </main>
  );

  return (
    <main className={`app-shell mode-${mode} mood-${mood} ${isThinking ? "is-thinking" : ""}`} data-theme={theme} data-mood={mood}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <LumiWordmark compact />
          <button className="close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">×</button>
        </div>

        <button className="new-button" onClick={() => startNewChat()}>
          <span>＋</span> new conversation
        </button>
        <button className="temporary-button" onClick={startTemporaryChat}><span>◌</span> temporary chat</button>

        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">ways to work together</p>
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
          <div className="history-heading"><p className="nav-label">{showArchived ? "archived adventures" : "recent adventures"}</p><button onClick={() => setShowArchived(!showArchived)}>{showArchived ? "recent" : "archive"}</button></div>
          <label className="chat-search"><span>⌕</span><input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="search chats" aria-label="Search chats" /></label>
          <div className="history-list">
            {[...visibleChats].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt).slice(0, 20).map((chat) => (
              <div className={chat.id === activeChatId ? "history-row active" : "history-row"} key={chat.id}>
                <button className="history-open" onClick={() => openChat(chat)}>
                  <span className={`history-gem ${chat.mode}`} /><span>{chat.title}</span>{chat.pinned && <b className="pin-mark">◆</b>}
                </button>
                <button className="history-action" onClick={() => updateChatPreference(chat, { pinned: !chat.pinned })} aria-label={chat.pinned ? `Unpin ${chat.title}` : `Pin ${chat.title}`}>◇</button>
                <button className="history-action" onClick={() => updateChatPreference(chat, { archived: !chat.archived, pinned: false })} aria-label={chat.archived ? `Restore ${chat.title}` : `Archive ${chat.title}`}>{chat.archived ? "↩" : "⌄"}</button>
                <button className="history-action" onClick={() => renameChat(chat)} aria-label={`Rename ${chat.title}`}>✎</button>
                <button className="history-action delete" onClick={() => deleteChat(chat)} aria-label={`Delete ${chat.title}`}>×</button>
              </div>
            ))}
            {!visibleChats.length && <p className="history-empty">{chatSearch ? "no chats match that search" : showArchived ? "nothing archived yet" : "no recent chats yet"}</p>}
          </div>
        </section>

        <section className="spaces">
          <div className="spaces-title"><button className={!activeSpaceId ? "spaces-home active" : "spaces-home"} onClick={() => setActiveSpaceId(null)}>my spaces</button><button onClick={() => { setEditingSpace(null); setSpaceEditorOpen(true); }} aria-label="Add space">＋</button></div>
          {spaces.map((space) => <div className={activeSpaceId === space.id ? "space-row active" : "space-row"} key={space.id}><button className="space-item" onClick={() => openSpace(space)}><span className={`space-dot ${space.color}`} /> {space.name}</button><button className="space-edit" onClick={() => { setEditingSpace(space); setSpaceEditorOpen(true); }} aria-label={`Edit ${space.name}`}>•••</button></div>)}
        </section>

        <div className="sidebar-bottom">
          <button className="settings-launch" onClick={() => setOnboardingOpen(true)}><span>✦</span> tune how we work</button>
          <button className="settings-launch" onClick={() => setSettingsOpen(true)}><span>⚙</span> settings</button>
          <div className="profile-button">
            <span className="avatar">{(profile?.name || "g")[0].toLowerCase()}</span>
            <span><strong>{profile?.name || "guest explorer"}</strong><small>{profile ? profile.email : "not signed in"}</small></span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <div className="mood-scene" aria-hidden="true"><i/><i/><i/></div>
        <div className="thinking-aurora" aria-hidden="true"><i /><i /><i /></div>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className={isTemporary ? "mode-pill temporary" : "mode-pill"}><span className={`mode-gem ${mode}`} /> {isTemporary ? "temporary chat" : activeSpace ? activeSpace.name : mode === "chat" ? "lumi chat" : `lumi ${mode}`}</div>
          <div className={`mood-indicator mood-${mood}`}><span>✦</span>{moodCopy[mood]}</div>
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
              <div className="hero-logo"><LumiWordmark /><span className="logo-tag">here to listen, think, and help</span></div>
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
              <div className="conversation-title"><LumiMark small /><span><small>today with lumi · {moodCopy[mood]}</small><strong>{activeChat?.title ?? `${mode} session`}</strong></span></div>
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
                      <div className="message-actions"><button onClick={() => copyMessage(message.text)}>copy</button><button onClick={() => regenerateMessage(index)} disabled={isThinking}>regenerate</button></div>
                    </div>
                  ) : <div className="user-bubble">{message.attachments?.length ? <div className="message-attachments">{message.attachments.map((attachment) => <div className="message-file" key={attachment.id}>{attachment.kind === "image" && attachment.dataUrl ? <img src={attachment.dataUrl} alt={attachment.name} /> : <span className={`file-icon ${attachment.kind}`}>{attachment.kind === "pdf" ? "PDF" : attachment.kind === "document" ? "DOC" : "TXT"}</span>}<span><strong>{attachment.name}</strong><small>{attachment.pageCount ? `${attachment.pageCount} pages · ` : ""}{formatBytes(attachment.size)}</small></span></div>)}</div> : null}<p>{message.text}</p><div className="message-actions"><button onClick={() => copyMessage(message.text)}>copy</button><button onClick={() => editUserMessage(index)} disabled={isThinking}>edit</button></div></div>}
                </div>
              ))}
              {isThinking && (
                <div className="message lumi thinking-message">
                  <LumiMark small thinking />
                  <div className="thinking-card" role="status" aria-live="polite">
                    <div className="thinking-orb"><span>✦</span><i/><i/></div>
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
            {(!isOnline || chatError) && <div className="recovery-banner" role="alert"><span>{isOnline ? "↻" : "⌁"}</span><div><strong>{isOnline ? "Lumi hit a connection snag" : "you’re offline"}</strong><small>{chatError || "regular chats stay on this device until you reconnect."}</small></div>{lastFailedMessages && isOnline && <button onClick={() => void generateReply(lastFailedMessages)}>try again</button>}</div>}
            {isTemporary && <div className="temporary-notice"><span>◌</span><strong>temporary chat</strong> this conversation won’t be saved, synced, or used for memory.</div>}
            {attachments.length > 0 && <div className="attachment-tray" aria-label="Selected attachments">{attachments.map((attachment) => <div className="attachment-chip" key={attachment.id}>{attachment.kind === "image" && attachment.dataUrl ? <img src={attachment.dataUrl} alt="" /> : <span>{attachment.kind === "pdf" ? "PDF" : attachment.kind === "document" ? "DOC" : "TXT"}</span>}<div><strong>{attachment.name}</strong><small>{attachment.pageCount ? `${attachment.pageCount} pages · ` : ""}{formatBytes(attachment.size)}</small></div><button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`Remove ${attachment.name}`}>×</button></div>)}</div>}
            <form className="composer" onSubmit={handleSubmit}>
              <input ref={fileInputRef} className="file-input" type="file" accept={ACCEPTED_ATTACHMENTS} multiple onChange={chooseAttachments} />
              <button type="button" className="add-button" onClick={() => fileInputRef.current?.click()} aria-label="Add attachment" disabled={attachmentsBusy}>{attachmentsBusy ? "…" : "＋"}</button>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={mode === "learn" ? "what do you want to understand?" : mode === "create" ? "what should we make?" : "talk to lumi..."}
                aria-label="Message Lumi"
              />
              <button type="button" className="voice-button" onClick={() => showToast("voice chat is coming soon ✦")} aria-label="Use voice">⌇</button>
              {isThinking ? <button type="button" className="send-button stop" onClick={stopReply} aria-label="Stop generating">■</button> : <button type="submit" className="send-button" disabled={attachmentsBusy || (!input.trim() && !attachments.length)} aria-label="Send message">↑</button>}
            </form>
            <p className="demo-note"><span>✦</span> images, PDFs, Word, and text · up to 4 files, 8 MB each</p>
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
