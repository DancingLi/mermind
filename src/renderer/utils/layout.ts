import dagre from '@dagrejs/dagre';
import { MarkerType, Position, type Edge, type Node } from '@xyflow/react';
import type {
  FlowchartAST,
  FlowchartEdge,
  FlowchartNode,
  FlowchartSubgraph,
  MindmapAST,
  MindmapLayoutMode,
  MindmapNode,
} from '@shared/types';
import type { DiagramTheme } from '../themes/themes';

/**
 * Estimate rendered text width accurately for both Latin and CJK wide characters.
 */
export function estimateTextWidth(text: string, fontSize = 13): number {
  let units = 0;
  for (const ch of text) {
    units += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1.05 : 0.6;
  }
  return Math.ceil(units * fontSize);
}

export interface MindmapFlowNodeData extends Record<string, unknown> {
  node: MindmapNode;
  depth: number;
  branchIndex: number;
  side: 'left' | 'right' | 'center' | 'down';
  collapsed: boolean;
  hiddenChildCount: number;
  theme: DiagramTheme;
  isSearchMatch: boolean;
  isDropTarget: boolean;
}

function countDescendants(node: MindmapNode): number {
  let n = 0;
  for (const c of node.children) {
    n += 1 + countDescendants(c);
  }
  return n;
}

function measureMindmapNode(node: MindmapNode, depth: number): { w: number; h: number } {
  const fontSize = depth === 0 ? 16 : depth === 1 ? 14 : 13;
  const textW = estimateTextWidth(node.label, fontSize);
  const padX = depth === 0 ? 44 : 34;
  const minW = depth === 0 ? 136 : 96;
  const maxW = 280;
  const w = Math.min(maxW, Math.max(minW, textW + padX));
  const lines = Math.max(1, Math.ceil(textW / Math.max(80, maxW - padX)));
  let h = depth === 0 ? 48 : 38;
  if (lines > 1) h += (lines - 1) * 18;
  if (node.shape === 'circle' || node.shape === 'bang') {
    h = Math.max(h, Math.min(96, Math.round(w * 0.56)));
  }
  return { w, h };
}

/**
 * Compute crisp multi-mode Mindmap layout (right-hand tree, balanced mindmap, or top-down org chart).
 */
export function layoutMindmap(
  ast: MindmapAST,
  mode: MindmapLayoutMode,
  collapsedUids: Set<string>,
  theme: DiagramTheme,
  searchQuery: string,
  dropTargetUid?: string,
): { nodes: Node<MindmapFlowNodeData>[]; edges: Edge[] } {
  const rfNodes: Node<MindmapFlowNodeData>[] = [];
  const rfEdges: Edge[] = [];
  const q = searchQuery.trim().toLowerCase();

  const H_GAP = 68;
  const V_GAP = 18;

  const isVisibleChildren = (node: MindmapNode) =>
    node.children.length > 0 && !collapsedUids.has(node.uid);

  const subtreeSpanCache = new Map<string, number>();

  const computeVerticalSpan = (node: MindmapNode, depth: number): number => {
    const { h } = measureMindmapNode(node, depth);
    if (!isVisibleChildren(node)) {
      subtreeSpanCache.set(node.uid, h);
      return h;
    }
    let total = 0;
    node.children.forEach((child, idx) => {
      total += computeVerticalSpan(child, depth + 1);
      if (idx > 0) total += V_GAP;
    });
    const span = Math.max(h, total);
    subtreeSpanCache.set(node.uid, span);
    return span;
  };

  const computeHorizontalSpan = (node: MindmapNode, depth: number): number => {
    const { w } = measureMindmapNode(node, depth);
    if (!isVisibleChildren(node)) {
      subtreeSpanCache.set(node.uid, w);
      return w;
    }
    let total = 0;
    node.children.forEach((child, idx) => {
      total += computeHorizontalSpan(child, depth + 1);
      if (idx > 0) total += 28;
    });
    const span = Math.max(w, total);
    subtreeSpanCache.set(node.uid, span);
    return span;
  };

  const addNodeAndEdge = (
    node: MindmapNode,
    parentUid: string | null,
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
    branchIndex: number,
    side: 'left' | 'right' | 'center' | 'down',
  ) => {
    const collapsed = collapsedUids.has(node.uid);
    const hiddenChildCount = collapsed ? countDescendants(node) : 0;
    const isSearchMatch = Boolean(q && node.label.toLowerCase().includes(q));
    const palette = theme.branchPalette[branchIndex % theme.branchPalette.length];

    rfNodes.push({
      id: node.uid,
      type: 'mindmapNode',
      position: { x: Math.round(x), y: Math.round(y) },
      width: w,
      height: h,
      data: {
        node,
        depth,
        branchIndex,
        side,
        collapsed,
        hiddenChildCount,
        theme,
        isSearchMatch,
        isDropTarget: dropTargetUid === node.uid,
      },
    });

    if (parentUid) {
      let sourceHandle = 'right-source';
      let targetHandle = 'left-target';
      if (side === 'left') {
        sourceHandle = 'left-source';
        targetHandle = 'right-target';
      } else if (side === 'down') {
        sourceHandle = 'bottom-source';
        targetHandle = 'top-target';
      }

      rfEdges.push({
        id: `${parentUid}->${node.uid}`,
        source: parentUid,
        target: node.uid,
        sourceHandle,
        targetHandle,
        type: 'default',
        style: {
          stroke: node.style?.stroke ?? palette.edge,
          strokeWidth: depth === 1 ? 2.4 : 1.75,
        },
      });
    }
  };

  if (mode === 'down') {
    computeHorizontalSpan(ast.root, 0);
    const placeDown = (
      node: MindmapNode,
      parentUid: string | null,
      centerX: number,
      topY: number,
      depth: number,
      branchIndex: number,
    ) => {
      const { w, h } = measureMindmapNode(node, depth);
      addNodeAndEdge(node, parentUid, centerX - w / 2, topY, w, h, depth, branchIndex, 'down');
      if (!isVisibleChildren(node)) return;

      const totalW =
        node.children.reduce((acc, c) => acc + (subtreeSpanCache.get(c.uid) ?? 120), 0) +
        (node.children.length - 1) * 28;
      let cursorX = centerX - totalW / 2;
      node.children.forEach((child, i) => {
        const span = subtreeSpanCache.get(child.uid) ?? 120;
        const bIdx = depth === 0 ? i : branchIndex;
        placeDown(child, node.uid, cursorX + span / 2, topY + h + 64, depth + 1, bIdx);
        cursorX += span + 28;
      });
    };
    placeDown(ast.root, null, 0, 0, 0, 0);
    return { nodes: rfNodes, edges: rfEdges };
  }

  // Horizontal layout: 'right' or 'balanced'
  computeVerticalSpan(ast.root, 0);
  const rootDim = measureMindmapNode(ast.root, 0);

  const placeHorizontalBranch = (
    node: MindmapNode,
    parentUid: string,
    anchorX: number,
    centerY: number,
    depth: number,
    branchIndex: number,
    dir: 'right' | 'left',
  ) => {
    const { w, h } = measureMindmapNode(node, depth);
    const x = dir === 'right' ? anchorX : anchorX - w;
    const y = centerY - h / 2;
    addNodeAndEdge(node, parentUid, x, y, w, h, depth, branchIndex, dir);

    if (!isVisibleChildren(node)) return;
    const totalH =
      node.children.reduce((acc, c) => acc + (subtreeSpanCache.get(c.uid) ?? 40), 0) +
      (node.children.length - 1) * V_GAP;
    let cursorY = centerY - totalH / 2;

    const nextAnchorX = dir === 'right' ? x + w + H_GAP : x - H_GAP;
    node.children.forEach((child) => {
      const span = subtreeSpanCache.get(child.uid) ?? 40;
      placeHorizontalBranch(child, node.uid, nextAnchorX, cursorY + span / 2, depth + 1, branchIndex, dir);
      cursorY += span + V_GAP;
    });
  };

  addNodeAndEdge(
    ast.root,
    null,
    -rootDim.w / 2,
    -rootDim.h / 2,
    rootDim.w,
    rootDim.h,
    0,
    0,
    mode === 'balanced' ? 'center' : 'right',
  );

  if (!isVisibleChildren(ast.root)) {
    return { nodes: rfNodes, edges: rfEdges };
  }

  const children = ast.root.children;
  if (mode === 'right') {
    const totalH =
      children.reduce((acc, c) => acc + (subtreeSpanCache.get(c.uid) ?? 40), 0) +
      (children.length - 1) * (V_GAP + 6);
    let cursorY = -totalH / 2;
    const startX = rootDim.w / 2 + H_GAP + 14;
    children.forEach((child, idx) => {
      const span = subtreeSpanCache.get(child.uid) ?? 40;
      placeHorizontalBranch(child, ast.root.uid, startX, cursorY + span / 2, 1, idx, 'right');
      cursorY += span + V_GAP + 6;
    });
  } else {
    // Balanced split: half right, half left
    const splitIdx = Math.ceil(children.length / 2);
    const rightChildren = children.slice(0, splitIdx);
    const leftChildren = children.slice(splitIdx);

    const placeSide = (group: MindmapNode[], offsetIdx: number, dir: 'right' | 'left') => {
      if (group.length === 0) return;
      const totalH =
        group.reduce((acc, c) => acc + (subtreeSpanCache.get(c.uid) ?? 40), 0) +
        (group.length - 1) * (V_GAP + 8);
      let cursorY = -totalH / 2;
      const startX = dir === 'right' ? rootDim.w / 2 + H_GAP + 16 : -rootDim.w / 2 - H_GAP - 16;
      group.forEach((child, i) => {
        const span = subtreeSpanCache.get(child.uid) ?? 40;
        placeHorizontalBranch(child, ast.root.uid, startX, cursorY + span / 2, 1, offsetIdx + i, dir);
        cursorY += span + V_GAP + 8;
      });
    };

    placeSide(rightChildren, 0, 'right');
    placeSide(leftChildren, splitIdx, 'left');
  }

  return { nodes: rfNodes, edges: rfEdges };
}

export interface FlowchartRFNodeData extends Record<string, unknown> {
  node: FlowchartNode;
  direction: FlowchartAST['direction'];
  theme: DiagramTheme;
  isSearchMatch: boolean;
  isPinned: boolean;
}

export interface SubgraphRFNodeData extends Record<string, unknown> {
  subgraph: FlowchartSubgraph;
  theme: DiagramTheme;
}

function measureFlowchartNode(node: FlowchartNode): { w: number; h: number } {
  const textW = estimateTextWidth(node.label, 13);
  if (node.shape === 'diamond') {
    const side = Math.min(180, Math.max(106, textW + 44));
    return { w: side, h: Math.round(side * 0.72) };
  }
  if (node.shape === 'circle') {
    const d = Math.min(140, Math.max(76, textW + 32));
    return { w: d, h: d };
  }
  const w = Math.min(260, Math.max(120, textW + 42));
  const h = node.shape === 'cylinder' ? 58 : 46;
  return { w, h };
}

/**
 * Layout Flowchart AST via Dagre, honoring explicit manual positions (`%% @pos`)
 * and wrapping subgraph members with dynamically sized background containers.
 */
export function layoutFlowchart(
  ast: FlowchartAST,
  theme: DiagramTheme,
  searchQuery: string,
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph({ compound: false });
  const rankdir = ast.direction === 'TD' ? 'TB' : ast.direction;
  g.setGraph({
    rankdir,
    nodesep: 52,
    ranksep: 72,
    marginx: 32,
    marginy: 32,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const dims = new Map<string, { w: number; h: number }>();
  for (const node of ast.nodes) {
    const d = measureFlowchartNode(node);
    dims.set(node.id, d);
    g.setNode(node.id, { width: d.w, height: d.h });
  }
  for (const edge of ast.edges) {
    if (dims.has(edge.source) && dims.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const q = searchQuery.trim().toLowerCase();
  const positioned = new Map<string, { x: number; y: number; w: number; h: number }>();

  const nodeElements: Node<FlowchartRFNodeData>[] = ast.nodes.map((node) => {
    const d = dims.get(node.id) ?? { w: 140, h: 46 };
    const dagrePos = g.node(node.id);
    const autoX = dagrePos ? dagrePos.x - d.w / 2 : 0;
    const autoY = dagrePos ? dagrePos.y - d.h / 2 : 0;

    const x = node.manualPosition ? node.manualPosition.x : Math.round(autoX);
    const y = node.manualPosition ? node.manualPosition.y : Math.round(autoY);
    positioned.set(node.id, { x, y, w: d.w, h: d.h });

    return {
      id: node.id,
      type: 'flowchartNode',
      position: { x, y },
      width: d.w,
      height: d.h,
      zIndex: 10,
      data: {
        node,
        direction: ast.direction,
        theme,
        isSearchMatch: Boolean(q && node.label.toLowerCase().includes(q)),
        isPinned: Boolean(node.manualPosition),
      },
    };
  });

  // Compute bounding boxes for subgraphs (rendered underneath regular nodes)
  const subgraphElements: Node<SubgraphRFNodeData>[] = [];
  const getSubgraphMemberIds = (sgId: string): string[] => {
    const direct = ast.nodes.filter((n) => n.subgraphId === sgId).map((n) => n.id);
    const nested = ast.subgraphs
      .filter((child) => child.parentId === sgId)
      .flatMap((child) => getSubgraphMemberIds(child.id));
    return [...direct, ...nested];
  };

  ast.subgraphs.forEach((sg, idx) => {
    const memberIds = getSubgraphMemberIds(sg.id);
    const boxes = memberIds
      .map((id) => positioned.get(id))
      .filter((b): b is { x: number; y: number; w: number; h: number } => Boolean(b));

    let minX = 40 + idx * 40;
    let minY = 40 + idx * 40;
    let maxX = minX + 240;
    let maxY = minY + 140;

    if (boxes.length > 0) {
      const padX = 28;
      const padTop = 44;
      const padBottom = 24;
      minX = Math.min(...boxes.map((b) => b.x)) - padX;
      minY = Math.min(...boxes.map((b) => b.y)) - padTop;
      maxX = Math.max(...boxes.map((b) => b.x + b.w)) + padX;
      maxY = Math.max(...boxes.map((b) => b.y + b.h)) + padBottom;
    }

    subgraphElements.push({
      id: `sg:${sg.id}`,
      type: 'subgraphNode',
      position: { x: Math.round(minX), y: Math.round(minY) },
      draggable: false,
      selectable: true,
      zIndex: -10 + idx,
      style: {
        width: Math.round(maxX - minX),
        height: Math.round(maxY - minY),
      },
      data: {
        subgraph: sg,
        theme,
      },
    });
  });

  const isHorizontal = ast.direction === 'LR' || ast.direction === 'RL';
  const sourcePos =
    ast.direction === 'LR'
      ? Position.Right
      : ast.direction === 'RL'
        ? Position.Left
        : ast.direction === 'BT'
          ? Position.Top
          : Position.Bottom;
  const targetPos =
    ast.direction === 'LR'
      ? Position.Left
      : ast.direction === 'RL'
        ? Position.Right
        : ast.direction === 'BT'
          ? Position.Bottom
          : Position.Top;

  const edgeElements: Edge[] = ast.edges.map((edge: FlowchartEdge) => {
    const stroke = edge.color ?? theme.flowEdgeColor;
    const isDotted = edge.edgeStyle === 'dotted-arrow' || edge.edgeStyle === 'dotted-line';
    const isThick = edge.edgeStyle === 'thick-arrow' || edge.edgeStyle === 'thick-line';
    const hasEndArrow =
      edge.edgeStyle === 'arrow' ||
      edge.edgeStyle === 'dotted-arrow' ||
      edge.edgeStyle === 'thick-arrow' ||
      edge.edgeStyle === 'bi-arrow';
    const hasStartArrow = edge.edgeStyle === 'bi-arrow';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourcePos,
      targetHandle: targetPos,
      label: edge.label,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke,
        strokeWidth: isThick ? 3.2 : 1.9,
        strokeDasharray: isDotted ? '6 4' : undefined,
      },
      labelStyle: {
        fill: theme.flowNodeText,
        fontSize: 12,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: theme.canvasBg,
        fillOpacity: 0.92,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: hasEndArrow
        ? { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 }
        : undefined,
      markerStart: hasStartArrow
        ? { type: MarkerType.ArrowClosed, color: stroke, width: 18, height: 18 }
        : undefined,
      data: { edge, isHorizontal },
    };
  });

  return {
    nodes: [...subgraphElements, ...nodeElements],
    edges: edgeElements,
  };
}
