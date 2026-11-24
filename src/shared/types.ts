export type DiagramKind = 'mindmap' | 'flowchart' | 'other';

export interface DiagramDetection {
  kind: DiagramKind;
  rawType: string;
}

export type MindmapShape =
  | 'default'
  | 'square'
  | 'rounded'
  | 'circle'
  | 'bang'
  | 'cloud'
  | 'hexagon';

export type MindmapLayoutMode = 'right' | 'balanced' | 'down';

export interface NodeVisualStyle {
  fill?: string;
  stroke?: string;
  color?: string;
  strokeWidth?: string;
}

export interface MindmapNode {
  uid: string;
  rawId?: string;
  label: string;
  shape: MindmapShape;
  icon?: string;
  classes: string[];
  style?: NodeVisualStyle;
  children: MindmapNode[];
  lineNumber?: number;
}

export interface MindmapAST {
  kind: 'mindmap';
  leadingLines: string[];
  root: MindmapNode;
  trailingLines: string[];
  warnings: ParseDiagnostic[];
}

export type FlowchartDirection = 'TD' | 'LR' | 'BT' | 'RL';

export type FlowchartShape =
  | 'rect'
  | 'rounded'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'circle'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram';

export type FlowchartEdgeStyle =
  | 'arrow'
  | 'line'
  | 'dotted-arrow'
  | 'dotted-line'
  | 'thick-arrow'
  | 'thick-line'
  | 'bi-arrow';

export interface FlowchartNode {
  id: string;
  label: string;
  shape: FlowchartShape;
  subgraphId?: string;
  classes: string[];
  style?: NodeVisualStyle;
  manualPosition?: { x: number; y: number };
  explicitlyDeclared?: boolean;
  lineNumber?: number;
}

export interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  edgeStyle: FlowchartEdgeStyle;
  color?: string;
  strokeWidth?: string;
  lineNumber?: number;
}

export interface FlowchartSubgraph {
  id: string;
  title: string;
  parentId?: string;
  direction?: FlowchartDirection;
  style?: NodeVisualStyle;
}

export interface FlowchartClassDef {
  name: string;
  rawStyle: string;
  parsedStyle: NodeVisualStyle;
}

export interface FlowchartAST {
  kind: 'flowchart';
  keyword: 'flowchart' | 'graph';
  direction: FlowchartDirection;
  leadingLines: string[];
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  subgraphs: FlowchartSubgraph[];
  classDefs: FlowchartClassDef[];
  extraLines: string[];
  warnings: ParseDiagnostic[];
}

export interface ParseDiagnostic {
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseResult<T> {
  ok: boolean;
  ast?: T;
  error?: ParseDiagnostic;
}

export interface FilePayload {
  filePath: string;
  name: string;
  content: string;
  fromMarkdown?: boolean;
  markdownBlocks?: string[];
}

export interface SaveFileResult {
  canceled: boolean;
  filePath?: string;
  name?: string;
}

export interface ExportFileRequest {
  defaultName: string;
  filters: Array<{ name: string; extensions: string[] }>;
  contentBase64?: string;
  contentText?: string;
}

export type UpdateMode = 'auto-win' | 'download-installer';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  mode: UpdateMode;
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  assetName?: string;
  assetUrl?: string;
  downloadedPath?: string;
  percent?: number;
  transferredBytes?: number;
  totalBytes?: number;
  errorMessage?: string;
  manual?: boolean;
}

export interface MermindAPI {
  platform: 'darwin' | 'win32' | 'linux' | string;
  appVersion: string;
  openFileDialog: () => Promise<FilePayload | null>;
  openMarkdownDialog: () => Promise<FilePayload | null>;
  readFileByPath: (filePath: string) => Promise<FilePayload | null>;
  saveFile: (args: {
    filePath?: string;
    defaultName: string;
    content: string;
  }) => Promise<SaveFileResult>;
  saveFileAs: (args: { defaultName: string; content: string }) => Promise<SaveFileResult>;
  exportBinaryOrText: (args: ExportFileRequest) => Promise<SaveFileResult>;
  exportPdfFromHtml: (args: { html: string; defaultName: string }) => Promise<SaveFileResult>;
  getRecentFiles: () => Promise<string[]>;
  addRecentFile: (filePath: string) => Promise<string[]>;
  clearRecentFiles: () => Promise<void>;
  onMenuAction: (callback: (action: string, payload?: string) => void) => () => void;
  updater: {
    getState: () => Promise<UpdateState>;
    checkForUpdates: (manual?: boolean) => Promise<UpdateState>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    openReleasePage: () => Promise<void>;
    onStatusChange: (callback: (state: UpdateState) => void) => () => void;
  };
  windowControls: {
    minimize: () => void;
    maximizeToggle: () => void;
    close: () => void;
  };
}
