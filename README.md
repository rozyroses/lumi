# Lumi AI ✦

Lumi is a warm, grounded AI companion for talking things through, learning, creating, planning, and finding a next step. It adapts to the user without pretending to be human or replacing human relationships.

**Live app:** https://rozyroses.github.io/lumi/

## What Lumi can do

- Chat, Learn, and Create modes
- Companion-first support that can listen, think alongside the user, or help them act
- Personalized Spaces with custom instructions
- Cross-device chats, Spaces, settings, and account-isolated data
- Automatic, editable memory with contradiction-aware updates
- Temporary chats that are excluded from history and memory
- Search, pin, archive, edit, copy, regenerate, and stop controls
- First-time onboarding and account management
- Installable PWA support with an offline app shell
- Mood-reactive backgrounds, four working themes, a glowing thinking state, and Lumi’s avatar
- Mobile-responsive navigation and layouts

## Companion boundaries

Lumi is an AI, not a person or therapist. Its companion behavior is designed to be supportive without encouraging dependency, claiming consciousness, replacing human relationships, or taking control away from the user.

## Privacy and accounts

Lumi keeps signed-in browser data under each Supabase user ID, separates guest data, and clears the active account state during logout or account switching. Supabase row-level security protects cloud records per user. Temporary chats are not synced or used for memory.

Never place an AI provider API key, service-role key, password, or other secret in this repository or browser-side code.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Deployment

Every push to `main` runs the GitHub Pages deployment workflow. In repository settings, use **Pages → Build and deployment → GitHub Actions**.

The deployed app expects the `/lumi/` base path used by the manifest, service worker, and compiled assets.
