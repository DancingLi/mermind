import React, { useState } from 'react';
import type { Node } from '@xyflow/react';
import {
  Check,
  Copy,
  FileCode,
  FileImage,
  FileText,
  GitFork,
  Keyboard,
  ListTree,
  Network,
  Printer,
  X,
} from 'lucide-react';
import { DIAGRAM_TEMPLATES } from '@shared/mermaid/templates';
import { mindmapToMarkdownOutline } from '@shared/mermaid/mindmapOps';
import { wrapAsMarkdownBlock } from '@shared/mermaid/markdown';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { fmt, getDict } from '../i18n';
import { DIAGRAM_THEMES } from '../themes/themes';
import {
  savePdfExport,
  savePngExport,
  saveSvgExport,
  saveTextExport,
} from '../utils/export';

interface ExportModalProps {
  measuredNodes: Node[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ measuredNodes }) => {
  const open = useAppStore((s) => s.exportModalOpen);
  const setOpen = useAppStore((s) => s.setExportModalOpen);
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const diagramTheme = useAppStore((s) => s.diagramTheme);
  const showToast = useAppStore((s) => s.showToast);

  const [pngScale, setPngScale] = useState<number>(2);
  const [busy, setBusy] = useState<string | null>(null);
  const dict = getDict(lang);

  if (!open) return null;

  const baseName = tab.title.replace(/\.(mmd|mermaid|md)$/i, '') || 'mermind-diagram';
  const theme = DIAGRAM_THEMES[diagramTheme];
  const exportOpts = { backgroundColor: theme.canvasBg, scale: pngScale, nodes: measuredNodes };

  const runExport = async (key: string, fn: () => Promise<boolean>) => {
    try {
      setBusy(key);
      const ok = await fn();
      if (ok) {
        showToast(dict.exportModal.exportSuccess);
        setOpen(false);
      }
    } catch (err) {
      console.error(err);
      showToast(`${dict.exportModal.exportFailed}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast(dict.toolbar.copied);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--mm-text)]">
              {dict.exportModal.title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--mm-text-muted)]">
              {dict.exportModal.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* SVG */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--mm-border)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-600 dark:text-blue-400">
                <FileCode className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--mm-text)]">
                  {dict.exportModal.svg}
                </div>
                <div className="text-[11px] text-[var(--mm-text-muted)]">
                  {dict.exportModal.svgDesc}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('svg', () => saveSvgExport(baseName, exportOpts))}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy === 'svg' ? '...' : dict.exportModal.exportBtn}
            </button>
          </div>

          {/* PNG with scale */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--mm-border)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                <FileImage className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--mm-text)]">
                  {dict.exportModal.png}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[11px] text-[var(--mm-text-muted)]">
                    {dict.exportModal.scale}:
                  </span>
                  {[1, 2, 3].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPngScale(s)}
                      className={[
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        pngScale === s
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[var(--mm-surface-muted)] text-[var(--mm-text-muted)]',
                      ].join(' ')}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('png', () => savePngExport(baseName, exportOpts))}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === 'png' ? '...' : dict.exportModal.exportBtn}
            </button>
          </div>

          {/* PDF */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--mm-border)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/12 text-rose-600 dark:text-rose-400">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--mm-text)]">
                  {dict.exportModal.pdf}
                </div>
                <div className="text-[11px] text-[var(--mm-text-muted)]">
                  {dict.exportModal.pdfDesc}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => runExport('pdf', () => savePdfExport(baseName, exportOpts))}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {busy === 'pdf' ? '...' : dict.exportModal.exportBtn}
            </button>
          </div>

          {/* Markdown Outline (for Mindmap) */}
          {tab.detection.kind === 'mindmap' && tab.mindmapAst && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--mm-border)] p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-400">
                  <ListTree className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--mm-text)]">
                    {dict.exportModal.markdownOutline}
                  </div>
                  <div className="text-[11px] text-[var(--mm-text-muted)]">
                    {dict.exportModal.markdownOutlineDesc}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  runExport('md', () =>
                    saveTextExport(
                      `${baseName}.md`,
                      mindmapToMarkdownOutline(tab.mindmapAst!),
                      'md',
                      'Markdown Outline',
                    ),
                  )
                }
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy === 'md' ? '...' : dict.exportModal.exportBtn}
              </button>
            </div>
          )}

          {/* Quick clipboard copy buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => copyText(tab.code)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mm-border)] px-3 py-2 text-xs font-medium text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
            >
              <Copy className="h-3.5 w-3.5" />
              {dict.exportModal.copyMmd}
            </button>
            <button
              type="button"
              onClick={() => copyText(wrapAsMarkdownBlock(tab.code))}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--mm-border)] px-3 py-2 text-xs font-medium text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
            >
              <FileText className="h-3.5 w-3.5" />
              {dict.exportModal.copyMdBlock}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TemplateModal: React.FC = () => {
  const open = useAppStore((s) => s.templateModalOpen);
  const setOpen = useAppStore((s) => s.setTemplateModalOpen);
  const lang = useAppStore((s) => s.lang);
  const addNewTab = useAppStore((s) => s.addNewTab);
  const [filter, setFilter] = useState<'all' | 'mindmap' | 'flowchart' | 'other'>('all');
  const dict = getDict(lang);

  if (!open) return null;

  const list = DIAGRAM_TEMPLATES.filter((t) => filter === 'all' || t.kind === filter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--mm-text)]">
              {dict.templateModal.title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--mm-text-muted)]">
              {dict.templateModal.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-1.5">
          {(['all', 'mindmap', 'flowchart', 'other'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                filter === k
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--mm-surface-muted)] text-[var(--mm-text-muted)] hover:text-[var(--mm-text)]',
              ].join(' ')}
            >
              {dict.templateModal[k]}
            </button>
          ))}
        </div>

        <div className="grid max-h-[420px] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {list.map((tpl) => {
            const Icon =
              tpl.kind === 'mindmap' ? Network : tpl.kind === 'flowchart' ? GitFork : FileCode;
            return (
              <div
                key={tpl.id}
                onClick={() => {
                  addNewTab({ title: tpl.name[lang], code: tpl.code[lang] });
                  setOpen(false);
                }}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg)] p-3.5 transition hover:border-blue-500 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold text-[var(--mm-text)]">
                      {tpl.name[lang]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--mm-text-muted)]">
                    {tpl.description[lang]}
                  </p>
                  <pre className="mt-2.5 max-h-24 overflow-hidden rounded-lg border border-[var(--mm-border)] bg-[var(--mm-surface)] p-2 font-mono text-[10px] leading-relaxed text-[var(--mm-text-muted)]">
                    {tpl.code[lang].split('\n').slice(0, 6).join('\n')}
                  </pre>
                </div>
                <div className="mt-2.5 text-right text-[11px] font-medium text-blue-600 opacity-80 group-hover:opacity-100 dark:text-blue-400">
                  {dict.templateModal.useTemplate} →
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ShortcutsModal: React.FC = () => {
  const open = useAppStore((s) => s.shortcutsModalOpen);
  const setOpen = useAppStore((s) => s.setShortcutsModalOpen);
  const lang = useAppStore((s) => s.lang);
  const dict = getDict(lang);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-500" />
            <h2 className="text-base font-semibold text-[var(--mm-text)]">
              {dict.shortcutsModal.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-[var(--mm-border)] text-xs">
          {dict.shortcutsModal.items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4 py-2">
              <span className="text-[var(--mm-text)]">{item.desc}</span>
              <kbd className="shrink-0 rounded-md border border-[var(--mm-border)] bg-[var(--mm-surface-muted)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--mm-text)]">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MarkdownPickerModal: React.FC = () => {
  const candidate = useAppStore((s) => s.markdownImportCandidate);
  const setCandidate = useAppStore((s) => s.setMarkdownImportCandidate);
  const lang = useAppStore((s) => s.lang);
  const addNewTab = useAppStore((s) => s.addNewTab);
  const dict = getDict(lang);

  if (!candidate) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      onClick={() => setCandidate(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--mm-text)]">
              {dict.markdownPicker.title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--mm-text-muted)]">
              {fmt(dict.markdownPicker.desc, { count: candidate.blocks.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCandidate(null)}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-72 space-y-2.5 overflow-y-auto">
          {candidate.blocks.map((block, idx) => (
            <div
              key={idx}
              onClick={() => {
                addNewTab({
                  title: `${candidate.name.replace(/\.md$/i, '')}-${idx + 1}.mmd`,
                  code: block,
                  markUnsaved: true,
                });
                setCandidate(null);
              }}
              className="cursor-pointer rounded-xl border border-[var(--mm-border)] bg-[var(--mm-bg)] p-3 hover:border-blue-500"
            >
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--mm-text)]">
                <span>{fmt(dict.markdownPicker.blockLabel, { index: idx + 1 })}</span>
                <Check className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <pre className="max-h-24 overflow-hidden font-mono text-[11px] text-[var(--mm-text-muted)]">
                {block.split('\n').slice(0, 5).join('\n')}
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              candidate.blocks.forEach((block, idx) => {
                addNewTab({
                  title: `${candidate.name.replace(/\.md$/i, '')}-${idx + 1}.mmd`,
                  code: block,
                  markUnsaved: true,
                });
              });
              setCandidate(null);
            }}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            {dict.markdownPicker.openAll}
          </button>
        </div>
      </div>
    </div>
  );
};
