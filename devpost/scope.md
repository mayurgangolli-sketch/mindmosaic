---
doc: scope
status: approved
---

# MindMosaic

A private, mobile-first emotional wellness journal where an AI companion listens like a supportive friend, responds based on genuinely saved past entries, and offers gentle suggestions only when the user is ready — never forcing advice, never inventing memories.

## The Unique Kernel

MindMosaic isn't a one-time chatbot conversation — it has real memory. The AI retrieves the user's actual saved journal entries and connects today's feelings to experiences they've genuinely recorded. When a user mentions exam stress, the AI might reference a strategy they wrote about before — but only if they actually recorded it. It never invents a past experience or claims an activity helped unless the user's own words confirm it. The insight comes from real history, not assumptions.

## Who It's For

A college student or working professional under real pressure — exam anxiety, workplace stress, sleep trouble — who wants somewhere private to think out loud. Today they either bottle it up, vent to a group chat (and feel judged), or open a generic AI that forgets them the moment the conversation ends.

## The Core Loop

They open the app and write freely about what happened or how they feel. The AI reads what they wrote *and* their relevant past entries, then responds like a supportive friend: it acknowledges feelings first, asks a gentle follow-up, and waits. The user then chooses: talk more, or hear a suggestion. The AI never pushes advice — it waits for an opening or an invitation. The entry is saved with a timestamp. Next time, the AI remembers — accurately.

## Privacy Principles (Built In, Not Bolted On)

- **Informed consent before sending:** Before journal content is sent to an external AI service for the first time in a session, the app explains clearly what will be shared and why, and obtains the user's consent. Once consent is given, the app does not repeat the warning unnecessarily within that session.
- **No exposed credentials:** API keys and secrets are never included in frontend code. They live server-side only.
- **User control over local data:** The app includes a clear way for users to delete their stored journal entries at any time.
- **Storage architecture:** Where entries are stored (browser vs. backend) will be decided in `4-spec` with privacy as a primary consideration.

## Safety Boundary

MindMosaic supports reflection and everyday emotional wellness — it is not a diagnostic tool and does not provide medical or mental health treatment. If a user's entry indicates immediate danger to themselves or others, the app responds with care: it does not panic or lecture, but it acknowledges the seriousness, gently steps back from the companion role, and surfaces basic crisis resources. This boundary is held consistently and without judgment.

## Inspiration & Identity

- Warm, calm, uncluttered — like a well-designed notes app crossed with a trusted friend
- Not clinical, not corporate wellness, not a mood tracker dashboard
- Tone: the kind of friend who says "that sounds really hard" before anything else
- The journal and conversation are the main focus; nothing clutters or competes with them
- Inspired by the learner's admiration for polished, immersive experiences (Elden Ring, "really cool websites") — the UI should feel considered and inviting, not generic
- Mobile-first: designed for a phone screen, comfortable on desktop

## Why This Matters to the Learner

Personal: *"We face academic pressure, competition, anxiety, uncertainty about the future. We may hesitate to share our feelings because we fear being judged."* MindMosaic is the space they wished existed when they needed it. Goal: build something real that other people actually use and get mentally better from.

## What "Working" Looks Like

A one-minute demo: a user types "I have an exam tomorrow, I'm scared I'll fail." The AI responds warmly, acknowledges the feeling, asks a gentle follow-up. The user says they want a suggestion. The AI references a strategy from a previous entry — one the user actually recorded — and asks whether they'd like to try it again. The entry is saved with a timestamp. The user opens their journal history and sees the conversation logged. The "oh, that's real" moment: the AI referenced something they genuinely wrote before, not something invented.

## The POC Boundary

- **Free-form journal entry** — user writes about their day or feelings
- **Date/time automatically recorded** with each entry
- **Friend-first AI response** — acknowledges feelings, asks a gentle follow-up; does not give advice immediately
- **User chooses the next step** — talk more, or receive a suggestion; advice is never forced
- **AI reads genuinely saved past entries** — a simple, reliable approach retrieves a few relevant entries to include as context; responses reference actual recorded history only; if no relevant history exists, the AI says so honestly and never invents memories
- **Suggestions on request or when gently appropriate** — practical, small, relevant
- **Timestamped journal history view** — user can see their saved entries
- **Privacy transparency** — user is told what is sent to the AI service before it is sent
- **Data deletion** — user can clear stored journal entries
- **Safety boundary** — consistent, non-judgmental response to indications of immediate danger
- **Mobile-first responsive web app** — designed for phones, demonstrable on desktop

## Later

- Mood and stress check-in UI (sliders or emoji selectors) with a simple pattern/history chart
- Mood trend visualization over time
- Optional tracking of anxiety, low mood, sleep difficulty, headaches — framed as personal observation, not diagnosis
- User accounts and cloud sync
- Full privacy controls: data export, granular deletion, transparency log
- Push notifications or gentle check-in reminders

## Explicitly Cut

- **User authentication / accounts** — adds significant complexity; not needed to prove the core idea in a PoC demo
- **Push notifications / reminders** — useful later, not essential to demonstrate the kernel
- **Onboarding flow** — a brief welcome screen is fine; a full multi-step onboarding is scope creep for now
- **Mood charts and pattern visualization** — kept for later; core experience must work first
- **Anxiety/sleep/headache tracking** — meaningful extension, not the proof of the kernel
- **Diagnosis, clinical language, or medical treatment framing** — excluded by design, permanently, not just deferred
