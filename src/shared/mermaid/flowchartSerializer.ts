import type {
  FlowchartAST,
  FlowchartEdge,
  FlowchartNode,
  FlowchartSubgraph,
  NodeVisualStyle,
} from '../types';

function needsQuotes(text: string): boolean {
  return /["[\](){}|&;<>]/.test(text) || text.includes('--') || text.includes('==');
}

function formatLabel(label: string): string {
  const clean = label.replace(/\r?\n/g, ' ').trim();
  if (!clean) return '""';
  if (needsQuotes(clean)) {
    return `"${clean.replace(/"/g, '\\"')}"`;
  }
  return clean;
}

function formatNodeDecl(node: FlowchartNode): string {
  const lbl = formatLabel(node.label);
  const clsSuffix = node.classes.length > 0 ? node.classes.map((c) => `:::${c}`).join('') : '';

  switch (node.shape) {
    case 'rounded':
      return `${node.id}(${lbl})${clsSuffix}`;
    case 'stadium':
      return `${node.id}([${lbl}])${clsSuffix}`;
    case 'subroutine':
      return `${node.id}[[${lbl}]]${clsSuffix}`;
    case 'cylinder':
      return `${node.id}[(${lbl})]${clsSuffix}`;
    case 'circle':
      return `${node.id}((${lbl}))${clsSuffix}`;
    case 'diamond':
      return `${node.id}{${lbl}}${clsSuffix}`;
    case 'hexagon':
      return `${node.id}{{${lbl}}}${clsSuffix}`;
    case 'parallelogram':
      return `${node.id}[/${lbl}/]${clsSuffix}`;
    case 'rect':
    default:
      return `${node.id}[${lbl}]${clsSuffix}`;
  }
}

function formatEdgeOp(edge: FlowchartEdge): string {
  const baseOp: Record<FlowchartEdge['edgeStyle'], string> = {
    arrow: '-->',
    line: '---',
    'dotted-arrow': '-.->',
    'dotted-line': '-.-',
    'thick-arrow': '==>',
    'thick-line': '===',
    'bi-arrow': '<-->',
  };
  const op = baseOp[edge.edgeStyle] ?? '-->';
  if (edge.label && edge.label.trim()) {
    const clean = edge.label.replace(/\|/g, '/').replace(/\r?\n/g, ' ').trim();
    return `${op}|${clean}|`;
  }
  return op;
}

function formatStyle(style?: NodeVisualStyle): string | null {
  if (!style) return null;
  const parts: string[] = [];
  if (style.fill) parts.push(`fill:${style.fill}`);
  if (style.stroke) parts.push(`stroke:${style.stroke}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.strokeWidth) parts.push(`stroke-width:${style.strokeWidth}`);
  return parts.length > 0 ? parts.join(',') : null;
}

/**
 * Serialize a FlowchartAST back into clean, idiomatic, 100% standard Mermaid flowchart syntax.
 * Manual coordinates are only emitted as standard `%% @pos id:x,y` comments at the bottom
 * for nodes explicitly dragged by the user.
 */
export function serializeFlowchart(ast: FlowchartAST): string {
  const lines: string[] = [];

  for (const l of ast.leadingLines) {
    lines.push(l);
  }

  lines.push(`${ast.keyword} ${ast.direction}`);

  const declaredNodeIds = new Set<string>();
  const nodeById = new Map<string, FlowchartNode>(ast.nodes.map((n) => [n.id, n]));

  // Group edges: track exact emission order so linkStyle indices match Mermaid's parser 1:1
  const emittedEdgeIds = new Set<string>();
  const emittedEdgesInOrder: FlowchartEdge[] = [];

  // Helper to emit a subgraph recursively
  const emitSubgraph = (sg: FlowchartSubgraph, depth: number) => {
    const indent = '  '.repeat(depth);
    const titleStr = sg.title && sg.title !== sg.id ? `[${formatLabel(sg.title)}]` : '';
    lines.push(`${indent}subgraph ${sg.id}${titleStr}`);
    if (sg.direction) {
      lines.push(`${indent}  direction ${sg.direction}`);
    }

    const childNodes = ast.nodes.filter((n) => n.subgraphId === sg.id);
    for (const node of childNodes) {
      lines.push(`${indent}  ${formatNodeDecl(node)}`);
      declaredNodeIds.add(node.id);
    }

    // Emit nested subgraphs
    const childSubgraphs = ast.subgraphs.filter((child) => child.parentId === sg.id);
    for (const childSg of childSubgraphs) {
      emitSubgraph(childSg, depth + 1);
    }

    // Emit edges completely inside this subgraph
    for (const edge of ast.edges) {
      if (emittedEdgeIds.has(edge.id)) continue;
      const src = nodeById.get(edge.source);
      const tgt = nodeById.get(edge.target);
      if (src?.subgraphId === sg.id && tgt?.subgraphId === sg.id) {
        lines.push(`${indent}  ${edge.source} ${formatEdgeOp(edge)} ${edge.target}`);
        emittedEdgeIds.add(edge.id);
        emittedEdgesInOrder.push(edge);
      }
    }

    lines.push(`${indent}end`);
  };

  // 1. Emit top-level nodes that are NOT in any subgraph
  const topNodes = ast.nodes.filter((n) => !n.subgraphId);
  for (const node of topNodes) {
    lines.push(`  ${formatNodeDecl(node)}`);
    declaredNodeIds.add(node.id);
  }

  // 2. Emit top-level subgraphs
  const rootSubgraphs = ast.subgraphs.filter((sg) => !sg.parentId);
  if (rootSubgraphs.length > 0 && topNodes.length > 0) {
    lines.push('');
  }
  for (const sg of rootSubgraphs) {
    emitSubgraph(sg, 1);
  }

  // 3. Emit remaining edges
  const remainingEdges = ast.edges.filter((e) => !emittedEdgeIds.has(e.id));
  if (remainingEdges.length > 0 && lines.length > 1) {
    lines.push('');
  }
  for (const edge of remainingEdges) {
    // Ensure any undeclared node gets declared cleanly
    const srcNode = nodeById.get(edge.source);
    const tgtNode = nodeById.get(edge.target);
    const srcExpr = srcNode && !declaredNodeIds.has(srcNode.id)
      ? (declaredNodeIds.add(srcNode.id), formatNodeDecl(srcNode))
      : edge.source;
    const tgtExpr = tgtNode && !declaredNodeIds.has(tgtNode.id)
      ? (declaredNodeIds.add(tgtNode.id), formatNodeDecl(tgtNode))
      : edge.target;
    lines.push(`  ${srcExpr} ${formatEdgeOp(edge)} ${tgtExpr}`);
    emittedEdgesInOrder.push(edge);
  }

  // 4. Emit classDefs
  if (ast.classDefs.length > 0) {
    lines.push('');
    for (const def of ast.classDefs) {
      lines.push(`  classDef ${def.name} ${def.rawStyle}`);
    }
  }

  // 5. Emit explicit node & subgraph styles
  const styleLines: string[] = [];
  for (const node of ast.nodes) {
    const s = formatStyle(node.style);
    if (s) styleLines.push(`  style ${node.id} ${s}`);
  }
  for (const sg of ast.subgraphs) {
    const s = formatStyle(sg.style);
    if (s) styleLines.push(`  style ${sg.id} ${s}`);
  }
  // Emit linkStyles based on exact emission order
  emittedEdgesInOrder.forEach((edge, idx) => {
    const parts: string[] = [];
    if (edge.color) parts.push(`stroke:${edge.color}`);
    if (edge.strokeWidth) parts.push(`stroke-width:${edge.strokeWidth}`);
    if (parts.length > 0) {
      styleLines.push(`  linkStyle ${idx} ${parts.join(',')}`);
    }
  });
  if (styleLines.length > 0) {
    lines.push('');
    lines.push(...styleLines);
  }

  // 6. Preserve unrecognized/extra lines (click handlers, user comments)
  if (ast.extraLines.length > 0) {
    lines.push('');
    for (const extra of ast.extraLines) {
      lines.push(`  ${extra}`);
    }
  }

  // 7. Emit manual positions ONLY for nodes that were manually positioned
  const manualPosLines = ast.nodes
    .filter((n) => n.manualPosition !== undefined)
    .map((n) => `  %% @pos ${n.id}:${Math.round(n.manualPosition!.x)},${Math.round(n.manualPosition!.y)}`);
  if (manualPosLines.length > 0) {
    lines.push('');
    lines.push(...manualPosLines);
  }

  return lines.join('\n');
}
