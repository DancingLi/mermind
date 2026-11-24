import { create } from 'zustand';
import type {
  DiagramDetection,
  FlowchartAST,
  MindmapAST,
  MindmapLayoutMode,
  ParseDiagnostic,
  UpdateState,
} from '@shared/types';
import { detectDiagramKind } from '@shared/mermaid/detect';
import { parseMindmap } from '@shared/mermaid/mindmapParser';
import { parseFlowchart } from '@shared/mermaid/flowchartParser';
import { getTemplateById } from '@shared/mermaid/templates';
import type { Language } from '../i18n';
import type { DiagramThemeId } from '../themes/themes';

export type ViewMode = 'visual' | 'preview';

export interface TabDoc {
  id: string;
  title: string;
  filePath?: string;
  code: string;
  savedCode: string;
  detection: DiagramDetection;
  mindmapAst?: MindmapAST;
  flowchartAst?: FlowchartAST;
  parseError?: ParseDiagnostic;
  collapsedUids: string[];
  selectedNodeId?: string;
  selectedEdgeId?: string;
  selectedSubgraphId?: string;
  editingNodeId?: string;
  historyPast: string[];
  historyFuture: string[];
}

interface PersistedPrefs {
  lang: Language;
  darkMode: boolean;
  diagramTheme: DiagramThemeId;
  codePaneVisible: boolean;
  splitRatio: number;
  mindmapLayout: MindmapLayoutMode;
}

interface PersistedDraftTab {
  id: string;
  title: string;
  filePath?: string;
  code: string;
  savedCode: string;
}

const PREFS_KEY = 'mermind:prefs:v1';
const DRAFTS_KEY = 'mermind:drafts:v1';
const MAX_HISTORY = 120;

function loadPrefs(): PersistedPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        lang: p.lang === 'en' ? 'en' : 'zh',
        darkMode: Boolean(p.darkMode),
        diagramTheme: p.diagramTheme ?? (p.darkMode ? 'modern-dark' : 'clean-light'),
        codePaneVisible: p.codePaneVisible !== undefined ? Boolean(p.codePaneVisible) : true,
        splitRatio: typeof p.splitRatio === 'number' ? Math.min(0.65, Math.max(0.2, p.splitRatio)) : 0.35,
        mindmapLayout: p.mindmapLayout === 'balanced' || p.mindmapLayout === 'down' ? p.mindmapLayout : 'right',
      };
    }
  } catch {
    // ignore storage failures
  }
  return {
    lang: 'zh',
    darkMode: false,
    diagramTheme: 'clean-light',
    codePaneVisible: true,
    splitRatio: 0.35,
    mindmapLayout: 'right',
  };
}

function savePrefs(prefs: PersistedPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function parseCodeForTab(
  code: string,
  prevMindmap?: MindmapAST,
  prevFlowchart?: FlowchartAST,
): {
  detection: DiagramDetection;
  mindmapAst?: MindmapAST;
  flowchartAst?: FlowchartAST;
  parseError?: ParseDiagnostic;
} {
  const detection = detectDiagramKind(code);
  if (detection.kind === 'mindmap') {
    const res = parseMindmap(code);
    if (res.ok && res.ast) {
      return { detection, mindmapAst: res.ast, flowchartAst: undefined, parseError: undefined };
    }
    return {
      detection,
      mindmapAst: prevMindmap,
      flowchartAst: undefined,
      parseError: res.error,
    };
  }

  if (detection.kind === 'flowchart') {
    const res = parseFlowchart(code);
    if (res.ok && res.ast) {
      return { detection, mindmapAst: undefined, flowchartAst: res.ast, parseError: undefined };
    }
    return {
      detection,
      mindmapAst: undefined,
      flowchartAst: prevFlowchart,
      parseError: res.error,
    };
  }

  return {
    detection,
    mindmapAst: undefined,
    flowchartAst: undefined,
    parseError: undefined,
  };
}

let tabCounter = 1;
function makeTabId(): string {
  return `tab_${Date.now().toString(36)}_${tabCounter++}`;
}

function createTabDoc(args: {
  id?: string;
  title: string;
  code: string;
  savedCode?: string;
  filePath?: string;
}): TabDoc {
  const parsed = parseCodeForTab(args.code);
  return {
    id: args.id ?? makeTabId(),
    title: args.title,
    filePath: args.filePath,
    code: args.code,
    savedCode: args.savedCode ?? args.code,
    detection: parsed.detection,
    mindmapAst: parsed.mindmapAst,
    flowchartAst: parsed.flowchartAst,
    parseError: parsed.parseError,
    collapsedUids: [],
    selectedNodeId: undefined,
    historyPast: [],
    historyFuture: [],
  };
}

function loadInitialTabs(lang: Language): TabDoc[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) {
      const parsed: PersistedDraftTab[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((t) =>
          createTabDoc({
            id: t.id,
            title: t.title,
            code: t.code,
            savedCode: t.savedCode,
            filePath: t.filePath,
          }),
        );
      }
    }
  } catch {
    // ignore
  }
  const starter = getTemplateById('mindmap-product');
  return [
    createTabDoc({
      title: starter.name[lang],
      code: starter.code[lang],
    }),
  ];
}

function persistDrafts(tabs: TabDoc[]): void {
  try {
    const payload: PersistedDraftTab[] = tabs.map((t) => ({
      id: t.id,
      title: t.title,
      filePath: t.filePath,
      code: t.code,
      savedCode: t.savedCode,
    }));
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

interface AppState {
  tabs: TabDoc[];
  activeTabId: string;
  lang: Language;
  darkMode: boolean;
  diagramTheme: DiagramThemeId;
  codePaneVisible: boolean;
  splitRatio: number;
  mindmapLayout: MindmapLayoutMode;
  viewMode: ViewMode;
  fitViewTrigger: number;
  searchQuery: string;
  toastMessage: string | null;

  // Modals
  exportModalOpen: boolean;
  templateModalOpen: boolean;
  shortcutsModalOpen: boolean;
  updateModalOpen: boolean;
  updateState: UpdateState | null;
  markdownImportCandidate: { filePath: string; name: string; blocks: string[] } | null;

  // Actions
  setActiveTab: (tabId: string) => void;
  addNewTab: (args: { title: string; code: string; filePath?: string; markUnsaved?: boolean }) => string;
  closeTab: (tabId: string) => void;
  updateActiveCode: (
    nextCode: string,
    options?: {
      pushHistory?: boolean;
      selectNodeId?: string;
      editingNodeId?: string;
      clearSelection?: boolean;
      mindmapUidMap?: Map<string, string>;
      expandUid?: string;
    },
  ) => void;
  markTabSaved: (tabId: string, filePath: string, name: string) => void;
  undo: () => void;
  redo: () => void;
  setSelection: (sel: { nodeId?: string; edgeId?: string; subgraphId?: string }) => void;
  setEditingNodeId: (nodeId?: string) => void;
  toggleCollapseUid: (uid: string) => void;
  setLang: (lang: Language) => void;
  toggleDarkMode: () => void;
  setDiagramTheme: (theme: DiagramThemeId) => void;
  toggleCodePane: () => void;
  setSplitRatio: (ratio: number) => void;
  setMindmapLayout: (layout: MindmapLayoutMode) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  triggerFitView: () => void;
  setSearchQuery: (q: string) => void;
  showToast: (msg: string) => void;
  setExportModalOpen: (open: boolean) => void;
  setTemplateModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setUpdateModalOpen: (open: boolean) => void;
  setUpdateState: (state: UpdateState | null) => void;
  setMarkdownImportCandidate: (
    candidate: { filePath: string; name: string; blocks: string[] } | null,
  ) => void;
}

const initialPrefs = loadPrefs();
const initialTabs = loadInitialTabs(initialPrefs.lang);

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  tabs: initialTabs,
  activeTabId: initialTabs[0].id,
  lang: initialPrefs.lang,
  darkMode: initialPrefs.darkMode,
  diagramTheme: initialPrefs.diagramTheme,
  codePaneVisible: initialPrefs.codePaneVisible,
  splitRatio: initialPrefs.splitRatio,
  mindmapLayout: initialPrefs.mindmapLayout,
  viewMode: 'visual',
  fitViewTrigger: 0,
  searchQuery: '',
  toastMessage: null,
  exportModalOpen: false,
  templateModalOpen: false,
  shortcutsModalOpen: false,
  updateModalOpen: false,
  updateState: null,
  markdownImportCandidate: null,

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  addNewTab: ({ title, code, filePath, markUnsaved }) => {
    // If filePath is already open, focus that tab
    if (filePath) {
      const existing = get().tabs.find((t) => t.filePath === filePath);
      if (existing) {
        set({ activeTabId: existing.id });
        return existing.id;
      }
    }
    const tab = createTabDoc({
      title,
      code,
      savedCode: markUnsaved ? '' : code,
      filePath,
    });
    const nextTabs = [...get().tabs, tab];
    persistDrafts(nextTabs);
    set({ tabs: nextTabs, activeTabId: tab.id, viewMode: 'visual' });
    return tab.id;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, lang } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    let nextTabs = tabs.filter((t) => t.id !== tabId);
    if (nextTabs.length === 0) {
      const blank = getTemplateById('mindmap-blank');
      nextTabs = [createTabDoc({ title: blank.name[lang], code: blank.code[lang] })];
    }
    const nextActive =
      activeTabId === tabId ? nextTabs[Math.min(idx, nextTabs.length - 1)].id : activeTabId;
    persistDrafts(nextTabs);
    set({ tabs: nextTabs, activeTabId: nextActive });
  },

  updateActiveCode: (nextCode, options = {}) => {
    const { tabs, activeTabId } = get();
    const {
      pushHistory = true,
      selectNodeId,
      editingNodeId,
      clearSelection,
      mindmapUidMap,
      expandUid,
    } = options;

    const nextTabs = tabs.map((tab) => {
      if (tab.id !== activeTabId) return tab;
      if (tab.code === nextCode && selectNodeId === undefined && editingNodeId === undefined) {
        return tab;
      }

      const parsed = parseCodeForTab(nextCode, tab.mindmapAst, tab.flowchartAst);
      const historyPast =
        pushHistory && tab.code !== nextCode
          ? [...tab.historyPast.slice(-(MAX_HISTORY - 1)), tab.code]
          : tab.historyPast;

      let nextCollapsed = tab.collapsedUids;
      if (mindmapUidMap && mindmapUidMap.size > 0 && nextCollapsed.length > 0) {
        nextCollapsed = nextCollapsed
          .map((u) => mindmapUidMap.get(u))
          .filter((u): u is string => Boolean(u));
      }
      if (expandUid) {
        const mappedExpand = mindmapUidMap?.get(expandUid) ?? expandUid;
        nextCollapsed = nextCollapsed.filter((u) => u !== expandUid && u !== mappedExpand);
      }

      return {
        ...tab,
        code: nextCode,
        detection: parsed.detection,
        mindmapAst: parsed.mindmapAst,
        flowchartAst: parsed.flowchartAst,
        parseError: parsed.parseError,
        collapsedUids: nextCollapsed,
        historyPast,
        historyFuture: pushHistory && tab.code !== nextCode ? [] : tab.historyFuture,
        selectedNodeId: clearSelection
          ? undefined
          : selectNodeId !== undefined
            ? selectNodeId
            : tab.selectedNodeId,
        selectedEdgeId: clearSelection || selectNodeId !== undefined ? undefined : tab.selectedEdgeId,
        selectedSubgraphId:
          clearSelection || selectNodeId !== undefined ? undefined : tab.selectedSubgraphId,
        editingNodeId: editingNodeId !== undefined ? editingNodeId : undefined,
      };
    });

    persistDrafts(nextTabs);
    set({ tabs: nextTabs });
  },

  markTabSaved: (tabId, filePath, name) => {
    const nextTabs = get().tabs.map((t) =>
      t.id === tabId ? { ...t, filePath, title: name, savedCode: t.code } : t,
    );
    persistDrafts(nextTabs);
    set({ tabs: nextTabs });
  },

  undo: () => {
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.map((tab) => {
      if (tab.id !== activeTabId || tab.historyPast.length === 0) return tab;
      const previous = tab.historyPast[tab.historyPast.length - 1];
      const parsed = parseCodeForTab(previous, tab.mindmapAst, tab.flowchartAst);
      return {
        ...tab,
        code: previous,
        detection: parsed.detection,
        mindmapAst: parsed.mindmapAst,
        flowchartAst: parsed.flowchartAst,
        parseError: parsed.parseError,
        historyPast: tab.historyPast.slice(0, -1),
        historyFuture: [tab.code, ...tab.historyFuture.slice(0, MAX_HISTORY - 1)],
        editingNodeId: undefined,
      };
    });
    persistDrafts(nextTabs);
    set({ tabs: nextTabs });
  },

  redo: () => {
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.map((tab) => {
      if (tab.id !== activeTabId || tab.historyFuture.length === 0) return tab;
      const next = tab.historyFuture[0];
      const parsed = parseCodeForTab(next, tab.mindmapAst, tab.flowchartAst);
      return {
        ...tab,
        code: next,
        detection: parsed.detection,
        mindmapAst: parsed.mindmapAst,
        flowchartAst: parsed.flowchartAst,
        parseError: parsed.parseError,
        historyPast: [...tab.historyPast.slice(-(MAX_HISTORY - 1)), tab.code],
        historyFuture: tab.historyFuture.slice(1),
        editingNodeId: undefined,
      };
    });
    persistDrafts(nextTabs);
    set({ tabs: nextTabs });
  },

  setSelection: ({ nodeId, edgeId, subgraphId }) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              selectedNodeId: nodeId,
              selectedEdgeId: edgeId,
              selectedSubgraphId: subgraphId,
            }
          : t,
      ),
    });
  },

  setEditingNodeId: (nodeId) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, editingNodeId: nodeId } : t)),
    });
  },

  toggleCollapseUid: (uid) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((t) => {
        if (t.id !== activeTabId) return t;
        const has = t.collapsedUids.includes(uid);
        return {
          ...t,
          collapsedUids: has ? t.collapsedUids.filter((u) => u !== uid) : [...t.collapsedUids, uid],
        };
      }),
    });
  },

  setLang: (lang) => {
    const s = get();
    savePrefs({
      lang,
      darkMode: s.darkMode,
      diagramTheme: s.diagramTheme,
      codePaneVisible: s.codePaneVisible,
      splitRatio: s.splitRatio,
      mindmapLayout: s.mindmapLayout,
    });
    set({ lang });
  },

  toggleDarkMode: () => {
    const s = get();
    const darkMode = !s.darkMode;
    const diagramTheme: DiagramThemeId =
      darkMode && s.diagramTheme === 'clean-light'
        ? 'modern-dark'
        : !darkMode && s.diagramTheme === 'modern-dark'
          ? 'clean-light'
          : s.diagramTheme;
    savePrefs({
      lang: s.lang,
      darkMode,
      diagramTheme,
      codePaneVisible: s.codePaneVisible,
      splitRatio: s.splitRatio,
      mindmapLayout: s.mindmapLayout,
    });
    set({ darkMode, diagramTheme });
  },

  setDiagramTheme: (diagramTheme) => {
    const s = get();
    const darkMode = diagramTheme === 'modern-dark' ? true : s.darkMode && diagramTheme !== 'clean-light' && diagramTheme !== 'warm-paper' && diagramTheme !== 'ocean-blue';
    savePrefs({
      lang: s.lang,
      darkMode,
      diagramTheme,
      codePaneVisible: s.codePaneVisible,
      splitRatio: s.splitRatio,
      mindmapLayout: s.mindmapLayout,
    });
    set({ diagramTheme, darkMode });
  },

  toggleCodePane: () => {
    const s = get();
    const codePaneVisible = !s.codePaneVisible;
    savePrefs({
      lang: s.lang,
      darkMode: s.darkMode,
      diagramTheme: s.diagramTheme,
      codePaneVisible,
      splitRatio: s.splitRatio,
      mindmapLayout: s.mindmapLayout,
    });
    set({ codePaneVisible });
  },

  setSplitRatio: (splitRatio) => {
    const clamped = Math.min(0.65, Math.max(0.2, splitRatio));
    const s = get();
    savePrefs({
      lang: s.lang,
      darkMode: s.darkMode,
      diagramTheme: s.diagramTheme,
      codePaneVisible: s.codePaneVisible,
      splitRatio: clamped,
      mindmapLayout: s.mindmapLayout,
    });
    set({ splitRatio: clamped });
  },

  setMindmapLayout: (mindmapLayout) => {
    const s = get();
    savePrefs({
      lang: s.lang,
      darkMode: s.darkMode,
      diagramTheme: s.diagramTheme,
      codePaneVisible: s.codePaneVisible,
      splitRatio: s.splitRatio,
      mindmapLayout,
    });
    set({ mindmapLayout, fitViewTrigger: s.fitViewTrigger + 1 });
  },

  setViewMode: (viewMode) => set({ viewMode }),
  toggleViewMode: () => set((s) => ({ viewMode: s.viewMode === 'visual' ? 'preview' : 'visual' })),
  triggerFitView: () => set((s) => ({ fitViewTrigger: s.fitViewTrigger + 1 })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: msg });
    toastTimer = setTimeout(() => set({ toastMessage: null }), 2200);
  },

  setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
  setTemplateModalOpen: (templateModalOpen) => set({ templateModalOpen }),
  setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),
  setUpdateModalOpen: (updateModalOpen) => set({ updateModalOpen }),
  setUpdateState: (updateState) => set({ updateState }),
  setMarkdownImportCandidate: (markdownImportCandidate) => set({ markdownImportCandidate }),
}));

export function getActiveTab(state: AppState): TabDoc {
  return state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
}
