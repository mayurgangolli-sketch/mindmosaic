'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, Clock, Lock, BookOpen, Feather } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export function WelcomeScreen() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 max-w-5xl mx-auto transition-colors duration-300">
      {/* Top navigation bar */}
      <header className="flex items-center justify-between py-3 sm:py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-aqua-600 to-mint-400 dark:from-aqua-500 dark:to-mint-400 flex items-center justify-center text-white dark:text-night-bg shadow-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                MindMosaic
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-aqua-100/70 dark:bg-night-surface text-aqua-900 dark:text-aqua-300 border border-aqua-200/60 dark:border-night-border">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                On-Device Journal
              </span>
            </div>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main hero composition: intimate, editorial, and inviting */}
      <main className="my-auto py-8 sm:py-14 flex flex-col items-center">
        {/* Intimate Context Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-white/90 dark:bg-night-surface text-aqua-800 dark:text-aqua-300 border border-aqua-200/70 dark:border-night-border shadow-sm mb-6">
          <Lock className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
          <span>Private on this browser • No accounts needed</span>
        </div>

        {/* Evocative Headline */}
        <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl font-normal tracking-tight text-center text-slate-900 dark:text-white max-w-2xl leading-[1.16]">
          A quiet space to write, breathe, and untangle your day.
        </h1>

        {/* Thoughtful Narrative Lead */}
        <p className="mt-5 text-base sm:text-lg text-center text-slate-600 dark:text-night-muted max-w-xl leading-relaxed">
          No public feeds. No algorithms. No accounts. An open, distraction-free journal on your own device for academic stress, workplace pressure, and quiet thoughts.
        </p>

        {/* Primary Action Button */}
        <div className="mt-8 sm:mt-10 flex flex-col items-center gap-2.5 w-full sm:w-auto">
          <Link
            href="/journal"
            className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto px-8 py-4 rounded-xl text-base font-medium text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg shadow-md hover:shadow-lg transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-aqua-600 dark:focus-visible:ring-aqua-400 active:scale-[0.99]"
          >
            <Feather className="w-4 h-4" />
            <span>Open Your Journal</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </Link>
          <span className="text-xs text-slate-400 dark:text-night-muted">
            Free forever • Stored 100% on this device
          </span>
        </div>

        {/* Centerpiece: Layered Journal Folio Preview */}
        <div className="mt-12 sm:mt-16 w-full max-w-md relative select-none">
          {/* Back tilted card providing tactile layered depth */}
          <div className="absolute inset-0 transform rotate-[-2deg] rounded-2xl bg-gradient-to-br from-aqua-100 to-mint-100 dark:from-night-surface dark:to-night-card border border-aqua-200/50 dark:border-night-border shadow-sm -z-10 translate-y-2 opacity-85" />

          {/* Front interactive journal sheet */}
          <Link
            href="/journal"
            className="block journal-sheet rounded-2xl p-5 sm:p-6 hover:border-aqua-400 dark:hover:border-mint-400/60 transition-all duration-200 group cursor-pointer"
          >
            <div className="flex items-center justify-between pb-3 border-b border-aqua-100 dark:border-night-border/70">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-aqua-500 dark:bg-mint-400" />
                <span className="text-xs font-semibold tracking-wider text-slate-700 dark:text-slate-200 uppercase">
                  Evening Reflection
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-night-muted">
                <Clock className="w-3.5 h-3.5 text-aqua-600 dark:text-mint-400" />
                <span>Today</span>
              </div>
            </div>

            <p className="mt-4 font-serif text-slate-800 dark:text-night-text text-base sm:text-lg leading-relaxed italic">
              "The exam preparation felt endless today, but writing things down before the night ends always makes tomorrow feel a little lighter."
            </p>

            <div className="mt-5 pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-night-muted border-t border-aqua-100/60 dark:border-night-border/40">
              <span className="inline-flex items-center gap-1 text-aqua-700 dark:text-aqua-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Private on this device
              </span>
              <span className="group-hover:text-aqua-600 dark:group-hover:text-mint-400 font-medium flex items-center gap-1 transition-colors">
                Write yours <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </Link>
        </div>

        {/* Dignified Journal Principles (Craft, not generic SaaS badges) */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl text-left">
          <div className="glass-surface p-5 rounded-2xl border border-aqua-200/40 dark:border-night-border transition-colors hover:border-aqua-300 dark:hover:border-night-border">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-aqua-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Private by Architecture
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-night-muted leading-relaxed">
              Your writing lives exclusively in your browser's local memory. No mandatory logins, remote profiles, or cloud databases.
            </p>
          </div>

          <div className="glass-surface p-5 rounded-2xl border border-aqua-200/40 dark:border-night-border transition-colors hover:border-aqua-300 dark:hover:border-night-border">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-aqua-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Distraction-Free Focus
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-night-muted leading-relaxed">
              Generous line spacing, clean typography, and zero notification clutter. Works effortlessly on ordinary mobile phones and laptops.
            </p>
          </div>
        </div>
      </main>

      {/* Footer with honest scope note */}
      <footer className="py-4 text-center text-xs text-slate-500 dark:text-night-muted border-t border-aqua-200/40 dark:border-night-border/40 mt-8">
        <p>MindMosaic supports personal reflection. It does not provide medical evaluation or clinical mental health treatment.</p>
      </footer>
    </div>
  );
}
