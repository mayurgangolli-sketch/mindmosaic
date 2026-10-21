---
doc: spec
status: approved
---

# MindMosaic — Technical Specification

## Reconciliation with Approved Scope and PRD

Before detailing the blueprint, the specification is reconciled with [scope.md](file:///c:/Users/mayur/Documents/mindmosaic/devpost/scope.md) and [prd.md](file:///c:/Users/mayur/Documents/mindmosaic/devpost/prd.md):

1. **Alignment with Core Scope and PRD:**
   - **Kernel & Journey:** Free-form entry saved locally before AI interaction; friend-first listener acknowledging specific situations before any advice; choice between "Talk more" and "Get a suggestion"; memory strictly grounded in genuinely recorded sessions; full session history with preview and deletion.
   - **Strict Zero-Cost & Device Compatibility:** Strictly ₹0 / $0 budget; no paid APIs, no billing, no paid hosting; accessible on ordinary smartphones and budget laptops via modern web browsers (no Ollama, no local AI models, no dedicated GPU).
   - **Security & Privacy:** Server-side API key isolation (`.env.local` excluded from git); informed consent modal before external AI processing; refusal allows journaling without AI; browser `localStorage` for offline persistence; fictional data only for development.
   - **Health & Safety Boundaries:** Maintained from PRD — verified crisis helplines and calibrated medical referral (no diagnosing or treatment prescribing, with immediate emergency-first guidance for alarming warning signs).

2. **Reconciled Design Refinement (Themes):**
   - In `prd.md > Look and Feel`, dark mode was noted as "avoid dark mode as default", prioritizing a calm, inviting default.
   - This specification formalizes that guidance into a comprehensive three-way theme system: **Light** (default soft aqua/mint), **Dark** (restrained deep teal/blue-green night palette with muted aqua accents), and **System** (follows OS preference dynamically), with local persistence and zero-flash initialization.

---

## How This Works, In Plain Language

MindMosaic consists of three clean parts working together in a single, lightweight web application:

1. **The Frontend (What you interact with in your browser):**
   - The user interface: Welcome screen, Journal editor, AI conversation thread, Theme toggle, and History manager.
   - Built with React 19 and Next.js 15 App Router, styled with Tailwind CSS.
   - Designed mobile-first for small phone screens and budget laptops with fast rendering and accessible contrast.
   - Interacts with local browser memory for storage and calls our own internal server route when AI responses are requested.

2. **The Backend API Route (The secure server-side proxy):**
   - A single Next.js server route at `/api/chat`.
   - Never exposed to the browser, this route acts as a secure intermediary. It retrieves the secret Groq API key from server environment variables (`.env.local`), formats the prompt with the user's current entry and only relevant historical context (if any), and securely calls Groq.
   - Protects your credentials: the browser never receives, stores, or sees the API key.

3. **The Provider Adapter (The swappable AI connection):**
   - A modular TypeScript interface (`lib/ai-provider.ts`) isolating the AI provider details from the rest of the application.
   - Connects to Groq (`lib/providers/groq.ts`) on the free developer tier (defaulting to `openai/gpt-oss-20b`, configurable via `GROQ_MODEL`; replacing the sunsetting `llama-3.1-8b-instant`).
   - Includes an honest fallback mock adapter (`lib/providers/mock.ts`) that activates automatically if Groq is unavailable, rate-limited, or misconfigured. Any fallback response is explicitly labeled as simulated, and core journaling, reading history, and deleting entries remain fully functional.

4. **Where Your Data Lives:**
   - All journal entries and full conversation threads reside in browser **`localStorage`** (`mindmosaic_sessions`).
   - Your reflections stay on your device. Data only leaves your browser when you explicitly consent before an AI interaction, at which point only the current message and minimal relevant context (if any) are sent to the AI service.

---

## The Core Journey Through the System

*PRD ref: `prd.md > The Core Journey`*

```
User opens browser (Mobile / Desktop)
      │
      ▼
  Welcome Screen (app/page.tsx)
  Shows: Brand mark, calm tagline, Theme Toggle (Light/Dark/System),
  and primary "Start Journaling" button.
      │
      ▼
  Journal Screen (app/journal/page.tsx)
  Shows: Time-aware greeting, "What's on your mind today?", expandable textarea.
      │
  User writes reflection → clicks "Save & Share"
      │
      ├─── 1. Entry saved to localStorage IMMEDIATELY (timestamped session created)
      │        (User's writing is safe even if network/AI fails)
      │
      ├─── 2. Privacy Consent Check (sessionStorage flag)
      │        • First AI interaction of the session: ConsentModal opens.
      │        • Explains what is sent (current entry + relevant past context snippets, if any),
      │          to whom (Groq cloud inference running Llama), and why (contextual response).
      │        • If declined: Modal closes, entry remains saved locally, honest notice
      │          explains AI is paused for this session. Core app remains fully usable.
      │        • If approved: Consent recorded for the session; proceeds to step 3.
      │
      ├─── 3. Browser calls Next.js API Route (/api/chat)
      │        Payload: { currentMessage, relevantContext: [only topically relevant past snippets, or []] }
      │        │
      │        ▼
      │     [Server: /api/chat/route.ts]
      │     • Validates payload (no extraneous data).
      │     • Reads GROQ_API_KEY from .env.local (never sent to client).
      │     • Invokes Groq adapter via AIProvider interface.
      │     • Formats system prompt (friend-first listener, safety rules, medical boundaries,
      │       anti-hallucination instructions).
      │        │
      │        ▼
      │     [Groq Free API: openai/gpt-oss-20b (default)]
      │     (If network/API fails or rate limits hit → Mock provider returns transparently labeled fallback)
      │
      ├─── 4. AI Friend-First Response Rendered
      │        • Acknowledges specific situation empathetically; offers NO unsolicited advice.
      │        • Appends AI message to the active session in localStorage.
      │        • Displays two distinct branch choice buttons:
      │          [Talk more]   [Get a suggestion]
      │
      ├─── 5. Conversation Continuation
      │        • User selects branch or types follow-up.
      │        • Subtly presents accessible switch option between branches.
      │        • Each message turn is saved to localStorage immediately upon receipt.
      │
      ▼
  History Screen (app/history/page.tsx)
  • Reads saved sessions from localStorage (sorted newest first).
  • Lists: Date, formatted time, and ~80-character entry preview.
  • Tapping opens SessionView: full original entry + ordered conversation transcript.
  • Provides single-session deletion and complete "Clear all" with confirmation dialogues.
```

---

## Stack

| Layer | Choice | Version | Rationale & Tradeoff | Docs |
|---|---|---|---|---|
| **Framework** | Next.js (App Router) | 15.x (latest stable) | Unifies frontend and backend in one project; server routes secure API secrets. Tradeoff: JavaScript/TypeScript rather than Python. | [nextjs.org/docs](https://nextjs.org/docs) |
| **UI Library** | React | 19.x (bundled) | Component-based state handling for reactive conversation and theme state. | [react.dev](https://react.dev) |
| **Language** | TypeScript | 5.x | Enforces type safety across data schemas and provider interfaces, preventing runtime bugs. | [typescriptlang.org](https://www.typescriptlang.org/docs) |
| **Styling** | Tailwind CSS | 3.x / 4.x stable | Utility-first CSS allowing precise, lightweight responsive design, custom palettes, and dark mode classes without heavyweight UI dependencies. | [tailwindcss.com](https://tailwindcss.com/docs) |
| **Icons** | Lucide React | Latest stable | Clean, purposeful SVG iconography. Eliminates informal emoji-as-icon patterns. | [lucide.dev](https://lucide.dev) |
| **AI Provider** | Groq Developer Free Tier | API v1 | Strictly ₹0 / $0, no credit card required, zero data retention for training. Fast inference on budget connections. Tradeoff: Rate limits (~30 RPM) and subject to provider terms. | [console.groq.com/docs](https://console.groq.com/docs) |
| **AI Model** | `openai/gpt-oss-20b` (configurable) | Free Tier | Ultra-fast inference (~1,000 tps), 128K context, prompt caching support, replacing sunsetting `llama-3.1-8b-instant`. | [console.groq.com/docs/models](https://console.groq.com/docs/models) |
| **Storage** | Browser `localStorage` | Built-in Web API | Local, zero-cost, requires no database setup or remote credentials. Tradeoff: Tied to single browser/device; unencrypted; cleared if browser data is wiped. | [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) |
| **Runtime** | Node.js | 18+ LTS | Standard execution environment for local build and Next.js server routes. | [nodejs.org](https://nodejs.org) |

---

## Where It Runs and How Someone Tries It

### Local Development (Primary Evaluation Target)

MindMosaic runs locally on ordinary machines (Windows, macOS, Linux) without requiring GPUs or special hardware:

```bash
# 1. Clone repository
git clone <repository-url>
cd mindmosaic

# 2. Install dependencies (lightweight npm packages only)
npm install

# 3. Configure environment variable
# Copy template and add your free Groq key from console.groq.com
cp .env.example .env.local
# Edit .env.local: GROQ_API_KEY=gsk_...

# 4. Start local development server
npm run dev

# 5. Open in any modern mobile or desktop browser
# http://localhost:3000
```

### Free Demo Recording & Hackathon Submission

- **Required Submission Artifacts:**
  1. Short video demonstration (~1–3 minutes) demonstrating: Welcome screen → Light/Dark/System theme switch → Writing a journal entry → Local save before AI call → Privacy consent dialog → First friend-first AI response → Branch choice ("Talk more" / "Get a suggestion") → History list → Viewing a past session → Deleting a session.
  2. Public GitHub repository with clean code, `.env.example`, and zero exposed secrets.
- **Optional Deployment:**
  - Can be hosted on Vercel Hobby Free Tier (requires linking GitHub repo and setting `GROQ_API_KEY` in Vercel project environment variables).
  - Vercel deployment is strictly optional and does not replace the demo recording.

---

## Visual Design System & Anti-AI-Slop Standards

MindMosaic's visual identity is calm, mature, focused, and distinctively art-directed. It rejects generic templates, aggressive gradients, and decorative distractions.

### 1. Palette & Themes

The app implements three theme states: **Light**, **Dark**, and **System** (defaulting to System, with explicit toggle).

- **Light Mode:**
  - Background: Soft, warm ivory to very subtle mint tint (`#F7FAF9` to `#EDF5F3`).
  - Cards & Surfaces: Translucent warm white (`rgba(255, 255, 255, 0.85)`), backdrop blur (`backdrop-blur-md`), hairline borders (`rgba(126, 206, 202, 0.25)`).
  - Primary Accent: Soft Aqua (`#4A9B96` / `#367C78` for accessible contrast against white, meeting WCAG AA 4.5:1).
  - Secondary Accent: Gentle Mint (`#94D6C0`).
  - Text: Deep Slate Charcoal (`#1E293B`) for body text, ensuring effortless readability.

- **Dark Mode (Night Sanctuary):**
  - Background: Deep contemplative teal / slate blue-green (`#0B1719` to `#0F2023`). Strictly avoids harsh pure-black (`#000000`), neon colors, or purples.
  - Cards & Surfaces: Muted deep teal card surfaces (`rgba(19, 38, 43, 0.8)`), subtle border (`rgba(94, 177, 172, 0.2)`).
  - Primary Accent: Luminous Soft Mint (`#6BC4B3`).
  - Text: Crisp, soft off-white (`#E6F4F1`) and muted teal-gray (`#9BB3AF`) for secondary labels. Meets WCAG AA contrast.

- **Theme Behavior & Persistence:**
  - Theme state stored in `localStorage` (`mindmosaic_theme`: `'light' | 'dark' | 'system'`).
  - An inline script in the document `<head>` initializes the theme before DOM paint, preventing any Flash of Unstyled Theme (FOUT).
  - Listens to `window.matchMedia('(prefers-color-scheme: dark)')` to dynamically update if System mode is selected and OS preferences change.

### 2. Typography

- **Headings (Brand & Titles):** `Playfair Display` (Google Fonts, serif) — evokes the thoughtful intimacy of an authentic bound journal.
- **Body, Inputs & Conversation:** `Inter` (Google Fonts, sans-serif) — clean, highly legible, optimized for small screens and long-form writing.
- **Line Length & Rhythm:** Controlled `max-w-prose` (65–75 characters per line) for optimal reading comfort.

### 3. Iconography & Components

- **Icons:** Official `lucide-react` SVG icons (featherweight, precise stroke width). **Zero emojis as interface buttons or navigation icons.**
- **Geometry & Cards:** Modest rounded corners (`rounded-xl` or `rounded-2xl`). Restrained, diffused shadows (`shadow-sm` / `shadow-md`). No floating blob shapes or decorative background noise.
- **Buttons:** Purposeful, rectangular with soft corners (`rounded-lg` / `rounded-xl`), clear contrast, visible focus rings (`focus-visible:ring-2`). Strictly avoids repetitive "pill" buttons everywhere.

### 4. Explicit Anti-AI-Slop Rules

To ensure professional quality, the following are strictly prohibited:
- ❌ No purple, violet, or magenta gradients.
- ❌ No generic SaaS landing page templates with oversized generic hero sections.
- ❌ No fake testimonials, invented user reviews, fake user counts, or fabricated trust badges.
- ❌ No cursor-following effects, custom trailing cursors, or parallax scroll animations.
- ❌ No floating decorative blobs, mesh gradient blobs, or decorative confetti.
- ❌ No emoji used as UI control icons.
- ❌ No vague marketing slogans or exaggerated therapeutic claims.
- ❌ No forced animations that delay reading or interaction. Full respect for `prefers-reduced-motion`.

---

## Components

*Every component addresses specific requirements in `prd.md > Features and Behavior` and `prd.md > Screens and Layout`.*

### `ThemeToggle`
- **Purpose:** Accessible switch allowing the user to select between Light, Dark, and System themes.
- **Details:** Uses subtle icons (Sun, Moon, Monitor) from `lucide-react`. Persists selection to `localStorage` and applies `.dark` class to `<html>`. Fully keyboard accessible.

### `WelcomeScreen`
- **Purpose:** Inviting, uncluttered landing view.
- **Details:** Displays the serif title, tagline *"A space to be heard, without judgment"*, and a prominent "Start Journaling" button. Includes the `ThemeToggle` in the top corner. Contains no fake metrics, no forced accounts, and no complex onboarding wizard.
- **PRD Ref:** `prd.md > Welcome Screen`.

### `ConsentModal`
- **Purpose:** Transparent, informed privacy consent prior to calling external AI services.
- **Details:** Appears as an accessible dialog overlay before the first AI interaction in a session. Clearly explains: (1) what data is sent (current entry + only relevant past context excerpts, if any), (2) the recipient (Groq cloud inference running Llama), (3) the purpose (personalized conversational context), and (4) that data is not used for training. Provides explicit "Agree & Continue" and "Keep Local Only" buttons. If declined, saves the entry locally, suppresses AI network requests for the session, and informs the user honestly.
- **PRD Ref:** `prd.md > Privacy Consent`.

### `JournalEntry`
- **Purpose:** The distraction-free private writing environment.
- **Details:** Features a time-aware greeting (e.g., "Good evening"), the prompt *"What's on your mind today?"*, and an auto-expanding, accessible textarea. The "Save & Share" action immediately commits the entry to `localStorage` before any network activity begins.
- **PRD Ref:** `prd.md > Journal Entry`.

### `ConversationThread`
- **Purpose:** Renders the back-and-forth dialogue between the user and the AI companion.
- **Details:** Displays the initial journal entry at the top, followed by alternating message bubbles with distinct styling for user and AI. AI messages feature restrained translucent card styling. Shows a subtle typing indicator during AI generation.
- **PRD Ref:** `prd.md > AI Companion Conversation`.

### `BranchChoice`
- **Purpose:** Offers the two conversational branches after the initial AI response.
- **Details:** Presents two clearly labeled buttons: **"Talk more"** and **"Get a suggestion"**. Once chosen, the buttons recede into natural conversation flow, while leaving a subtle, accessible link to switch modes at any time.
- **PRD Ref:** `prd.md > AI Companion — Friend-First Response`, `prd.md > AI Companion — Talk More Branch`, `prd.md > AI Companion — Get a Suggestion Branch`.

### `SafetyBanner`
- **Purpose:** Immediate, compassionate crisis intervention and medical safety notices.
- **Details:** Rendered when crisis language or severe medical warning signs are detected. Provides verified, immediate helpline resources:
  - **Tele-MANAS (Govt of India):** `14416` or `1800-891-4416` (24/7, Toll-Free, Multilingual National Mental Health Helpline)
  - **iCALL – TISS Mumbai:** `+91 9152987821` / `022-25521111` (Mon–Sat, 10:00 AM – 8:00 PM; `icallhelpline.org`)
  - **Vandrevala Foundation Helpline:** `+91 9999 666 555` (24/7, Free Call and WhatsApp; `vandrevalafoundation.com`)
  - **National Emergency Services (India):** `112` (Immediate Emergency Medical, Police, Fire)
  - **International Directory:** `findahelpline.com` (Free, confidential support across 130+ countries)
  - **Safety Notice:** Automated keyword or pattern detection cannot guarantee 100% comprehensive detection of crisis or medical emergencies, and does not replace professional psychiatric or emergency medical evaluation.
  - Replaces standard companion chit-chat; places emergency guidance first and unhindered.
- **PRD Ref:** `prd.md > Safety Boundary`, `prd.md > Health Concerns and Medical Referral`.

### `HistoryList`
- **Purpose:** Displays chronological index of saved journal sessions.
- **Details:** Lists all entries stored in `localStorage` sorted by date (newest first). Each item shows the formatted date, time, and an ~80-character preview. Includes empty state (*"Nothing here yet — your first entry is waiting."*) and a "Clear All" action with modal confirmation.
- **PRD Ref:** `prd.md > Journal History`.

### `SessionView`
- **Purpose:** Full retrospective view of an individual past session.
- **Details:** Displays the original journal entry with its timestamp, followed by the entire conversation thread in chronological order (including suggestions offered). Includes a single-session "Delete Session" button with a confirmation step. Deletion removes the session from `localStorage` and returns to `HistoryList`.
- **PRD Ref:** `prd.md > Journal History`.

---

## Data Model, Local Storage & Memory Minimization

All user data is persisted in the user's browser using `localStorage`. No remote database is used.

### Schema (`lib/storage.ts`)

```typescript
// Stored as a JSON array under the key: "mindmosaic_sessions"
export interface JournalSession {
  id: string;               // Unique ID: `session_${Date.now()}_${randomSuffix}`
  createdAt: string;        // ISO 8601 string: "2026-10-19T15:30:00.000Z"
  entryText: string;        // Original free-form journal reflection
  conversation: Message[];  // Complete chronological message thread
}

export interface Message {
  id: string;               // Unique message identifier
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;        // ISO 8601 string
  branchChoice?: 'talk' | 'suggestion'; // Optional branch record
  isSimulated?: boolean;    // Explicitly true if produced by fallback mock provider
}

// Session-scoped consent flag (cleared when browser tab closes)
// sessionStorage key: "mindmosaic_consent_given" => "true" | "false"

// Persistent theme preference
// localStorage key: "mindmosaic_theme" => "light" | "dark" | "system"
```

### Memory Minimization Strategy
To honor privacy and token efficiency:
1. **Relevance Filtering (No Blind Dumps):** The frontend does **not** automatically pass entire recent sessions. Before calling `/api/chat`, a client-side utility (`lib/storage.ts > getRelevantContext`) scans saved sessions for meaningful keyword/topic overlap with the current entry (e.g. references to recurring topics like "exam", "sleep", "headache", "project").
2. **Strict Excerpt Limits:** Only matching excerpts (up to 1–2 brief snippets, maximum ~120 words total) are extracted.
3. **Zero Historical Context When Irrelevant:** If no past entries share meaningful topical overlap with the current submission, **zero historical context is sent**.
4. **Anti-Fabrication Prompting:** When no historical context is passed, the system prompt instructs the AI to recognize that no relevant prior history was recorded. The AI must never invent past conversations or claim an activity helped.

### Data Lifecycle & Safety
1. **Save-First Rule:** When the user clicks submit, the entry is written to `localStorage` immediately. Network failure or tab closure cannot destroy the user's writing.
2. **Atomic Session Updates:** Every incoming AI response and user follow-up is appended to the session object and committed to `localStorage` right away.
3. **Session Reopening & Deletion:** Any session can be inspected in full or deleted permanently. Deleting a session removes both the journal text and its associated conversation from `localStorage`.
4. **Storage Limitations & Fallbacks:** A standard `try/catch` wraps `localStorage.setItem`. If storage is full (quota exceeded), an honest banner warns the user to clear older entries, ensuring existing data is never corrupted.
5. **Clear Privacy Disclaimers:** The UI transparently explains that `localStorage` is not hardware-encrypted and that clearing browser data or switching devices will not transfer entries.

---

## AI System Prompt & Conversational Guidelines

The AI system prompt configured in `app/api/chat/route.ts` translates the PRD personality and safety principles into concrete behavior:

```markdown
You are MindMosaic, a compassionate, emotionally attentive friend and personal wellness companion.

CORE IDENTITY & CONVERSATIONAL PRINCIPLES:
1. Friend-First: Always acknowledge the user's specific feelings and situation before anything else.
2. No Formulaic Openers: NEVER use phrases like "I'm sorry you're feeling this way", "It sounds like you're experiencing...", or "Would you like to explore those feelings?".
3. No Unsolicited Advice: In the first response, offer NO advice, tips, solutions, or action plans. Simply listen, validate the specific detail, and sit with them.
4. Varied Rhythm: Match the user's tone. Sometimes write a thoughtful paragraph; sometimes write a single warm sentence. Do not always end with a question. Silence and presence are valid.
5. User Leads: If the user says they are tired or done, let them rest without probing. If they change the subject, follow them immediately without clinging to the previous topic.
6. Honest Memory: Only reference previous events or strategies if they appear in the provided RELEVANT CONTEXT snippets. If no context snippets are provided, you have NO prior memory of the user. NEVER invent past experiences or claim an activity helped unless explicitly documented in the provided context.

SAFETY & CRISIS BOUNDARY:
If the user indicates intent of self-harm, suicide, or severe crisis, step back from the companion role immediately. Provide a calm, non-judgmental response and display emergency helpline resources:
- Tele-MANAS (Govt of India): 14416 or 1800-891-4416 (24/7)
- iCALL (TISS): +91 9152987821 (Mon-Sat, 10am-8pm)
- Vandrevala Foundation: +91 9999 666 555 (24/7)
- Immediate Emergency (India): 112
- International: findahelpline.com

HEALTH & MEDICAL REFERRAL BOUNDARY:
1. Never diagnose, identify causes, prescribe treatments, or suggest medications for any physical symptom or illness.
2. Acknowledge physical discomfort with compassion, and advise consulting a qualified healthcare professional.
3. Severe warning signs (e.g., sudden "worst headache of life", loss of vision, numbness, difficulty speaking): Provide IMMEDIATE emergency medical care guidance as the FIRST and ONLY content of the response. Do not delay with follow-up questions or wellness chit-chat.
```

---

## File Structure

```
mindmosaic/
├── app/
│   ├── layout.tsx              # Root layout: metadata, fonts (Playfair + Inter), theme init script
│   ├── globals.css             # Tailwind directives, CSS custom variables, glass-morphism utilities
│   ├── page.tsx                # Welcome Screen (/)
│   ├── journal/
│   │   └── page.tsx            # Active Journaling & Conversation interface (/journal)
│   ├── history/
│   │   └── page.tsx            # Journal History list & SessionView modal (/history)
│   └── api/
│       └── chat/
│           └── route.ts        # Server-side API route: GROQ_API_KEY handler & prompt builder
│
├── components/
│   ├── ThemeToggle.tsx         # Light / Dark / System switcher (Lucide icons, no FOUT)
│   ├── WelcomeScreen.tsx       # Calm landing view with Start button
│   ├── JournalEntry.tsx        # Auto-expanding text area & save-first submission
│   ├── ConsentModal.tsx        # Privacy & data-transfer disclosure dialog
│   ├── ConversationThread.tsx  # Natural message bubbles (user vs AI)
│   ├── BranchChoice.tsx        # "Talk more" vs "Get a suggestion" controls
│   ├── SafetyBanner.tsx        # Crisis helplines & emergency medical alert panel
│   ├── HistoryList.tsx         # Session listing with date, time, and ~80-char preview
│   └── SessionView.tsx         # Full session retro view (entry + ordered conversation)
│
├── lib/
│   ├── storage.ts              # Type-safe localStorage CRUD, memory minimizer & quota handler
│   ├── ai-provider.ts          # AIProvider TypeScript interface
│   └── providers/
│       ├── groq.ts             # Groq SDK / OpenAI-compatible client implementation
│       └── mock.ts             # Transparent offline/rate-limit fallback provider (labels simulated)
│
├── devpost/
│   ├── learner-profile.md      # Completed learner profile
│   ├── scope.md                # Approved project scope
│   ├── prd.md                  # Approved product requirements
│   └── spec.md                 # Technical specification (this document)
│
├── .env.local                  # GROQ_API_KEY=gsk_... (STRICTLY GITIGNORED)
├── .env.example                # GROQ_API_KEY=your_groq_api_key_here (Committed template)
├── .gitignore                  # Enforces exclusion of .env.local, node_modules, .next
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Theme color definitions (aqua, mint, deep teal), dark mode: 'class'
├── tsconfig.json               # TypeScript strict configuration
├── package.json                # Lightweight dependencies: next, react, react-dom, lucide-react, groq-sdk
└── README.md                   # Setup guide and local execution instructions
```

---

## External Services, Free-Tier Realities & Security

### 1. Groq Developer Free Tier & Service Realities
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`.
- **Authentication:** Bearer token loaded strictly on the server from `process.env.GROQ_API_KEY`.
- **Model:** `openai/gpt-oss-20b` (default, configurable via `GROQ_MODEL`). Selected after evaluating Groq's deprecation schedule for `llama-3.1-8b-instant`.
- **Free Tier Constraints & Volatility:**
  - Rate limits: ~30 requests per minute (RPM), ~1,000 requests per day (RPD), ~8,000 tokens per minute (TPM). Includes automatic prompt caching.
  - **No Permanence Guarantee:** Free-tier availability, model IDs, rate limits, and access conditions can be altered or discontinued by Groq at any time without notice.
  - **Strict Zero-Cost Guarantee:** MindMosaic will **never** silently transition to a paid tier or enable billing.
  - **Honest Fallback:** If Groq is unavailable, rate-limited, or misconfigured, the app falls back to `lib/providers/mock.ts`. The response is explicitly labeled in the UI as a simulated response (`[Simulated Demo Response - AI Offline]`), ensuring the user is never misled into believing a mock response is AI-generated.
  - **Privacy:** Groq terms state developer API payloads are not used to train models and are not retained by default.

### 2. Secret Protection & Anti-Leakage
- `GROQ_API_KEY` is loaded exclusively inside `app/api/chat/route.ts`.
- The key is **NEVER** prefixed with `NEXT_PUBLIC_`. It is physically impossible for Next.js to bundle it into client-side JavaScript.
- `.env.local` is listed in `.gitignore`.
- Fictional data only: All development, testing, and demonstration workflows must use synthetic/fictional entries to ensure zero sensitive personal thoughts are transmitted during evaluation.

---

## Important Failure Modes & Honest Fallbacks

| Failure Event | System Reaction | User Experience |
|---|---|---|
| **Groq 429 Rate Limit or Service Outage** | Caught by `groq.ts` adapter; falls back immediately to `mock.ts`. | Displays a clear, honest notice: *"I'm unable to connect to the AI service right now, but your journal entry is safely saved on your device. You can review it anytime in History."* Fallback messages are labeled as simulated. |
| **Missing or Invalid API Key** | Backend detects unconfigured `GROQ_API_KEY`; logs internal warning without crashing. | Activates honest mock mode. Clear prompt in developer terminal guiding key setup; user interface remains fully functional for journaling. |
| **User Declines AI Consent** | Consent state set to declined in `sessionStorage`. No request sent to `/api/chat`. | Entry is saved to `localStorage`. A warm notice informs: *"Your reflection is saved privately on this device. AI responses are paused for this session."* |
| **Network Disconnection Mid-Submission** | Entry was already written to `localStorage` before fetch was dispatched. | Notification: *"Network disconnected. Your entry is safe in History. You can retry chatting when back online."* |
| **Browser `localStorage` Full** | Exception caught in `lib/storage.ts`. | User alerted with guidance: *"Browser storage is full. Please open History and remove older sessions to save new reflections."* Existing data remains intact. |

---

## What Was Simplified and Why (POC Boundary)

1. **Targeted Keyword Relevance over Vector Embeddings:**
   - Instead of deploying an external vector database (e.g., Pinecone) and embedding models, the app scans saved sessions for topical relevance and sends at most 1–2 short snippets (or none if irrelevant).
   - *Why:* Honors memory minimization and proves the core continuity kernel with zero cost, zero external database setup, and instant response times.
2. **`localStorage` over Cloud Database / Auth:**
   - Eliminates logins, passwords, email verification, and backend databases.
   - *Why:* Maximum user privacy for a prototype and zero server hosting costs.
3. **Discrete Response over Word Streaming:**
   - Displays the AI response upon completion rather than streaming character-by-character via WebSockets or SSE.
   - *Why:* Greatly simplifies error handling and fallback switching on mobile devices without degrading conversational utility.
4. **Append-Only Active Session:**
   - Previous sessions in History can be reviewed and deleted, but continuing a conversation from a past day is deferred.
   - *Why:* Keeps data lifecycles straightforward and unambiguous.

---

## Practical Acceptance Criteria & Verification Test Plan

The following test suites define ready-for-build verification for `5-build`:

### Test Suite 1: Mobile Responsiveness & Layout
- [ ] Viewport 375px (iPhone SE / budget Android): No horizontal scrolling or clipped text.
- [ ] Textarea auto-expands comfortably; touch targets (buttons, links) are at least 44×44px.
- [ ] Clean rendering across tablet (768px) and desktop (1024px+) viewports.

### Test Suite 2: Theme System (Light, Dark, System)
- [ ] Theme switcher toggles smoothly between Light, Dark, and System modes.
- [ ] Selection is persisted across browser refreshes via `localStorage` (`mindmosaic_theme`).
- [ ] System mode dynamically adapts when the OS switches between light and dark themes.
- [ ] Dark mode uses deep slate/teal surfaces (`#0B1719`), not harsh pure black or purple gradients.
- [ ] High contrast (WCAG AA 4.5:1) verified for all text elements in both themes.
- [ ] Zero Flash of Unstyled Theme (FOUT) on hard page reload via inline document script.

### Test Suite 3: Anti-AI-Slop & UI Quality Standards
- [ ] Modest corner radii used on buttons and cards; no ubiquitous "pill" buttons everywhere.
- [ ] Real SVG icons from Lucide React used for all interface controls; zero emojis used as UI icons.
- [ ] Zero purple/violet gradients, zero floating background blobs, and zero custom cursor animations.
- [ ] Zero fake customer testimonials, invented review counts, or fabricated trust badges.
- [ ] Full respect for `prefers-reduced-motion` media queries on all subtle transitions.

### Test Suite 4: Privacy Consent & Local Save-First
- [ ] Submitting a journal entry writes the entry to `localStorage` *before* the consent dialog or AI request occurs.
- [ ] Privacy consent modal appears on the first AI interaction of the session.
- [ ] Declining consent prevents any outbound network request; the entry remains saved in History with an honest explanatory message.
- [ ] Approving consent allows the AI request to proceed and suppresses the modal for subsequent messages in that browser session.

### Test Suite 5: History Management & Deletion
- [ ] History list shows all saved sessions in reverse-chronological order with timestamps and previews.
- [ ] Tapping a session displays the full original entry and complete conversation in proper order.
- [ ] Deleting an individual session removes it from `localStorage` after confirmation.
- [ ] "Clear All" completely resets `mindmosaic_sessions` after confirmation and renders the empty state.

### Test Suite 6: AI Conversational Quality & Branching
- [ ] Initial AI response validates the user's specific text without unsolicited advice or formulaic intros.
- [ ] "Talk more" and "Get a suggestion" buttons appear after the first response.
- [ ] Selecting "Talk more" continues natural dialogue; selecting "Get a suggestion" offers at most 1–2 practical, gentle suggestions.
- [ ] User can switch between conversation branches via a persistent, subtle link.

### Test Suite 7: Memory Minimization & Anti-Hallucination
- [ ] Historical context retrieval is minimized: extracts only topically relevant snippets (max 1–2 excerpts).
- [ ] When no past sessions share topical relevance with the current entry, **zero historical context is sent**.
- [ ] AI does **not** invent past hobbies, events, or claims that an activity helped unless recorded in the provided context snippets.
- [ ] When no past history exists or applies, the AI operates transparently without pretending to remember past context.

### Test Suite 8: Safety & Medical Referral Boundaries
- [ ] **Crisis Indicator:** Entries expressing self-harm or severe crisis trigger the `SafetyBanner` and surface verified helplines (Tele-MANAS: 14416, iCALL: +91 9152987821, Vandrevala Foundation: +91 9999 666 555, Emergency: 112).
- [ ] **Mild Physical Symptom:** Acknowledges compassionately, does not diagnose or prescribe treatment, and suggests consulting a doctor if persistent.
- [ ] **Emergency Warning Signs (e.g. worst headache, sudden numbness):** AI provides clear emergency medical care guidance as the **first and only** content, without preamble, follow-up questions, or wellness suggestions.
- [ ] Clear disclaimer displayed noting that automated detection is not guaranteed to catch all emergencies and is not a substitute for clinical care.

### Test Suite 9: Zero-Cost Security & Credential Isolation
- [x] Git inspection verifies `.env.local` is excluded from git tracking.
- [x] Browser developer tools network/source inspection confirms `GROQ_API_KEY` is never present in client bundles or responses.
- [x] Missing API key or Groq rate limit gracefully triggers the mock fallback with an honest disclosure, explicitly labeling simulated responses.
- [x] Zero-dependency in-memory sliding-window rate limiting on `/api/chat` (15 req/min) and `/api/memory/extract` (10 req/min) prevents abusive script loops and Groq quota exhaustion.
- [x] Hardened HTTP security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and strict CSP) prevent clickjacking and MIME-sniffing.
- [x] Safe JSON parsing with generic client-facing error responses prevents internal exception detail leakage.
- [x] Never transitions to a paid provider under any circumstance; budget remains strictly ₹0 / $0.

---

## Decisions and Open Issues

### Summary of Agreed Decisions

| Decision | Selection | Rationale | Accepted Tradeoff |
|---|---|---|---|
| **Budget** | Strictly ₹0 / $0 | Strict user constraint; accessible to students. | Relies on Groq free tier limits and local resources. |
| **Framework** | Next.js 15 (App Router) + React 19 | Combines UI and secure server proxy in one project. | JavaScript/TypeScript stack rather than Python. |
| **Styling & UI** | Tailwind CSS + Lucide Icons | Expressive, lightweight, rapid theme implementation. | Utility class density; no off-the-shelf prebuilt widgets. |
| **Themes** | Light, Dark, System | Accommodates user preference; restful night palette. | Requires careful contrast verification across all components. |
| **Storage** | Browser `localStorage` | Zero cost, private on-device, instant setup. | No cross-device sync; data lost if browser cache wiped. |
| **Memory** | Relevant Context Minimization | Passes only topically matching snippets; zero when irrelevant. | Does not pass full session history over the wire. |
| **AI Security** | Next.js API route (`/api/chat`) | Keeps API key strictly server-side. | Requires running local Next.js server. |
| **AI Fallback** | Honest mock adapter (`mock.ts`) | App never crashes; simulated responses explicitly marked. | Offline mode lacks dynamic AI generation. |

### Genuine Uncertainty Identified & Verification Strategy

**How reliably will the system prompt enforce the friend-first restraint and emergency medical guidance using Llama 3.1 8B?**
- *The Uncertainty:* Smaller 8B parameter models can sometimes lapse into standard assistant habits (e.g., offering bulleted advice prematurely or generating polite apologies).
- *The Resolution:* During Step 3 of `5-build`, we will test the prompt against 5 specific fictional test scenarios (mild headache, emergency warning signs, exam stress, grief, and exhaustion) before connecting the UI. The prompt will be iterated until the model adheres strictly to the friend-first and emergency-first boundaries.

### Carried-Over Questions: Resolved
- **Storage:** Browser `localStorage` (key: `mindmosaic_sessions`).
- **AI Service:** Groq free developer tier (`openai/gpt-oss-20b`, configurable), with honest mock fallback.
- **Crisis Helplines:** Officially verified contact details: Tele-MANAS (`14416`), iCALL (`+91 9152987821`), Vandrevala Foundation (`+91 9999 666 555`), Emergency (`112`), and `findahelpline.com`.
- **Interrupted Session:** Entry is saved prior to AI dispatch; each completed message turn is saved immediately. Tab closure preserves all completed turns.
