"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Mode = "chat" | "learn" | "create";
type Message = { role: "lumi" | "user"; text: string };

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

export default function Home() {
  const [mode, setMode] = useState<Mode>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [memoryOn, setMemoryOn] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = modeCopy[mode];

  useEffect(() => {
    const saved = localStorage.getItem("lumi-demo-messages");
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("lumi-demo-messages", JSON.stringify(messages));
  }, [messages]);

  function submit(text = input) {
    const clean = text.trim();
    if (!clean) return;
    setMessages((old) => [
      ...old,
      { role: "user", text: clean },
      {
        role: "lumi",
        text:
          mode === "learn"
            ? `okay, let’s learn “${clean}” together. first, tell me what you already know—even if it’s just a tiny bit.`
            : mode === "create"
              ? `oh, i see the vision. let’s turn “${clean}” into something real. what feeling should people get first?`
              : `i’m with you. let’s work through “${clean}” one clear step at a time. what would a win look like today?`,
      },
    ]);
    setInput("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function changeMode(next: Mode) {
    setMode(next);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-row">
          <LumiMark small />
          <span className="brand-name">lumi</span>
          <button className="close-menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">×</button>
        </div>

        <button className="new-button" onClick={() => setMessages([])}>
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

        <section className="spaces">
          <div className="spaces-title"><span>my spaces</span><button aria-label="Add space">＋</button></div>
          <button className="space-item"><span className="space-dot lavender" /> college life</button>
          <button className="space-item"><span className="space-dot peach" /> music ideas</button>
          <button className="space-item"><span className="space-dot mint" /> big dreams</button>
        </section>

        <div className="sidebar-bottom">
          <button className="profile-button">
            <span className="avatar">r</span>
            <span><strong>roosevelt</strong><small>free explorer</small></span>
            <span className="dots">•••</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="mode-pill"><span className={`mode-gem ${mode}`} /> {mode === "chat" ? "lumi chat" : `lumi ${mode}`}</div>
          <div className="top-actions">
            <button className={`memory-pill ${memoryOn ? "on" : ""}`} onClick={() => setMemoryOn(!memoryOn)}>
              <span>◉</span> memory {memoryOn ? "on" : "off"}
            </button>
            <button className="round-button" aria-label="Notifications">♢</button>
          </div>
        </header>

        <div className="content">
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="mascot-wrap">
                <span className="orbit-dot one" />
                <span className="orbit-dot two" />
                <LumiMark />
              </div>
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
              <div className="conversation-title"><LumiMark small /><span><small>today with lumi</small><strong>{mode} session</strong></span></div>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}`}>
                  {message.role === "lumi" && <LumiMark small />}
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
          )}

          <div className="composer-wrap">
            <form className="composer" onSubmit={handleSubmit}>
              <button type="button" className="add-button" aria-label="Add attachment">＋</button>
              <input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={mode === "learn" ? "what do you want to understand?" : mode === "create" ? "what should we make?" : "talk to lumi..."}
                aria-label="Message Lumi"
              />
              <button type="button" className="voice-button" aria-label="Use voice">⌇</button>
              <button type="submit" className="send-button" disabled={!input.trim()} aria-label="Send message">↑</button>
            </form>
            <p className="demo-note"><span>✦</span> lumi is still learning — this is our playful little prototype</p>
          </div>
        </div>
      </section>
    </main>
  );
}
