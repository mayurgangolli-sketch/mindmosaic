import { NextRequest, NextResponse } from 'next/server';
import { MockAIProvider } from '@/lib/providers/mock';
import { GroqAIProvider } from '@/lib/providers/groq';
import { ChatMessage } from '@/lib/ai-provider';
import { checkSafetyPatterns } from '@/lib/safety';
import { getClientIp, checkRateLimit } from '@/lib/rate-limiter';
import { readBoundedJson, CHAT_MAX_BODY_BYTES } from '@/lib/request-utils';

// Diagnostic terms filter to strictly prevent clinical/psychiatric assertions in background memory context
const AI_DIAGNOSTIC_TERMS_REGEX =
  /\b(depression|depressed|bipolar|disorder|pathology|trauma|ptsd|adhd|ocd|psychosis|schizo\w*|diagnos\w*)\b/i;

// Approved System Prompt establishing MindMosaic companion identity and safety boundaries
const SYSTEM_PROMPT = `You are MindMosaic, a compassionate, emotionally attentive friend and personal wellness companion.

CORE IDENTITY & CONVERSATIONAL PRINCIPLES:
1. Friend-First: Always acknowledge the user's specific feelings and situation before anything else.
2. No Formulaic Openers: NEVER use phrases like "I'm sorry you're feeling this way", "It sounds like you're experiencing...", or "Would you like to explore those feelings?".
3. Suggestions When Asked (No Unsolicited Advice):
   - In ordinary reflections or when the user has not asked for advice: offer NO unsolicited advice, checklists, or action plans. Simply listen, validate their specific feelings, and sit with them.
   - When the user explicitly asks for suggestions, advice, ideas, or ways to cope: warmly validate their feelings first, and then offer 2–3 concrete, relevant, realistic suggestions (for example, for presentation anxiety: practicing the opening minute aloud until natural, keeping a small card with 2–3 anchor cue words, and rehearsing answers to 1–2 likely questions). Avoid overwhelming checklists, lengthy lectures, or generic platitudes.
   - If genuinely helpful to calibrate suggestions, you may ask one brief clarifying question rather than refusing to help.
4. Varied Rhythm: Match the user's tone. Sometimes write a thoughtful paragraph; sometimes write a single warm sentence. Do not always end with a question. Silence and presence are valid.
5. User Leads: If the user says they are tired or done, let them rest without probing. If they change the subject, follow them immediately without clinging to the previous topic.
6. Honest Memory & Context Boundaries:
   - Conversation History: You have full memory of what the user shared during this ongoing conversation session as shown in the conversation history turns.
   - Approved Background Context: When a separate RELEVANT BACKGROUND CONTEXT block is provided below, it contains concise, valid memories that the user previously approved and saved across past reflections. Treat these items as gentle, tentative background awareness shared by a friend—never as unquestionable facts, rigid assumptions, or clinical diagnoses.
   - No Invented History: If NO background context block is provided and no prior messages exist in this session's history, you have no prior memory of the user. You must NEVER invent past events, assume unstated habits, or claim an activity previously helped unless explicitly documented in this session or in the provided background context block.
   - Gentle Application: Do not force background memories if the user is focused on an unrelated topic. If referencing a past coping strategy, frame it softly (e.g., "You've mentioned that a quick walk helps when exams feel heavy—does that feel like an option today, or does today feel different?"). If a past memory seems ambiguous or outdated, ask a warm, open question rather than assuming it still applies.

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
3. Severe warning signs (e.g., sudden "worst headache of life", loss of vision, numbness, difficulty speaking): Provide IMMEDIATE emergency medical care guidance as the FIRST and ONLY content of the response. Do not delay with follow-up questions or wellness chit-chat.`;

// Configurable context window limit (defaults to 10 most recent message turns)
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES || '10', 10);

export async function POST(req: NextRequest) {
  try {
    // Zero-dependency sliding-window rate limiting (15 requests / 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`chat_${clientIp}`, 15, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before sending another message.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSeconds),
            'X-RateLimit-Limit': String(rateCheck.limit),
            'X-RateLimit-Remaining': String(rateCheck.remaining),
            'X-RateLimit-Reset': String(Math.ceil(rateCheck.resetAt / 1000)),
          },
        }
      );
    }

    // Bounded request body read and safe JSON parsing (max 64 KB)
    const readResult = await readBoundedJson(req, CHAT_MAX_BODY_BYTES);
    if (readResult.status !== 200 || !readResult.data) {
      return NextResponse.json(
        { error: readResult.error || 'Invalid request body.' },
        { status: readResult.status }
      );
    }

    const { message, conversationHistory = [], relevantMemories = [] } = readResult.data;

    // Validate message payload
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A reflection message is required.' },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: 'Message is too long. Please limit your message to 4,000 characters.' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();

    // Run deterministic safety check for red-flag medical emergencies and crisis expressions
    const safetyCheck = checkSafetyPatterns(trimmedMessage);

    // If an acute medical emergency is detected, return immediate emergency medical guidance first
    // Note: Medical emergency completely bypasses LLM prompt assembly and provider dispatch
    if (safetyCheck.isMedicalEmergency) {
      return NextResponse.json({
        success: true,
        data: {
          content:
            'Please seek immediate emergency medical care or call 112 right away. The symptoms you described can indicate an acute medical situation that requires urgent evaluation by a healthcare professional. Please do not wait or rely on journaling apps.',
          isSimulated: false,
          modelUsed: 'mindmosaic-medical-guard',
          safetyAlert: 'medical',
        },
      });
    }

    // Validate and sanitize conversation history (bounded to trailing turns before iteration)
    const rawHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-MAX_CONTEXT_MESSAGES * 2)
      : [];
    const validatedHistory: ChatMessage[] = [];
    for (const item of rawHistory) {
      if (
        item &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim()
      ) {
        validatedHistory.push({
          role: item.role,
          content: item.content.slice(0, 4000),
        });
      }
    }

    // Retain only the most recent messages up to MAX_CONTEXT_MESSAGES to prevent token bloat
    const recentHistory = validatedHistory.slice(-MAX_CONTEXT_MESSAGES);

    // Validate and sanitize relevant memories payload (bounded to max 5 candidate items before iteration)
    const rawMemories = Array.isArray(relevantMemories) ? relevantMemories.slice(0, 5) : [];
    const validatedMemories: Array<{
      category: string;
      summary: string;
      provenance: string;
      tags: string[];
    }> = [];

    let totalMemChars = 0;
    for (const mem of rawMemories.slice(0, 3)) {
      if (
        mem &&
        typeof mem === 'object' &&
        typeof mem.summary === 'string' &&
        mem.summary.trim().length > 0 &&
        mem.summary.length <= 160 &&
        ['coping_strategy', 'user_preference', 'lifestyle_fact', 'inferred_observation'].includes(mem.category) &&
        ['user_stated', 'ai_inferred'].includes(mem.provenance) &&
        !AI_DIAGNOSTIC_TERMS_REGEX.test(mem.summary)
      ) {
        const trimmedSummary = mem.summary.trim();
        if (totalMemChars + trimmedSummary.length <= 500) {
          validatedMemories.push({
            category: mem.category,
            summary: trimmedSummary,
            provenance: mem.provenance,
            tags: Array.isArray(mem.tags)
              ? mem.tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 5)
              : [],
          });
          totalMemChars += trimmedSummary.length;
        }
      }
    }

    // Authoritative Safety Precedence:
    // If a crisis is detected, suppress the background memory block entirely so the prompt focuses strictly on safety.
    let effectiveSystemPrompt = SYSTEM_PROMPT;

    if (!safetyCheck.isCrisis && validatedMemories.length > 0) {
      let memoryBlock = '\n\nRELEVANT BACKGROUND CONTEXT (Approved by user from previous reflections):\n';
      for (const m of validatedMemories) {
        const provLabel = m.provenance === 'user_stated' ? 'User-Stated' : 'AI-Inferred';
        memoryBlock += `- [${provLabel} ${m.category}]: "${m.summary}"\n`;
      }
      memoryBlock += '\nCOMPANION GUIDELINES FOR BACKGROUND CONTEXT:\n' +
        '1. Treat context as gentle background awareness, never as unquestionable facts or clinical absolutes.\n' +
        '2. Do NOT force memories into the conversation if the user is focused on an unrelated topic.\n' +
        '3. If referencing a previous coping strategy or preference, frame it softly and invite their current perspective.\n' +
        '4. If a memory seems ambiguous or outdated, prefer a warm, open question rather than assuming it still applies.\n' +
        '5. NEVER assign diagnostic, psychological, or clinical labels based on past memories.';

      effectiveSystemPrompt = SYSTEM_PROMPT + memoryBlock;
    }

    // Prepare message sequence for AI provider
    const messages: ChatMessage[] = [
      { role: 'system', content: effectiveSystemPrompt },
      ...recentHistory,
      { role: 'user', content: trimmedMessage },
    ];

    // Check for Groq API key in server environment
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      console.log(
        '[MindMosaic /api/chat] No GROQ_API_KEY found in server environment. Activating transparent Mock Fallback provider.'
      );
      const provider = new MockAIProvider();
      const response = await provider.generateResponse(messages);
      if (safetyCheck.isCrisis) {
        response.safetyAlert = 'crisis';
      }
      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    // Groq API Key is present: attempt live generation
    try {
      const selectedModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
      const groqProvider = new GroqAIProvider(groqApiKey, selectedModel);
      const response = await groqProvider.generateResponse(messages);
      if (safetyCheck.isCrisis) {
        response.safetyAlert = 'crisis';
      }
      return NextResponse.json({
        success: true,
        data: response,
      });
    } catch (providerError: any) {
      console.warn(
        `[MindMosaic /api/chat] Groq live request failed (${providerError?.status || providerError?.message}). Gracefully falling back to transparent mock provider.`
      );

      // Gracefully fall back to transparent mock provider
      const fallbackProvider = new MockAIProvider();
      const fallbackResponse = await fallbackProvider.generateResponse(messages);

      // Append transparent diagnostic notice
      fallbackResponse.content = `[Simulated Demo Response - AI Offline: ${providerError?.message || 'Provider Unavailable'}]\n\n` + fallbackResponse.content;
      fallbackResponse.isSimulated = true;
      fallbackResponse.modelUsed = 'mock-offline-fallback';
      if (safetyCheck.isCrisis) {
        fallbackResponse.safetyAlert = 'crisis';
      }

      return NextResponse.json({
        success: true,
        data: fallbackResponse,
      });
    }
  } catch (error: any) {
    console.error('[MindMosaic /api/chat] Error handling chat request:', error);
    return NextResponse.json(
      {
        error: 'An internal error occurred while processing your reflection.',
      },
      { status: 500 }
    );
  }
}
