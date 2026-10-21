---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Project Scaffold, Welcome Screen, Theme System, and Local Journal Entry**
  Becomes usable: A running Next.js application where the user can view the calm landing screen, toggle between Light, Dark, and System themes (with local persistence and zero flash), click "Start Journaling", and write a reflection that is immediately saved to browser `localStorage` before any network calls.
  Why now: Bootstrapping must live in Slice 1. It establishes the end-to-end frontend foundation, visual theme system, and the core save-first privacy guarantee so every subsequent slice has a working place to land.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Welcome Screen`, `prd.md > Journal Entry`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Stack`, `spec.md > Visual Design System & Anti-AI-Slop Standards`, `spec.md > Components` (`WelcomeScreen`, `ThemeToggle`, `JournalEntry`), `spec.md > Data Model`
  Build: Initialize Next.js 15 project with React 19, TypeScript, and Tailwind CSS. Install `lucide-react`. Configure tailwind custom colors (soft aqua, gentle mint, deep slate/teal `#0B1719`). Add inline theme initialization script in `app/layout.tsx` to prevent FOUT. Implement `components/ThemeToggle.tsx`. Build `app/page.tsx` (Welcome screen) and `app/journal/page.tsx` with auto-expanding textarea and immediate local saving to `localStorage` (`mindmosaic_sessions`).
  Verify (mechanical): Run `npm run build` to confirm zero TypeScript/build errors. Start dev server with `npm run dev` and verify HTTP 200 on `/` and `/journal`. Verify theme toggle switches class `.dark` on `<html>`, and verify an entry submitted on `/journal` is stored in browser `localStorage`.
  Learner check: Open the app on mobile or desktop browser, toggle between Light, Dark, and System themes, click "Start Journaling", type a reflection, and confirm it saves locally with comfortable typography and no visual glitch.
  Commit: `Scaffold app, theme system, welcome view, and local-first journal entry`

- [x] **2. Privacy Consent Modal and Secure Server-Side AI Proxy with Transparent Mock Fallback**
  Becomes usable: Submitting a reflection prompts a clear privacy consent dialog on the first AI interaction of the session. If accepted or declined, the app communicates with a secure server-side API route (`/api/chat`) backed by a swappable provider adapter. If no API key is present or AI is offline, the app returns a transparently labeled mock response (`[Simulated Demo Response - AI Offline]`) without crashing.
  Why now: Enforces the server-side security boundary (keeping secrets off the client) and the user consent workflow before live AI services are connected.
  PRD ref: `prd.md > Privacy Consent`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > AI Architecture & Security`, `spec.md > Components` (`ConsentModal`), `spec.md > External Services & Failure Modes`, `spec.md > Data Model`
  Build: Create `components/ConsentModal.tsx` disclosing data transfer and recipient. Create `sessionStorage` consent tracker. Create `lib/ai-provider.ts` interface and `lib/providers/mock.ts` returning honest simulated responses. Build Next.js server route `app/api/chat/route.ts` validating payloads, reading environment variables, and proxying through the adapter.
  Verify (mechanical): Run `npm run build`. Send test POST request to `http://localhost:3000/api/chat` and verify it returns a valid JSON response containing `isSimulated: true` and the honest fallback message.
  Learner check: Submit an entry on the journal screen. Confirm the consent dialog appears, explain what happens if you decline vs agree, and observe the honest fallback response.
  Commit: `Add privacy consent modal, server API proxy, and honest mock fallback`

- [x] **3. Live Groq AI Integration, Friend-First Companion Prompt, and Medical/Crisis Safety Boundaries**
  Becomes usable: Connecting a free Groq API key allows live AI companion responses. The AI responds like an attentive friend: validating specific feelings without unsolicited advice, lecture, or formulaic empathy. If crisis or severe medical symptoms are detected, the app displays emergency guidance immediately.
  Why now: Connects the core AI engine and implements the critical health-safety and crisis intervention boundaries before conversational branching is introduced.
  PRD ref: `prd.md > AI Companion — Friend-First Response`, `prd.md > Safety Boundary`, `prd.md > Health Concerns and Medical Referral`
  Spec ref: `spec.md > AI System Prompt & Conversational Guidelines`, `spec.md > Components` (`SafetyBanner`), `spec.md > External Services` (`Groq Developer Free Tier`)
  Build: Implement `lib/providers/groq.ts` using OpenAI-compatible native fetch targeting `openai/gpt-oss-20b` (configurable via `GROQ_MODEL`). Craft the system prompt in `app/api/chat/route.ts` enforcing friend-first principles, varied rhythm, and non-diagnostic medical guidance. Build `components/SafetyBanner.tsx` with verified helplines (Tele-MANAS, iCALL, Vandrevala, 112).
  Verify (mechanical): Run automated test script against `/api/chat` with 5 scenarios: mild headache, emergency signs (worst headache of life), exam stress, crisis distress, and normal reflection. Verify emergency signs trigger immediate emergency guidance first without preamble, and crisis expressions trigger the helpline banner.
  Learner check: Test with fictional journal entries (e.g. feeling stressed about exams, or describing a headache). Confirm the AI listens like a real friend without offering unsolicited advice or robotic empathy.
  Commit: `Integrate Groq AI, friend-first companion prompt, and safety banners`

- [x] **4. Conversational Branching ("Talk More" vs "Get a Suggestion") and Multi-Turn Dialogue**
  Becomes usable: After the AI's first response, the user is offered two clear choices: "Talk more" or "Get a suggestion". The user can converse back and forth naturally, with every message saved immediately to `localStorage`. A subtle switch remains accessible to change branches anytime.
  Why now: Delivers the core interactive journey from the PRD, giving the user control over the conversation's depth and direction.
  PRD ref: `prd.md > AI Companion — Talk More Branch`, `prd.md > AI Companion — Get a Suggestion Branch`, `prd.md > AI Companion Conversation`
  Spec ref: `spec.md > Components` (`BranchChoice`, `ConversationThread`), `spec.md > Data Model`
  Build: Implement `components/BranchChoice.tsx` with modest corner radii (no pill buttons) and clean styling. Update `components/ConversationThread.tsx` to handle multi-turn dialogue, typing states, and branch switching. Update `app/journal/page.tsx` to commit each incoming message to `localStorage` in real time.
  Verify (mechanical): Submit an entry, simulate selecting "Talk more", send a follow-up message, and verify all turns are stored in `localStorage.mindmosaic_sessions` in chronological order. Simulate selecting "Get a suggestion" and verify 1-2 practical suggestions are returned.
  Learner check: Have a brief conversation with the AI companion. Try clicking "Talk more", follow up, then switch to "Get a suggestion" and confirm the flow feels natural, supportive, and respectful.
  Commit: `Implement conversational branching and multi-turn message persistence`

- [x] **5. Memory Minimization and Anti-Hallucination Context Retrieval**
  Becomes usable: When the user journals, the app scans previous saved sessions for topical relevance (e.g. matching keywords like "exam", "sleep", "project"), extracts at most 1–2 brief snippets (~120 words), and passes them as context. If no past sessions are relevant, zero context is sent. The AI accurately remembers past recorded strategies without ever inventing memories.
  Why now: Delivers MindMosaic's unique kernel — real memory continuity with strict anti-fabrication and data minimization guarantees.
  PRD ref: `prd.md > AI Memory and Continuity`, `prd.md > The Unique Kernel`
  Spec ref: `spec.md > Data Model, Local Storage & Memory Minimization`, `spec.md > AI System Prompt`
  Build: Implement `lib/storage.ts > getRelevantContext(currentText)` to scan local sessions for keyword/thematic relevance and cap context size. Update `/api/chat` to include relevant context in the prompt. Update prompt with anti-hallucination instructions: never claim an activity helped unless recorded in the text, and be transparent when no context exists.
  Verify (mechanical): Seed `localStorage` with a fictional session mentioning a helpful evening walk. Submit a new reflection about feeling restless. Verify the AI mentions the walk from the saved entry. Submit a completely unrelated reflection (e.g. buying a new notebook) and verify zero past context is sent and no memories are fabricated.
  Learner check: Create an entry about trying a specific study technique. Start a new entry the next day about studying. Observe the AI naturally remembering what you actually wrote, without inventing extra details.
  Commit: `Implement memory minimization and anti-hallucination context retrieval`

- [x] **6. Journal History, Full Retrospective Session View, and Deletion**
  Becomes usable: The user can navigate to `/history` to browse all saved sessions sorted newest-first with formatted dates, times, and previews. Tapping a session opens the full retrospective view (original entry + complete conversation). Individual sessions can be deleted with a confirmation dialog, and a "Clear All" action is available.
  Why now: Completes the full user lifecycle, fulfilling user data control, privacy rights, and the PRD's history requirements.
  PRD ref: `prd.md > Journal History`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (`HistoryList`, `SessionView`), `spec.md > Data Model`
  Build: Create `app/history/page.tsx`, `components/HistoryList.tsx`, and `components/SessionView.tsx`. Implement date formatting, ~80-character snippet previews, delete confirmation modal, and empty state ("Nothing here yet — your first entry is waiting."). Connect delete actions to `lib/storage.ts`.
  Verify (mechanical): Create 3 sessions, visit `/history`, verify all 3 render in reverse-chronological order. Open one session, confirm full transcript renders. Delete one session, confirm it is removed from `localStorage` and the list updates. Trigger "Clear All" and verify empty state renders.
  Learner check: Visit your History page, open a past conversation, check that timestamps and messages are intact, and delete a test session to confirm you have complete control over your data.
  Commit: `Add journal history, retrospective session view, and session deletion`

## Hands-on Checkpoints

- [x] Early usable behavior explored — Checkpoint after Slice 2 (Scaffold, Themes, Journal Entry, Consent, and Mock Fallback running locally)
- [x] Final kick-the-tires exploration and feedback completed — After Slice 6 (Full end-to-end user journey across all screens and features)

## Final Review

- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Guided Code Tour following a reflection submission across frontend, API proxy/safety guards, and local storage partitions; learner completed comprehension checks at each stop.
Route and stops: 1. components/JournalEntry.tsx (save-first & consent gate), 2. app/api/chat/route.ts (deterministic medical/crisis guards & provider selection), 3. lib/storage.ts (partition isolation & resilient deletion).
Edit outcome: Offered and declined; learner chose to keep verified code unchanged.
Reflection: Addressed; learner noted: "Deterministic safety rules should run before statistical AI models for critical safety decisions. Next time, plan smaller implementation slices, review the plan before coding, and test each feature before moving to the next."
Activity mode: guided

## Revisions


