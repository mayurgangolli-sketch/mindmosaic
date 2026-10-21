'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Shield,
  X,
  AlertTriangle,
  Trash2,
  CheckCircle2,
  Info,
  Lock,
  Layers,
  Database,
  BarChart2,
  RotateCcw,
  Tag,
} from 'lucide-react';
import {
  MemoryRecord,
  MemorySettings,
  ThemeTrackingSettings,
  getMemorySettings,
  saveMemorySettings,
  getThemeTrackingSettings,
  saveThemeTrackingSettings,
  getMemories,
  deleteMemory,
  clearAllMemories,
  formatSessionDate,
} from '@/lib/storage';

function formatMemoryCategory(cat?: string): string {
  switch (cat) {
    case 'coping_strategy':
      return 'Coping Strategy';
    case 'user_preference':
      return 'Preference';
    case 'lifestyle_fact':
      return 'Lifestyle Fact';
    case 'inferred_observation':
      return 'Inferred Pattern';
    default:
      return 'Memory Note';
  }
}

interface MemorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: (settings: MemorySettings) => void;
  onThemeSettingsChanged?: (settings: ThemeTrackingSettings) => void;
}

export function MemorySettingsModal({
  isOpen,
  onClose,
  onSettingsChanged,
  onThemeSettingsChanged,
}: MemorySettingsModalProps) {
  // Committed memory settings from localStorage
  const [committedSettings, setCommittedSettings] = useState<MemorySettings>(getMemorySettings());
  // Draft memory toggle: committed only on "Done"
  const [pendingEnabled, setPendingEnabled] = useState<boolean>(false);

  // Committed theme tracking settings from localStorage
  const [committedThemeSettings, setCommittedThemeSettings] = useState<ThemeTrackingSettings>(
    getThemeTrackingSettings()
  );
  // Draft theme tracking toggle: committed only on "Done"
  const [pendingThemeEnabled, setPendingThemeEnabled] = useState<boolean>(false);

  const [memoryCount, setMemoryCount] = useState<number>(0);
  const [storedMemories, setStoredMemories] = useState<MemoryRecord[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showResetThemeConfirm, setShowResetThemeConfirm] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync draft states from committed localStorage values whenever modal opens
  useEffect(() => {
    if (isOpen) {
      const currentMem = getMemorySettings();
      setCommittedSettings(currentMem);
      setPendingEnabled(currentMem.enabled);

      const currentTheme = getThemeTrackingSettings();
      setCommittedThemeSettings(currentTheme);
      setPendingThemeEnabled(currentTheme.enabled);

      const mems = getMemories();
      setStoredMemories(mems);
      setMemoryCount(mems.length);
      setShowClearConfirm(false);
      setShowResetThemeConfirm(false);
      setStatusMessage(null);
      setSaveError(null);
    }
  }, [isOpen]);

  // Handle Escape key: cancels draft changes and closes without saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Toggle draft memory state
  const handleToggle = () => {
    setPendingEnabled((prev) => !prev);
    setSaveError(null);
  };

  // Toggle draft theme tracking state
  const handleThemeToggle = () => {
    setPendingThemeEnabled((prev) => !prev);
    setSaveError(null);
  };

  // Commit draft settings only when clicking "Done"
  const handleDone = () => {
    let hasError = false;

    // 1. Commit persistent memory if draft changed
    if (pendingEnabled !== committedSettings.enabled) {
      const resMem = saveMemorySettings({ enabled: pendingEnabled });
      if (resMem.success) {
        setCommittedSettings(resMem.settings);
        if (onSettingsChanged) onSettingsChanged(resMem.settings);
      } else {
        hasError = true;
        setSaveError(resMem.error || 'Could not save memory settings to device storage.');
      }
    }

    // 2. Commit theme tracking if draft changed
    if (pendingThemeEnabled !== committedThemeSettings.enabled) {
      const resTheme = saveThemeTrackingSettings({ enabled: pendingThemeEnabled });
      if (resTheme.success) {
        setCommittedThemeSettings(resTheme.settings);
        if (onThemeSettingsChanged) onThemeSettingsChanged(resTheme.settings);
      } else {
        hasError = true;
        setSaveError(resTheme.error || 'Could not save theme tracking settings to device storage.');
      }
    }

    if (!hasError) {
      onClose();
    }
  };

  // Delete a single memory record by ID immediately (preserves settings, sessions, and remaining memories)
  const handleDeleteSingleMemory = (memoryId: string) => {
    const success = deleteMemory(memoryId);
    if (success) {
      const updated = getMemories();
      setStoredMemories(updated);
      setMemoryCount(updated.length);
      setStatusMessage('Memory record removed from this device.');
      setSaveError(null);
    } else {
      setSaveError('Could not delete memory record. Please try again.');
    }
  };

  // Immediate deletion of all memory records with confirmation (preserves settings & sessions)
  const handleClearMemories = () => {
    const success = clearAllMemories();
    if (success) {
      setStoredMemories([]);
      setMemoryCount(0);
      setShowClearConfirm(false);
      setStatusMessage(
        'All stored memory records were permanently removed. Your settings and journal sessions remain intact.'
      );
    } else {
      setSaveError('Could not clear memory records. Please try again.');
    }
  };

  // Reset theme tracking history cutoff (preserves reflections & memories)
  const handleResetThemeHistory = () => {
    const now = new Date().toISOString();
    const res = saveThemeTrackingSettings({ resetAt: now });
    if (res.success) {
      setCommittedThemeSettings(res.settings);
      setShowResetThemeConfirm(false);
      setStatusMessage(
        'Theme tracking history has been reset. Reflections prior to this moment are excluded from themes. Your journal entries and saved memories remain untouched.'
      );
      if (onThemeSettingsChanged) onThemeSettingsChanged(res.settings);
    } else {
      setSaveError('Could not reset tracking history. Please try again.');
    }
  };

  const hasDraftChanges =
    pendingEnabled !== committedSettings.enabled ||
    pendingThemeEnabled !== committedThemeSettings.enabled;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-settings-title"
      onClick={(e) => {
        // Backdrop click cancels draft changes and closes without saving
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="glass-card-layered w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-aqua-200/80 dark:border-night-border transition-all max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-aqua-100/70 dark:border-night-border/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aqua-100 dark:bg-night-card flex items-center justify-center text-aqua-700 dark:text-mint-400 shadow-sm">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 id="memory-settings-title" className="text-base sm:text-lg font-serif font-bold text-slate-900 dark:text-white">
                Companion Memory & Privacy Settings
              </h3>
              <p className="text-xs text-slate-500 dark:text-night-muted">
                Control cross-session context, theme tracking, and device storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
            aria-label="Discard changes and close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {saveError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Status Toast */}
        {statusMessage && (
          <div className="mt-4 p-3 rounded-xl bg-aqua-50 dark:bg-night-card border border-aqua-200/60 dark:border-night-border text-xs text-aqua-900 dark:text-aqua-300 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-aqua-600 dark:text-aqua-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Section 1: Persistent Memory Toggle (Draft State) */}
        <div className="my-5 p-5 rounded-2xl bg-aqua-50/50 dark:bg-night-surface/90 border border-aqua-200/60 dark:border-night-border space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                  Persistent Memory
                </span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    pendingEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-night-card text-slate-600 dark:text-night-muted border-slate-300 dark:border-night-border'
                  }`}
                >
                  {pendingEnabled ? 'Active' : 'Off'}
                </span>
                {pendingEnabled !== committedSettings.enabled && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                    (Pending save)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-night-muted mt-1">
                {pendingEnabled
                  ? 'The companion can remember useful coping habits and preferences you share.'
                  : 'Memory is completely off. MindMosaic treats every session independently.'}
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={handleToggle}
              role="switch"
              aria-checked={pendingEnabled}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 ${
                pendingEnabled ? 'bg-aqua-600 dark:bg-aqua-500' : 'bg-slate-300 dark:bg-night-card'
              }`}
            >
              <span className="sr-only">Toggle persistent memory</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  pendingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {committedSettings.consentGivenAt && (
            <p className="text-[11px] text-slate-400 dark:text-night-muted pt-1 border-t border-aqua-100/50 dark:border-night-border/40">
              First enabled: {formatSessionDate(committedSettings.consentGivenAt).full}
            </p>
          )}
        </div>

        {/* Section 2: Reflection Themes Tracker Controls (Draft State) */}
        <div className="my-5 p-5 rounded-2xl bg-aqua-50/50 dark:bg-night-surface/90 border border-aqua-200/60 dark:border-night-border space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-aqua-600 dark:text-aqua-400" />
                  <span>Reflection Themes Tracker</span>
                </span>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                    pendingThemeEnabled
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-night-card text-slate-600 dark:text-night-muted border-slate-300 dark:border-night-border'
                  }`}
                >
                  {pendingThemeEnabled ? 'Active' : 'Off'}
                </span>
                {pendingThemeEnabled !== committedThemeSettings.enabled && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                    (Pending save)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-night-muted mt-1 leading-relaxed">
                Notice recurring topics (stress, sleep, focus) across your reflections over time.
              </p>
            </div>

            {/* Theme Toggle Switch */}
            <button
              type="button"
              onClick={handleThemeToggle}
              role="switch"
              aria-checked={pendingThemeEnabled}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-500 ${
                pendingThemeEnabled ? 'bg-aqua-600 dark:bg-aqua-500' : 'bg-slate-300 dark:bg-night-card'
              }`}
            >
              <span className="sr-only">Toggle reflection themes tracker</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  pendingThemeEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="pt-2 border-t border-aqua-100/50 dark:border-night-border/40 text-[11px] text-slate-500 dark:text-night-muted space-y-1.5 leading-relaxed">
            <p>
              • <strong>On-Device Processing:</strong> Enabling this processes your saved reflections 100% locally on this device. Zero AI tokens, zero network requests, $0 budget.
            </p>
            <p>
              • <strong>Disabling Behavior:</strong> Turning this off stops future theme analysis, but does not delete journal entries or reset past tracking history.
            </p>
            {committedThemeSettings.resetAt && (
              <p className="text-teal-700 dark:text-teal-400 font-medium">
                • Active history cutoff: {formatSessionDate(committedThemeSettings.resetAt).full} (prior reflections are excluded from theme counts).
              </p>
            )}
          </div>

          {/* Reset Tracking History Button & Confirmation */}
          <div className="pt-2">
            {!showResetThemeConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetThemeConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-white/80 dark:bg-night-card hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-night-border text-slate-700 dark:text-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset Tracking History</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
                <p className="font-semibold">Reset theme tracking cutoff date?</p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  This sets a new cutoff timestamp. Future theme summaries will ignore reflections created on or before this moment. Your actual journal reflections and saved memories are NOT deleted.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
                  <button
                    type="button"
                    onClick={() => setShowResetThemeConfirm(false)}
                    className="px-3 py-1 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetThemeHistory}
                    className="px-3.5 py-1 rounded-md text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  >
                    Confirm Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Educational Privacy Principles */}
        <div className="space-y-3 text-xs text-slate-600 dark:text-night-muted leading-relaxed">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-aqua-600 dark:text-aqua-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-night-text">Distinct Permissions:</strong> AI chat consent, persistent memory, and theme tracking are three separate permissions. Enabling one never silently activates the others.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Layers className="w-4 h-4 text-aqua-600 dark:text-aqua-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-night-text">Context Notice:</strong> When both AI Conversation Consent and Persistent Memory are enabled, up to three concise saved memory summaries relevant to the current reflection may be sent to the external AI service as background context. If either permission is inactive, no saved memory summaries are selected or sent.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-aqua-600 dark:text-aqua-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-night-text">Local Storage Notice:</strong> Memories and themes are stored 100% on this device in your browser&apos;s local storage ($0 cost, zero cloud databases). Please note that browser local storage is <em>not encrypted by default</em> and will be erased if you clear your browser data or use a private browsing window.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-aqua-600 dark:text-aqua-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 dark:text-night-text">No Clinical Labels:</strong> MindMosaic is an empathetic journaling companion, not a therapist. It never assigns diagnostic labels, depression scores, or clinical tags.
            </div>
          </div>
        </div>

        {/* Manage Stored Memories Section (Discoverable) */}
        <div className="mt-6 pt-5 border-t border-aqua-100/70 dark:border-night-border/70 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-aqua-600 dark:text-aqua-400" />
              <span>Manage Stored Memories</span>
            </h4>
            <span className="text-xs text-slate-500 dark:text-night-muted">
              <strong className="font-semibold text-slate-800 dark:text-night-text">{memoryCount}</strong> {memoryCount === 1 ? 'memory' : 'memories'} stored
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-night-muted">
            {memoryCount === 0
              ? 'There are currently no saved memories on this device.'
              : 'You can inspect each remembered item below, delete specific memories individually, or clear all memories without deleting your journal reflections.'}
          </p>

          {/* Stored Memories List */}
          {storedMemories.length > 0 && (
            <div
              className="space-y-2 max-h-64 overflow-y-auto pr-1"
              role="list"
              aria-label="Stored memory records"
            >
              {storedMemories.map((mem) => {
                const isAiInferred = mem.provenance === 'ai_inferred';
                const dateDisplay = mem.createdAt ? formatSessionDate(mem.createdAt).full : 'Saved on device';

                return (
                  <div
                    key={mem.id}
                    role="listitem"
                    className="p-3 rounded-xl bg-white/70 dark:bg-night-card border border-aqua-200/50 dark:border-night-border flex items-start justify-between gap-3 text-xs shadow-xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badges: Provenance & Category */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                            isAiInferred
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800'
                              : 'bg-aqua-100 text-aqua-800 dark:bg-aqua-950/60 dark:text-aqua-300 border border-aqua-300/60 dark:border-aqua-800'
                          }`}
                        >
                          {isAiInferred ? 'AI Inferred' : 'User Stated'}
                        </span>

                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-night-surface text-slate-700 dark:text-night-muted border border-slate-200 dark:border-night-border font-medium">
                          {formatMemoryCategory(mem.category)}
                        </span>

                        <span className="text-[10px] text-slate-400 dark:text-night-muted ml-auto">
                          {dateDisplay}
                        </span>
                      </div>

                      {/* Memory Summary */}
                      <p className="text-slate-800 dark:text-night-text font-medium text-xs leading-relaxed break-words">
                        &ldquo;{mem.summary}&rdquo;
                      </p>

                      {/* Tags if present */}
                      {mem.tags && mem.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5" aria-label="Tags">
                          {mem.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-night-surface text-slate-500 dark:text-night-muted"
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Individual Delete Action */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSingleMemory(mem.id)}
                      aria-label={`Delete memory: ${mem.summary}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:text-night-muted dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                      title="Delete this memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              disabled={memoryCount === 0}
              aria-label="Clear all stored memory records"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors border shadow-sm disabled:opacity-40 disabled:cursor-not-allowed bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Memories</span>
            </button>
          ) : (
            /* Confirmation card */
            <div className="p-4 rounded-2xl bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-900 dark:text-rose-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-950 dark:text-rose-100">Permanently delete all {memoryCount} stored memory records?</p>
                  <p className="text-xs text-rose-800 dark:text-rose-300 mt-0.5">
                    Your journal reflections, AI chat consent, and memory settings will remain safe. Only cross-session memory snippets will be erased.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-800/40">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-700 dark:text-night-muted hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearMemories}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-sm transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Cancel & Done Actions */}
        <div className="mt-6 pt-4 flex items-center justify-between border-t border-aqua-100/70 dark:border-night-border/70">
          <div>
            {hasDraftChanges && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Unsaved changes pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 dark:text-night-muted hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white bg-aqua-700 hover:bg-aqua-800 dark:bg-aqua-500 dark:hover:bg-aqua-400 dark:text-night-bg shadow-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
