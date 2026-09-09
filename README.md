# Unity brand and public homepage

Unity now opens on an interactive public homepage with major tabs, a sample knowledge check, a creative-interest path finder, FAQ accordions, and direct student-account/campus entry. Public homepage and all student surfaces share the navy, blue, and lime design system: courses, tutoring, practice, grades, services, onboarding, authentication, memory, preferences, and retained creative tools. Major tabs support arrow keys, account dialogs contain keyboard focus, and campus section navigation supports browser back/forward.

The original Unity script wordmark is inspired by the supplied baseball-script reference. It is artwork, not the exact reference font or an installed typeface. Wordmark and illustrative creative-studio photography were generated for this project and optimized as WebP. Source images remain outside the repo; the web-ready assets are tracked in public. No social sharing card was added.

# Unity student platform

Unity now offers student sign-up with major selection, three foundation major pathways, a major-specific campus sequence, built-in Lumi advising, untimed practice checks, practice GPA, downloadable personal learning records, and private AI student-service conversations with open/closed state. The existing Supabase account and per-user journal sync remain the persistence layer; no database migration is required. Major selection at sign-up is stored in auth metadata, and later changes use an account-isolated profile journal.

Practice GPA uses the best scored check for each course in the selected major, equally weighted. Unassessed courses are excluded and an empty record displays no GPA. It is a self-study measure, not an official academic GPA; client-side practice scores are not authoritative grades. Financial aid, accredited degrees/credits, credit transfer, laptop shipments, staffed support, and official transcripts are not offered by this release. Service conversations clearly identify AI guidance and are not delivered to humans.

# Unity College of the Arts · powered by Lumi

Unity adds a creative learning campus to Lumi with three foundation courses, nine lessons, knowledge checks, self-reported completion, and editable project drafts. Lessons now open as guided conversations with a grounded welcome, creative examples, quick replies, saved back-and-forth tutoring, retry handling, and a notes/practice tab. Each lesson keeps its own conversation in the existing account-isolated storage. The campus is the default home; Lumi remains available as the study companion with its existing chat, voice, attachments, Spaces, accounts, and memory.

Coursework uses dedicated private learning journals in the existing `lumi_chats` storage and its account isolation/sync. No new Supabase schema is required. Guest work stays on the current device; signed-in work uses the existing cloud sync. Journals are excluded from normal conversation history. Progress is self-reported, and AI project feedback is not an instructor grade. This release does not add instructor administration, official enrollment, grading, or submission workflows.

# Lumi AI ✦

Lumi is a warm, grounded AI companion for talking things through, learning, creating, planning, and finding a next step. It adapts to the user without pretending to be human or replacing human relationships.

**Live app:** https://rozyroses.github.io/lumi/

## What Lumi can do

- Chat, Learn, and Create modes
- Companion-first support that can listen, think alongside the user, or help them act
- Secure in-chat attachments for images, PDFs, Word documents, and text files
- Image understanding plus filename- and page-aware answers for uploaded material
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

Attachments are processed for the current conversation and sent through Lumi's secured AI gateway. The client and gateway enforce supported file types, a four-file maximum, an 8 MB per-file limit, and a 12 MB combined image limit. Temporary-chat attachments are not synced.

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
