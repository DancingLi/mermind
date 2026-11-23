import React from 'react';
import { countMindmapNodes } from '@shared/mermaid/mindmapOps';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { fmt, getDict } from '../i18n';

export const StatusBar: React.FC = () => {
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const dict = getDict(lang);

  const dirty = tab.code !== tab.savedCode;
  const kind = tab.detection.kind;

  let statsText = '';
  let tipText = '';

  if (kind === 'mindmap' && tab.mindmapAst) {
    statsText = fmt(dict.statusBar.nodes, { count: countMindmapNodes(tab.mindmapAst.root) });
    tipText = dict.statusBar.dragTipMindmap;
  } else if (kind === 'flowchart' && tab.flowchartAst) {
    const pinned = tab.flowchartAst.nodes.filter((n) => Boolean(n.manualPosition)).length;
    statsText = `${fmt(dict.statusBar.nodes, { count: tab.flowchartAst.nodes.length })} · ${fmt(
      dict.statusBar.edges,
      { count: tab.flowchartAst.edges.length },
    )}${pinned > 0 ? ` · ${fmt(dict.statusBar.manualPinned, { count: pinned })}` : ''}`;
    tipText = dict.statusBar.dragTipFlowchart;
  } else {
    statsText = tab.detection.rawType;
  }

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[var(--mm-border)] bg-[var(--mm-surface)] px-3 text-[11px] text-[var(--mm-text-muted)]">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 font-medium text-[var(--mm-text)]">
          <span
            className={[
              'h-2 w-2 rounded-full',
              kind === 'mindmap'
                ? 'bg-emerald-500'
                : kind === 'flowchart'
                  ? 'bg-blue-500'
                  : 'bg-violet-500',
            ].join(' ')}
          />
          {kind === 'mindmap'
            ? dict.statusBar.mindmap
            : kind === 'flowchart'
              ? dict.statusBar.flowchart
              : `${dict.statusBar.other} (${tab.detection.rawType})`}
        </span>
        <span>{statsText}</span>
      </div>

      {tipText && <span className="hidden truncate px-4 lg:inline">{tipText}</span>}

      <div className="flex items-center gap-3">
        {tab.filePath && (
          <span className="hidden max-w-[260px] truncate font-mono text-[10px] md:inline">
            {tab.filePath}
          </span>
        )}
        <span className={dirty ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
          {dirty ? dict.statusBar.unsaved : dict.statusBar.saved}
        </span>
      </div>
    </footer>
  );
};
