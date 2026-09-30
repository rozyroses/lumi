import { ElleWordmark } from "./ElleBrand";

type Props = {
  onEnter: (tab: "home" | "explore" | "communities" | "ai") => void;
  onAuth: (mode: "login" | "signup") => void;
};

export default function ElleLanding({ onEnter, onAuth }: Props) {
  return <div className="orbit-landing">
    <header className="orbit-header">
      <a className="elle-logo" href="#welcome" aria-label="Elle welcome"><ElleWordmark /></a>
      <nav aria-label="Welcome navigation">
        <button className="landing-explore" onClick={() => onEnter("explore")}>explore</button>
        <button className="landing-communities" onClick={() => onEnter("communities")}>communities</button>
        <button onClick={() => onAuth("login")}>log in</button>
        <button className="orbit-primary" onClick={() => onAuth("signup")}>join elle <span aria-hidden="true">↗</span></button>
      </nav>
    </header>
    <main id="welcome">
      <section className="orbit-hero" aria-labelledby="orbit-title">
        <img className="orbit-hero-art" src={`${import.meta.env.BASE_URL}elle-space.webp`} width="1536" height="1024" alt="" fetchPriority="high" />
        <div className="orbit-hero-copy">
          <p className="orbit-eyebrow"><span aria-hidden="true">✦</span> a brighter kind of social</p>
          <h1 id="orbit-title">your world.<br />your people<span className="coral-dot">.</span></h1>
          <p className="orbit-tagline">a little space to be yourself.</p>
          <p className="orbit-description">big ideas, little updates, and people who get you. find your corner of the universe.</p>
          <div className="orbit-hero-actions">
            <button className="orbit-primary" onClick={() => onAuth("signup")}>find your people <span aria-hidden="true">↗</span></button>
            <button className="orbit-text-button" onClick={() => onEnter("home")}>take a look around <span aria-hidden="true">→</span></button>
          </div>
        </div>
        <span className="orbit-floating-star" aria-hidden="true">✦</span>
        <div className="orbit-coordinate" aria-hidden="true">a whole universe. a little more you.</div>
      </section>
      <div className="orbit-ribbon" aria-hidden="true"><span>less scrolling past.</span><i>✦</i><span>more finding your people.</span><i>✦</i><span>make yourself at home.</span></div>
      <section className="orbit-discover" aria-labelledby="discover-title">
        <div className="orbit-section-heading"><p className="orbit-eyebrow">there’s space for all of you</p><h2 id="discover-title">follow your curiosity.</h2><p>the song in your head. the idea in your notes. the conversation you needed.</p></div>
        <div className="orbit-features">
          <button className="orbit-feature feature-lilac" onClick={() => onEnter("communities")}><span className="feature-art" aria-hidden="true">◎</span><span className="feature-number">01 / connect</span><h3>your kind of people.</h3><p>find a community for whatever you’re into.</p><span className="feature-link">explore communities ↗</span></button>
          <button className="orbit-feature feature-yellow" onClick={() => onEnter("explore")}><span className="feature-art" aria-hidden="true">✳</span><span className="feature-number">02 / discover</span><h3>out of your orbit.</h3><p>a fresh perspective could be one post away.</p><span className="feature-link">explore the feed ↗</span></button>
          <button className="orbit-feature feature-coral" onClick={() => onEnter("ai")}><span className="feature-art" aria-hidden="true">✦</span><span className="feature-number">03 / create</span><h3>a spark of something.</h3><p>think it through, find the words, or start with elle ai.</p><span className="feature-link">meet elle ai ↗</span></button>
        </div>
      </section>
      <section className="orbit-final"><span aria-hidden="true">✦</span><h2>you belong in this orbit.</h2><button className="orbit-primary" onClick={() => onAuth("signup")}>make yourself at home ↗</button></section>
    </main>
    <footer className="orbit-footer"><a className="elle-logo" href="#welcome" aria-label="Back to top"><ElleWordmark /></a><span>your world. your people.</span><small>© {new Date().getFullYear()} elle</small></footer>
  </div>;
}
