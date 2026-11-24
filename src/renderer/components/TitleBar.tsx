import React from 'react';
import { FileCode2, GitFork, Minus, Network, Plus, Square, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n';
import { getTemplateById } from '@shared/mermaid/templates';

export const TitleBar: React.FC = () => {
  const tabs = useAppStore((s) => s.tabs);
  const activeTabId = useAppStore((s) => s.activeTabId);
  const lang = useAppStore((s) => s.lang);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const closeTab = useAppStore((s) => s.closeTab);
  const addNewTab = useAppStore((s) => s.addNewTab);

  const dict = getDict(lang);
  const platform = window.mermindAPI?.platform ?? 'web';
  const isMac = platform === 'darwin';
  const isWinOrLinuxDesktop = Boolean(window.mermindAPI) && !isMac;

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
