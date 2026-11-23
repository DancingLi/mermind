import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  GitBranch,
  MoveUpLeft,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  FlowchartEdgeStyle,
  FlowchartShape,
  MindmapShape,
  NodeVisualStyle,
} from '@shared/types';
import {
  addMindmapChild,
  addMindmapSibling,
  deleteMindmapNode,
  findMindmapNode,
  moveMindmapNodeOrder,
  promoteMindmapNode,
  updateMindmapNodeLabel,
  updateMindmapNodeShape,
  updateMindmapNodeStyle,
} from '@shared/mermaid/mindmapOps';
import { serializeMindmap } from '@shared/mermaid/mindmapSerializer';
import {
  addFlowchartDownstreamNode,
  addFlowchartSiblingNode,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  deleteFlowchartSubgraph,
  updateFlowchartEdge,
  updateFlowchartNode,
  updateFlowchartSubgraph,
} from '@shared/mermaid/flowchartOps';
import { serializeFlowchart } from '@shared/mermaid/flowchartSerializer';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n';
import { COLOR_SWATCHES } from '../themes/themes';

const MINDMAP_SHAPES: MindmapShape[] = [
  'default',
  'rounded',
  'square',
  'circle',
  'hexagon',
  'cloud',
  'bang',
];

const FLOWCHART_SHAPES: FlowchartShape[] = [
  'rect',
  'rounded',
  'stadium',
  'diamond',
  'circle',
  'cylinder',
  'hexagon',
  'subroutine',
  'parallelogram',
];

const EDGE_STYLES: FlowchartEdgeStyle[] = [
  'arrow',
  'dotted-arrow',
  'thick-arrow',
  'bi-arrow',
  'line',
  'dotted-line',
  'thick-line',
];

export const InspectorPanel: React.FC = () => {
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const viewMode = useAppStore((s) => s.viewMode);
  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const setSelection = useAppStore((s) => s.setSelection);
  const dict = getDict(lang);

  if (viewMode !== 'visual') return null;

  // 1. Mindmap Node Inspector
  if (tab.detection.kind === 'mindmap' && tab.mindmapAst && tab.selectedNodeId) {
    const ast = tab.mindmapAst;
    const found = findMindmapNode(ast.root, tab.selectedNodeId);
    if (!found) return null;
    const node = found.node;
    const isRoot = !found.parent;

    const applyStyle = (style: NodeVisualStyle | undefined) => {
      const next = updateMindmapNodeStyle(ast, node.uid, style);
      updateActiveCode(serializeMindmap(next), { selectNodeId: node.uid });
    };

    return (
      <div className="absolute right-4 top-4 z-20 w-[264px] rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mm-text-muted)]">
            {dict.inspector.nodeTitle}
          </span>
          <button
            type="button"
            onClick={() => setSelection({})}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)] hover:text-[var(--mm-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Label */}
          <div>
            <label className="mb-1 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.label}
            </label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => {
                const next = updateMindmapNodeLabel(ast, node.uid, e.target.value);
                updateActiveCode(serializeMindmap(next), {
                  pushHistory: false,
                  selectNodeId: node.uid,
                });
              }}
              className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-2.5 py-1.5 text-xs text-[var(--mm-text)] outline-none focus:border-sky-500"
            />
          </div>

          {/* Shape */}
          <div>
            <label className="mb-1.5 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.shape}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {MINDMAP_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const next = updateMindmapNodeShape(ast, node.uid, s);
                    updateActiveCode(serializeMindmap(next), { selectNodeId: node.uid });
                  }}
                  className={[
                    'rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition',
                    node.shape === s
                      ? 'border-sky-500 bg-sky-500/12 text-sky-600 dark:text-sky-300'
                      : 'border-[var(--mm-border)] text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]',
                  ].join(' ')}
                >
                  {dict.inspector.shapes[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-medium text-[var(--mm-text-muted)]">
                {dict.inspector.colors}
              </label>
              {node.style && (
                <button
                  type="button"
                  onClick={() => applyStyle(undefined)}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline dark:text-sky-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  {dict.inspector.resetStyle}
                </button>
              )}
            </div>
            <div className="mb-2 grid grid-cols-8 gap-1.5">
              {COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.name}
                  type="button"
                  title={sw.name}
                  onClick={() =>
                    applyStyle({ fill: sw.fill, stroke: sw.stroke, color: sw.color })
                  }
                  style={{ backgroundColor: sw.fill, borderColor: sw.stroke }}
                  className="h-5 w-5 rounded-full border-2 transition hover:scale-110"
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.fill}</span>
                <input
                  type="color"
                  value={node.style?.fill ?? '#dbeafe'}
                  onChange={(e) => applyStyle({ ...node.style, fill: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.stroke}</span>
                <input
                  type="color"
                  value={node.style?.stroke ?? '#2563eb'}
                  onChange={(e) => applyStyle({ ...node.style, stroke: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.textColor}</span>
                <input
                  type="color"
                  value={node.style?.color ?? '#1e3a8a'}
                  onChange={(e) => applyStyle({ ...node.style, color: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-t border-[var(--mm-border)] pt-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const { ast: next, newNodeUid } = addMindmapChild(
                    ast,
                    node.uid,
                    lang === 'zh' ? '子主题' : 'Subtopic',
                  );
                  updateActiveCode(serializeMindmap(next), {
                    selectNodeId: newNodeUid,
                    editingNodeId: newNodeUid,
                  });
                }}
                className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 font-medium hover:bg-[var(--mm-surface-muted)]"
              >
                <CornerDownRight className="h-3.5 w-3.5" />
                {dict.inspector.addChild}
              </button>
              <button
                type="button"
                onClick={() => {
                  const { ast: next, newNodeUid } = addMindmapSibling(
                    ast,
                    node.uid,
                    lang === 'zh' ? '同级主题' : 'Topic',
                  );
                  updateActiveCode(serializeMindmap(next), {
                    selectNodeId: newNodeUid,
                    editingNodeId: newNodeUid,
                  });
                }}
                className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 font-medium hover:bg-[var(--mm-surface-muted)]"
              >
                <Plus className="h-3.5 w-3.5" />
                {dict.inspector.addSibling}
              </button>

              {!isRoot && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const next = moveMindmapNodeOrder(ast, node.uid, 'up');
                      if (next !== ast) updateActiveCode(serializeMindmap(next), { selectNodeId: node.uid });
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 hover:bg-[var(--mm-surface-muted)]"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                    {dict.inspector.moveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = moveMindmapNodeOrder(ast, node.uid, 'down');
                      if (next !== ast) updateActiveCode(serializeMindmap(next), { selectNodeId: node.uid });
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 hover:bg-[var(--mm-surface-muted)]"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    {dict.inspector.moveDown}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = promoteMindmapNode(ast, node.uid);
                      if (next !== ast) updateActiveCode(serializeMindmap(next), { selectNodeId: node.uid });
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 hover:bg-[var(--mm-surface-muted)]"
                  >
                    <MoveUpLeft className="h-3.5 w-3.5" />
                    {dict.inspector.promote}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const { ast: next, nextSelectUid } = deleteMindmapNode(ast, node.uid);
                      updateActiveCode(serializeMindmap(next), { selectNodeId: nextSelectUid });
                    }}
                    className="flex items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {dict.inspector.deleteNode}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Flowchart Node Inspector
  if (tab.detection.kind === 'flowchart' && tab.flowchartAst && tab.selectedNodeId) {
    const ast = tab.flowchartAst;
    const node = ast.nodes.find((n) => n.id === tab.selectedNodeId);
    if (!node) return null;

    const applyStyle = (style: NodeVisualStyle | undefined) => {
      const next = updateFlowchartNode(ast, node.id, { style });
      updateActiveCode(serializeFlowchart(next), { selectNodeId: node.id });
    };

    return (
      <div className="absolute right-4 top-4 z-20 max-h-[calc(100%-32px)] w-[272px] overflow-y-auto rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mm-text-muted)]">
            {dict.inspector.nodeTitle} · <code className="font-mono text-[11px]">{node.id}</code>
          </span>
          <button
            type="button"
            onClick={() => setSelection({})}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Label */}
          <div>
            <label className="mb-1 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.label}
            </label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => {
                const next = updateFlowchartNode(ast, node.id, { label: e.target.value });
                updateActiveCode(serializeFlowchart(next), {
                  pushHistory: false,
                  selectNodeId: node.id,
                });
              }}
              className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-2.5 py-1.5 text-xs text-[var(--mm-text)] outline-none focus:border-sky-500"
            />
          </div>

          {/* Shape */}
          <div>
            <label className="mb-1.5 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.shape}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FLOWCHART_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    const next = updateFlowchartNode(ast, node.id, { shape: s });
                    updateActiveCode(serializeFlowchart(next), { selectNodeId: node.id });
                  }}
                  className={[
                    'rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition',
                    node.shape === s
                      ? 'border-sky-500 bg-sky-500/12 text-sky-600 dark:text-sky-300'
                      : 'border-[var(--mm-border)] text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]',
                  ].join(' ')}
                >
                  {dict.inspector.shapes[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Subgraph Assignment */}
          {ast.subgraphs.length > 0 && (
            <div>
              <label className="mb-1 block font-medium text-[var(--mm-text-muted)]">
                {dict.inspector.subgraphAssign}
              </label>
              <select
                value={node.subgraphId ?? ''}
                onChange={(e) => {
                  const next = updateFlowchartNode(ast, node.id, {
                    subgraphId: e.target.value || undefined,
                  });
                  updateActiveCode(serializeFlowchart(next), { selectNodeId: node.id });
                }}
                className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-2.5 py-1.5 text-xs text-[var(--mm-text)] outline-none"
              >
                <option value="">{dict.inspector.noneSubgraph}</option>
                {ast.subgraphs.map((sg) => (
                  <option key={sg.id} value={sg.id}>
                    {sg.title} ({sg.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Colors */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-medium text-[var(--mm-text-muted)]">
                {dict.inspector.colors}
              </label>
              {node.style && (
                <button
                  type="button"
                  onClick={() => applyStyle(undefined)}
                  className="inline-flex items-center gap-1 text-[11px] text-sky-600 hover:underline dark:text-sky-400"
                >
                  <RotateCcw className="h-3 w-3" />
                  {dict.inspector.resetStyle}
                </button>
              )}
            </div>
            <div className="mb-2 grid grid-cols-8 gap-1.5">
              {COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.name}
                  type="button"
                  title={sw.name}
                  onClick={() => applyStyle({ fill: sw.fill, stroke: sw.stroke, color: sw.color })}
                  style={{ backgroundColor: sw.fill, borderColor: sw.stroke }}
                  className="h-5 w-5 rounded-full border-2 transition hover:scale-110"
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.fill}</span>
                <input
                  type="color"
                  value={node.style?.fill ?? '#dbeafe'}
                  onChange={(e) => applyStyle({ ...node.style, fill: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.stroke}</span>
                <input
                  type="color"
                  value={node.style?.stroke ?? '#2563eb'}
                  onChange={(e) => applyStyle({ ...node.style, stroke: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
              <label className="flex flex-col items-center gap-1 rounded-lg border border-[var(--mm-border)] p-1.5">
                <span className="text-[10px] text-[var(--mm-text-muted)]">{dict.inspector.textColor}</span>
                <input
                  type="color"
                  value={node.style?.color ?? '#1e3a8a'}
                  onChange={(e) => applyStyle({ ...node.style, color: e.target.value })}
                  className="h-5 w-full cursor-pointer border-0 bg-transparent"
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--mm-border)] pt-2.5">
            <button
              type="button"
              onClick={() => {
                const { ast: next, newNodeId } = addFlowchartDownstreamNode(
                  ast,
                  node.id,
                  lang === 'zh' ? '下一步' : 'Next Step',
                );
                updateActiveCode(serializeFlowchart(next), {
                  selectNodeId: newNodeId,
                  editingNodeId: newNodeId,
                });
              }}
              className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 font-medium hover:bg-[var(--mm-surface-muted)]"
            >
              <CornerDownRight className="h-3.5 w-3.5" />
              {dict.inspector.addDownstream}
            </button>
            <button
              type="button"
              onClick={() => {
                const { ast: next, newNodeId } = addFlowchartSiblingNode(
                  ast,
                  node.id,
                  lang === 'zh' ? '分支步骤' : 'Branch',
                );
                updateActiveCode(serializeFlowchart(next), {
                  selectNodeId: newNodeId,
                  editingNodeId: newNodeId,
                });
              }}
              className="flex items-center justify-center gap-1 rounded-lg border border-[var(--mm-border)] px-2 py-1.5 font-medium hover:bg-[var(--mm-surface-muted)]"
            >
              <GitBranch className="h-3.5 w-3.5" />
              {dict.inspector.addSibling}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = deleteFlowchartNode(ast, node.id);
                updateActiveCode(serializeFlowchart(next), { clearSelection: true });
              }}
              className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {dict.inspector.deleteNode}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Flowchart Edge Inspector
  if (tab.detection.kind === 'flowchart' && tab.flowchartAst && tab.selectedEdgeId) {
    const ast = tab.flowchartAst;
    const edge = ast.edges.find((e) => e.id === tab.selectedEdgeId);
    if (!edge) return null;

    return (
      <div className="absolute right-4 top-4 z-20 w-[264px] rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mm-text-muted)]">
            {dict.inspector.edgeTitle}
          </span>
          <button
            type="button"
            onClick={() => setSelection({})}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.edgeLabel}
            </label>
            <input
              type="text"
              value={edge.label ?? ''}
              placeholder={lang === 'zh' ? '例如：通过 / 否' : 'e.g. Yes / No'}
              onChange={(e) => {
                const next = updateFlowchartEdge(ast, edge.id, { label: e.target.value });
                updateActiveCode(serializeFlowchart(next), { pushHistory: false });
              }}
              className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-2.5 py-1.5 text-xs text-[var(--mm-text)] outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.edgeStyle}
            </label>
            <div className="grid grid-cols-1 gap-1">
              {EDGE_STYLES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    const next = updateFlowchartEdge(ast, edge.id, { edgeStyle: st });
                    updateActiveCode(serializeFlowchart(next));
                  }}
                  className={[
                    'rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-medium transition',
                    edge.edgeStyle === st
                      ? 'border-sky-500 bg-sky-500/12 text-sky-600 dark:text-sky-300'
                      : 'border-[var(--mm-border)] text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]',
                  ].join(' ')}
                >
                  {dict.inspector.edgeStyles[st]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-[var(--mm-text-muted)]">{dict.inspector.edgeColor}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={edge.color ?? '#64748b'}
                onChange={(e) => {
                  const next = updateFlowchartEdge(ast, edge.id, { color: e.target.value });
                  updateActiveCode(serializeFlowchart(next));
                }}
                className="h-6 w-10 cursor-pointer rounded border border-[var(--mm-border)] bg-transparent"
              />
              {edge.color && (
                <button
                  type="button"
                  onClick={() => {
                    const next = updateFlowchartEdge(ast, edge.id, { color: undefined });
                    updateActiveCode(serializeFlowchart(next));
                  }}
                  className="text-[11px] text-sky-600 hover:underline"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = deleteFlowchartEdge(ast, edge.id);
              updateActiveCode(serializeFlowchart(next), { clearSelection: true });
            }}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {dict.inspector.deleteEdge}
          </button>
        </div>
      </div>
    );
  }

  // 4. Flowchart Subgraph Inspector
  if (tab.detection.kind === 'flowchart' && tab.flowchartAst && tab.selectedSubgraphId) {
    const ast = tab.flowchartAst;
    const sg = ast.subgraphs.find((s) => s.id === tab.selectedSubgraphId);
    if (!sg) return null;

    return (
      <div className="absolute right-4 top-4 z-20 w-[256px] rounded-2xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-3.5 shadow-xl backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--mm-text-muted)]">
            {dict.inspector.subgraphTitle}
          </span>
          <button
            type="button"
            onClick={() => setSelection({})}
            className="rounded-lg p-1 text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium text-[var(--mm-text-muted)]">
              {dict.inspector.label}
            </label>
            <input
              type="text"
              value={sg.title}
              onChange={(e) => {
                const next = updateFlowchartSubgraph(ast, sg.id, { title: e.target.value });
                updateActiveCode(serializeFlowchart(next), { pushHistory: false });
              }}
              className="w-full rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-2.5 py-1.5 text-xs text-[var(--mm-text)] outline-none focus:border-sky-500"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              const next = deleteFlowchartSubgraph(ast, sg.id);
              updateActiveCode(serializeFlowchart(next), { clearSelection: true });
            }}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-medium text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {dict.inspector.deleteSubgraph}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
