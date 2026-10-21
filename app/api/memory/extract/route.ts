import { NextRequest, NextResponse } from 'next/server';
import { GroqAIProvider } from '@/lib/providers/groq';
import { checkSafetyPatterns } from '@/lib/safety';
import { getClientIp, checkRateLimit } from '@/lib/rate-limiter';
import { readBoundedJson, EXTRACT_MAX_BODY_BYTES } from '@/lib/request-utils';

/**
 * MindMosaic — Memory Extraction API Route (Slice 5B Step 3)
 *
 * Extracts at most 1–2 useful, non-sensitive memory candidates from the CURRENT reflection only.
 *
 * Privacy & Security Guarantees:
 * - Minimal context: Uses ONLY the current reflection. Never receives archived entries or full history.
 * - Input validation: Enforces 2,000-character maximum and rejects non-string payloads.
 * - Server-side secrets: API keys remain strictly server-side.
 * - No sensitive logging: Journal text, reflection content, candidate summaries, and secrets are NEVER logged.
 * - Client consent note: Browser-local consent flags cannot be independently verified server-side without
 *   session credentials. The server strictly enforces safety boundaries, size limits, and non-diagnostic
 *   content validation. The client is responsible for gating calls behind explicit user consent.
 * - Non-diagnostic boundary: Enforces strict non-diagnostic filters on all extracted candidate summaries.
 * - Crisis & Medical Safety: Drops extraction completely if crisis or acute medical patterns are detected.
 * - Local-First: Candidate records are returned to the client; no memories are saved server-side.
 * - ₹0 budget: Uses existing Groq integration only. Never falls back to paid APIs.
 */

const MAX_REFLECTION_LENGTH = 2000;
const MAX_CANDIDATE_SUMMARY_LENGTH = 160;

// Strict prohibition for AI-inferred observations: AI companion must never infer or label diagnostic/clinical conditions
const AI_DIAGNOSTIC_TERMS_REGEX =
  /\b(depression|depressed|bipolar|disorder|pathology|trauma|ptsd|adhd|ocd|psychosis|schizo\w*|diagnos\w*)\b/i;

// Safeguard for user-stated records: prevents formal diagnostic/clinical labeling while allowing ordinary non-diagnostic reflections
const USER_CLINICAL_LABEL_REGEX =
  /\b(clinical diagnosis|formal diagnosis|diagnosed with|psychiatric disorder|bipolar disorder|personality disorder|psychopathology)\b/i;

const EXTRACTION_SYSTEM_PROMPT = `You are MindMosaic's private memory extraction analyzer.
Analyze the user's current reflection to identify at most 1–2 genuinely useful, non-sensitive items worth remembering to support future emotional wellness.

STRICT CATEGORIES AND PROVENANCE:
1. "user_stated" provenance (facts explicitly stated by the user):
   - "coping_strategy": An activity or coping mechanism the user explicitly states helps them (e.g., "Taking a 10-minute walk helps clear exam stress").
   - "user_preference": A response preference or communication boundary (e.g., "Prefers quiet listening without advice").
   - "lifestyle_fact": An objective, non-sensitive factual context (e.g., "Studying for final exams this week").
2. "ai_inferred" provenance (observations tentatively inferred by AI):
   - "inferred_observation": A gentle, tentative emotional pattern or recurring theme (e.g., "Tends to feel overwhelmed when balancing project deadlines and exams").

CRITICAL SAFEGUARDS:
- Non-Diagnostic Boundary: NEVER infer or label clinical, psychiatric, or diagnostic terms (e.g., do not use words like depression, depressed, bipolar, disorder, trauma, pathology, ptsd).
- Brevity: Each summary must be under 160 characters.
- Non-Sensitive: Do not extract passwords, financial details, full names of other people, or intimate secrets.
- If the reflection does not contain clear, useful, non-sensitive memories, return an empty list.

OUTPUT FORMAT:
Return STRICT JSON ONLY, with NO surrounding explanation or markdown.
{
  "candidates": [
    {
      "category": "coping_strategy" | "user_preference" | "lifestyle_fact" | "inferred_observation",
      "summary": "Concise summary under 160 characters",
      "tags": ["keyword1", "keyword2"],
      "provenance": "user_stated" | "ai_inferred"
    }
  ]
}`;

export interface CandidateMemory {
  category: 'coping_strategy' | 'user_preference' | 'lifestyle_fact' | 'inferred_observation';
  summary: string;
  tags: string[];
  provenance: 'user_stated' | 'ai_inferred';
  sourceSessionId?: string;
}

/**
 * Safely parses JSON from model output, handling potential markdown code fence wrapping.
 */
function parseCandidateJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Validates and sanitizes candidate objects from the model.
 */
function validateCandidate(candidate: any, sessionId?: string): CandidateMemory | null {
  if (!candidate || typeof candidate !== 'object') return null;

  const validCategories = ['coping_strategy', 'user_preference', 'lifestyle_fact', 'inferred_observation'];
  if (!validCategories.includes(candidate.category)) return null;

  const validProvenances = ['user_stated', 'ai_inferred'];
  let provenance = validProvenances.includes(candidate.provenance) ? candidate.provenance : null;

  // Inferred observations MUST have ai_inferred provenance
  if (candidate.category === 'inferred_observation') {
    provenance = 'ai_inferred';
  }
  if (!provenance) return null;

  // Validate and trim summary
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
  if (!summary || summary.length > MAX_CANDIDATE_SUMMARY_LENGTH) {
    return null;
  }

  // Enforce diagnostic term rejection
  if (provenance === 'ai_inferred') {
    if (AI_DIAGNOSTIC_TERMS_REGEX.test(summary)) {
      return null;
    }
  } else {
    if (USER_CLINICAL_LABEL_REGEX.test(summary)) {
      return null;
    }
  }

  // Sanitize tags
  const tags: string[] = Array.isArray(candidate.tags)
    ? Array.from(
        new Set<string>(
          candidate.tags
            .map((t: any) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
            .filter((t: string) => Boolean(t))
        )
      )
    : [];

  return {
    category: candidate.category,
    summary,
    tags: tags.slice(0, 5), // Limit to 5 tags
    provenance,
    sourceSessionId: typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    // Zero-dependency sliding-window rate limiting (10 requests / 60 seconds per IP)
    const clientIp = getClientIp(req);
    const rateCheck = checkRateLimit(`extract_${clientIp}`, 10, 60000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many memory extraction requests. Please wait before reflecting again.' },
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

    // Bounded request body read and safe JSON parsing (max 16 KB)
    const readResult = await readBoundedJson(req, EXTRACT_MAX_BODY_BYTES);
    if (readResult.status !== 200 || !readResult.data) {
      return NextResponse.json(
        { error: readResult.error || 'Invalid request body.' },
        { status: readResult.status }
      );
    }

    const { reflection, sessionId } = readResult.data;

    // Validate reflection string
    if (typeof reflection !== 'string' || !reflection.trim()) {
      return NextResponse.json(
        { error: 'A reflection text string is required.' },
        { status: 400 }
      );
    }

    // Enforce 2,000-character maximum
    if (reflection.length > MAX_REFLECTION_LENGTH) {
      return NextResponse.json(
        { error: `Reflection exceeds maximum allowed length of ${MAX_REFLECTION_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const trimmedReflection = reflection.trim();

    // Deterministic safety check: crisis or acute medical indicators
    // If triggered, memory extraction is strictly omitted
    const safetyCheck = checkSafetyPatterns(trimmedReflection);
    if (safetyCheck.isCrisis || safetyCheck.isMedicalEmergency) {
      return NextResponse.json({
        success: true,
        candidates: [],
        safetyBlocked: true,
        emergencyType: safetyCheck.emergencyType,
      });
    }

    const groqApiKey = process.env.GROQ_API_KEY;

    // If no API key is present, return safe empty candidates without making external network calls
    if (!groqApiKey) {
      return NextResponse.json({
        success: true,
        candidates: [],
        isSimulated: true,
      });
    }

    // Call Groq with minimal context (only the current reflection)
    const selectedModel = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const groqProvider = new GroqAIProvider(groqApiKey, selectedModel);

    const messages = [
      { role: 'system' as const, content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user' as const, content: trimmedReflection },
    ];

    let providerResponse;
    try {
      providerResponse = await groqProvider.generateResponse(messages);
    } catch (providerError: any) {
      // Safe, non-sensitive error logging: never log reflection or user details
      console.warn('[MindMosaic /api/memory/extract] Groq extraction request failed or timed out.');
      return NextResponse.json({
        success: true,
        candidates: [],
        providerError: true,
      });
    }

    // Parse and validate model output safely
    const parsed = parseCandidateJson(providerResponse.content);
    if (!parsed || !Array.isArray(parsed.candidates)) {
      return NextResponse.json({
        success: true,
        candidates: [],
      });
    }

    // Validate candidates through strict safeguards
    const validCandidates: CandidateMemory[] = [];
    for (const rawCandidate of parsed.candidates) {
      const validated = validateCandidate(rawCandidate, sessionId);
      if (validated) {
        validCandidates.push(validated);
        if (validCandidates.length >= 2) break; // Capped at 2 candidates
      }
    }

    return NextResponse.json({
      success: true,
      candidates: validCandidates,
    });
  } catch (error: any) {
    // Non-sensitive error logging: do not log reflection text or request payloads
    console.error('[MindMosaic /api/memory/extract] Internal processing error occurred.');
    return NextResponse.json(
      { error: 'An internal error occurred while analyzing reflection for memories.' },
      { status: 500 }
    );
  }
}
