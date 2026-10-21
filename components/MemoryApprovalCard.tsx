'use client';

import React, { useState } from 'react';
import { Sparkles, Check, X, Shield, Tag } from 'lucide-react';
import type { MemoryRecord } from '@/lib/storage';

export interface MemoryCandidate {
  id?: string;
  category: 'coping_strategy' | 'user_preference' | 'lifestyle_fact' | 'inferred_observation';
  summary: string;
  tags: string[];
  provenance: 'user_stated' | 'ai_inferred';
  sourceSessionId?: string;
}

export interface MemoryApprovalCardProps {
  candidate: MemoryCandidate;
  onApprove: (candidate: MemoryCandidate) => void;
  onReject: (candidate: MemoryCandidate) => void;
  className?: string;
}

/**
 * MemoryApprovalCard (Slice 5B Step 4)
 *
 * Prompts the user with neutral, transparent framing to approve or reject
 * an AI-inferred observation before anything is saved to browser memory.
 *
 * Guarantees:
 * - Display alone NEVER persists the memory.
 * - Explicit user confirmation ("Remember this") is strictly required before saving.
 * - Clear "Don't save" action dismisses the candidate without persisting.
 * - Retains 'ai_inferred' provenance.
 * - Accessible keyboard navigation and theme-aware styling.
 */
export function MemoryApprovalCard({
  candidate,
  onApprove,
  onReject,
  className = '',
}: MemoryApprovalCardProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionTaken, setActionTaken] = useState<'approved' | 'rejected' | null>(null);

  const handleApprove = () => {
    if (isProcessing || actionTaken) return;
    setIsProcessing(true);
    setActionTaken('approved');
    // Enforce provenance as ai_inferred for inferred observations
    const approvedCandidate: MemoryCandidate = {
      ...candidate,
      provenance: 'ai_inferred',
    };
    onApprove(approvedCandidate);
  };

  const handleReject = () => {
    if (isProcessing || actionTaken) return;
    setIsProcessing(true);
    setActionTaken('rejected');
    onReject(candidate);
  };

  if (actionTaken === 'rejected') {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Memory approval prompt"
      className={`relative my-4 p-4 rounded-xl border border-teal-200/80 bg-teal-50/50 dark:border-teal-800/60 dark:bg-slate-800/80 shadow-sm backdrop-blur-sm transition-all ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* Leading icon */}
        <div className="p-2 rounded-lg bg-teal-100/80 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
        </div>

        {/* Content body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-teal-800 dark:text-teal-300">
              Observation Notice
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 font-normal">
              <Shield className="w-3 h-3 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              Requires Approval
            </span>
          </div>

          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed mb-2">
            &ldquo;{candidate.summary}&rdquo;
          </p>

          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            MindMosaic noticed this pattern in your reflection. Would you like to remember it locally for future conversations?
          </p>

          {/* Tags if present */}
          {candidate.tags && candidate.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3" aria-label="Tags">
              {candidate.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                >
                  <Tag className="w-2.5 h-2.5 text-slate-400" aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleApprove}
              disabled={isProcessing || actionTaken !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 dark:focus:ring-offset-slate-800 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Remember this
            </button>

            <button
              type="button"
              onClick={handleReject}
              disabled={isProcessing || actionTaken !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:focus:ring-offset-slate-800 disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              Don&apos;t save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

