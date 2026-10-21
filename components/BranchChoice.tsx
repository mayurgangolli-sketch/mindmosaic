'use client';

import React from 'react';
import { MessageSquare, Sparkles, ArrowRightLeft, Check } from 'lucide-react';

interface BranchChoiceProps {
  onSelectBranch: (branch: 'talk' | 'suggestion') => void;
  disabled?: boolean;
}

interface BranchSwitcherProps {
  currentBranch: 'talk' | 'suggestion';
  onSwitchBranch: (branch: 'talk' | 'suggestion') => void;
  disabled?: boolean;
}

/**
 * BranchChoice: Two clear choices presented after the AI companion's initial response.
 * Uses modest corner radii (rounded-2xl) adhering to design system rules (no pills).
 */
export function BranchChoice({ onSelectBranch, disabled = false }: BranchChoiceProps) {
  return (
    <div
      role="region"
      aria-label="Conversation path choices"
      className="p-5 sm:p-6 rounded-2xl bg-white/70 dark:bg-night-card border border-aqua-200/70 dark:border-night-border shadow-xs space-y-4 animate-in fade-in duration-200"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-aqua-600 dark:text-mint-400" />
          <span>How would you like to continue?</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-night-muted">
          Choose a path for this conversation. You can switch between them at any time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Choice 1: Talk More */}
        <button
          type="button"
          onClick={() => onSelectBranch('talk')}
          disabled={disabled}
          className="group text-left p-4 rounded-xl border border-aqua-200/60 dark:border-night-border/80 bg-white/90 dark:bg-night-surface/90 hover:border-aqua-500 dark:hover:border-mint-400/80 hover:bg-aqua-50/50 dark:hover:bg-night-card transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-aqua-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center gap-2.5 pb-2">
            <div className="w-8 h-8 rounded-lg bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400 group-hover:bg-aqua-200 dark:group-hover:bg-night-border transition-colors">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block">
                Talk more
              </span>
              <span className="text-[11px] text-aqua-700 dark:text-mint-400 font-medium">
                Attentive listening
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-night-muted leading-relaxed">
            Continue untangling your thoughts. MindMosaic will listen attentively and validate your feelings without unsolicited advice.
          </p>
        </button>

        {/* Choice 2: Get a Suggestion */}
        <button
          type="button"
          onClick={() => onSelectBranch('suggestion')}
          disabled={disabled}
          className="group text-left p-4 rounded-xl border border-aqua-200/60 dark:border-night-border/80 bg-white/90 dark:bg-night-surface/90 hover:border-aqua-500 dark:hover:border-mint-400/80 hover:bg-aqua-50/50 dark:hover:bg-night-card transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-aqua-500/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div className="flex items-center gap-2.5 pb-2">
            <div className="w-8 h-8 rounded-lg bg-mint-100 dark:bg-night-card flex items-center justify-center text-mint-700 dark:text-mint-400 group-hover:bg-mint-200 dark:group-hover:bg-night-border transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white block">
                Get a suggestion
              </span>
              <span className="text-[11px] text-mint-700 dark:text-mint-400 font-medium">
                1–2 practical ideas
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-night-muted leading-relaxed">
            Receive 1–2 practical, gentle coping ideas or perspectives grounded in what you shared, without overwhelming checklists.
          </p>
        </button>
      </div>
    </div>
  );
}
/**
 * BranchSwitcher: A subtle, accessible control directly above the reply composer.
 * Allows switching between "Talk more" and "Get a suggestion" during the conversation.
 */
export function BranchSwitcher({
  currentBranch,
  onSwitchBranch,
  disabled = false,
}: BranchSwitcherProps) {
  const isTalk = currentBranch === 'talk';
  const targetBranch = isTalk ? 'suggestion' : 'talk';
  const targetLabel = isTalk ? 'Get a suggestion' : 'Talk more';

  return (
    <div
      role="group"
      aria-label="Conversation mode control"
      className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-aqua-50/60 dark:bg-night-card/70 border border-aqua-200/50 dark:border-night-border/50 text-xs transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500 dark:text-night-muted">Mode:</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-white dark:bg-night-surface text-aqua-950 dark:text-aqua-200 border border-aqua-200/60 dark:border-night-border shadow-xs">
          <Check className="w-3 h-3 text-aqua-600 dark:text-mint-400" />
          {isTalk ? 'Talk more' : 'Suggestion mode'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onSwitchBranch(targetBranch)}
        disabled={disabled}
        aria-label={`Switch conversation mode to ${targetLabel}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-aqua-700 dark:text-mint-400 hover:text-aqua-900 dark:hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-aqua-100/60 dark:hover:bg-night-border/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <ArrowRightLeft className="w-3 h-3" />
        <span>Switch to &ldquo;{targetLabel}&rdquo;</span>
      </button>
    </div>
  );
}
