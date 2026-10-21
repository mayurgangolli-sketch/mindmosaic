# MindMosaic — A Private Emotional Wellness Journal

> A private emotional wellness journal where an AI companion listens with empathy, grounded in your real reflections — without unsolicited advice or clinical diagnostic labels.

---

## Overview

MindMosaic is built for students, working professionals, and anyone experiencing academic stress, workplace burnout, or anxiety who needs a quiet space to think out loud.

Unlike generic AI chat tools that forget you the moment a tab closes — or complex platforms that require accounts, credit cards, and cloud databases — MindMosaic provides an intimate, local-first journaling space:
- **Save-First Guarantee**: Your reflections are immediately saved to your local browser storage before any network request or AI processing begins.
- **Informed AI Consent**: Your writing stays on your device by default. Content is only sent to an external AI service when you explicitly choose to engage and confirm the privacy consent dialog.
- **Friend-First Active Listener**: The companion validates your specific feelings first, avoiding formulaic empathy templates and offering no unsolicited advice unless you ask.
- **Conversational Agency**: After the opening reflection, choose between **"Talk more"** (to unpack your thoughts) or **"Get a suggestion"** (to receive 1–2 practical, manageable ideas).
- **Grounded Memory Continuity**: MindMosaic uses relevance checks and approved memory summaries to help ground responses in recorded information. AI responses may still be inaccurate.
- **Full Retrospective & Data Control**: Browse past sessions sorted newest-first, read complete conversation threads, and permanently delete individual reflections or clear all history at any time.

---

## The Core User Journey

```
Welcome Screen (/)
      │
      ▼
Journal Workspace (/journal) ──► Saved immediately to browser localStorage
      │
      ▼
Privacy Consent Modal ────────► User confirms (or chooses to keep local only)
      │
      ▼
Companion Active Listening ───► Validates feelings; no unsolicited advice
      │
      ├───► [Talk more] ────────► Natural conversational flow
      │
      └───► [Get a suggestion] ─► 1–2 practical, manageable coping ideas
      │
      ▼
History View (/history) ──────► Retrospective reading, single delete, or clear all
```

---

## Technical Stack & Architecture

### Frontend & Application Layer
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Type Safety**: TypeScript 5 (Strict type checking enabled)
- **Styling**: Tailwind CSS 3 (Custom ivory/mint light mode and night sanctuary dark mode palettes)
- **Icons**: Lucide React (Official lightweight SVG iconography; zero raw emojis as UI controls)

### Data Persistence Layer
- **Browser LocalStorage**: Reflections, conversation transcripts, theme preferences, and user-approved memories reside entirely within the user's browser.
- **Storage Keys**:
  - `mindmosaic_sessions`: Array of saved reflections and conversation transcripts.
  - `mindmosaic_memories`: Versioned memory records approved by the user.
  - `mindmosaic_memory_settings`: Persistent memory toggle and consent metadata.
  - `mindmosaic_theme`: Theme choice (`light`, `dark`, or `system`).

### Backend API Routes & AI Providers
- **Secure Server Proxy**: Server-side Next.js route handlers (`/api/chat` and `/api/memory/extract`) keep the private Groq API key strictly on the server. The client bundle never receives or exposes API credentials.
- **AI Inference Provider**: Free Groq developer tier targeting the `openai/gpt-oss-20b` model (configurable via server environment variables).
- **Transparent Offline Mock Fallback**: Built-in `MockAIProvider` automatically activates if no API key is configured or if network inference fails, allowing full offline journaling and honest simulated responses labeled `[Offline Demo]`.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Version 18+ LTS recommended)
- `npm` (bundled with Node.js)

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/username/mindmosaic.git
cd mindmosaic

# Install dependencies (lightweight npm packages only)
npm install
```

### 2. Environment Configuration (Optional)
MindMosaic is fully operational without an API key using the transparent offline mock provider. To enable live AI companion responses via Groq's free developer tier:

1. Obtain a free API key from the [Groq Console](https://console.groq.com/).
2. Copy `.env.example` to create a local `.env.local` file:

   **macOS / Linux / Git Bash:**
   ```bash
   cp .env.example .env.local
   ```

   **Windows PowerShell:**
   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Open `.env.local` and add your key using placeholder format:
   ```env
   # Groq API Key (Server-side only, never committed to git)
   GROQ_API_KEY=your_groq_api_key_here

   # Groq Model ID (Optional - defaults to openai/gpt-oss-20b)
   GROQ_MODEL=openai/gpt-oss-20b
   ```

> **Security Note**: Never commit `.env.local` or expose your private API key. The `.gitignore` file is configured to strictly exclude all `.env*.local` files.

### 3. Run the Development Server
```bash
npm run dev
```
Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

### 4. Production Build
```bash
# Compile and build the production bundle
npm run build

# Start the optimized production server
npm run start
```

---

## Automated Verification & Testing

MindMosaic maintains automated test suites covering retrieval logic, server safety filtering, storage resilience, security rate limiting, and retrospective history. All tests execute deterministically with zero external API calls:

```bash
# 1. Retrospective History & Deletion Verification (Slice 6)
npx tsx scratch/test_slice6_history.ts

# 2. Memory Relevance Ranking & Keyword Retrieval (Slice 5A)
npx tsx scratch/test_retrieval_step1.ts

# 3. Server Route Safety & Diagnostic Stripping (Slice 5B)
npx tsx scratch/test_chat_route_step2.ts

# 4. Client/Server Integration & Dynamic Retry (Slice 5C)
npx tsx scratch/test_slice5c_integration.ts

# 5. Multi-Turn Continuity & Medical Bypass (Slice 5D)
npx tsx scratch/test_slice5d_continuity.ts

# 6. Storage Resilience, Quota Errors & Partition Isolation (Slice 5E)
npx tsx scratch/test_slice5e_resilience.ts

# 7. Security Hardening: IP Validation, Byte Bounds, Rate Limits & CSP
npx tsx scratch/test_security_hardening.ts

# 8. Full TypeScript Type Check
npx tsc --noEmit

# 9. Next.js Production Build
npm run build
```

---

## Privacy, Storage & Memory Controls

1. **Local Data Residence**:
   - Journal sessions, reflection text, full conversation transcripts, and approved memories are stored in browser `localStorage`.
   - Data is stored on your device and is not synchronized to or stored in an external MindMosaic database.
   - **Storage Limitation**: `localStorage` is not hardware-encrypted by the browser. Clearing browser data, using incognito/private browsing windows, or changing devices will not transfer saved reflections.
2. **Explicit Consent & External AI Transmission**:
   - Reflections remain local by default.
   - When you explicitly confirm the Privacy Consent modal before an AI reflection, only the current message (and up to three concise, user-approved memory summaries if companion memory is enabled) is transmitted to the MindMosaic server route and forwarded to Groq's cloud inference service.
   - MindMosaic does not save your reflections in a remote database. External AI inference is subject to Groq's standard developer API terms and privacy policies; MindMosaic makes no independent promises regarding upstream third-party data processing or retention policies.
   - If you decline consent, your reflection is preserved locally on your device, no data leaves your browser, and no external AI call is made.
3. **Approved Memory Controls**:
   - Persistent memory is switched **OFF** by default.
   - When enabled, candidate memories extracted by the AI require explicit user approval via a confirmation card before being stored.
   - Memory capacity is capped at 50 records, with AI-inferred observations evicted before user-stated facts.
   - Deleting a journal reflection does not delete approved memories (preserving your personal coping strategies), and clearing memories does not delete your journal reflections.
4. **Permanent Data Erasure**:
   - Delete individual sessions or use **"Clear All History"** to permanently erase session records from local browser storage.

---

## Safety Boundaries & Crisis Resources

### Non-Diagnostic Wellness Disclaimer
MindMosaic is an empathetic reflection companion designed for everyday emotional wellness. **It is not a diagnostic tool, a medical service, or a substitute for professional mental health therapy.** The system strictly prohibits diagnosing conditions, speculating on medical causes, or prescribing medical treatments.

### Emergency Medical Precedence
If an entry describes alarming physical warning signs (such as the sudden "worst headache of your life", loss of vision, new numbness, or severe difficulty speaking), MindMosaic immediately provides clear emergency medical guidance as the first and only content of the response.

### Crisis Helpline Resources
If an entry indicates severe distress, self-harm, or crisis, MindMosaic surfaces the following helpline resources configured in the application:
- **Tele-MANAS (Govt. of India)**: `14416` or `1800-891-4416` (24/7 National Mental Health Helpline)
- **iCALL – TISS Mumbai**: `+91 9152987821` (Mon–Sat, 10:00 AM – 8:00 PM)
- **Vandrevala Foundation Helpline**: `+91 9999 666 555` (24/7 Free Call and WhatsApp Support)
- **National Emergency Services (India)**: `112` (Immediate Medical, Police, Fire)
- **International Resources**: [findahelpline.com](https://findahelpline.com/) (Free, confidential support across 130+ countries)

---

## Security Architecture & Known Limitations

The application configures security headers, request-size limits, and in-memory rate limiting. These controls reduce certain risks but do not guarantee security.

- **Bounded Request Bodies**: Server routes enforce byte limits (64 KB for chat, 16 KB for memory extraction) using raw stream chunk inspection before JSON parsing, returning HTTP 413 for oversized payloads.
- **In-Memory Rate Limiting**: Built-in sliding-window limiter restricts abuse (`/api/chat`: 15 req/min, `/api/memory/extract`: 10 req/min). Note: In serverless multi-instance deployments, in-memory limits apply per instance rather than globally; distributed coordination would require an external data store (e.g., Redis).
- **Client IP Validation**: Validates client IP addresses using Node.js native `node:net isIP()` to handle standard IPv4 and compressed IPv6 (`::1`). Forwarded headers (`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`) are trustworthy only when an upstream reverse proxy sanitizes them.
- **Content Security Policy & Security Headers**: Configured with `default-src 'self'`, with allowances including `'unsafe-inline'` for scripts (required by the inline zero-flash theme script in `<head>`) and styles (Tailwind CSS styling), `'unsafe-eval'` in development mode, `data:` and `blob:` for images and fonts, and `frame-ancestors 'none'` to block clickjacking. Includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and production-only HSTS (`max-age=31536000`).
- **Dependency Advisories**: Dependency advisories remain under review. Review the affected packages and available fixes before public deployment.

---

## Hackathon Links & Submission Artifacts

- **Public Repository**: [https://github.com/username/mindmosaic](https://github.com/username/mindmosaic) *(Placeholder — to be updated upon repository publication)*
- **Demo Video Walkthrough**: [https://youtu.be/placeholder](https://youtu.be/placeholder) *(Placeholder — to be updated upon recording)*

---

## License

This project was developed for the **Devpost Build With AI: Basics** learning hackathon under a strict ₹0 / $0 budget. An open-source license has not yet been selected.
