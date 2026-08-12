import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");

describe("critical Lumi interface contracts", () => {
  it.each([
    ["attachment picker", 'aria-label="Add attachment"'],
    ["temporary-chat privacy notice", "this conversation won’t be saved, synced, or used for memory"],
    ["user chat bubble", 'className="user-bubble"'],
    ["accessible thinking status", 'role="status" aria-live="polite"'],
    ["thinking presence", 'className="thinking-dots"'],
    ["push-to-talk voice control", 'aria-label={voiceState === "listening" ? "Stop listening" : "Talk to Lumi"}'],
    ["private voice notice", "audio is processed by your browser and never saved"],
    ["accessible voice status", 'className={`voice-presence ${voiceState}`} role="status" aria-live="polite"'],
  ])("keeps the %s", (_label, marker) => {
    expect(app).toContain(marker);
  });

  it.each([".user-bubble>p", ".thinking-card", ".attachment-tray", ".temporary-notice", ".voice-presence", ".voice-controls"])(
    "keeps critical responsive styling for %s",
    (selector) => expect(css).toContain(selector),
  );
});

describe("deployment gate", () => {
  it("runs tests before the production build and deployment", () => {
    const testStep = workflow.indexOf("npm run test");
    const buildStep = workflow.indexOf("npm run build");
    const deployStep = workflow.indexOf("actions/deploy-pages");
    expect(testStep).toBeGreaterThan(-1);
    expect(buildStep).toBeGreaterThan(testStep);
    expect(deployStep).toBeGreaterThan(buildStep);
  });
});
