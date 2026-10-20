'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ConsentModal } from '@/components/ConsentModal';
import {
  getSessions,
  createSession,
  saveSession,
  formatSessionDate,
  JournalSession,
  Message
} from '@/lib/storage';

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

  // Save feedback state
  const [saveBanner, setSaveBanner] = useState<{ message: string; time: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved sessions on mount
  useEffect(() => {
    refreshSessions();
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

  // 1. Save locally to localStorage FIRST, then check consent before AI call
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = entryText.trim();
    if (!trimmed) {
      setSaveError('Please write a few thoughts before saving your reflection.');
      return;
    }

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
      const consentGiven = typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;

      if (consentGiven === 'true') {
        // Consent already given this session -> clear composer and proceed to AI request
        setEntryText('');
        setSaveError(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        requestAiResponse(session, trimmed);
      } else if (consentGiven === 'false') {
        // Consent previously declined this session -> preserve local only without repeating prompt
        // Preserve typed text in textarea so user can review, edit, or explicitly connect
        setSaveError(null);
        setConsentDeclinedNotice(true);
      } else {
        // First AI interaction or previously dismissed -> open consent modal
        // Preserve typed text in textarea so dismissing/declining never causes data loss
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

    const textToSend = pendingText || entryText.trim() || currentSession?.entryText;
    if (currentSession && textToSend) {
      // Clear composer now that it has been handed off to the companion thread
      setEntryText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      requestAiResponse(currentSession, textToSend);
      setPendingText(null);
    }
  };

  // 3. User explicitly declines consent ("Keep Reflection Local Only")
  // Preserves typed text in textarea and local storage, does not call /api/chat
  const handleDeclineConsent = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mindmosaic_consent_given', 'false');
    }
    setIsConsentOpen(false);
    setPendingText(null);
    setConsentDeclinedNotice(true);
  };

  // 4. User dismisses the modal (clicks X, clicks backdrop, or presses Escape)
  // Preserves exact typed text in textarea, does not modify sessionStorage, does not call /api/chat
  const handleDismissConsent = () => {
    setIsConsentOpen(false);
    setPendingText(null);
  };

  // 5. Explicitly connect to AI (e.g. from local-mode banner after declining)
  const handleExplicitConnect = () => {
    const textToUse = entryText.trim() || currentSession?.entryText;
    if (!textToUse || !currentSession) return;

    const consentGiven = typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    if (consentGiven === 'true') {
      setEntryText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      requestAiResponse(currentSession, textToUse);
    } else {
      setPendingText(textToUse);
      setIsConsentOpen(true);
    }
  };

  // 6. Server-side API request via /api/chat proxy (strictly verifies consent first)
  const requestAiResponse = async (session: JournalSession, textToAnalyze: string) => {
    // Defense-in-depth: Never send AI requests without explicit session consent
    const consent = typeof window !== 'undefined' ? sessionStorage.getItem('mindmosaic_consent_given') : null;
    if (consent !== 'true') {
      console.warn('[MindMosaic] AI request aborted: explicit consent has not been granted.');
      setPendingText(textToAnalyze);
      setIsConsentOpen(true);
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToAnalyze,
          conversationHistory: session.conversation || [],
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
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: aiData.content,
        timestamp: new Date().toISOString(),
        isSimulated: aiData.isSimulated,
      };

      // Append to the active session and persist to localStorage
      const updatedSession: JournalSession = {
        ...session,
        conversation: [...(session.conversation || []), assistantMessage],
      };

      saveSession(updatedSession);
      setCurrentSession(updatedSession);
      refreshSessions();
    } catch (err: any) {
      console.error('Error contacting AI companion:', err);
      setAiError(err?.message || 'Could not reach the AI companion service. Your reflection is still safely stored locally.');
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSession, isConsentOpen]);

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

      {/* Top navigation */}
      <header className="flex items-center justify-between pb-6 border-b border-aqua-200/40 dark:border-night-border/50">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white">
            MindMosaic
          </span>
          <span className="text-xs text-aqua-700 dark:text-aqua-300 font-medium px-2 py-0.5 rounded-full bg-aqua-100/60 dark:bg-night-surface">
            Journal
          </span>
        </div>

        <ThemeToggle />
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
                <h1 id="composer-heading" className="font-serif text-2xl sm:text-4xl font-normal text-slate-900 dark:text-white mt-2">
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

        {/* AI Companion Response Area (When reflection is submitted) */}
        {currentSession && (
          <section aria-labelledby="companion-response-heading" className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aqua-600 dark:text-mint-400" />
                <h2 id="companion-response-heading" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                  Companion Response
                </h2>
              </div>
              {currentSession.conversation && currentSession.conversation.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-aqua-100/70 dark:bg-night-card text-aqua-800 dark:text-aqua-300 font-medium">
                  Active Thread
                </span>
              )}
            </div>

            {/* AI Loading State */}
            {isAiLoading && (
              <div className="glass-surface p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-aqua-200/50 dark:border-night-border animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400">
                  <Bot className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    MindMosaic is reflecting on what you wrote...
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
                      Your journal reflection is safely stored locally. You can try connecting again whenever you are ready.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExplicitConnect}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-200/70 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 hover:bg-amber-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry AI Response</span>
                </button>
              </div>
            )}

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
                      You chose to keep reflections local on this device. No text is sent to external AI services.
                    </p>
                  </div>
                </div>
                {currentSession && (!currentSession.conversation || currentSession.conversation.length === 0) && (
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

            {/* Display AI Conversation Turn */}
            {currentSession.conversation && currentSession.conversation.length > 0 && (
              <div className="space-y-4">
                {currentSession.conversation.map((msg) => (
                  <div
                    key={msg.id}
                    className="journal-sheet p-6 sm:p-7 rounded-2xl sm:rounded-3xl border border-aqua-200/60 dark:border-night-border shadow-sm space-y-3"
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
                      {msg.isSimulated && (
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          Offline Demo Mode
                        </span>
                      )}
                    </div>

                    <div className="text-sm sm:text-base text-slate-800 dark:text-night-text leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-400 dark:text-night-muted border-t border-aqua-100/40 dark:border-night-border/40">
                      <span>{formatSessionDate(msg.timestamp).full}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Saved in local session
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recent Reflections on This Device */}
        <section aria-labelledby="recent-reflections-heading" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-aqua-700 dark:text-mint-400" />
              <h2 id="recent-reflections-heading" className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                Saved Reflections on This Device
              </h2>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white dark:bg-night-card text-aqua-900 dark:text-aqua-300 border border-aqua-200/60 dark:border-night-border font-medium shadow-sm">
              {sessions.length} {sessions.length === 1 ? 'entry' : 'entries'}
            </span>
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
                Write your thoughts above and click "Save Reflection" to personally verify that entries are recorded safely in your browser.
              </p>
            </div>
          ) : (
            /* Saved Reflections List */
            <div className="grid grid-cols-1 gap-3">
              {sessions.map((session) => {
                const formatted = formatSessionDate(session.createdAt);
                const words = session.entryText.trim().split(/\s+/).length;
                const hasConversation = session.conversation && session.conversation.length > 0;
                return (
                  <article
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSession(session);
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
                    <h3 id="modal-title" className="text-base font-serif font-bold text-slate-900 dark:text-white">
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
                  <span>
                    Recorded: {formatSessionDate(selectedSession.createdAt).full}
                  </span>
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
                          <span className="font-semibold text-aqua-900 dark:text-aqua-300">
                            {msg.role === 'assistant' ? 'MindMosaic Companion' : 'You'}
                          </span>
                          {msg.isSimulated && (
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                              Offline Demo
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-5 pt-3.5 flex items-center justify-between text-xs text-slate-500 dark:text-night-muted border-t border-aqua-100 dark:border-night-border">
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified in local storage
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 text-white dark:text-night-bg transition-colors shadow-sm"
                >
                  Done Reading
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
