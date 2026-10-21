export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  branchChoice?: 'talk' | 'suggestion';
  isSimulated?: boolean;
  safetyAlert?: 'crisis' | 'medical';
}

export interface JournalSession {
  id: string;
  createdAt: string;
  entryText: string;
  conversation: Message[];
}

/**
 * Versioned Persistent Memory Settings
 * Stored in localStorage under 'mindmosaic_memory_settings'.
 * Defaults strictly to enabled: false.
 */
export interface MemorySettings {
  version: 1;
  enabled: boolean;
  consentGivenAt: string | null;
  updatedAt: string | null;
}

/**
 * Versioned Memory Record Model
 * Stored in localStorage under 'mindmosaic_memories'.
 * Contains a provenance field to separate user-stated facts from AI-inferred observations.
 */
export interface MemoryRecord {
  id: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  category: 'coping_strategy' | 'user_preference' | 'lifestyle_fact' | 'inferred_observation';
  summary: string;
  sourceSessionId?: string;
  tags: string[];
  provenance: 'user_stated' | 'ai_inferred';
}

/**
 * Versioned Theme Tracking Settings
 * Stored in localStorage under 'mindmosaic_theme_tracking_settings'.
 * Defaults strictly to enabled: false.
 */
export interface ThemeTrackingSettings {
  version: 1;
  enabled: boolean;
  enabledAt: string | null;
  resetAt: string | null;
  updatedAt: string | null;
}

const STORAGE_KEY = 'mindmosaic_sessions';
const MEMORY_SETTINGS_KEY = 'mindmosaic_memory_settings';
const MEMORIES_KEY = 'mindmosaic_memories';
const THEME_TRACKING_SETTINGS_KEY = 'mindmosaic_theme_tracking_settings';

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  version: 1,
  enabled: false,
  consentGivenAt: null,
  updatedAt: null,
};

export const DEFAULT_THEME_TRACKING_SETTINGS: ThemeTrackingSettings = {
  version: 1,
  enabled: false,
  enabledAt: null,
  resetAt: null,
  updatedAt: null,
};

/**
 * Read all sessions from localStorage safely.
 * Returns empty array if localStorage is unavailable or corrupted.
 */
export function getSessions(): JournalSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Sort newest first by createdAt
      return parsed.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });
    }
    return [];
  } catch (error) {
    console.error('Failed to read sessions from localStorage:', error);
    return [];
  }
}

/**
 * Save or update a session in localStorage.
 * Ensures the session is either added to the top (newest first) or updated in place.
 */
export function saveSession(session: JournalSession): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Browser window not available' };
  try {
    const sessions = getSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save session to localStorage:', error);
    const isQuota =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      error?.code === 1014;
    return {
      success: false,
      error: isQuota
        ? 'Browser storage is full. Please remove older entries to save new reflections.'
        : 'Could not write to local device memory.',
    };
  }
}

/**
 * Creates and immediately saves a new session with the user's reflection.
 * Guarantees the user's writing is saved locally BEFORE any external action.
 */
export function createSession(entryText: string): JournalSession {
  const newSession: JournalSession = {
    id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    entryText: entryText.trim(),
    conversation: [],
  };

  saveSession(newSession);
  return newSession;
}

/**
 * Delete a specific session by ID.
 */
export function deleteSession(sessionId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const sessions = getSessions().filter((s) => s.id !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Clear all sessions from storage.
 */
export function clearAllSessions(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    return true;
  } catch (error) {
    console.error('Failed to clear sessions:', error);
    return false;
  }
}

/**
 * Formats timestamps cleanly into relative or formatted strings.
 */
export function formatSessionDate(isoString: string): { date: string; time: string; full: string } {
  try {
    const dateObj = new Date(isoString);
    if (isNaN(dateObj.getTime())) {
      return { date: 'Recently', time: '', full: 'Recently' };
    }

    const now = new Date();
    const isToday =
      dateObj.getDate() === now.getDate() &&
      dateObj.getMonth() === now.getMonth() &&
      dateObj.getFullYear() === now.getFullYear();

    const time = dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const date = isToday
      ? 'Today'
      : dateObj.toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });

    return {
      date,
      time,
      full: `${date} at ${time}`,
    };
  } catch {
    return { date: 'Recently', time: '', full: 'Recently' };
  }
}

/**
 * Read persistent memory settings from localStorage.
 * Defaults strictly to enabled: false.
 * Stable read: Does NOT write to localStorage or generate timestamps merely because settings are read.
 */
export function getMemorySettings(): MemorySettings {
  if (typeof window === 'undefined') return { ...DEFAULT_MEMORY_SETTINGS };
  try {
    const raw = localStorage.getItem(MEMORY_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_MEMORY_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        version: 1,
        enabled: Boolean(parsed.enabled),
        consentGivenAt: typeof parsed.consentGivenAt === 'string' ? parsed.consentGivenAt : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    }
    return { ...DEFAULT_MEMORY_SETTINGS };
  } catch (error) {
    console.error('Failed to read memory settings from localStorage:', error);
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
}

/**
 * Save or update memory settings in localStorage.
 * When enabled is switched to true for the first time, records consentGivenAt timestamp.
 */
export function saveMemorySettings(
  updates: Partial<MemorySettings>
): { success: boolean; settings: MemorySettings; error?: string } {
  if (typeof window === 'undefined') {
    return { success: false, settings: { ...DEFAULT_MEMORY_SETTINGS }, error: 'Browser window not available' };
  }
  try {
    const current = getMemorySettings();
    const willEnable = updates.enabled !== undefined ? updates.enabled : current.enabled;
    const now = new Date().toISOString();

    const merged: MemorySettings = {
      version: 1,
      enabled: willEnable,
      consentGivenAt:
        willEnable && !current.consentGivenAt
          ? now
          : updates.consentGivenAt !== undefined
          ? updates.consentGivenAt
          : current.consentGivenAt,
      updatedAt: now,
    };

    localStorage.setItem(MEMORY_SETTINGS_KEY, JSON.stringify(merged));
    return { success: true, settings: merged };
  } catch (error: any) {
    console.error('Failed to save memory settings:', error);
    return {
      success: false,
      settings: getMemorySettings(),
      error: 'Could not update memory settings in device memory.',
    };
  }
}

// Strict prohibition for AI-inferred observations: AI companion must never infer or label diagnostic/clinical conditions
const AI_DIAGNOSTIC_TERMS_REGEX =
  /\b(depression|depressed|bipolar|disorder|pathology|trauma|ptsd|adhd|ocd|psychosis|schizo\w*|diagnos\w*)\b/i;

// Safeguard for user-stated records: prevents formal diagnostic/clinical labeling while allowing ordinary non-diagnostic reflections (e.g., "feeling depressed", "coping with trauma")
const USER_CLINICAL_LABEL_REGEX =
  /\b(clinical diagnosis|formal diagnosis|diagnosed with|psychiatric disorder|bipolar disorder|personality disorder|psychopathology)\b/i;

const MAX_MEMORY_SUMMARY_LENGTH = 160;
const MAX_MEMORIES_COUNT = 50;

/**
 * Safely parses a timestamp from a memory record for eviction and sorting.
 * Returns 0 if timestamp is missing, malformed, or invalid, ensuring safe fallback.
 */
function getRecordTimestamp(record: Partial<MemoryRecord> | null | undefined): number {
  if (!record) return 0;
  if (typeof record.createdAt === 'string') {
    const t = new Date(record.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (typeof record.updatedAt === 'string') {
    const t = new Date(record.updatedAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}

/**
 * Read theme tracking settings from localStorage.
 * Defaults strictly to enabled: false.
 * Stable read: Does NOT write to localStorage or generate timestamps merely because settings are read.
 */
export function getThemeTrackingSettings(): ThemeTrackingSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_THEME_TRACKING_SETTINGS };
  try {
    const raw = localStorage.getItem(THEME_TRACKING_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_THEME_TRACKING_SETTINGS };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        version: 1,
        enabled: Boolean(parsed.enabled),
        enabledAt: typeof parsed.enabledAt === 'string' ? parsed.enabledAt : null,
        resetAt: typeof parsed.resetAt === 'string' ? parsed.resetAt : null,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
      };
    }
    return { ...DEFAULT_THEME_TRACKING_SETTINGS };
  } catch (error) {
    console.error('Failed to read theme tracking settings from localStorage:', error);
    return { ...DEFAULT_THEME_TRACKING_SETTINGS };
  }
}

/**
 * Save or update theme tracking settings in localStorage.
 * Preserves resetAt across enable/disable cycles unless explicitly overwritten.
 * Records enabledAt timestamp when enabled is switched to true.
 */
export function saveThemeTrackingSettings(
  updates: Partial<ThemeTrackingSettings>
): { success: boolean; settings: ThemeTrackingSettings; error?: string } {
  if (typeof window === 'undefined') {
    return {
      success: false,
      settings: { ...DEFAULT_THEME_TRACKING_SETTINGS },
      error: 'Browser window not available',
    };
  }
  try {
    const current = getThemeTrackingSettings();
    const willEnable = updates.enabled !== undefined ? updates.enabled : current.enabled;
    const now = new Date().toISOString();

    const merged: ThemeTrackingSettings = {
      version: 1,
      enabled: willEnable,
      enabledAt:
        willEnable && !current.enabledAt
          ? now
          : updates.enabledAt !== undefined
          ? updates.enabledAt
          : current.enabledAt,
      resetAt: updates.resetAt !== undefined ? updates.resetAt : current.resetAt,
      updatedAt: now,
    };

    localStorage.setItem(THEME_TRACKING_SETTINGS_KEY, JSON.stringify(merged));
    return { success: true, settings: merged };
  } catch (error: any) {
    console.error('Failed to save theme tracking settings:', error);
    return {
      success: false,
      settings: getThemeTrackingSettings(),
      error: 'Could not update theme tracking settings in device memory.',
    };
  }
}

/**
 * Read all persistent memory records from localStorage safely.
 * Returns empty array if localStorage is unavailable, empty, or corrupted.
 * Sorts newest first using getRecordTimestamp to handle missing/invalid dates safely.
 */
export function getMemories(): MemoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MEMORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => {
        const timeA = getRecordTimestamp(a);
        const timeB = getRecordTimestamp(b);
        return timeB - timeA;
      });
    }
    return [];
  } catch (error) {
    console.error('Failed to read memory records from localStorage:', error);
    return [];
  }
}

/**
 * Save a new or updated memory record.
 * Strictly guards against saving when persistent memory is disabled.
 * Enforces summary length <= 160 chars.
 * Filters diagnostic terms:
 *   - AI-inferred observations: strictly prohibits clinical/diagnostic assertions.
 *   - User-stated records: blocks formal clinical labeling while preserving ordinary non-diagnostic reflections.
 * Performs conservative deduplication, protects user provenance, and enforces max 50 records
 * with prioritized eviction (AI-inferred evicted before user-stated; invalid timestamps evicted first).
 */
export function saveMemory(record: MemoryRecord): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Browser window not available' };
  
  // Guard: Persistent memory must be explicitly enabled
  const settings = getMemorySettings();
  if (!settings.enabled) {
    return {
      success: false,
      error: 'Persistent memory is currently disabled. Please enable memory in settings before saving records.',
    };
  }

  // Guard: Summary validation
  const trimmedSummary = typeof record.summary === 'string' ? record.summary.trim() : '';
  if (!trimmedSummary) {
    return { success: false, error: 'Memory summary cannot be empty.' };
  }
  if (trimmedSummary.length > MAX_MEMORY_SUMMARY_LENGTH) {
    return {
      success: false,
      error: `Memory summary exceeds maximum length of ${MAX_MEMORY_SUMMARY_LENGTH} characters.`,
    };
  }

  // Guard: Diagnostic / clinical terms rejection
  if (record.provenance === 'ai_inferred') {
    if (AI_DIAGNOSTIC_TERMS_REGEX.test(trimmedSummary)) {
      return {
        success: false,
        error: 'Inferred observations cannot contain clinical or diagnostic terminology.',
      };
    }
  } else {
    if (USER_CLINICAL_LABEL_REGEX.test(trimmedSummary)) {
      return {
        success: false,
        error: 'Memory contains formal clinical or diagnostic labeling which is not permitted.',
      };
    }
  }

  // Sanitize tags
  const sanitizedTags = Array.isArray(record.tags)
    ? Array.from(new Set(record.tags.map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : '')).filter(Boolean)))
    : [];

  const now = new Date().toISOString();
  const validCreatedAt =
    typeof record.createdAt === 'string' && !isNaN(new Date(record.createdAt).getTime())
      ? record.createdAt
      : now;

  try {
    const memories = getMemories();
    const existingByIdIndex = memories.findIndex((m) => m.id === record.id);

    if (existingByIdIndex >= 0) {
      // Existing memory updated by ID
      const existing = memories[existingByIdIndex];
      const mergedTags = Array.from(new Set([...existing.tags, ...sanitizedTags]));
      const provenance =
        existing.provenance === 'user_stated' && record.provenance === 'ai_inferred'
          ? 'user_stated'
          : record.provenance;

      memories[existingByIdIndex] = {
        ...record,
        summary: trimmedSummary,
        tags: mergedTags,
        provenance,
        createdAt: existing.createdAt || validCreatedAt,
        updatedAt: now,
      };
    } else {
      // Check for duplicate by normalized summary
      const normalizedSummary = trimmedSummary.toLowerCase();
      const existingBySummaryIndex = memories.findIndex(
        (m) => m.summary.trim().toLowerCase() === normalizedSummary
      );

      if (existingBySummaryIndex >= 0) {
        // Content duplicate: update in place, merge tags, preserve provenance
        const existing = memories[existingBySummaryIndex];
        const mergedTags = Array.from(new Set([...existing.tags, ...sanitizedTags]));
        const provenance =
          existing.provenance === 'user_stated' || record.provenance === 'user_stated'
            ? 'user_stated'
            : 'ai_inferred';

        memories[existingBySummaryIndex] = {
          ...existing,
          tags: mergedTags,
          provenance,
          sourceSessionId: record.sourceSessionId || existing.sourceSessionId,
          updatedAt: now,
        };
      } else {
        // Brand new memory: apply 50-record capacity limit
        const newRecord: MemoryRecord = {
          ...record,
          summary: trimmedSummary,
          tags: sanitizedTags,
          createdAt: validCreatedAt,
          updatedAt: now,
        };

        // Enforce maximum 50 records capacity
        while (memories.length >= MAX_MEMORIES_COUNT) {
          // Look for an AI-inferred record to evict first
          let oldestAiIdx = -1;
          let oldestAiTime = Infinity;

          for (let i = 0; i < memories.length; i++) {
            if (memories[i].provenance === 'ai_inferred') {
              const t = getRecordTimestamp(memories[i]);
              if (t < oldestAiTime) {
                oldestAiTime = t;
                oldestAiIdx = i;
              }
            }
          }

          if (oldestAiIdx !== -1) {
            // Evict oldest AI-inferred record
            memories.splice(oldestAiIdx, 1);
          } else {
            // All existing memories are user_stated
            if (record.provenance === 'ai_inferred') {
              // Inferred observation MUST NOT evict a user-stated record
              return {
                success: false,
                error: 'Memory storage is at capacity (50 user-saved records). Inferred observations cannot evict user memories.',
              };
            }

            // Both incoming and all existing are user_stated: evict the oldest user_stated record
            let oldestUserIdx = -1;
            let oldestUserTime = Infinity;

            for (let i = 0; i < memories.length; i++) {
              const t = getRecordTimestamp(memories[i]);
              if (t < oldestUserTime) {
                oldestUserTime = t;
                oldestUserIdx = i;
              }
            }

            if (oldestUserIdx !== -1) {
              memories.splice(oldestUserIdx, 1);
            } else {
              break;
            }
          }
        }

        memories.unshift(newRecord);
      }
    }

    localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
    return { success: true };
  } catch (error: any) {
    console.error('Failed to save memory record:', error);
    return { success: false, error: 'Could not write memory record to device storage.' };
  }
}

/**
 * Delete a specific memory record by ID.
 */
export function deleteMemory(memoryId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const memories = getMemories().filter((m) => m.id !== memoryId);
    localStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
    return true;
  } catch (error) {
    console.error('Failed to delete memory record:', error);
    return false;
  }
}

/**
 * Clear all memory records.
 * Purges memory records only; strictly preserves memory settings (enabled/disabled preference),
 * journal sessions, and AI consent.
 */
export function clearAllMemories(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(MEMORIES_KEY, JSON.stringify([]));
    return true;
  } catch (error) {
    console.error('Failed to clear memory records:', error);
    return false;
  }
}
