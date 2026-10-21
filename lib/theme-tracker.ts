/**
 * MindMosaic — Reflection Themes Tracker Engine (Step 2)
 *
 * Deterministic, privacy-first local engine for identifying recurring themes
 * across user reflections over time.
 *
 * Guarantees:
 * - 100% client-side computation. Zero external network requests or AI calls.
 * - Counts distinct reflections per theme (not repeated word frequencies).
 * - Conservative linguistic context handling:
 *     - Negation, past history, hypotheticals, quotations, third-party references,
 *       and ambiguous mixed context are never presented as confirmed current emotions.
 *     - Uncertain matches are categorized separately as mentions.
 * - Accurate date filtering for 'last_30_days' and 'all_time'.
 * - Strict resetAt boundary enforcement: missing/invalid timestamps when a reset cutoff
 *   is active are strictly excluded to prevent resurrecting cleared history.
 * - Never duplicates or persists raw journal text.
 */

import type { JournalSession, ThemeTrackingSettings } from './storage';

export interface ThemeDefinition {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

export interface ThemeOccurrence {
  themeId: string;
  themeLabel: string;
  reflectionCount: number; // Distinct reflections containing this theme (direct + mentions)
  directCount: number;     // Distinct reflections expressing confirmed current state
  uncertainCount: number;  // Distinct reflections where context was negated, past, hypothetical, quoted, or third-party
}

export interface ThemeTrackingSummary {
  period: 'last_30_days' | 'all_time';
  totalReflectionsAnalyzed: number;
  startDate: string | null;
  endDate: string | null;
  themes: ThemeOccurrence[];
  hasResetCutoff: boolean;
  resetAt: string | null;
}

/**
 * Standard reflection themes calibrated to students and working professionals.
 */
export const WELLNESS_THEMES: ThemeDefinition[] = [
  {
    id: 'stress_pressure',
    label: 'Stress & Pressure',
    description: 'Workload, deadlines, academic pressure, and feeling overwhelmed.',
    keywords: [
      'stress', 'stressed', 'stressful', 'stressing',
      'pressure', 'pressured',
      'overwhelmed', 'overwhelming',
      'deadline', 'deadlines',
      'workload', 'burnout', 'burnt out',
      'exam', 'exams',
    ],
  },
  {
    id: 'sleep_rest',
    label: 'Sleep & Rest',
    description: 'Sleep quality, exhaustion, tiredness, insomnia, and recovery.',
    keywords: [
      'sleep', 'sleeping', 'slept', 'sleepless',
      'insomnia',
      'tired', 'tiredness',
      'exhausted', 'exhaustion',
      'fatigue', 'fatigued',
      'rest', 'resting', 'restless',
      'bedtime', 'awake', 'wake up', 'waking up',
    ],
  },
  {
    id: 'mood_vitality',
    label: 'Mood & Vitality',
    description: 'Feeling low, down, unmotivated, heavy, or emotionally drained.',
    keywords: [
      'mood', 'moody',
      'down', 'low mood', 'low energy',
      'sad', 'sadness',
      'unhappy',
      'heavy', 'heaviness',
      'unmotivated', 'drained',
      'gloomy', 'crying', 'wept',
    ],
  },
  {
    id: 'focus_clarity',
    label: 'Focus & Productivity',
    description: 'Concentration, procrastination, distraction, brain fog, and clarity.',
    keywords: [
      'focus', 'focused', 'focusing',
      'concentrate', 'concentration',
      'procrastinate', 'procrastinating', 'procrastination',
      'distracted', 'distraction', 'distractions',
      'brain fog', 'foggy',
      'scattered', 'productive', 'productivity',
    ],
  },
  {
    id: 'connection_support',
    label: 'Social & Connection',
    description: 'Loneliness, isolation, relationships, talking to friends, and support.',
    keywords: [
      'lonely', 'loneliness',
      'isolated', 'isolation',
      'friend', 'friends', 'friendship',
      'family', 'parents',
      'relationship', 'relationships',
      'talked', 'talking', 'connected', 'connection',
      'supported', 'supportive',
    ],
  },
  {
    id: 'physical_calm',
    label: 'Physical Well-being & Calm',
    description: 'Physical tension, headaches, somatic discomfort, breathing, and walks.',
    keywords: [
      'headache', 'headaches',
      'migraine', 'migraines',
      'tension', 'tense',
      'tightness', 'body ache',
      'breathing', 'deep breath', 'breathwork',
      'walk', 'walks', 'walking',
      'stretching', 'exercise', 'workout',
    ],
  },
];

// Context Markers for Linguistic Classification
const NEGATION_REGEX =
  /\b(not|never|no|hardly|scarcely|barely|don't|doesn't|didn't|wasn't|weren't|haven't|hasn't|hadn't|won't|wouldn't|can't|cannot|couldn't|neither|nor|without|free of|free from)\b/i;

const PAST_HISTORY_REGEX =
  /\b(used to|in the past|years ago|months ago|weeks ago|last (?:year|month|week|night)|yesterday|back when|back in|formerly|previously|historically|when I was)\b/i;

const HYPOTHETICAL_REGEX =
  /\b(if|what if|might|could|would|in case|suppose|supposing|wondering if|whether|maybe|perhaps|probably|imagine if)\b/i;

const THIRD_PARTY_REGEX =
  /\b(?:he|she|they|my\s+(?:friend|boss|coworker|colleague|partner|mom|dad|mother|father|brother|sister|roommate|teacher|professor|doctor|therapist|dog|cat)|someone|everyone|people|others|it)\s+(?:is|was|were|are|feels|felt|seems|seemed|has|had|looks|looked|became)\b/i;

const AMBIGUOUS_MIXED_REGEX =
  /\b(not sure if|don't know if|hard to tell if|maybe or maybe not|uncertain whether|can't tell if|unsure whether)\b/i;

/**
 * Splits text into clauses while identifying whether segments fall within quotes.
 */
interface ClauseSegment {
  text: string;
  isQuoted: boolean;
}

function extractClauses(rawText: string): ClauseSegment[] {
  const clauses: ClauseSegment[] = [];

  // Match quoted strings (both straight and curly quotes)
  const quoteRegex = /(["'“‘])([\s\S]*?)(["'”’])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = quoteRegex.exec(rawText)) !== null) {
    const unquotedBefore = rawText.slice(lastIndex, match.index);
    if (unquotedBefore.trim()) {
      splitSubClauses(unquotedBefore, false, clauses);
    }

    const quotedContent = match[2];
    if (quotedContent.trim()) {
      splitSubClauses(quotedContent, true, clauses);
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = rawText.slice(lastIndex);
  if (remaining.trim()) {
    splitSubClauses(remaining, false, clauses);
  }

  return clauses;
}

function splitSubClauses(text: string, isQuoted: boolean, clauses: ClauseSegment[]): void {
  // Split on sentence boundaries and contrastive conjunctions (e.g. "but", "however", "although")
  const rawParts = text.split(/(?:[.!?;:\n]+|\s+\b(?:but|however|although|though|yet|while|whereas)\b\s+)/i);
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (trimmed) {
      clauses.push({ text: trimmed, isQuoted });
    }
  }
}

/**
 * Checks whether a clause contains a whole-word match for any keyword of a theme.
 */
function clauseContainsTheme(clauseText: string, keywords: string[]): boolean {
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(clauseText)) {
      return true;
    }
  }
  return false;
}

/**
 * Classifies a single reflection session for a specific theme.
 * Returns:
 * - 'direct': at least one clause directly affirms the theme currently.
 * - 'uncertain': theme was mentioned, but only in negated, past, hypothetical, quoted, or third-party context.
 * - 'none': theme not mentioned in this reflection.
 */
export function classifyThemeInReflection(
  reflectionText: string,
  theme: ThemeDefinition
): 'direct' | 'uncertain' | 'none' {
  if (!reflectionText || !reflectionText.trim()) return 'none';

  const clauses = extractClauses(reflectionText);
  let hasMention = false;
  let hasDirect = false;

  for (const clause of clauses) {
    if (!clauseContainsTheme(clause.text, theme.keywords)) {
      continue;
    }

    hasMention = true;

    // Conservative linguistic rules:
    // Any of these flags downgrade the clause to an uncertain mention rather than confirmed current emotion
    if (clause.isQuoted) continue;
    if (NEGATION_REGEX.test(clause.text)) continue;
    if (PAST_HISTORY_REGEX.test(clause.text)) continue;
    if (HYPOTHETICAL_REGEX.test(clause.text)) continue;
    if (THIRD_PARTY_REGEX.test(clause.text)) continue;
    if (AMBIGUOUS_MIXED_REGEX.test(clause.text)) continue;

    // Clause is free from non-current markers -> affirmed direct current reflection
    hasDirect = true;
    break; // One direct clause in this reflection is sufficient to qualify the reflection as direct
  }

  if (hasDirect) return 'direct';
  if (hasMention) return 'uncertain';
  return 'none';
}

/**
 * Safely parses session timestamp.
 * Returns null if missing, malformed, or invalid.
 */
function parseSessionTime(session: JournalSession): number | null {
  if (!session || typeof session.createdAt !== 'string') return null;
  const t = new Date(session.createdAt).getTime();
  if (isNaN(t) || t <= 0) return null;
  return t;
}

/**
 * Main engine entry point:
 * Analyzes stored sessions according to settings and date boundary.
 *
 * Guarantees:
 * - Pure computation. Zero storage writes.
 * - Missing/invalid timestamps when a reset cutoff is active are excluded.
 * - Counts distinct reflections per theme.
 */
export function extractThemeCounts(
  sessions: JournalSession[],
  settings: ThemeTrackingSettings,
  period: 'last_30_days' | 'all_time' = 'all_time',
  referenceNow: Date = new Date()
): ThemeTrackingSummary {
  // If theme tracking is globally disabled, return empty summary immediately
  if (!settings || !settings.enabled) {
    return {
      period,
      totalReflectionsAnalyzed: 0,
      startDate: null,
      endDate: null,
      themes: WELLNESS_THEMES.map((theme) => ({
        themeId: theme.id,
        themeLabel: theme.label,
        reflectionCount: 0,
        directCount: 0,
        uncertainCount: 0,
      })),
      hasResetCutoff: Boolean(settings?.resetAt),
      resetAt: settings?.resetAt || null,
    };
  }

  const nowTime = referenceNow.getTime();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoTime = nowTime - THIRTY_DAYS_MS;

  let resetTime: number | null = null;
  if (settings.resetAt) {
    const t = new Date(settings.resetAt).getTime();
    if (!isNaN(t) && t > 0) {
      resetTime = t;
    }
  }

  // Filter eligible sessions according to reset cutoff and date boundary
  const validSessions = Array.isArray(sessions) ? sessions : [];
  const eligibleSessions = validSessions.filter((session) => {
    if (!session || typeof session.entryText !== 'string' || !session.entryText.trim()) {
      return false;
    }

    const sessionTime = parseSessionTime(session);

    // Reset boundary defense:
    // If resetAt is active, missing/invalid timestamps MUST be excluded,
    // and sessions at or before resetAt MUST be excluded.
    if (resetTime !== null) {
      if (sessionTime === null) {
        return false;
      }
      if (sessionTime <= resetTime) {
        return false;
      }
    }

    // Period boundary defense:
    if (period === 'last_30_days') {
      if (sessionTime === null) {
        return false;
      }
      // Must fall strictly within the last 30 days window up to now (with 60s clock skew tolerance)
      if (sessionTime < thirtyDaysAgoTime || sessionTime > nowTime + 60000) {
        return false;
      }
    }

    return true;
  });

  // Calculate start and end date range of analyzed reflections
  const sessionTimestamps = eligibleSessions
    .map(parseSessionTime)
    .filter((t): t is number => t !== null);

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (sessionTimestamps.length > 0) {
    startDate = new Date(Math.min(...sessionTimestamps)).toISOString();
    endDate = new Date(Math.max(...sessionTimestamps)).toISOString();
  }

  // Count distinct reflections per theme
  const occurrences: ThemeOccurrence[] = WELLNESS_THEMES.map((theme) => {
    let directCount = 0;
    let uncertainCount = 0;

    for (const session of eligibleSessions) {
      // Gather all user-authored text in this session (entry + user chat turns)
      const userTurns = Array.isArray(session.conversation)
        ? session.conversation
            .filter((m) => m && m.role === 'user' && typeof m.content === 'string')
            .map((m) => m.content)
        : [];

      const fullReflectionText = [session.entryText, ...userTurns].join('\n');
      const classification = classifyThemeInReflection(fullReflectionText, theme);

      if (classification === 'direct') {
        directCount++;
      } else if (classification === 'uncertain') {
        uncertainCount++;
      }
    }

    return {
      themeId: theme.id,
      themeLabel: theme.label,
      reflectionCount: directCount + uncertainCount,
      directCount,
      uncertainCount,
    };
  });

  return {
    period,
    totalReflectionsAnalyzed: eligibleSessions.length,
    startDate,
    endDate,
    themes: occurrences,
    hasResetCutoff: resetTime !== null,
    resetAt: settings.resetAt || null,
  };
}

