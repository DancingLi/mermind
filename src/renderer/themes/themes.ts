export type DiagramThemeId = 'clean-light' | 'modern-dark' | 'ocean-blue' | 'warm-paper';

export interface DiagramTheme {
  id: DiagramThemeId;
  isDarkCanvas: boolean;
  canvasBg: string;
  dotColor: string;
  rootFill: string;
  rootStroke: string;
  rootText: string;
  branchPalette: Array<{ fill: string; stroke: string; text: string; edge: string }>;
  leafFill: string;
  leafStroke: string;
  leafText: string;
  flowNodeFill: string;
  flowNodeStroke: string;
  flowNodeText: string;
  flowEdgeColor: string;
  subgraphBg: string;
  subgraphBorder: string;
  subgraphTitleColor: string;
  mermaidTheme: 'default' | 'dark' | 'neutral' | 'base';
}

export const DIAGRAM_THEMES: Record<DiagramThemeId, DiagramTheme> = {
  'clean-light': {
    id: 'clean-light',
    isDarkCanvas: false,
    canvasBg: '#f8fafc',
    dotColor: '#cbd5e1',
    rootFill: '#0f172a',
    rootStroke: '#0f172a',
    rootText: '#ffffff',
    branchPalette: [
      { fill: '#eff6ff', stroke: '#3b82f6', text: '#1e3a8a', edge: '#3b82f6' },
      { fill: '#ecfdf5', stroke: '#10b981', text: '#065f46', edge: '#10b981' },
      { fill: '#f5f3ff', stroke: '#8b5cf6', text: '#4c1d95', edge: '#8b5cf6' },
      { fill: '#fff7ed', stroke: '#f97316', text: '#9a3412', edge: '#f97316' },
      { fill: '#fdf2f8', stroke: '#ec4899', text: '#831843', edge: '#ec4899' },
      { fill: '#ecfeff', stroke: '#06b6d4', text: '#155e75', edge: '#06b6d4' },
    ],
    leafFill: '#ffffff',
    leafStroke: '#cbd5e1',
    leafText: '#1e293b',
    flowNodeFill: '#ffffff',
    flowNodeStroke: '#3b82f6',
    flowNodeText: '#0f172a',
    flowEdgeColor: '#64748b',
    subgraphBg: 'rgba(241, 245, 249, 0.72)',
    subgraphBorder: '#94a3b8',
    subgraphTitleColor: '#334155',
    mermaidTheme: 'default',
  },
  'modern-dark': {
    id: 'modern-dark',
    isDarkCanvas: true,
    canvasBg: '#0b1120',
    dotColor: '#1e293b',
    rootFill: '#0284c7',
    rootStroke: '#38bdf8',
    rootText: '#f8fafc',
    branchPalette: [
      { fill: '#172554', stroke: '#60a5fa', text: '#dbeafe', edge: '#60a5fa' },
      { fill: '#064e3b', stroke: '#34d399', text: '#d1fae5', edge: '#34d399' },
      { fill: '#2e1065', stroke: '#a78bfa', text: '#ede9fe', edge: '#a78bfa' },
      { fill: '#431407', stroke: '#fb923c', text: '#ffedd5', edge: '#fb923c' },
      { fill: '#500724', stroke: '#f472b6', text: '#fce7f3', edge: '#f472b6' },
      { fill: '#083344', stroke: '#22d3ee', text: '#cffafe', edge: '#22d3ee' },
    ],
    leafFill: '#111827',
    leafStroke: '#334155',
    leafText: '#e2e8f0',
    flowNodeFill: '#111827',
    flowNodeStroke: '#38bdf8',
    flowNodeText: '#f1f5f9',
    flowEdgeColor: '#94a3b8',
    subgraphBg: 'rgba(30, 41, 59, 0.55)',
    subgraphBorder: '#475569',
    subgraphTitleColor: '#cbd5e1',
    mermaidTheme: 'dark',
  },
  'ocean-blue': {
    id: 'ocean-blue',
    isDarkCanvas: false,
    canvasBg: '#f0f7ff',
    dotColor: '#bfdbfe',
    rootFill: '#1d4ed8',
    rootStroke: '#1e40af',
    rootText: '#ffffff',
    branchPalette: [
      { fill: '#dbeafe', stroke: '#2563eb', text: '#1e3a8a', edge: '#2563eb' },
      { fill: '#cffafe', stroke: '#0891b2', text: '#164e63', edge: '#0891b2' },
      { fill: '#e0e7ff', stroke: '#4f46e5', text: '#312e81', edge: '#4f46e5' },
      { fill: '#ccfbf1', stroke: '#0d9488', text: '#134e4a', edge: '#0d9488' },
      { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e', edge: '#0284c7' },
    ],
    leafFill: '#ffffff',
    leafStroke: '#93c5fd',
    leafText: '#0f172a',
    flowNodeFill: '#ffffff',
    flowNodeStroke: '#1d4ed8',
    flowNodeText: '#0f172a',
    flowEdgeColor: '#3b82f6',
    subgraphBg: 'rgba(219, 234, 254, 0.45)',
    subgraphBorder: '#60a5fa',
    subgraphTitleColor: '#1e40af',
    mermaidTheme: 'default',
  },
  'warm-paper': {
    id: 'warm-paper',
    isDarkCanvas: false,
    canvasBg: '#faf7f2',
    dotColor: '#e7ddd0',
    rootFill: '#7c2d12',
    rootStroke: '#7c2d12',
    rootText: '#fffbeb',
    branchPalette: [
      { fill: '#fef3c7', stroke: '#d97706', text: '#78350f', edge: '#d97706' },
      { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d', edge: '#dc2626' },
      { fill: '#dcfce7', stroke: '#15803d', text: '#14532d', edge: '#15803d' },
      { fill: '#e0e7ff', stroke: '#4338ca', text: '#312e81', edge: '#4338ca' },
      { fill: '#fae8ff', stroke: '#a21caf', text: '#701a75', edge: '#a21caf' },
    ],
    leafFill: '#fffdf9',
    leafStroke: '#d6c7b2',
    leafText: '#292524',
    flowNodeFill: '#fffdf9',
    flowNodeStroke: '#b45309',
    flowNodeText: '#292524',
    flowEdgeColor: '#78716c',
    subgraphBg: 'rgba(245, 238, 226, 0.72)',
    subgraphBorder: '#c2a98b',
    subgraphTitleColor: '#57534e',
    mermaidTheme: 'neutral',
  },
};

export const COLOR_SWATCHES = [
  { name: 'Blue', fill: '#dbeafe', stroke: '#2563eb', color: '#1e3a8a' },
  { name: 'Emerald', fill: '#dcfce7', stroke: '#16a34a', color: '#14532d' },
  { name: 'Amber', fill: '#fef3c7', stroke: '#d97706', color: '#78350f' },
  { name: 'Rose', fill: '#ffe4e6', stroke: '#e11d48', color: '#881337' },
  { name: 'Violet', fill: '#ede9fe', stroke: '#7c3aed', color: '#4c1d95' },
  { name: 'Cyan', fill: '#cffafe', stroke: '#0891b2', color: '#164e63' },
  { name: 'Slate', fill: '#f1f5f9', stroke: '#475569', color: '#0f172a' },
  { name: 'Dark', fill: '#1e293b', stroke: '#64748b', color: '#f8fafc' },
];
