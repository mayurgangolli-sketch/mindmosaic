'use client';

import React from 'react';
import { Phone, AlertTriangle, ExternalLink, HeartPulse, X } from 'lucide-react';

interface SafetyBannerProps {
  type?: 'crisis' | 'medical';
  onDismiss?: () => void;
}

export function SafetyBanner({ type = 'crisis', onDismiss }: SafetyBannerProps) {
  const isMedical = type === 'medical';

  return (
    <aside
      aria-label="Immediate Safety and Emergency Helplines"
      className="p-5 sm:p-6 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 shadow-sm space-y-4 animate-in fade-in duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-700 dark:text-rose-300 flex-shrink-0">
            {isMedical ? <HeartPulse className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-serif font-bold text-rose-950 dark:text-rose-100">
              {isMedical ? 'Immediate Medical Attention Recommended' : 'Support is Available Right Now'}
            </h3>
            <p className="text-xs text-rose-800/80 dark:text-rose-300">
              {isMedical
                ? 'Severe or sudden physical warning signs require immediate clinical evaluation.'
                : 'You do not have to carry this alone. Confidential, free help is available.'}
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-lg text-rose-600 dark:text-rose-300 hover:text-rose-900 dark:hover:text-white transition-colors"
            aria-label="Dismiss safety notice"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Verified Helplines Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-white/80 dark:bg-night-card border border-rose-200 dark:border-rose-900/40 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-950 dark:text-rose-200">
            <Phone className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            <span>National Emergency (India)</span>
          </div>
          <p className="text-slate-600 dark:text-night-muted">
            Call <strong className="text-rose-800 dark:text-rose-300">112</strong> (Medical, Police, Fire — 24/7)
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white/80 dark:bg-night-card border border-rose-200 dark:border-rose-900/40 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-950 dark:text-rose-200">
            <Phone className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            <span>Tele-MANAS (Govt of India)</span>
          </div>
          <p className="text-slate-600 dark:text-night-muted">
            Toll-Free: <strong className="text-rose-800 dark:text-rose-300">14416</strong> or <strong className="text-rose-800 dark:text-rose-300">1800-891-4416</strong> (24/7)
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white/80 dark:bg-night-card border border-rose-200 dark:border-rose-900/40 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-950 dark:text-rose-200">
            <Phone className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            <span>Vandrevala Foundation</span>
          </div>
          <p className="text-slate-600 dark:text-night-muted">
            Call / WhatsApp: <strong className="text-rose-800 dark:text-rose-300">+91 9999 666 555</strong> (24/7)
          </p>
        </div>

        <div className="p-3 rounded-xl bg-white/80 dark:bg-night-card border border-rose-200 dark:border-rose-900/40 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-rose-950 dark:text-rose-200">
            <ExternalLink className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
            <span>International Resources</span>
          </div>
          <p className="text-slate-600 dark:text-night-muted">
            Directory in 130+ countries:{' '}
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-800 dark:text-rose-300 underline font-medium hover:text-rose-950"
            >
              findahelpline.com
            </a>
          </p>
        </div>
      </div>

      {/* Mandatory Safety Notice / Non-Medical Disclaimer */}
      <p className="text-[11px] text-rose-900/70 dark:text-rose-400/80 leading-relaxed italic border-t border-rose-200/60 dark:border-rose-900/50 pt-2.5">
        Safety Notice: MindMosaic is a journaling companion, not a healthcare provider. Automated pattern detection cannot guarantee 100% comprehensive detection of emergencies and does not replace psychiatric or emergency medical evaluation.
      </p>
    </aside>
  );
}

