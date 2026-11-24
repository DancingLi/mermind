import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Node } from '@xyflow/react';
import { getTemplateById } from '@shared/mermaid/templates';
import { extractMermaidBlocksFromMarkdown } from '@shared/mermaid/markdown';
import { getActiveTab, useAppStore } from './store/useAppStore';
import { DIAGRAM_THEMES } from './themes/themes';
import { getDict } from './i18n';
import { TitleBar } from './components/TitleBar';
import { Toolbar } from './components/Toolbar';
import { CodeEditor } from './components/CodeEditor';
import { MindmapCanvas } from './components/MindmapCanvas';
import { FlowchartCanvas } from './components/FlowchartCanvas';
import { MermaidPreview } from './components/MermaidPreview';
import { InspectorPanel } from './components/InspectorPanel';
import { StatusBar } from './components/StatusBar';
import {
  ExportModal,
  MarkdownPickerModal,
  ShortcutsModal,
  TemplateModal,
  UpdateModal,
} from './components/Modals';

export const App: React.FC = () => {
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const darkMode = useAppStore((s) => s.darkMode);
  const diagramTheme = useAppStore((s) => s.diagramTheme);
  const codePaneVisible = useAppStore((s) => s.codePaneVisible);
  const splitRatio = useAppStore((s) => s.splitRatio);
  const mindmapLayout = useAppStore((s) => s.mindmapLayout);
  const viewMode = useAppStore((s) => s.viewMode);
  const fitViewTrigger = useAppStore((s) => s.fitViewTrigger);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const toastMessage = useAppStore((s) => s.toastMessage);

  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const addNewTab = useAppStore((s) => s.addNewTab);
  const markTabSaved = useAppStore((s) => s.markTabSaved);
  const setSplitRatio = useAppStore((s) => s.setSplitRatio);
  const toggleCodePane = useAppStore((s) => s.toggleCodePane);
  const toggleViewMode = useAppStore((s) => s.toggleViewMode);
  const triggerFitView = useAppStore((s) => s.triggerFitView);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const showToast = useAppStore((s) => s.showToast);
  const setExportModalOpen = useAppStore((s) => s.setExportModalOpen);
  const setTemplateModalOpen = useAppStore((s) => s.setTemplateModalOpen);
  const setShortcutsModalOpen = useAppStore((s) => s.setShortcutsModalOpen);
  const setUpdateModalOpen = useAppStore((s) => s.setUpdateModalOpen);
  const setUpdateState = useAppStore((s) => s.setUpdateState);
  const setMarkdownImportCandidate = useAppStore((s) => s.setMarkdownImportCandidate);

  const dict = getDict(lang);
  const theme = DIAGRAM_THEMES[diagramTheme];
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [measuredNodes, setMeasuredNodes] = useState<Node[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync Tailwind dark mode class on root HTML element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleOpenPayload = useCallback(
    (payload: {
      filePath: string;
      name: string;
      content: string;
      fromMarkdown?: boolean;
      markdownBlocks?: string[];
    }) => {
      if (payload.fromMarkdown && payload.markdownBlocks && payload.markdownBlocks.length > 1) {
        setMarkdownImportCandidate({
          filePath: payload.filePath,
          name: payload.name,
          blocks: payload.markdownBlocks,
        });
        return;
      }
      addNewTab({
        title: payload.fromMarkdown ? `${payload.name.replace(/\.md$/i, '')}.mmd` : payload.name,
        code: payload.content,
        filePath: payload.fromMarkdown ? undefined : payload.filePath,
        markUnsaved: Boolean(payload.fromMarkdown),
      });
    },
    [addNewTab, setMarkdownImportCandidate],
  );

  const handleOpenFile = useCallback(async () => {
    if (window.mermindAPI) {
      const payload = await window.mermindAPI.openFileDialog();
      if (payload) handleOpenPayload(payload);
      return;
    }
    // Web fallback file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mmd,.mermaid,.md,.txt';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const content = await file.text();
      if (file.name.toLowerCase().endsWith('.md')) {
        const blocks = extractMermaidBlocksFromMarkdown(content);
        handleOpenPayload({
          filePath: file.name,
          name: file.name,
          content: blocks[0] ?? content,
          fromMarkdown: true,
          markdownBlocks: blocks,
        });
      } else {
        addNewTab({ title: file.name, code: content });
      }
    };
    input.click();
  }, [addNewTab, handleOpenPayload]);

  const handleImportMarkdown = useCallback(async () => {
    if (window.mermindAPI) {
      const payload = await window.mermindAPI.openMarkdownDialog();
      if (payload) handleOpenPayload(payload);
      return;
    }
    handleOpenFile();
  }, [handleOpenFile, handleOpenPayload]);

  const handleSaveFile = useCallback(
    async (forceSaveAs = false) => {
      const active = getActiveTab(useAppStore.getState());
      if (window.mermindAPI) {
        const res = forceSaveAs
          ? await window.mermindAPI.saveFileAs({
              defaultName: active.title,
              content: active.code,
            })
          : await window.mermindAPI.saveFile({
              filePath: active.filePath,
              defaultName: active.title,
              content: active.code,
            });
        if (!res.canceled && res.filePath && res.name) {
          markTabSaved(active.id, res.filePath, res.name);
          showToast(dict.statusBar.saved);
        }
        return;
      }
      // Browser fallback download
      const blob = new Blob([active.code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = active.title.endsWith('.mmd') ? active.title : `${active.title}.mmd`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(dict.statusBar.saved);
    },
    [dict.statusBar.saved, markTabSaved, showToast],
  );

  // Listen to Electron native menu IPC events
  useEffect(() => {
    if (!window.mermindAPI) return;
    return window.mermindAPI.onMenuAction(async (action, payload) => {
      const currentLang = useAppStore.getState().lang;
      switch (action) {
        case 'new-mindmap': {
          const tpl = getTemplateById('mindmap-blank');
          addNewTab({ title: getDict(currentLang).tabs.untitledMindmap, code: tpl.code[currentLang] });
          break;
        }
        case 'new-flowchart': {
          const tpl = getTemplateById('flowchart-blank');
          addNewTab({ title: getDict(currentLang).tabs.untitledFlowchart, code: tpl.code[currentLang] });
          break;
        }
        case 'open-templates':
          setTemplateModalOpen(true);
          break;
        case 'open-file':
          await handleOpenFile();
          break;
        case 'import-markdown':
          await handleImportMarkdown();
          break;
        case 'open-path':
          if (payload && window.mermindAPI) {
            const filePayload = await window.mermindAPI.readFileByPath(payload);
            if (filePayload) handleOpenPayload(filePayload);
          }
          break;
        case 'save-file':
          await handleSaveFile(false);
          break;
        case 'save-file-as':
          await handleSaveFile(true);
          break;
        case 'open-export':
          setExportModalOpen(true);
          break;
        case 'undo':
          undo();
          break;
        case 'redo':
          redo();
          break;
        case 'toggle-code-pane':
          toggleCodePane();
          break;
        case 'toggle-view-mode':
          toggleViewMode();
          break;
        case 'fit-view':
          triggerFitView();
          break;
        case 'open-shortcuts':
          setShortcutsModalOpen(true);
          break;
        case 'check-updates':
          setUpdateModalOpen(true);
          void window.mermindAPI?.updater.checkForUpdates(true);
          break;
      }
    });
  }, [
    addNewTab,
    handleImportMarkdown,
    handleOpenFile,
    handleOpenPayload,
    handleSaveFile,
    redo,
    setExportModalOpen,
    setShortcutsModalOpen,
    setTemplateModalOpen,
    setUpdateModalOpen,
    toggleCodePane,
    toggleViewMode,
    triggerFitView,
    undo,
  ]);

  // Subscribe to Electron updater status updates
  useEffect(() => {
    const updater = window.mermindAPI?.updater;
    if (!updater) return;
    void updater.getState().then((s) => setUpdateState(s));
    return updater.onStatusChange((nextState) => {
      setUpdateState(nextState);
      if (nextState.manual && nextState.status !== 'idle') {
        setUpdateModalOpen(true);
      } else if (nextState.status === 'downloaded' && nextState.mode === 'auto-win') {
        setUpdateModalOpen(true);
      }
    });
  }, [setUpdateState, setUpdateModalOpen]);

  // Global keyboard shortcuts (works in both Electron & Web)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === '\\') {
        e.preventDefault();
        toggleCodePane();
      } else if (key === 's') {
        e.preventDefault();
        void handleSaveFile(e.shiftKey);
      } else if (key === 'o') {
        e.preventDefault();
        if (e.shiftKey) void handleImportMarkdown();
        else void handleOpenFile();
      } else if (key === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
      } else if (key === 'p' && e.shiftKey) {
        e.preventDefault();
        toggleViewMode();
      } else if (key === '0') {
        e.preventDefault();
        triggerFitView();
      } else if (key === '/') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      } else if (key === 'z' && !(e.target as HTMLElement)?.closest('.cm-editor')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y' && !(e.target as HTMLElement)?.closest('.cm-editor')) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleImportMarkdown,
    handleOpenFile,
    handleSaveFile,
    redo,
    setExportModalOpen,
    setShortcutsModalOpen,
    toggleCodePane,
    toggleViewMode,
    triggerFitView,
    undo,
  ]);

  // Draggable split pane divider
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMove = (moveEvent: MouseEvent) => {
      const nextRatio = (moveEvent.clientX - rect.left) / rect.width;
      setSplitRatio(nextRatio);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Drag & drop local .mmd / .mermaid / .md files onto app window
  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const content = await file.text();
    const isMd = file.name.toLowerCase().endsWith('.md') || file.name.toLowerCase().endsWith('.markdown');
    if (isMd) {
      const blocks = extractMermaidBlocksFromMarkdown(content);
      handleOpenPayload({
        filePath: file.name,
        name: file.name,
        content: blocks[0] ?? content,
        fromMarkdown: true,
        markdownBlocks: blocks,
      });
    } else {
      addNewTab({ title: file.name, code: content });
    }
  };

  const renderCanvas = () => {
    if (viewMode === 'preview' || tab.detection.kind === 'other') {
      return (
        <MermaidPreview
          code={tab.code}
          theme={theme}
          fitViewTrigger={fitViewTrigger}
        />
      );
    }

    if (tab.detection.kind === 'mindmap' && tab.mindmapAst) {
      return (
        <MindmapCanvas
          key={tab.id}
          ast={tab.mindmapAst}
          theme={theme}
          layoutMode={mindmapLayout}
          collapsedUids={tab.collapsedUids}
          selectedNodeId={tab.selectedNodeId}
          editingNodeId={tab.editingNodeId}
          searchQuery={searchQuery}
          fitViewTrigger={fitViewTrigger}
          onNodesMeasured={setMeasuredNodes}
        />
      );
    }

    if (tab.detection.kind === 'flowchart' && tab.flowchartAst) {
      return (
        <FlowchartCanvas
          key={tab.id}
          ast={tab.flowchartAst}
          theme={theme}
          selectedNodeId={tab.selectedNodeId}
          selectedEdgeId={tab.selectedEdgeId}
          selectedSubgraphId={tab.selectedSubgraphId}
          editingNodeId={tab.editingNodeId}
          searchQuery={searchQuery}
          fitViewTrigger={fitViewTrigger}
          onNodesMeasured={setMeasuredNodes}
        />
      );
    }

    return <MermaidPreview code={tab.code} theme={theme} fitViewTrigger={fitViewTrigger} />;
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDropFile}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--mm-bg)] text-[var(--mm-text)]"
    >
      <TitleBar />
      <Toolbar
        onOpenFile={() => void handleOpenFile()}
        onImportMarkdown={() => void handleImportMarkdown()}
        onSaveFile={() => void handleSaveFile(false)}
      />

      {/* Main Split Workspace: Left Mermaid Code + Right Interactive Canvas */}
      <main ref={splitContainerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
        {codePaneVisible && (
          <>
            <section
              style={{ width: `${Math.round(splitRatio * 100)}%` }}
              className="h-full shrink-0 overflow-hidden"
            >
              <CodeEditor
                code={tab.code}
                onChange={(next) => updateActiveCode(next, { pushHistory: true })}
                darkMode={darkMode}
                lang={lang}
                parseError={tab.parseError}
                isReadOnlyVisual={tab.detection.kind === 'other'}
              />
            </section>

            {/* Draggable vertical resizer */}
            <div
              onMouseDown={startSplitResize}
              className="group relative z-10 w-1 cursor-col-resize bg-transparent transition hover:bg-blue-500/40"
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>
          </>
        )}

        {/* Right Canvas Viewport */}
        <section className="relative min-w-0 flex-1 overflow-hidden">
          {renderCanvas()}
          <InspectorPanel />
        </section>
      </main>

      <StatusBar />

      {/* Modals */}
      <ExportModal measuredNodes={measuredNodes} />
      <TemplateModal />
      <ShortcutsModal />
      <MarkdownPickerModal />
      <UpdateModal />

      {/* File Drop Overlay */}
      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-blue-600/15 backdrop-blur-xs">
          <div className="rounded-2xl border-2 border-dashed border-blue-500 bg-[var(--mm-surface)] px-8 py-5 text-sm font-semibold text-blue-600 shadow-xl dark:text-blue-300">
            {lang === 'zh'
              ? '松开鼠标即可打开 .mmd / .mermaid / .md 文件'
              : 'Drop .mmd / .mermaid / .md file to open'}
          </div>
        </div>
      )}

      {/* Subtle Toast */}
      {toastMessage && (
        <div className="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
