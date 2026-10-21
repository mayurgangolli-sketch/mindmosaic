'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  PenLine,
  Clock,
  Shield,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  BookOpen,
  Calendar,
  Sparkles,
  Bot,
  RotateCcw,
  Send,
  User,
  Brain,
  BarChart2,
  Info,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ConsentModal } from '@/components/ConsentModal';
import { MemorySettingsModal } from '@/components/MemorySettingsModal';
import { MemoryApprovalCard, MemoryCandidate } from '@/components/MemoryApprovalCard';
import { SafetyBanner } from '@/components/SafetyBanner';
import { FormattedMessage } from '@/components/FormattedMessage';
import {
  getSessions,
  createSession,
  saveSession,
  formatSessionDate,
  JournalSession,
  Message,
  MemorySettings,
  ThemeTrackingSettings,
  getMemorySettings,
  getThemeTrackingSettings,
  saveMemory,
  getMemories,
} from '@/lib/storage';
import { checkSafetyPatterns } from '@/lib/safety';
import { selectRelevantMemories } from '@/lib/memory-retrieval';
import { extractThemeCounts, ThemeTrackingSummary } from '@/lib/theme-tracker';

export function JournalEntry() {
  const [entryText, setEntryText] = useState('');
  const [greeting, setGreeting] = useState('Welcome');
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [currentSession, setCurrentSession] = useState<JournalSession | null>(null);
  const [selectedSession, setSelectedSession] = useState<JournalSession | null>(null);

  // Consent & AI status state
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [consentDeclinedNotice, setConsentDeclinedNotice] = useState(false);

  // Multi-turn chat composer state
  const [replyText, setReplyText] = useState('');
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Companion Memory Settings state (Slice 5A & 5B)
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memorySettings, setMemorySettings] = useState<MemorySettings>({
    version: 1,
    enabled: false,
    consentGivenAt: null,
    updatedAt: null,
  });

  // Reflection Themes Tracker state (Slice 5B Step 6)
  const [themeTrackingSettings, setThemeTrackingSettings] = useState<ThemeTrackingSettings>({
    version: 1,
    enabled: false,
    enabledAt: null,
    resetAt: null,
    updatedAt: null,
  });
  const [isThemesModalOpen, setIsThemesModalOpen] = useState(false);
  const [themesPeriod, setThemesPeriod] = useState<'last_30_days' | 'all_time'>('last_30_days');

  // Pending Inferred Memory Candidates queue for explicit approval
  const [pendingCandidates, setPendingCandidates] = useState<MemoryCandidate[]>([]);

  // Save feedback state
  const [saveBanner, setSaveBanner] = useState<{ message: string; time: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll conversation smoothly on new messages
  useEffect(() => {
    if (currentSession?.conversation && currentSession.conversation.length > 0) {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.conversation?.length, isAiLoading]);

  // Load saved sessions, memory settings, and theme tracking settings on mount
  useEffect(() => {
    refreshSessions();
    setMemorySettings(getMemorySettings());
    setThemeTrackingSettings(getThemeTrackingSettings());
  }, []);

  const refreshSessions = () => {
    try {
      const stored = getSessions();
      setSessions(stored);
    } catch (err) {
      console.error('Error reading saved sessions:', err);
      setSaveError('Could not load past reflections from browser memory.');
    }
  };

  // Time-aware greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Good morning');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good afternoon');
    } else if (hour >= 17 && hour < 22) {
      setGreeting('Good evening');
    } else {
      setGreeting('Quiet hours');
    }
  }, []);

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEntryText(e.target.value);
    setSaveError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(180, textareaRef.current.scrollHeight)}px`;
    }
  };

  // Restore local-mode preference if previously declined in this session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('mindmosaic_consent_given');
      if (stored === 'false') {
        setConsentDeclinedNotice(true);
      }
    }
  }, []);

  // Compute theme tracking summary 100% locally on device (zero network requests)
  const themeSummary: ThemeTrackingSummary | null = useMemo(() => {
    if (!themeTrackingSettings.enabled) return null;
    return extractThemeCounts(sessions, themeTrackingSettings, themesPeriod);
  }, [sessions, themeTrackingSettings, themesPeriod]);

  // Candidate Approval Handler (explicit user confirmation)
  const handleApproveCandidate = (candidate: MemoryCandidate) => {
    const currentSettings = getMemorySettings();
    if (!currentSettings.enabled) {
      // Memory OFF must block approval-based saves and dismiss pending candidates
      setPendingCandidates([]);
      return;
    }

    const res = saveMemory({
      id: candidate.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      category: candidate.category,
      summary: candidate.summary,
      tags: candidate.tags || [],
      provenance: 'ai_inferred',
      sourceSessionId: candidate.sourceSessionId || currentSession?.id,
    });

    if (res.success) {
      setSaveBanner({
        message: 'Observation saved to browser memory with your approval.',
        time: formatSessionDate(new Date().toISOString()).time,
      });
    }

    // Dismiss this approved candidate from the pending queue
    setPendingCandidates((prev) =>
      prev.filter((c) => (candidate.id ? c.id !== candidate.id : c.summary !== candidate.summary))
    );
  };

  // Candidate Rejection Handler (dismiss without saving)
  const handleRejectCandidate = (candidate: MemoryCandidate) => {
    setPendingCandidates((prev) =>
      prev.filter((c) => (candidate.id ? c.id !== candidate.id : c.summary !== candidate.summary))
    );
  };

  // 1. Save locally to localStorage FIRST, then check consent before AI call
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = entryText.trim();
    if (!trimmed) {
      setSaveError('Please write a few thoughts before saving your reflection.');
      return;
    }

    // Reset pending candidates from any previous reflection
    setPendingCandidates([]);

    try {
      // Step 1: Save locally to localStorage immediately BEFORE any network request
      const session = createSession(trimmed);
      setCurrentSession(session);
      refreshSessions();

      const formatted = formatSessionDate(session.createdAt);
      setSaveBanner({
        message: 'Reflection safely recorded to your browser storage.',
        time: formatted.full,
      });

      // Step 2: Check consent state in sessionStorage
      const consentGiven =
        typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;

      if (consentGiven === 'true') {
        // Consent already given this session -> clear composer and proceed to AI request
        setEntryText('');
        setSaveError(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        dispatchAiTurn(session, trimmed, true);
      } else if (consentGiven === 'false') {
        // Consent previously declined this session -> preserve local only without repeating prompt
        setSaveError(null);
        setConsentDeclinedNotice(true);
      } else {
        // First AI interaction or previously dismissed -> open consent modal
        setSaveError(null);
        setPendingText(trimmed);
        setIsConsentOpen(true);
      }
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save your reflection to local storage.');
    }
  };

  // 2. User confirms consent ("Agree & Connect")
  const handleConfirmConsent = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mindmosaic_consent_given', 'true');
    }
    setIsConsentOpen(false);
    setConsentDeclinedNotice(false);

    if (!currentSession) return;

    const conversation = currentSession.conversation || [];
    const isInitial = conversation.length === 0;
    const textToSend = pendingText || (isInitial ? currentSession.entryText : replyText.trim());

    if (textToSend) {
      if (isInitial) {
        setEntryText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        dispatchAiTurn(currentSession, textToSend, true);
      } else {
        // Follow-up reply: save user message locally FIRST before dispatching
        const userMessage: Message = {
          id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          role: 'user',
          content: textToSend,
          timestamp: new Date().toISOString(),
        };

        const sessionWithUserMsg: JournalSession = {
          ...currentSession,
          conversation: [...conversation, userMessage],
        };

        saveSession(sessionWithUserMsg);
        setCurrentSession(sessionWithUserMsg);
        refreshSessions();

        setReplyText('');
        if (replyTextareaRef.current) {
          replyTextareaRef.current.style.height = 'auto';
        }

        dispatchAiTurn(sessionWithUserMsg, textToSend, false);
      }
      setPendingText(null);
    }
  };

  // 3. User explicitly declines consent ("Keep Reflection Local Only")
  const handleDeclineConsent = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mindmosaic_consent_given', 'false');
    }
    setIsConsentOpen(false);
    setPendingText(null);
    setConsentDeclinedNotice(true);
  };

  // 4. User dismisses the modal (clicks X, clicks backdrop, or presses Escape)
  const handleDismissConsent = () => {
    setIsConsentOpen(false);
    setPendingText(null);
  };

  // 5. Explicitly connect to AI (e.g. from local-mode banner after declining)
  const handleExplicitConnect = () => {
    const textToUse = entryText.trim() || currentSession?.entryText;
    if (!textToUse || !currentSession) return;

    const consentGiven =
      typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    if (consentGiven === 'true') {
      setEntryText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      dispatchAiTurn(currentSession, textToUse, true);
    } else {
      setPendingText(textToUse);
      setIsConsentOpen(true);
    }
  };

  // 6. Handle follow-up multi-turn replies
  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    if (replyTextareaRef.current) {
      replyTextareaRef.current.style.height = 'auto';
      replyTextareaRef.current.style.height = `${Math.min(
        replyTextareaRef.current.scrollHeight,
        160
      )}px`;
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleSendReply = async () => {
    const trimmed = replyText.trim();
    if (!trimmed || isAiLoading || !currentSession) return;

    // Consent check: Never send follow-up messages without explicit consent
    const consent =
      typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    if (consent !== 'true') {
      setPendingText(trimmed);
      setIsConsentOpen(true);
      return;
    }

    // Step 1: Save user message locally BEFORE any network dispatch
    const userMessage: Message = {
      id: `msg_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const sessionWithUserMsg: JournalSession = {
      ...currentSession,
      conversation: [...(currentSession.conversation || []), userMessage],
    };

    saveSession(sessionWithUserMsg);
    setCurrentSession(sessionWithUserMsg);
    refreshSessions();

    // Clear reply composer
    setReplyText('');
    if (replyTextareaRef.current) {
      replyTextareaRef.current.style.height = 'auto';
    }

    // Step 2: Request AI response
    dispatchAiTurn(sessionWithUserMsg, trimmed, false);
  };

  // Safe retry handler without creating duplicate user messages
  const handleRetryAi = () => {
    if (!currentSession) return;
    const conversation = currentSession.conversation || [];
    if (conversation.length === 0) {
      dispatchAiTurn(currentSession, currentSession.entryText, true);
      return;
    }

    // Find the last user turn in conversation
    const lastUserTurn = [...conversation].reverse().find((m) => m.role === 'user');
    if (lastUserTurn) {
      dispatchAiTurn(currentSession, lastUserTurn.content, false);
    } else {
      dispatchAiTurn(currentSession, currentSession.entryText, true);
    }
  };

  // Trigger memory extraction in background under strict consent & memory settings
  const triggerMemoryExtraction = (reflectionText: string, sessionId: string) => {
    const consent =
      typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    const memSettings = getMemorySettings();

    // Strict Gating: require BOTH affirmative AI consent AND persistent memory enabled
    if (consent !== 'true' || !memSettings.enabled) {
      return;
    }

    fetch('/api/memory/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reflection: reflectionText,
        sessionId,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((extractData) => {
        if (!extractData || !extractData.success || !Array.isArray(extractData.candidates)) {
          return;
        }

        // Safety check: if safety flag was blocked, do not process candidates
        if (extractData.safetyBlocked) {
          return;
        }

        // Re-verify that memory is STILL enabled at time of response
        const activeSettings = getMemorySettings();
        if (!activeSettings.enabled) {
          return;
        }

        const newInferredCandidates: MemoryCandidate[] = [];

        for (const cand of extractData.candidates) {
          if (cand.provenance === 'user_stated') {
            // Automatically save eligible user-stated facts
            saveMemory({
              id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              category: cand.category,
              summary: cand.summary,
              tags: cand.tags || [],
              provenance: 'user_stated',
              sourceSessionId: sessionId,
            });
          } else if (cand.provenance === 'ai_inferred') {
            // AI-inferred observations MUST remain pending until explicit user approval
            newInferredCandidates.push({
              ...cand,
              id: cand.id || `cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              sourceSessionId: sessionId,
            });
          }
        }

        if (newInferredCandidates.length > 0) {
          setPendingCandidates((prev) => {
            const existingSummaries = new Set(prev.map((c) => c.summary.toLowerCase().trim()));
            const nonDuplicates = newInferredCandidates.filter(
              (c) => !existingSummaries.has(c.summary.toLowerCase().trim())
            );
            return [...prev, ...nonDuplicates];
          });
        }
      })
      .catch(() => {
        // Non-blocking: background memory failure must never disrupt normal conversation
        console.warn('[MindMosaic] Background memory extraction skipped or failed.');
      });
  };

  // 7. Core AI Turn Dispatcher (strictly verifies consent first)
  const dispatchAiTurn = async (
    session: JournalSession,
    userMessageContent: string,
    isInitial = false
  ) => {
    // Defense-in-depth: Never send AI requests without explicit session consent
    const consent =
      typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    if (consent !== 'true') {
      console.warn('[MindMosaic] AI request aborted: explicit consent has not been granted.');
      setPendingText(userMessageContent);
      setIsConsentOpen(true);
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    // Prepare previous history for context
    const allTurns = session.conversation || [];
    const priorTurns = isInitial ? [] : allTurns.slice(0, -1);
    const hasInitialTurn = priorTurns.length > 0 && priorTurns[0].content === session.entryText;
    const baseHistory = isInitial
      ? []
      : hasInitialTurn
      ? priorTurns
      : [{ role: 'user' as const, content: session.entryText }, ...priorTurns];
    const history = baseHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Slice 5C: Safe dynamic memory selection
    // Checks current memory settings, fresh saved memories, and pre-screens for crisis/medical safety
    let relevantMemories: any[] = [];
    const memSettings = getMemorySettings();
    const safetyCheck = checkSafetyPatterns(userMessageContent);

    if (memSettings.enabled && !safetyCheck.isCrisis && !safetyCheck.isMedicalEmergency) {
      const savedMemories = getMemories();
      relevantMemories = selectRelevantMemories(userMessageContent, savedMemories);
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessageContent,
          conversationHistory: history,
          relevantMemories,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const json = await res.json();
      const aiData = json.data;

      // Create new assistant message
      const assistantMessage: Message = {
        id: `msg_asst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: aiData.content,
        timestamp: new Date().toISOString(),
        isSimulated: aiData.isSimulated,
        safetyAlert: aiData.safetyAlert,
      };

      // Append to the active session and persist to localStorage
      const updatedSession: JournalSession = {
        ...session,
        conversation: [...(session.conversation || []), assistantMessage],
      };

      saveSession(updatedSession);
      setCurrentSession(updatedSession);
      refreshSessions();

      // Trigger memory extraction in background if no crisis/medical safety alert was triggered
      if (!assistantMessage.safetyAlert) {
        const textForExtraction = isInitial ? session.entryText : userMessageContent;
        triggerMemoryExtraction(textForExtraction, session.id);
      }
    } catch (err: any) {
      console.error('Error contacting AI companion:', err);
      setAiError(
        err?.message ||
          'Could not reach the AI companion service. Your message is safely stored in local memory.'
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // Close modals with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedSession) setSelectedSession(null);
        if (isConsentOpen) handleDismissConsent();
        if (isThemesModalOpen) setIsThemesModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSession, isConsentOpen, isThemesModalOpen]);

  const wordCount = entryText.trim() ? entryText.trim().split(/\s+/).length : 0;
  const charCount = entryText.length;

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 max-w-4xl mx-auto transition-colors duration-300">
      {/* Privacy Consent Modal */}
      <ConsentModal
        isOpen={isConsentOpen}
        onConfirm={handleConfirmConsent}
        onDecline={handleDeclineConsent}
        onDismiss={handleDismissConsent}
      />

      {/* Companion Persistent Memory & Theme Tracking Settings Modal */}
      <MemorySettingsModal
        isOpen={isMemoryModalOpen}
        onClose={() => setIsMemoryModalOpen(false)}
        onSettingsChanged={(updated) => {
          setMemorySettings(updated);
          // If persistent memory is switched OFF, pending candidates must disappear immediately
          if (!updated.enabled) {
            setPendingCandidates([]);
          }
        }}
        onThemeSettingsChanged={(updated) => setThemeTrackingSettings(updated)}
      />

      {/* Top navigation */}
      <header className="relative flex items-center justify-between pb-6 border-b border-aqua-200/40 dark:border-night-border/50">
        {/* Left: Home link and History link with z-10 for clickability */}
        <div className="flex items-center gap-1 sm:gap-2 z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-2.5 sm:px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-2.5 sm:px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
          >
            <Clock className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
            <span className="hidden sm:inline">History</span>
          </Link>
        </div>

        {/* Center: Combined MindMosaic + Journal group centered relative to the viewport */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <span className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white whitespace-nowrap">
            MindMosaic
          </span>
          <span className="text-xs text-aqua-700 dark:text-aqua-300 font-medium px-2 py-0.5 rounded-full bg-aqua-100/60 dark:bg-night-surface whitespace-nowrap">
            Journal
          </span>
        </div>

        {/* Right: Controls with z-10 */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 z-10">
          <button
            type="button"
            onClick={() => setIsMemoryModalOpen(true)}
            aria-label={`Companion memory is ${
              memorySettings.enabled ? 'active' : 'off'
            }. Click to manage persistent memory settings.`}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              memorySettings.enabled
                ? 'bg-aqua-100/90 dark:bg-night-card text-aqua-900 dark:text-aqua-300 border-aqua-300 dark:border-night-border shadow-sm'
                : 'bg-white/60 dark:bg-night-surface/60 text-slate-500 dark:text-night-muted border-aqua-200/50 dark:border-night-border hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Brain
              className={`w-3.5 h-3.5 ${
                memorySettings.enabled
                  ? 'text-aqua-700 dark:text-mint-400'
                  : 'text-slate-400 dark:text-night-muted'
              }`}
            />
            <span className="hidden sm:inline">Memory: </span>
            <span>{memorySettings.enabled ? 'Active' : 'Off'}</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="my-auto py-6 sm:py-10 space-y-12">
        {/* Active Composer Section */}
        <section aria-labelledby="composer-heading">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header prompt with refined hierarchy */}
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 pb-1">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-aqua-100/80 dark:bg-night-card text-aqua-900 dark:text-aqua-300 border border-aqua-200/60 dark:border-night-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {greeting}
                </div>
                <h1
                  id="composer-heading"
                  className="font-serif text-2xl sm:text-4xl font-normal text-slate-900 dark:text-white mt-2"
                >
                  What's on your mind right now?
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-night-muted mt-1 sm:mt-0">
                Saved immediately to your browser
              </p>
            </div>

            {/* Error banner */}
            {saveError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{saveError}</span>
              </div>
            )}

            {/* Save success feedback toast */}
            {saveBanner && (
              <div
                role="status"
                className="flex items-start justify-between gap-3 p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm transition-all shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{saveBanner.message}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Recorded at {saveBanner.time} • Appended to your Recent Reflections below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaveBanner(null)}
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-white p-1"
                  aria-label="Dismiss save confirmation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Tactile Journal Folio Panel */}
            <div className="journal-sheet rounded-2xl sm:rounded-3xl p-5 sm:p-8 transition-all focus-within:border-aqua-500/70 dark:focus-within:border-mint-400/50 focus-within:ring-2 focus-within:ring-aqua-500/20 dark:focus-within:ring-mint-400/20">
              <textarea
                ref={textareaRef}
                value={entryText}
                onChange={handleTextChange}
                placeholder="Take all the space you need. Write about what happened, how you feel, or what's weighing on you..."
                rows={6}
                aria-label="Your journal reflection text"
                className="w-full bg-transparent resize-none outline-none text-slate-800 dark:text-night-text placeholder-slate-400 dark:placeholder-night-muted text-base sm:text-xl leading-relaxed font-sans"
              />

              {/* Dynamic word and character metrics */}
              <div className="flex items-center justify-between pt-4 mt-3 border-t border-aqua-100/70 dark:border-night-border/50 text-xs text-slate-500 dark:text-night-muted">
                <span className="font-medium">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <span>{charCount} characters</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-night-muted">
                <Shield className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                <span>100% on this device • Zero cloud sync</span>
              </div>

              <button
                type="submit"
                disabled={!entryText.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-medium text-sm text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg shadow-sm hover:shadow-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                <PenLine className="w-4 h-4" />
                <span>Save Reflection</span>
              </button>
            </div>
          </form>
        </section>

        {/* AI Companion Response & Multi-Turn Conversation Area */}
        {currentSession && (
          <section aria-labelledby="companion-response-heading" className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aqua-600 dark:text-mint-400" />
                <h2
                  id="companion-response-heading"
                  className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Conversation with Companion
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentSession(null);
                    setSaveBanner(null);
                    setAiError(null);
                    setConsentDeclinedNotice(false);
                    setPendingCandidates([]);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white hover:bg-aqua-50 dark:hover:bg-night-card transition-colors border border-transparent hover:border-aqua-200/50"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>New Reflection</span>
                </button>
                {currentSession.conversation && currentSession.conversation.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-aqua-100/70 dark:bg-night-card text-aqua-800 dark:text-aqua-300 font-medium">
                    Active Thread
                  </span>
                )}
              </div>
            </div>

            {/* Initial Reflection Reference Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-aqua-50/70 dark:bg-night-surface/90 border border-aqua-200/60 dark:border-night-border space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-night-muted pb-1.5 border-b border-aqua-100/60 dark:border-night-border/40">
                <span className="font-semibold text-aqua-950 dark:text-aqua-300">
                  Your Initial Reflection
                </span>
                <span>{formatSessionDate(currentSession.createdAt).full}</span>
              </div>
              <p className="text-sm sm:text-base text-slate-800 dark:text-night-text whitespace-pre-wrap leading-relaxed font-sans">
                {currentSession.entryText}
              </p>
            </div>

            {/* Consent Declined Notice */}
            {consentDeclinedNotice && !isAiLoading && (
              <div className="glass-surface p-5 rounded-2xl border border-aqua-200/40 dark:border-night-border text-xs sm:text-sm text-slate-600 dark:text-night-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-aqua-600 dark:text-mint-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Private Local Mode Active
                    </p>
                    <p className="text-xs mt-0.5">
                      You chose to keep reflections local on this device. No text is sent to external
                      AI services.
                    </p>
                  </div>
                </div>
                {currentSession &&
                  (!currentSession.conversation || currentSession.conversation.length === 0) && (
                    <button
                      type="button"
                      onClick={handleExplicitConnect}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-aqua-800 dark:text-aqua-300 bg-aqua-100/70 dark:bg-night-card hover:bg-aqua-200/70 dark:hover:bg-night-surface border border-aqua-200/60 dark:border-night-border transition-colors flex-shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Connect to AI Companion</span>
                    </button>
                  )}
              </div>
            )}

            {/* Display Multi-Turn Conversation Thread */}
            {currentSession.conversation && currentSession.conversation.length > 0 && (
              <div className="space-y-4">
                {currentSession.conversation.map((msg) =>
                  msg.role === 'user' ? (
                    /* User Follow-Up Turn */
                    <div
                      key={msg.id}
                      className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-aqua-100/50 dark:bg-night-card border border-aqua-200/60 dark:border-night-border shadow-sm space-y-2 ml-4 sm:ml-12"
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-aqua-200/40 dark:border-night-border/40 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-aqua-950 dark:text-aqua-200">
                          <User className="w-3.5 h-3.5 text-aqua-700 dark:text-mint-400" />
                          <span>You</span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-night-muted">
                          {formatSessionDate(msg.timestamp).time}
                        </span>
                      </div>
                      <div className="text-sm sm:text-base text-slate-800 dark:text-night-text leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>
                      <div className="pt-1 flex items-center justify-end text-[11px] text-emerald-700 dark:text-emerald-400 font-medium gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Saved locally</span>
                      </div>
                    </div>
                  ) : (
                    /* Assistant Companion Turn */
                    <div
                      key={msg.id}
                      className="journal-sheet p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-aqua-200/60 dark:border-night-border shadow-sm space-y-3 mr-2 sm:mr-6"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-aqua-100/60 dark:border-night-border/50 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400">
                            <Bot className="w-4 h-4" />
                          </div>
                          <span className="font-serif font-bold text-slate-900 dark:text-white">
                            MindMosaic Companion
                          </span>
                        </div>
                        {msg.isSimulated ? (
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                            Offline Demo Mode
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                            Live AI Response
                          </span>
                        )}
                      </div>

                      <div className="text-sm sm:text-base text-slate-800 dark:text-night-text leading-relaxed font-sans">
                        <FormattedMessage content={msg.content} />
                      </div>

                      {msg.safetyAlert && (
                        <div className="pt-2">
                          <SafetyBanner type={msg.safetyAlert} />
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between text-xs text-slate-400 dark:text-night-muted border-t border-aqua-100/40 dark:border-night-border/40">
                        <span>{formatSessionDate(msg.timestamp).full}</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Saved in local session
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {/* Inferred Memory Observation Approval Cards (Inline below assistant message) */}
            {pendingCandidates.length > 0 && (
              <div className="space-y-3" role="region" aria-label="Pending memory observations">
                {pendingCandidates.map((candidate) => (
                  <MemoryApprovalCard
                    key={candidate.id || candidate.summary}
                    candidate={candidate}
                    onApprove={handleApproveCandidate}
                    onReject={handleRejectCandidate}
                  />
                ))}
              </div>
            )}

            {/* AI Loading State */}
            {isAiLoading && (
              <div className="glass-surface p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-aqua-200/50 dark:border-night-border animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400 flex-shrink-0">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    MindMosaic is reflecting on what you shared...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-night-muted mt-0.5">
                    Listening attentively before responding.
                  </p>
                </div>
              </div>
            )}

            {/* AI Error / Retry State */}
            {aiError && (
              <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{aiError}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Your message was already safely recorded to local storage. You can retry
                      sending to the companion without losing your writing.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRetryAi}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-200/70 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 hover:bg-amber-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry AI Response</span>
                </button>
              </div>
            )}

            {/* Multi-Turn Message Composer */}
            <div className="pt-2">
              <div className="journal-sheet rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-aqua-200/70 dark:border-night-border focus-within:border-aqua-500/80 dark:focus-within:border-mint-400/60 focus-within:ring-2 focus-within:ring-aqua-500/20 transition-all space-y-2.5 shadow-sm">
                <textarea
                  ref={replyTextareaRef}
                  value={replyText}
                  onChange={handleReplyChange}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Reply to MindMosaic... (Press Enter to send, Shift+Enter for new line)"
                  rows={2}
                  disabled={isAiLoading}
                  aria-label="Reply to MindMosaic companion"
                  className="w-full bg-transparent resize-none outline-none text-slate-800 dark:text-night-text placeholder-slate-400 dark:placeholder-night-muted text-sm sm:text-base leading-relaxed font-sans disabled:opacity-50"
                />
                <div className="flex items-center justify-between pt-2 border-t border-aqua-100/60 dark:border-night-border/40 text-xs">
                  <span className="text-[11px] text-slate-400 dark:text-night-muted">
                    Press Enter to send • Shift+Enter for new line
                  </span>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isAiLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-medium text-xs text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Anchor for auto-scroll */}
            <div ref={conversationEndRef} />
          </section>
        )}

        {/* Recent Reflections on This Device */}
        <section aria-labelledby="recent-reflections-heading" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-aqua-700 dark:text-mint-400" />
              <h2
                id="recent-reflections-heading"
                className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white"
              >
                Saved Reflections on This Device
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Reflection Themes Tracker Trigger Button */}
              <button
                type="button"
                onClick={() => setIsThemesModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors bg-white/70 dark:bg-night-card hover:bg-aqua-50 dark:hover:bg-night-surface text-aqua-900 dark:text-aqua-300 border-aqua-200/60 dark:border-night-border shadow-sm"
              >
                <BarChart2 className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                <span>Reflection Themes</span>
                {themeTrackingSettings.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </button>

              <Link
                href="/history"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors bg-white/70 dark:bg-night-card hover:bg-aqua-50 dark:hover:bg-night-surface text-aqua-900 dark:text-aqua-300 border-aqua-200/60 dark:border-night-border shadow-xs"
              >
                <Clock className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                <span>Full History</span>
              </Link>

              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white dark:bg-night-card text-aqua-900 dark:text-aqua-300 border border-aqua-200/60 dark:border-night-border font-medium shadow-sm">
                {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
          </div>

          {sessions.length === 0 ? (
            /* Empty State */
            <div className="glass-surface p-8 sm:p-10 rounded-2xl border border-dashed border-aqua-200 dark:border-night-border text-center">
              <div className="w-12 h-12 rounded-2xl bg-aqua-100/70 dark:bg-night-card flex items-center justify-center text-aqua-600 dark:text-mint-400 mx-auto mb-3.5 shadow-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Your journal is waiting for its first thought
              </h3>
              <p className="text-xs text-slate-500 dark:text-night-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
                Write your thoughts above and click "Save Reflection" to personally verify that entries
                are recorded safely in your browser.
              </p>
            </div>
          ) : (
            /* Saved Reflections List */
            <div className="grid grid-cols-1 gap-3">
              {sessions.map((session) => {
                const formatted = formatSessionDate(session.createdAt);
                const words = session.entryText.trim().split(/\s+/).length;
                const hasConversation =
                  session.conversation && session.conversation.length > 0;
                return (
                  <article
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session);
                      setPendingCandidates([]);
                    }}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSession(session);
                        setPendingCandidates([]);
                      }
                    }}
                    className="glass-surface p-5 rounded-2xl border border-aqua-200/50 dark:border-night-border hover:border-aqua-400 dark:hover:border-mint-400/60 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group focus-visible:ring-2 focus-visible:ring-aqua-500"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-night-muted pb-2.5 border-b border-aqua-100/50 dark:border-night-border/50">
                      <div className="flex items-center gap-2 font-medium text-aqua-900 dark:text-aqua-300">
                        <Calendar className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                        <span>{formatted.full}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasConversation && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-aqua-100 dark:bg-night-card text-aqua-800 dark:text-aqua-300 font-medium">
                            Thread saved
                          </span>
                        )}
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-aqua-50 dark:bg-night-surface text-slate-600 dark:text-night-muted">
                          {words} {words === 1 ? 'word' : 'words'}
                        </span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm sm:text-base text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed font-sans">
                      {session.entryText}
                    </p>

                    <div className="mt-3.5 flex items-center justify-between text-xs text-aqua-700 dark:text-mint-400 font-medium">
                      <span>Click to read full entry and conversation</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Reflection Full Reading Modal */}
        {selectedSession && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedSession(null);
              }
            }}
            className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div className="glass-card-layered w-full max-w-lg rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-aqua-200 dark:border-night-border max-h-[85vh] flex flex-col justify-between">
              <div className="overflow-y-auto pr-1 space-y-4">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-aqua-100 dark:border-night-border">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-aqua-700 dark:text-mint-400" />
                    <h3
                      id="modal-title"
                      className="text-base font-serif font-bold text-slate-900 dark:text-white"
                    >
                      Saved Session View
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedSession(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-aqua-100/50 dark:hover:bg-night-card transition-colors"
                    aria-label="Close reflection viewer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-night-muted">
                  <Clock className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                  <span>Recorded: {formatSessionDate(selectedSession.createdAt).full}</span>
                </div>

                {/* Original Reflection Text */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-night-muted mb-1.5">
                    Your Reflection:
                  </h4>
                  <div className="p-4 rounded-xl sm:rounded-2xl bg-white/80 dark:bg-night-surface/90 border border-aqua-100 dark:border-night-border text-slate-800 dark:text-night-text text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {selectedSession.entryText}
                  </div>
                </div>

                {/* Conversation Transcript if present */}
                {selectedSession.conversation && selectedSession.conversation.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-night-muted mb-1.5">
                      Companion Transcript:
                    </h4>
                    {selectedSession.conversation.map((msg) => (
                      <div
                        key={msg.id}
                        className="p-3.5 rounded-xl bg-aqua-50/70 dark:bg-night-card/80 border border-aqua-200/50 dark:border-night-border text-xs sm:text-sm text-slate-800 dark:text-night-text leading-relaxed"
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-aqua-100/50 dark:border-night-border/40 text-[11px] text-slate-500 dark:text-night-muted">
                          <span className="font-semibold text-aqua-950 dark:text-aqua-300">
                            {msg.role === 'assistant' ? 'MindMosaic Companion' : 'You'}
                          </span>
                          {msg.isSimulated ? (
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                              Offline Demo
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                              Live AI
                            </span>
                          )}
                        </div>
                        {msg.role === 'assistant' ? (
                          <div className="text-sm text-slate-800 dark:text-night-text leading-relaxed font-sans">
                            <FormattedMessage content={msg.content} />
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                        {msg.safetyAlert && (
                          <div className="pt-2">
                            <SafetyBanner type={msg.safetyAlert} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-5 pt-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-night-muted border-t border-aqua-100 dark:border-night-border">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified in local storage
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSession(selectedSession);
                      setSelectedSession(null);
                      setSaveBanner(null);
                      setAiError(null);
                      setConsentDeclinedNotice(false);
                      setPendingCandidates([]);
                    }}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl font-medium text-xs bg-aqua-100 hover:bg-aqua-200 dark:bg-night-card dark:hover:bg-night-surface text-aqua-900 dark:text-aqua-300 border border-aqua-200/60 dark:border-night-border transition-colors shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Resume Dialogue</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSession(null)}
                    className="px-4 py-2 rounded-xl font-medium text-xs bg-slate-100 hover:bg-slate-200 dark:bg-night-border dark:hover:bg-night-card text-slate-700 dark:text-night-text transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reflection Themes Modal (100% on-device computed view) */}
        {isThemesModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="themes-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsThemesModalOpen(false);
            }}
            className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="glass-card-layered w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-aqua-200/80 dark:border-night-border transition-all max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between pb-4 border-b border-aqua-100/70 dark:border-night-border/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400 shadow-sm">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      id="themes-modal-title"
                      className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white"
                    >
                      Reflection Themes Tracker
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-night-muted">
                      100% computed on-device • Zero network calls
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsThemesModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  aria-label="Close themes viewer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!themeTrackingSettings.enabled ? (
                /* Disabled Zero-State */
                <div className="my-6 p-6 rounded-2xl bg-aqua-50/50 dark:bg-night-surface/90 border border-aqua-200/60 dark:border-night-border text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-night-card flex items-center justify-center text-slate-500 mx-auto">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Theme tracking is currently disabled
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-night-muted max-w-sm mx-auto leading-relaxed">
                    You can privately turn on theme tracking in settings to notice recurring topics
                    like stress, sleep, or focus across your reflections over time.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsThemesModalOpen(false);
                      setIsMemoryModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg transition-colors shadow-sm"
                  >
                    <span>Open Memory & Themes Settings</span>
                  </button>
                </div>
              ) : (
                /* Active Theme Summary View */
                <div className="my-5 space-y-4">
                  {/* Period Switcher (Last 30 Days vs All Time) */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-aqua-50 dark:bg-night-surface border border-aqua-200/50 dark:border-night-border">
                    <button
                      type="button"
                      onClick={() => setThemesPeriod('last_30_days')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                        themesPeriod === 'last_30_days'
                          ? 'bg-white dark:bg-night-card text-aqua-900 dark:text-aqua-300 shadow-sm'
                          : 'text-slate-500 dark:text-night-muted hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setThemesPeriod('all_time')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all ${
                        themesPeriod === 'all_time'
                          ? 'bg-white dark:bg-night-card text-aqua-900 dark:text-aqua-300 shadow-sm'
                          : 'text-slate-500 dark:text-night-muted hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      All Time
                    </button>
                  </div>

                  {/* Summary Scope Indicator */}
                  {themeSummary && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-night-muted px-1">
                      <span>
                        Analyzed {themeSummary.totalReflectionsAnalyzed}{' '}
                        {themeSummary.totalReflectionsAnalyzed === 1 ? 'reflection' : 'reflections'}
                      </span>
                      {themeSummary.startDate && themeSummary.endDate ? (
                        <span>
                          {formatSessionDate(themeSummary.startDate).date} –{' '}
                          {formatSessionDate(themeSummary.endDate).date}
                        </span>
                      ) : (
                        <span>No reflections in this period</span>
                      )}
                    </div>
                  )}

                  {themeSummary?.hasResetCutoff && (
                    <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-night-surface/60 border border-teal-200/60 dark:border-night-border text-[11px] text-teal-800 dark:text-teal-300 flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
                      <span>
                        History cutoff active: Reflections recorded before{' '}
                        {formatSessionDate(themeSummary.resetAt || '').full} are excluded.
                      </span>
                    </div>
                  )}

                  {/* Themes Grid */}
                  <div className="space-y-2.5 pt-1">
                    {themeSummary?.themes.map((t) => {
                      const hasMentions = t.reflectionCount > 0;
                      return (
                        <div
                          key={t.themeId}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            hasMentions
                              ? 'bg-white/90 dark:bg-night-surface/90 border-aqua-200/70 dark:border-night-border shadow-sm'
                              : 'bg-slate-50/50 dark:bg-night-card/40 border-slate-200/50 dark:border-night-border/40 opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                              {t.themeLabel}
                            </span>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                hasMentions
                                  ? 'bg-aqua-100 dark:bg-night-card text-aqua-900 dark:text-aqua-300 border border-aqua-300/60 dark:border-night-border'
                                  : 'bg-slate-100 dark:bg-night-card text-slate-500 dark:text-night-muted'
                              }`}
                            >
                              {t.reflectionCount}{' '}
                              {t.reflectionCount === 1 ? 'reflection' : 'reflections'}
                            </span>
                          </div>

                          {hasMentions && (
                            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 dark:text-night-muted pt-1.5 border-t border-aqua-100/50 dark:border-night-border/40">
                              <span>
                                Direct:{' '}
                                <strong className="text-slate-800 dark:text-night-text">
                                  {t.directCount}
                                </strong>
                              </span>
                              <span>
                                Mentions / Contextual:{' '}
                                <strong className="text-slate-800 dark:text-night-text">
                                  {t.uncertainCount}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 flex items-center justify-end border-t border-aqua-100/70 dark:border-night-border/70">
                <button
                  type="button"
                  onClick={() => setIsThemesModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-medium text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 dark:text-night-muted border-t border-aqua-200/40 dark:border-night-border/40 mt-8">
        <p>Private & on-device. MindMosaic never sends reflections without your explicit consent.</p>
      </footer>
    </div>
  );
}
