'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Trash2,
  AlertTriangle,
  AlertCircle,
  X,
  Feather,
  CheckCircle2,
} from 'lucide-react';
import { JournalSession, formatSessionDate, clearAllSessions } from '@/lib/storage';

interface HistoryListProps {
  sessions: JournalSession[];
  onSelectSession: (session: JournalSession) => void;
  onSessionsCleared: () => void;
}

export function HistoryList({
  sessions,
  onSelectSession,
  onSessionsCleared,
}: HistoryListProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAll = () => {
    setIsClearing(true);
    setClearError(null);
    try {
      const success = clearAllSessions();
      if (success) {
        setIsClearing(false);
        setShowClearConfirm(false);
        onSessionsCleared();
      } else {
        setIsClearing(false);
        setClearError('Could not clear reflections from device storage. Please try again.');
      }
    } catch (err: any) {
      setIsClearing(false);
      setClearError(err?.message || 'An unexpected error occurred while clearing history.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row within List */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-aqua-200/40 dark:border-night-border/50">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Journal History
          </h2>
          <p className="text-xs text-slate-500 dark:text-night-muted mt-0.5">
            {sessions.length === 0
              ? 'Zero reflections saved on this device'
              : `${sessions.length} ${sessions.length === 1 ? 'reflection' : 'reflections'} stored locally`}
          </p>
        </div>

        {sessions.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 transition-all shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All History</span>
          </button>
        )}
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-history-title"
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="glass-card-layered w-full max-w-md rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-4">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-700 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearError(null);
                }}
                disabled={isClearing}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                aria-label="Cancel clearing"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3
                id="clear-history-title"
                className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white"
              >
                Clear All Journal History?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-night-muted leading-relaxed">
                Are you sure you want to delete all saved journal reflections? All sessions and conversation transcripts stored in this browser will be permanently erased. Approved memory records and settings will remain preserved.
              </p>
            </div>

            {clearError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{clearError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isClearing}
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-night-text bg-slate-100 hover:bg-slate-200 dark:bg-night-card dark:hover:bg-night-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {isClearing ? 'Clearing...' : 'Permanently Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main List Body */}
      {sessions.length === 0 ? (
        /* Empty State */
        <div className="glass-surface p-8 sm:p-12 rounded-3xl border border-dashed border-aqua-200/80 dark:border-night-border text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-aqua-100/70 dark:bg-night-card flex items-center justify-center text-aqua-600 dark:text-mint-400 mx-auto shadow-sm">
            <BookOpen className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white">
              Nothing here yet — your first entry is waiting.
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-night-muted leading-relaxed">
              Write your thoughts in your journal to start building your personal reflection history on this device.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/journal"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-xs sm:text-sm text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg transition-all shadow-sm"
            >
              <Feather className="w-4 h-4" />
              <span>Open Your Journal</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Chronological Session Cards */
        <div className="grid grid-cols-1 gap-3.5" role="list" aria-label="Saved reflections">
          {sessions.map((session) => {
            const formatted = formatSessionDate(session.createdAt);
            const words = session.entryText.trim()
              ? session.entryText.trim().split(/\s+/).length
              : 0;
            const hasConversation =
              session.conversation && session.conversation.length > 0;

            // ~80-character readable preview
            const preview =
              session.entryText.length > 80
                ? `${session.entryText.slice(0, 80).trim()}...`
                : session.entryText;

            return (
              <article
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(session)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSession(session);
                  }
                }}
                className="glass-surface p-5 sm:p-6 rounded-2xl border border-aqua-200/50 dark:border-night-border hover:border-aqua-400 dark:hover:border-mint-400/60 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group focus-visible:ring-2 focus-visible:ring-aqua-500 outline-none"
              >
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-night-muted pb-3 border-b border-aqua-100/50 dark:border-night-border/50 gap-2">
                  <div className="flex items-center gap-2 font-medium text-aqua-950 dark:text-aqua-300">
                    <Calendar className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                    <span>{formatted.full}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasConversation && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-aqua-100 dark:bg-night-card text-aqua-800 dark:text-aqua-300 font-medium">
                        Thread saved ({session.conversation.length})
                      </span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/70 dark:bg-night-card text-slate-600 dark:text-night-muted border border-aqua-100 dark:border-night-border">
                      {words} {words === 1 ? 'word' : 'words'}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed font-sans line-clamp-2">
                  {preview}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs text-aqua-700 dark:text-mint-400 font-medium pt-1">
                  <span>Read full reflection & conversation</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

