import type {
  FlowchartAST,
  FlowchartDirection,
  FlowchartEdge,
  FlowchartEdgeStyle,
  FlowchartNode,
  FlowchartShape,
  NodeVisualStyle,
} from '../types';

export function cloneFlowchartAST(ast: FlowchartAST): FlowchartAST {
  return {
    ...ast,
    leadingLines: [...ast.leadingLines],
    nodes: ast.nodes.map((n) => ({
      ...n,
      classes: [...n.classes],
      style: n.style ? { ...n.style } : undefined,
      manualPosition: n.manualPosition ? { ...n.manualPosition } : undefined,
    })),
    edges: ast.edges.map((e) => ({ ...e })),
    subgraphs: ast.subgraphs.map((s) => ({
      ...s,
      style: s.style ? { ...s.style } : undefined,
    })),
    classDefs: ast.classDefs.map((c) => ({ ...c, parsedStyle: { ...c.parsedStyle } })),
    extraLines: [...ast.extraLines],
    warnings: [...ast.warnings],
  };
}

export function generateFlowchartNodeId(ast: FlowchartAST, prefix = 'N'): string {
  const used = new Set([
    ...ast.nodes.map((n) => n.id),
    ...ast.subgraphs.map((s) => s.id),
  ]);
  let idx = ast.nodes.length + 1;
  while (used.has(`${prefix}${idx}`)) idx++;
  return `${prefix}${idx}`;
}

function generateEdgeId(ast: FlowchartAST): string {
  const used = new Set(ast.edges.map((e) => e.id));
  let idx = ast.edges.length + 1;
  while (used.has(`e_${idx}`)) idx++;
  return `e_${idx}`;
}

export function addFlowchartNode(
  ast: FlowchartAST,
  options: {
    label?: string;
    shape?: FlowchartShape;
    subgraphId?: string;
    manualPosition?: { x: number; y: number };
  } = {},
): { ast: FlowchartAST; newNodeId: string } {
  const next = cloneFlowchartAST(ast);
  const newNodeId = generateFlowchartNodeId(next);
  const node: FlowchartNode = {
    id: newNodeId,
    label: options.label ?? '新节点',
    shape: options.shape ?? 'rect',
    subgraphId: options.subgraphId,
    classes: [],
    manualPosition: options.manualPosition,
    explicitlyDeclared: true,
  };
  next.nodes.push(node);
  return { ast: next, newNodeId };
}

/**
 * Tab shortcut on flowchart: create a new downstream connected node from `sourceNodeId`.
 */
export function addFlowchartDownstreamNode(
  ast: FlowchartAST,
  sourceNodeId: string,
  label = '下一步',
): { ast: FlowchartAST; newNodeId: string } {
  const next = cloneFlowchartAST(ast);
  const sourceNode = next.nodes.find((n) => n.id === sourceNodeId);
  const newNodeId = generateFlowchartNodeId(next);
  const newNode: FlowchartNode = {
    id: newNodeId,
    label,
    shape: 'rect',
    subgraphId: sourceNode?.subgraphId,
    classes: [],
    explicitlyDeclared: true,
  };
  next.nodes.push(newNode);
  if (sourceNode) {
    next.edges.push({
      id: generateEdgeId(next),
      source: sourceNode.id,
      target: newNodeId,
      edgeStyle: 'arrow',
    });
  }
  return { ast: next, newNodeId };
}

/**
 * Enter shortcut on flowchart: create a sibling branch node from the same incoming parent
 * (or downstream if the selected node has no incoming parent).
 */
export function addFlowchartSiblingNode(
  ast: FlowchartAST,
  selectedNodeId: string,
  label = '分支节点',
): { ast: FlowchartAST; newNodeId: string } {
  const incomingEdge = ast.edges.find((e) => e.target === selectedNodeId);
  if (!incomingEdge) {
    return addFlowchartDownstreamNode(ast, selectedNodeId, label);
  }
  const next = cloneFlowchartAST(ast);
  const selected = next.nodes.find((n) => n.id === selectedNodeId);
  const newNodeId = generateFlowchartNodeId(next);
  next.nodes.push({
    id: newNodeId,
    label,
    shape: 'rect',
    subgraphId: selected?.subgraphId,
    classes: [],
    explicitlyDeclared: true,
  });
  next.edges.push({
    id: generateEdgeId(next),
    source: incomingEdge.source,
    target: newNodeId,
    edgeStyle: incomingEdge.edgeStyle,
  });
  return { ast: next, newNodeId };
}

export function addFlowchartEdge(
  ast: FlowchartAST,
  source: string,
  target: string,
  edgeStyle: FlowchartEdgeStyle = 'arrow',
  label?: string,
): { ast: FlowchartAST; newEdgeId: string } {
  const next = cloneFlowchartAST(ast);
  const newEdgeId = generateEdgeId(next);
  next.edges.push({
    id: newEdgeId,
    source,
    target,
    label,
    edgeStyle,
  });
  return { ast: next, newEdgeId };
}

export function updateFlowchartNode(
  ast: FlowchartAST,
  nodeId: string,
  patch: Partial<Pick<FlowchartNode, 'label' | 'shape' | 'subgraphId' | 'style'>>,
): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (!node) return ast;
  if (patch.label !== undefined) node.label = patch.label.trim() || node.label;
  if (patch.shape !== undefined) node.shape = patch.shape;
  if ('subgraphId' in patch) node.subgraphId = patch.subgraphId;
  if ('style' in patch) {
    const s = patch.style;
    if (!s || (!s.fill && !s.stroke && !s.color && !s.strokeWidth)) {
      node.style = undefined;
    } else {
      node.style = { ...s };
    }
  }
  return next;
}

export function updateFlowchartEdge(
  ast: FlowchartAST,
  edgeId: string,
  patch: Partial<Pick<FlowchartEdge, 'label' | 'edgeStyle' | 'color' | 'strokeWidth'>>,
): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  const edge = next.edges.find((e) => e.id === edgeId);
  if (!edge) return ast;
  if ('label' in patch) edge.label = patch.label?.trim() || undefined;
  if (patch.edgeStyle !== undefined) edge.edgeStyle = patch.edgeStyle;
  if ('color' in patch) edge.color = patch.color || undefined;
  if ('strokeWidth' in patch) edge.strokeWidth = patch.strokeWidth || undefined;
  return next;
}

export function deleteFlowchartNode(ast: FlowchartAST, nodeId: string): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  next.nodes = next.nodes.filter((n) => n.id !== nodeId);
  next.edges = next.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  return next;
}

export function deleteFlowchartEdge(ast: FlowchartAST, edgeId: string): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  next.edges = next.edges.filter((e) => e.id !== edgeId);
  return next;
}

export function setFlowchartDirection(ast: FlowchartAST, direction: FlowchartDirection): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  next.direction = direction;
  return next;
}

export function setFlowchartNodeManualPosition(
  ast: FlowchartAST,
  nodeId: string,
  pos: { x: number; y: number },
): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  const node = next.nodes.find((n) => n.id === nodeId);
  if (!node) return ast;
  node.manualPosition = { x: Math.round(pos.x), y: Math.round(pos.y) };
  return next;
}

export function clearAllManualPositions(ast: FlowchartAST): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  for (const node of next.nodes) {
    node.manualPosition = undefined;
  }
  return next;
}

export function addFlowchartSubgraph(
  ast: FlowchartAST,
  title = '新分组',
  attachNodeIds: string[] = [],
): { ast: FlowchartAST; subgraphId: string } {
  const next = cloneFlowchartAST(ast);
  const used = new Set([
    ...next.subgraphs.map((s) => s.id),
    ...next.nodes.map((n) => n.id),
  ]);
  let idx = next.subgraphs.length + 1;
  while (used.has(`SG${idx}`)) idx++;
  const subgraphId = `SG${idx}`;

  next.subgraphs.push({ id: subgraphId, title });
  for (const nid of attachNodeIds) {
    const node = next.nodes.find((n) => n.id === nid);
    if (node) node.subgraphId = subgraphId;
  }
  return { ast: next, subgraphId };
}

export function updateFlowchartSubgraph(
  ast: FlowchartAST,
  subgraphId: string,
  patch: { title?: string; style?: NodeVisualStyle | undefined },
): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  const sg = next.subgraphs.find((s) => s.id === subgraphId);
  if (!sg) return ast;
  if (patch.title !== undefined) sg.title = patch.title.trim() || sg.title;
  if ('style' in patch) sg.style = patch.style;
  return next;
}

export function deleteFlowchartSubgraph(ast: FlowchartAST, subgraphId: string): FlowchartAST {
  const next = cloneFlowchartAST(ast);
  next.subgraphs = next.subgraphs.filter((s) => s.id !== subgraphId);
  for (const node of next.nodes) {
    if (node.subgraphId === subgraphId) node.subgraphId = undefined;
  }
  return next;
}
