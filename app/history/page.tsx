'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, Feather } from 'lucide-react';
import { JournalSession, getSessions } from '@/lib/storage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HistoryList } from '@/components/HistoryList';
import { SessionView } from '@/components/SessionView';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<JournalSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load sessions from local device storage on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = () => {
    try {
      const stored = getSessions();
      setSessions(stored);
      setIsLoaded(true);
    } catch (err) {
      console.error('Error loading history from local storage:', err);
      setSessions([]);
      setIsLoaded(true);
    }
  };

  const handleSessionDeleted = (deletedId: string) => {
    setSelectedSession(null);
    setSessions((prev) => prev.filter((s) => s.id !== deletedId));
  };

  const handleSessionsCleared = () => {
    setSelectedSession(null);
    setSessions([]);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 max-w-4xl mx-auto transition-colors duration-300">
      {/* Top Navigation Header matching MindMosaic layout */}
      <header className="relative flex items-center justify-between pb-6 border-b border-aqua-200/40 dark:border-night-border/50">
        {/* Left: Navigation links with z-10 for clickability */}
        <div className="flex items-center gap-1.5 z-10">
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-2.5 sm:px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Journal</span>
          </Link>
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors py-1.5 px-2.5 sm:px-3 rounded-lg hover:bg-white/60 dark:hover:bg-night-card border border-transparent hover:border-aqua-200/40 dark:hover:border-night-border"
          >
            <span>Home</span>
          </Link>
        </div>

        {/* Center: Combined MindMosaic + History group centered relative to the viewport */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <span className="font-serif font-bold text-base sm:text-lg text-slate-900 dark:text-white whitespace-nowrap">
            MindMosaic
          </span>
          <span className="text-xs text-aqua-700 dark:text-aqua-300 font-medium px-2 py-0.5 rounded-full bg-aqua-100/60 dark:bg-night-surface whitespace-nowrap">
            History
          </span>
        </div>

        {/* Right: Theme Toggle with z-10 */}
        <div className="flex items-center gap-2 z-10">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="my-auto py-6 sm:py-10">
        {!isLoaded ? (
          <div className="py-20 text-center text-xs text-slate-400 dark:text-night-muted">
            Loading your local reflection history...
          </div>
        ) : selectedSession ? (
          <SessionView
            session={selectedSession}
            onBack={() => setSelectedSession(null)}
            onDeleted={handleSessionDeleted}
          />
        ) : (
          <HistoryList
            sessions={sessions}
            onSelectSession={(s) => setSelectedSession(s)}
            onSessionsCleared={handleSessionsCleared}
          />
        )}
      </main>

      {/* Footer Disclaimer */}
      <footer className="pt-6 pb-2 text-center text-xs text-slate-400 dark:text-night-muted border-t border-aqua-100/40 dark:border-night-border/40">
        <p>MindMosaic • All journal reflections are stored 100% on this device in local memory.</p>
      </footer>
    </div>
  );
}

