import React from 'react';
import {
  Box,
  CornerDownRight,
  Download,
  Eye,
  FilePlus2,
  FolderOpen,
  GitBranch,
  HelpCircle,
  LayoutGrid,
  Maximize2,
  Moon,
  Palette,
  PanelLeft,
  Plus,
  Redo2,
  Save,
  Search,
  Sparkles,
  Sun,
  Undo2,
  Wand2,
} from 'lucide-react';
import type { FlowchartDirection, MindmapLayoutMode } from '@shared/types';
import { addMindmapChild, addMindmapSibling } from '@shared/mermaid/mindmapOps';
import { serializeMindmap } from '@shared/mermaid/mindmapSerializer';
import {
  addFlowchartNode,
  addFlowchartSubgraph,
  clearAllManualPositions,
  setFlowchartDirection,
} from '@shared/mermaid/flowchartOps';
import { serializeFlowchart } from '@shared/mermaid/flowchartSerializer';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { getDict } from '../i18n';
import type { DiagramThemeId } from '../themes/themes';

interface ToolbarProps {
  onOpenFile: () => void;
  onImportMarkdown: () => void;
  onSaveFile: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onOpenFile,
  onImportMarkdown,
  onSaveFile,
}) => {
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const darkMode = useAppStore((s) => s.darkMode);
  const diagramTheme = useAppStore((s) => s.diagramTheme);
  const codePaneVisible = useAppStore((s) => s.codePaneVisible);
  const mindmapLayout = useAppStore((s) => s.mindmapLayout);
  const viewMode = useAppStore((s) => s.viewMode);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setLang = useAppStore((s) => s.setLang);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const setDiagramTheme = useAppStore((s) => s.setDiagramTheme);
  const toggleCodePane = useAppStore((s) => s.toggleCodePane);
  const setMindmapLayout = useAppStore((s) => s.setMindmapLayout);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const triggerFitView = useAppStore((s) => s.triggerFitView);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const setExportModalOpen = useAppStore((s) => s.setExportModalOpen);
  const setTemplateModalOpen = useAppStore((s) => s.setTemplateModalOpen);
  const setShortcutsModalOpen = useAppStore((s) => s.setShortcutsModalOpen);

  const dict = getDict(lang);
  const isMindmap = tab.detection.kind === 'mindmap';
  const isFlowchart = tab.detection.kind === 'flowchart';
  const isOther = tab.detection.kind === 'other';

  const pinnedCount =
    isFlowchart && tab.flowchartAst
      ? tab.flowchartAst.nodes.filter((n) => Boolean(n.manualPosition)).length
      : 0;

  const btnCls =
    'inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-[var(--mm-text)] transition hover:bg-[var(--mm-surface-muted)] disabled:opacity-35 disabled:pointer-events-none';

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-1.5 overflow-x-auto border-b border-[var(--mm-border)] bg-[var(--mm-surface)] px-2.5">
      {/* Left: File, History, Panel & Mode */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={toggleCodePane}
          title={`${dict.toolbar.codeToggle} (Cmd/Ctrl+\\)`}
          className={[
            btnCls,
            codePaneVisible ? 'bg-[var(--mm-accent-soft)] text-[var(--mm-accent)]' : '',
          ].join(' ')}
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{dict.toolbar.codeToggle}</span>
        </button>

        <div className="mx-1 h-4 w-px bg-[var(--mm-border)]" />

        <button
          type="button"
          onClick={() => setTemplateModalOpen(true)}
          title={dict.toolbar.templates}
          className={btnCls}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">{dict.toolbar.templates}</span>
        </button>

        <button
          type="button"
          onClick={onOpenFile}
          title={`${dict.toolbar.openMmd} (Cmd/Ctrl+O)`}
          className={btnCls}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline">{dict.toolbar.open}</span>
        </button>

        <button
          type="button"
          onClick={onImportMarkdown}
          title={dict.toolbar.importMd}
          className={btnCls}
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline">.md</span>
        </button>

        <button
          type="button"
          onClick={onSaveFile}
          title={`${dict.toolbar.save} (Cmd/Ctrl+S)`}
          className={btnCls}
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden 2xl:inline">{dict.toolbar.save}</span>
        </button>

        <div className="mx-1 h-4 w-px bg-[var(--mm-border)]" />

        <button
          type="button"
          onClick={undo}
          disabled={tab.historyPast.length === 0}
          title={`${dict.toolbar.undo} (Cmd/Ctrl+Z)`}
          className={btnCls}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={tab.historyFuture.length === 0}
          title={`${dict.toolbar.redo} (Cmd/Ctrl+Shift+Z)`}
          className={btnCls}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Center: Diagram-Specific Visual Tools + View Mode Switch */}
      <div className="flex shrink-0 items-center gap-1">
        {!isOther && (
          <div className="flex items-center rounded-lg border border-[var(--mm-border)] bg-[var(--mm-surface-muted)] p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={[
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition',
                viewMode === 'visual'
                  ? 'bg-[var(--mm-surface)] text-[var(--mm-text)] shadow-xs'
                  : 'text-[var(--mm-text-muted)] hover:text-[var(--mm-text)]',
              ].join(' ')}
            >
              <Sparkles className="h-3 w-3" />
              {dict.toolbar.visualMode}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={[
                'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition',
                viewMode === 'preview'
                  ? 'bg-[var(--mm-surface)] text-[var(--mm-text)] shadow-xs'
                  : 'text-[var(--mm-text-muted)] hover:text-[var(--mm-text)]',
              ].join(' ')}
            >
              <Eye className="h-3 w-3" />
              {dict.toolbar.previewMode}
            </button>
          </div>
        )}

        {/* Mindmap context actions */}
        {isMindmap && viewMode === 'visual' && tab.mindmapAst && (
          <>
            <button
              type="button"
              title={dict.toolbar.addChild}
              onClick={() => {
                const targetUid = tab.selectedNodeId ?? tab.mindmapAst!.root.uid;
                const { ast: next, newNodeUid, uidMap } = addMindmapChild(
                  tab.mindmapAst!,
                  targetUid,
                  lang === 'zh' ? '子主题' : 'Subtopic',
                );
                updateActiveCode(serializeMindmap(next), {
                  selectNodeId: newNodeUid,
                  editingNodeId: newNodeUid,
                  mindmapUidMap: uidMap,
                  expandUid: targetUid,
                });
              }}
              className={btnCls}
            >
              <CornerDownRight className="h-3.5 w-3.5 text-sky-500" />
              <span>{lang === 'zh' ? '子节点' : 'Child'}</span>
            </button>
            <button
              type="button"
              title={dict.toolbar.addSibling}
              onClick={() => {
                const targetUid = tab.selectedNodeId ?? tab.mindmapAst!.root.uid;
                const { ast: next, newNodeUid, uidMap } = addMindmapSibling(
                  tab.mindmapAst!,
                  targetUid,
                  lang === 'zh' ? '同级主题' : 'Topic',
                );
                updateActiveCode(serializeMindmap(next), {
                  selectNodeId: newNodeUid,
                  editingNodeId: newNodeUid,
                  mindmapUidMap: uidMap,
                });
              }}
              className={btnCls}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
              <span>{lang === 'zh' ? '同级' : 'Sibling'}</span>
            </button>

            <select
              value={mindmapLayout}
              onChange={(e) => setMindmapLayout(e.target.value as MindmapLayoutMode)}
              className="h-7 rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-1.5 text-xs text-[var(--mm-text)] outline-none"
            >
              <option value="right">{dict.toolbar.layoutRight}</option>
              <option value="balanced">{dict.toolbar.layoutBalanced}</option>
              <option value="down">{dict.toolbar.layoutDown}</option>
            </select>
          </>
        )}

        {/* Flowchart context actions */}
        {isFlowchart && viewMode === 'visual' && tab.flowchartAst && (
          <>
            <button
              type="button"
              title={dict.toolbar.addNode}
              onClick={() => {
                const { ast: next, newNodeId } = addFlowchartNode(tab.flowchartAst!, {
                  label: lang === 'zh' ? '新节点' : 'New Node',
                });
                updateActiveCode(serializeFlowchart(next), {
                  selectNodeId: newNodeId,
                  editingNodeId: newNodeId,
                });
              }}
              className={btnCls}
            >
              <Plus className="h-3.5 w-3.5 text-sky-500" />
              <span>{lang === 'zh' ? '节点' : 'Node'}</span>
            </button>
            <button
              type="button"
              title={dict.toolbar.addSubgraph}
              onClick={() => {
                const attach = tab.selectedNodeId ? [tab.selectedNodeId] : [];
                const { ast: next } = addFlowchartSubgraph(
                  tab.flowchartAst!,
                  lang === 'zh' ? '新分组' : 'Subgraph',
                  attach,
                );
                updateActiveCode(serializeFlowchart(next));
              }}
              className={btnCls}
            >
              <Box className="h-3.5 w-3.5 text-violet-500" />
              <span>{lang === 'zh' ? '分组' : 'Group'}</span>
            </button>

            <select
              value={tab.flowchartAst.direction}
              onChange={(e) => {
                const next = setFlowchartDirection(
                  tab.flowchartAst!,
                  e.target.value as FlowchartDirection,
                );
                updateActiveCode(serializeFlowchart(next));
              }}
              className="h-7 rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-1.5 text-xs text-[var(--mm-text)] outline-none"
            >
              <option value="TD">{dict.toolbar.dirTD}</option>
              <option value="LR">{dict.toolbar.dirLR}</option>
              <option value="BT">{dict.toolbar.dirBT}</option>
              <option value="RL">{dict.toolbar.dirRL}</option>
            </select>

            <button
              type="button"
              title={dict.toolbar.autoTidyTip}
              onClick={() => {
                const next = clearAllManualPositions(tab.flowchartAst!);
                updateActiveCode(serializeFlowchart(next));
                triggerFitView();
              }}
              className={[
                btnCls,
                pinnedCount > 0
                  ? 'border border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                  : '',
              ].join(' ')}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>{dict.toolbar.autoTidy}</span>
            </button>
          </>
        )}
      </div>

      {/* Right: Search, Theme, Export, UI Controls */}
      <div className="flex shrink-0 items-center gap-1">
        {!isOther && viewMode === 'visual' && (
          <div className="relative hidden items-center xl:flex">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[var(--mm-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dict.codePane.searchPlaceholder}
              className="h-7 w-32 rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] pl-7 pr-2 text-xs text-[var(--mm-text)] outline-none transition focus:w-44 focus:border-sky-500"
            />
          </div>
        )}

        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--mm-border)] bg-[var(--mm-bg)] px-1.5">
          <Palette className="h-3.5 w-3.5 text-[var(--mm-text-muted)]" />
          <select
            value={diagramTheme}
            onChange={(e) => setDiagramTheme(e.target.value as DiagramThemeId)}
            aria-label={dict.toolbar.theme}
            className="h-7 bg-transparent text-xs text-[var(--mm-text)] outline-none"
          >
            <option value="clean-light">{dict.themes['clean-light']}</option>
            <option value="modern-dark">{dict.themes['modern-dark']}</option>
            <option value="ocean-blue">{dict.themes['ocean-blue']}</option>
            <option value="warm-paper">{dict.themes['warm-paper']}</option>
          </select>
        </div>

        <button
          type="button"
          onClick={triggerFitView}
          title={`${dict.toolbar.fitView} (Cmd/Ctrl+0)`}
          className={btnCls}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          title={`${dict.toolbar.export} (Cmd/Ctrl+E)`}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 text-xs font-medium text-white shadow-xs transition hover:bg-blue-700"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{dict.toolbar.export}</span>
        </button>

        <div className="mx-0.5 h-4 w-px bg-[var(--mm-border)]" />

        <button
          type="button"
          onClick={toggleDarkMode}
          title={dict.toolbar.darkMode}
          className={btnCls}
        >
          {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="inline-flex h-7 items-center rounded-lg border border-[var(--mm-border)] px-2 text-[11px] font-semibold text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
        >
          {dict.toolbar.langSwitch}
        </button>

        <button
          type="button"
          onClick={() => setShortcutsModalOpen(true)}
          title={`${dict.toolbar.shortcuts} (Cmd/Ctrl+/)`}
          className={btnCls}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
