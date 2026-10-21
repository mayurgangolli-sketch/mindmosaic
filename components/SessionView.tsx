'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { JournalSession, formatSessionDate, deleteSession } from '@/lib/storage';
import { FormattedMessage } from '@/components/FormattedMessage';
import { SafetyBanner } from '@/components/SafetyBanner';

interface SessionViewProps {
  session: JournalSession;
  onBack: () => void;
  onDeleted: (sessionId: string) => void;
}

export function SessionView({ session, onBack, onDeleted }: SessionViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formattedDate = formatSessionDate(session.createdAt);
  const wordCount = session.entryText.trim()
    ? session.entryText.trim().split(/\s+/).length
    : 0;

  const handleDelete = () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const success = deleteSession(session.id);
      if (success) {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        onDeleted(session.id);
      } else {
        setIsDeleting(false);
        setDeleteError('Could not delete reflection from device storage. Please try again.');
      }
    } catch (err: any) {
      setIsDeleting(false);
      setDeleteError(err?.message || 'An unexpected error occurred while deleting.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation and Actions Bar */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-aqua-200/50 dark:border-night-border/60">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to History</span>
        </button>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 py-1.5 px-3 rounded-xl transition-all shadow-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Session</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-title"
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
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                aria-label="Cancel deletion"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h3
                id="delete-session-title"
                className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white"
              >
                Delete This Reflection?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-night-muted leading-relaxed">
                This reflection and its entire companion conversation will be permanently removed from this browser. This action cannot be undone.
              </p>
            </div>

            {deleteError && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-night-text bg-slate-100 hover:bg-slate-200 dark:bg-night-card dark:hover:bg-night-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Metadata Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-night-muted">
        <div className="flex items-center gap-2 font-medium text-aqua-900 dark:text-aqua-300">
          <Calendar className="w-4 h-4 text-aqua-600 dark:text-mint-400" />
          <span>Recorded: {formattedDate.full}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md bg-white/70 dark:bg-night-card border border-aqua-200/50 dark:border-night-border font-medium">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-800 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Saved on device
          </span>
        </div>
      </div>

      {/* Original Reflection Content */}
      <section aria-labelledby="original-entry-heading" className="space-y-2">
        <h2
          id="original-entry-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-night-muted flex items-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
          <span>Your Reflection</span>
        </h2>
        <div className="journal-sheet rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-slate-800 dark:text-night-text text-base sm:text-lg leading-relaxed whitespace-pre-wrap font-sans">
          {session.entryText}
        </div>
      </section>

      {/* Complete Companion Conversation Transcript */}
      <section aria-labelledby="transcript-heading" className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-aqua-600 dark:text-mint-400" />
            <h2
              id="transcript-heading"
              className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white"
            >
              Companion Conversation
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-night-muted">
            {session.conversation?.length || 0}{' '}
            {session.conversation?.length === 1 ? 'message' : 'messages'}
          </span>
        </div>

        {session.conversation && session.conversation.length > 0 ? (
          <div className="space-y-3" role="feed" aria-label="Conversation transcript">
            {session.conversation.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`p-4 sm:p-5 rounded-2xl transition-all ${
                    isAssistant
                      ? 'bg-white/80 dark:bg-night-card border border-aqua-200/60 dark:border-night-border shadow-xs'
                      : 'bg-aqua-50/70 dark:bg-night-surface/90 border border-aqua-200/40 dark:border-night-border'
                  }`}
                >
                  {/* Message Meta Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-aqua-100/60 dark:border-night-border/40 text-[11px] text-slate-500 dark:text-night-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-aqua-950 dark:text-aqua-300">
                        {isAssistant ? 'MindMosaic Companion' : 'You'}
                      </span>
                      {msg.branchChoice && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-aqua-100 dark:bg-night-card text-aqua-800 dark:text-aqua-300 font-medium">
                          {msg.branchChoice === 'suggestion' ? 'Suggestion mode' : 'Talk more'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isAssistant && (
                        msg.isSimulated ? (
                          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                            Offline Demo
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                            Live AI
                          </span>
                        )
                      )}
                      {msg.timestamp && (
                        <span className="flex items-center gap-1 text-slate-400 dark:text-night-muted">
                          <Clock className="w-3 h-3" />
                          <span>{formatSessionDate(msg.timestamp).time || 'Saved'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Message Body */}
                  {isAssistant ? (
                    <div className="text-sm sm:text-base text-slate-800 dark:text-night-text leading-relaxed font-sans">
                      <FormattedMessage content={msg.content} />
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-slate-800 dark:text-night-text leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.content}
                    </p>
                  )}

                  {/* Safety Alert Banner */}
                  {msg.safetyAlert && (
                    <div className="pt-3">
                      <SafetyBanner type={msg.safetyAlert} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-white/50 dark:bg-night-card/50 border border-dashed border-aqua-200/60 dark:border-night-border text-center text-xs text-slate-500 dark:text-night-muted">
            No companion conversation took place during this reflection.
          </div>
        )}
      </section>
    </div>
  );
}

