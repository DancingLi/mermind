import React from 'react';
import {
  ArrowDownToLine,
  FileCode2,
  GitFork,
  Loader2,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Square,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { fmt, getDict } from '../i18n';
import { getTemplateById } from '@shared/mermaid/templates';

export const TitleBar: React.FC = () => {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const lang = useAppStore((s) => s.lang);
  const updateState = useAppStore((s) => s.updateState);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const addNewTab = useAppStore((s) => s.addNewTab);
  const setUpdateModalOpen = useAppStore((s) => s.setUpdateModalOpen);

  const dict = getDict(lang);
  const platform = window.mermindAPI?.platform ?? 'web';
  const isMac = platform === 'darwin';
  const isWinOrLinuxDesktop = Boolean(window.mermindAPI) && !isMac;

  const showUpdatePill =
    updateState &&
    (updateState.status === 'available' ||
      updateState.status === 'downloading' ||
      updateState.status === 'downloaded');

  const handleNewBlankTab = () => {
    const blank = getTemplateById('mindmap-blank');
    addNewTab({ title: dict.tabs.untitledMindmap, code: blank.code[lang] });
  };

  return (
    <header
      className={[
        'app-drag flex h-10 shrink-0 items-center justify-between border-b border-[var(--mm-border)] bg-[var(--mm-surface)]',
        isMac ? 'pl-[78px] pr-3' : 'pl-3 pr-0',
      ].join(' ')}
    >
      {/* Brand + Multi-Tab Strip + Draggable Blank Area */}
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-teal-500 text-[11px] font-bold text-white shadow-sm">
            M
          </div>
          <span className="text-xs font-bold tracking-tight text-[var(--mm-text)]">Mermind</span>
        </div>

        <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
          {tabs.map((t) => {
            const active = t.id === activeTabId;
            const dirty = t.code !== t.savedCode;
            const Icon =
              t.detection.kind === 'mindmap'
                ? Network
                : t.detection.kind === 'flowchart'
                  ? GitFork
                  : FileCode2;
            return (
              <div
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={[
                  'app-no-drag group flex h-7 max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs transition',
                  active
                    ? 'border-[var(--mm-border)] bg-[var(--mm-bg)] font-medium text-[var(--mm-text)] shadow-xs'
                    : 'border-transparent text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)] hover:text-[var(--mm-text)]',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-75" />
                <span className="truncate">{t.title}</span>
                {dirty && (
                  <span
                    title={dict.statusBar.unsaved}
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  />
                )}
                <button
                  type="button"
                  title={dict.tabs.closeTab}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  className="ml-0.5 rounded p-0.5 opacity-0 transition hover:bg-[var(--mm-surface-muted)] group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleNewBlankTab}
            title={dict.tabs.newTab}
            className="app-no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--mm-text-muted)] transition hover:bg-[var(--mm-surface-muted)] hover:text-[var(--mm-text)]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dedicated draggable blank region on the right of the tab bar */}
        <div className="app-drag h-full min-w-[48px] flex-1" />
      </div>

      {/* Subtle in-app update status pill */}
      {showUpdatePill && updateState && (
        <button
          type="button"
          onClick={() => setUpdateModalOpen(true)}
          className={[
            'app-no-drag mr-2 inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition',
            updateState.status === 'downloaded'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-blue-600/12 text-blue-600 hover:bg-blue-600/20 dark:bg-sky-500/20 dark:text-sky-300',
          ].join(' ')}
        >
          {updateState.status === 'downloading' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : updateState.status === 'downloaded' ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <ArrowDownToLine className="h-3 w-3" />
          )}
          <span>
            {updateState.status === 'downloading'
              ? fmt(dict.updater.pillDownloading, { percent: updateState.percent ?? 0 })
              : updateState.status === 'downloaded'
                ? fmt(
                    updateState.mode === 'auto-win'
                      ? dict.updater.pillReadyWin
                      : dict.updater.pillReadyMac,
                    { version: updateState.latestVersion ?? '' },
                  )
                : fmt(dict.updater.pillAvailable, { version: updateState.latestVersion ?? '' })}
          </span>
        </button>
      )}

      {/* Windows / Linux Native Window Controls */}
      {isWinOrLinuxDesktop && (
        <div className="app-no-drag flex h-full shrink-0 items-center">
          <button
            type="button"
            onClick={() => window.mermindAPI?.windowControls.minimize()}
            className="flex h-full w-11 items-center justify-center text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.mermindAPI?.windowControls.maximizeToggle()}
            className="flex h-full w-11 items-center justify-center text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => window.mermindAPI?.windowControls.close()}
            className="flex h-full w-11 items-center justify-center text-[var(--mm-text-muted)] hover:bg-rose-600 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
