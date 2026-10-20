'use client';

import React from 'react';
import { Shield, ArrowRight, X } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  onDismiss: () => void;
}

export function ConsentModal({ isOpen, onConfirm, onDecline, onDismiss }: ConsentModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="glass-card-layered w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-aqua-200/80 dark:border-night-border transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-aqua-100/70 dark:border-night-border/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400 shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 id="consent-title" className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white">
                Privacy & External AI Consent
              </h3>
              <p className="text-xs text-slate-500 dark:text-night-muted">
                Your permission is required before sending anything
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            aria-label="Dismiss without choosing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Body */}
        <div className="py-5 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-night-muted leading-relaxed">
          <p>
            Your reflection is <strong className="text-slate-900 dark:text-white">already safely saved on your device</strong>. Before MindMosaic generates a companion response, please review how data is handled:
          </p>

          <div className="space-y-2.5 p-4 rounded-2xl bg-aqua-50/70 dark:bg-night-surface/90 border border-aqua-200/50 dark:border-night-border text-xs">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-aqua-900 dark:text-aqua-300 min-w-[85px]">What is sent:</span>
              <span>Only your current reflection text and minimal relevant context.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-aqua-900 dark:text-aqua-300 min-w-[85px]">Data use:</span>
              <span>Your reflection is processed by an external AI service solely to generate a conversational response.</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-night-muted italic">
            You can decline anytime. If you choose to keep your entry local, your writing remains completely safe in your browser.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-aqua-100/70 dark:border-night-border/70">
          <button
            type="button"
            onClick={onDecline}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-night-text bg-white dark:bg-night-card border border-aqua-200/60 dark:border-night-border hover:bg-aqua-50 dark:hover:bg-night-surface transition-colors"
          >
            Keep Reflection Local Only
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg shadow-sm transition-all"
          >
            <span>Agree & Connect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
