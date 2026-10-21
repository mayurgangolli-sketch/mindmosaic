import type { MemoryRecord } from './storage';

/**
 * MindMosaic — Persistent Memory Retrieval & Relevance Engine (Slice 5C)
 *
 * Deterministically ranks and selects a small, relevant subset of approved saved memories
 * to provide gentle background continuity for AI conversations.
 *
 * Core Guarantees:
 * - Operates entirely client-side on approved, saved memories in localStorage.
 * - Caps injected context at at most 3 items and at most 400 total characters.
 * - Excludes stop words and generic emotional fillers to avoid false-positive keyword matches.
 * - Distinguishes active communication preferences (which govern conversational tone/boundaries)
 *   from lifestyle preferences and facts (which require topical relevance).
 * - Safe fallback: returns [] if no memories achieve positive relevance or if text is empty.
 * - ₹0 budget: Pure TypeScript tokenization; zero external embedding dependencies.
 */

export interface RelevantMemoryContext {
  id: string;
  category: 'coping_strategy' | 'user_preference' | 'lifestyle_fact' | 'inferred_observation';
  summary: string;
  provenance: 'user_stated' | 'ai_inferred';
  tags?: string[];
}

/**
 * Common English stop words, pronouns, and generic temporal/emotional filler words
 * that must never trigger false-positive memory associations.
 */
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'cannot', 'could', 'couldn', 'couldn\'t', 'did', 'didn', 'didn\'t', 'do', 'does', 'doesn',
  'doesn\'t', 'doing', 'don', 'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'hadn', 'hadn\'t', 'has', 'hasn', 'hasn\'t', 'have', 'haven', 'haven\'t', 'having', 'he', 'her',
  'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'isn\'t',
  'it', 'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of',
  'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same',
  'she', 'should', 'shouldn', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
  'until', 'up', 'very', 'was', 'wasn', 'wasn\'t', 'we', 'were', 'weren', 'weren\'t', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'won', 'won\'t', 'would', 'wouldn', 'wouldn\'t',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  // Common emotional and temporal fillers:
  'really', 'today', 'yesterday', 'tomorrow', 'day', 'days', 'feel', 'feeling', 'feels', 'felt',
  'time', 'times', 'thing', 'things', 'much', 'like', 'good', 'bad', 'well', 'going', 'went', 'gone',
  'always', 'never', 'sometimes', 'think', 'thinking', 'thought', 'know', 'want', 'wanted', 'need', 'needed'
]);

/**
 * Regex matching keywords that indicate a user_preference is specifically a communication boundary
 * (e.g. governing listening, advice, brevity, format) rather than a personal lifestyle preference.
 */
const COMMUNICATION_PREFERENCE_REGEX =
  /\b(listen|listening|advice|unsolicited advice|brief|short|reply|replies|tone|format|response|question|questions|style|boundary|boundaries|quiet)\b/i;

/**
 * Determines whether a memory record is a communication preference governing how the companion should respond.
 */
export function isCommunicationPreference(memory: MemoryRecord): boolean {
  if (memory.category !== 'user_preference') return false;
  if (COMMUNICATION_PREFERENCE_REGEX.test(memory.summary)) return true;
  if (Array.isArray(memory.tags)) {
    return memory.tags.some((t) => COMMUNICATION_PREFERENCE_REGEX.test(t));
  }
  return false;
}

/**
 * Splits text into normalized, lower-case tokens, stripping stop words and non-alphanumeric punctuation.
 */
export function extractSearchTokens(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/);
  const validTokens = new Set<string>();

  for (const word of words) {
    const trimmed = word.trim();
    if (trimmed.length >= 3 && !STOP_WORDS.has(trimmed)) {
      validTokens.add(trimmed);
    }
  }

  return Array.from(validTokens);
}

/**
 * Calculates a numerical relevance score for a given memory record against extracted message tokens.
 *
 * Scoring Rules:
 * - Communication preferences receive a base score of 5.0 (priority for conversational boundaries).
 * - Each tag match adds 3.0 points.
 * - Each summary keyword match adds 1.5 points.
 * - Memories updated in the last 14 days receive a +0.2 recency bonus.
 * - Standard memories require a score >= 1.5 to be eligible.
 */
export function calculateMemoryRelevance(messageTokens: string[], memory: MemoryRecord): number {
  let score = 0;
  const isCommPref = isCommunicationPreference(memory);

  if (isCommPref) {
    score += 5.0;
  }

  const tokenSet = new Set(messageTokens);

  // Match against tags (high precision)
  if (Array.isArray(memory.tags)) {
    for (const tag of memory.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (tokenSet.has(normalizedTag)) {
        score += 3.0;
      }
    }
  }

  // Match against summary tokens (medium precision)
  const summaryTokens = extractSearchTokens(memory.summary);
  for (const st of summaryTokens) {
    if (tokenSet.has(st)) {
      score += 1.5;
    }
  }

  // Recency bonus: slightly favor recently updated/created memories (last 14 days)
  const timestamp = memory.updatedAt || memory.createdAt;
  if (timestamp) {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    if (!isNaN(ageMs) && ageMs >= 0 && ageMs < 14 * 24 * 60 * 60 * 1000) {
      score += 0.2;
    }
  }

  return score;
}

/**
 * Selects the most relevant subset of approved memory records for the current user reflection.
 *
 * Enforces:
 * - Communication preferences qualify automatically.
 * - Non-communication memories must have score >= 1.5 (at least 1 keyword or tag match).
 * - Capped at maxCount (default 3) and maxChars (default 400 total characters).
 * - Pure and deterministic: does not mutate inputs or localStorage.
 */
export function selectRelevantMemories(
  userText: string,
  memories: MemoryRecord[],
  options?: { maxCount?: number; maxChars?: number }
): RelevantMemoryContext[] {
  const maxCount = options?.maxCount ?? 3;
  const maxChars = options?.maxChars ?? 400;

  if (!userText || typeof userText !== 'string' || !Array.isArray(memories) || memories.length === 0) {
    return [];
  }

  const messageTokens = extractSearchTokens(userText);

  // Filter to valid approved memory records only
  const validRecords = memories.filter((m) => {
    return (
      m &&
      typeof m.id === 'string' &&
      typeof m.summary === 'string' &&
      m.summary.trim().length > 0 &&
      m.summary.length <= 160 &&
      (m.provenance === 'user_stated' || m.provenance === 'ai_inferred') &&
      ['coping_strategy', 'user_preference', 'lifestyle_fact', 'inferred_observation'].includes(m.category)
    );
  });

  // Score each memory
  const scoredItems = validRecords
    .map((record) => {
      const score = calculateMemoryRelevance(messageTokens, record);
      return { record, score };
    })
    .filter(({ record, score }) => {
      if (isCommunicationPreference(record)) {
        return score >= 5.0;
      }
      return score >= 1.5;
    });

  // Sort descending by score, tie-breaking by newest timestamp
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const timeA = new Date(a.record.updatedAt || a.record.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.record.updatedAt || b.record.createdAt || 0).getTime() || 0;
    return timeB - timeA;
  });

  // Select top items within maxCount and maxChars constraints
  const selected: RelevantMemoryContext[] = [];
  let currentChars = 0;

  for (const { record } of scoredItems) {
    if (selected.length >= maxCount) break;

    const summaryLength = record.summary.trim().length;
    if (currentChars + summaryLength > maxChars && selected.length > 0) {
      // Skip if adding this summary would exceed char budget and we already have at least 1 memory
      continue;
    }

    selected.push({
      id: record.id,
      category: record.category,
      summary: record.summary.trim(),
      provenance: record.provenance,
      tags: record.tags || [],
    });

    currentChars += summaryLength;
  }

  return selected;
}

