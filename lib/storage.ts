export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  branchChoice?: 'talk' | 'suggestion';
  isSimulated?: boolean;
}

export interface JournalSession {
  id: string;
  createdAt: string;
  entryText: string;
  conversation: Message[];
}

const STORAGE_KEY = 'mindmosaic_sessions';

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
