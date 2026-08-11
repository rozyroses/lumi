"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "chat" | "learn" | "create";
type Message = { role: "lumi" | "user"; text: string };
type Chat = { id: string; title: string; mode: Mode; messages: Message[]; updatedAt: number };

const CHATS_KEY = "lumi-chats-v1";
const ACTIVE_CHAT_KEY = "lumi-active-chat-v1";
const makeChat = (mode: Mode): Chat => ({ id: crypto.randomUUID(), title: "new adventure", mode, messages: [], updatedAt: Date.now() });

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
  return (
    <img
      className={compact ? "lumi-wordmark compact" : "lumi-wordmark"}
      src="/lumi/lumi-logo.png"
      alt="lumi"
    />
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOn, setMemoryOn] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = modeCopy[mode];
  const activeChat = chats.find((chat) => chat.id === activeChatId);
  const messages = activeChat?.messages ?? [];

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
    if (chats.length) localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    if (activeChatId) localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
  }, [chats, activeChatId]);

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

  function startNewChat(nextMode: Mode = mode) {
    const existing = chats.find((chat) => chat.messages.length === 0 && chat.mode === nextMode);
    if (existing) setActiveChatId(existing.id);
    else { const next = makeChat(nextMode); setChats((current) => [next, ...current]); setActiveChatId(next.id); }
    setMode(nextMode); setInput(""); setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function openChat(chat: Chat) { setActiveChatId(chat.id); setMode(chat.mode); setSidebarOpen(false); }

  function renameChat(chat: Chat) {
    const title = window.prompt("name this adventure", chat.title)?.trim();
    if (title) setChats((current) => current.map((item) => item.id === chat.id ? { ...item, title: title.slice(0, 50) } : item));
  }

  function deleteChat(chat: Chat) {
    if (!window.confirm(`delete “${chat.title}”?`)) return;
    const remaining = chats.filter((item) => item.id !== chat.id);
    if (remaining.length) { setChats(remaining); if (chat.id === activeChatId) openChat(remaining[0]); }
    else { const fresh = makeChat(mode); setChats([fresh]); setActiveChatId(fresh.id); }
  }

  async function submit(text = input) {
    const clean = text.trim();
    if (!clean || isThinking) return;
    const nextMessages: Message[] = [...messages, { role: "user", text: clean }];
    updateActive(nextMessages); setInput(""); setIsThinking(true);
    try {
      const response = await fetch("https://luni-gateway.roosevelt-wooden.workers.dev/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages: nextMessages.map((message) => ({ role: message.role === "lumi" ? "assistant" : "user", content: message.text })) }),
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

  return (
    <main className={`app-shell mode-${mode} ${isThinking ? "is-thinking" : ""}`}>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <LumiWordmark compact />
          <button className="close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">×</button>
        </div>

        <button className="new-button" onClick={() => startNewChat()}>
          <span>＋</span> new little adventure
        </button>

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
            {[...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8).map((chat) => (
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
          <div className="spaces-title"><span>my spaces</span><button onClick={() => showToast("custom Spaces are coming next ✦")} aria-label="Add space">＋</button></div>
          <button className="space-item" onClick={() => showToast("college life is getting its own workspace soon")}><span className="space-dot lavender" /> college life</button>
          <button className="space-item" onClick={() => showToast("music ideas is getting its own workspace soon")}><span className="space-dot peach" /> music ideas</button>
          <button className="space-item" onClick={() => showToast("big dreams is getting its own workspace soon")}><span className="space-dot mint" /> big dreams</button>
        </section>

        <div className="sidebar-bottom">
          <button className="profile-button" onClick={() => showToast("profiles and sign-in are coming soon") }>
            <span className="avatar">r</span>
            <span><strong>roosevelt</strong><small>free explorer</small></span>
            <span className="dots">•••</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <div className="thinking-aurora" aria-hidden="true"><i /><i /><i /></div>
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="mode-pill"><span className={`mode-gem ${mode}`} /> {mode === "chat" ? "lumi chat" : `lumi ${mode}`}</div>
          <div className="top-actions">
            <button className={`memory-pill ${memoryOn ? "on" : ""}`} onClick={() => setMemoryOn(!memoryOn)}>
              <span>◉</span> memory {memoryOn ? "on" : "off"}
            </button>
            <button className="round-button" onClick={() => showToast("you’re all caught up ✦")} aria-label="Notifications">♢</button>
          </div>
        </header>

        <div className="content">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="hero-logo"><LumiWordmark /><span className="logo-tag">your bright little brain</span></div>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1>{copy.title}</h1>
              <p className="subtitle">{copy.subtitle}</p>

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
    </main>
  );
}
