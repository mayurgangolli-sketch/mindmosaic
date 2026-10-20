'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('system');

  // Initialize theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('mindmosaic_theme') as ThemeMode | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setTheme(stored);
      }
    } catch {
      // localStorage may fail in restricted environments
    }
  }, []);

  // Apply theme to DOM and respond to system preference changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (mode: ThemeMode) => {
      let isDark = false;
      if (mode === 'dark') {
        isDark = true;
      } else if (mode === 'light') {
        isDark = false;
      } else {
        isDark = mediaQuery.matches;
      }

      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);

    // Save to localStorage
    try {
      localStorage.setItem('mindmosaic_theme', theme);
    } catch (e) {
      console.warn('Could not save theme preference:', e);
    }

    // Dynamic listener for OS changes when in system mode
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, mounted]);

  // Prevent hydration mismatch by rendering placeholder until mounted
  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 bg-aqua-100/40 dark:bg-night-surface rounded-xl border border-aqua-200/40 dark:border-night-border w-28 h-8 animate-pulse" />
    );
  }

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light mode', icon: <Sun className="w-3.5 h-3.5" /> },
    { mode: 'system', label: 'System theme', icon: <Monitor className="w-3.5 h-3.5" /> },
    { mode: 'dark', label: 'Dark mode', icon: <Moon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className="inline-flex items-center gap-1 p-1 bg-white/80 dark:bg-night-surface/90 rounded-xl border border-aqua-200/60 dark:border-night-border shadow-sm transition-colors duration-200"
    >
      {options.map(({ mode, label, icon }) => {
        const isActive = theme === mode;
        return (
          <button
            key={mode}
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            title={label}
            onClick={() => setTheme(mode)}
            className={`flex items-center justify-center p-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              isActive
                ? 'bg-aqua-600 dark:bg-aqua-500 text-white dark:text-night-bg shadow-sm'
                : 'text-slate-500 dark:text-night-muted hover:text-slate-900 dark:hover:text-white hover:bg-aqua-50 dark:hover:bg-night-card'
            }`}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
