import type {
  FlowchartAST,
  FlowchartClassDef,
  FlowchartDirection,
  FlowchartEdge,
  FlowchartEdgeStyle,
  FlowchartNode,
  FlowchartShape,
  FlowchartSubgraph,
  NodeVisualStyle,
  ParseDiagnostic,
  ParseResult,
} from '../types';

function normalizeDirection(raw?: string): FlowchartDirection {
  const up = (raw ?? 'TD').toUpperCase();
  if (up === 'TB' || up === 'TD') return 'TD';
  if (up === 'LR' || up === 'RL' || up === 'BT') return up;
  return 'TD';
}

function unquote(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseStyleProps(raw: string): NodeVisualStyle {
  const style: NodeVisualStyle = {};
  for (const part of raw.split(',')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!val) continue;
    if (key === 'fill') style.fill = val;
    else if (key === 'stroke') style.stroke = val;
    else if (key === 'color') style.color = val;
    else if (key === 'stroke-width') style.strokeWidth = val;
  }
  return style;
}

interface ParsedNodeExpr {
  id: string;
  label?: string;
  shape?: FlowchartShape;
  classes: string[];
  explicit: boolean;
}

/**
 * Parse a single flowchart node token such as:
 *   A, A[Label], A("Rounded"), A([Stadium]), A[(DB)], A((Circle)),
 *   A[[Sub]], A{Decision}, A{{Hex}}, A[/Para/], A[Label]:::cls
 */
function parseNodeExpr(rawToken: string): ParsedNodeExpr | null {
  let token = rawToken.trim();
  if (!token) return null;

  const classes: string[] = [];
  while (true) {
    const clsMatch = token.match(/:::([A-Za-z0-9_-]+)\s*$/);
    if (!clsMatch) break;
    classes.unshift(clsMatch[1]);
    token = token.slice(0, clsMatch.index).trim();
  }

  const idMatch = token.match(/^([A-Za-z0-9_.-]+)([\s\S]*)$/);
  if (!idMatch) return null;
  const id = idMatch[1];
  const rest = idMatch[2].trim();

  if (!rest) {
    return { id, classes, explicit: false };
  }

  // Ordered longest/most-specific delimiters first
  const shapeMatchers: Array<{ shape: FlowchartShape; re: RegExp }> = [
    { shape: 'stadium', re: /^\(\[([\s\S]*)\]\)$/ },
    { shape: 'subroutine', re: /^\[\[([\s\S]*)\]\]$/ },
    { shape: 'cylinder', re: /^\[\(([\s\S]*)\)\]$/ },
    { shape: 'circle', re: /^\(\(([\s\S]*)\)\)$/ },
    { shape: 'hexagon', re: /^\{\{([\s\S]*)\}\}$/ },
    { shape: 'parallelogram', re: /^\[\/([\s\S]*)\/\]$/ },
    { shape: 'rect', re: /^\[([\s\S]*)\]$/ },
    { shape: 'rounded', re: /^\(([\s\S]*)\)$/ },
    { shape: 'diamond', re: /^\{([\s\S]*)\}$/ },
  ];

  for (const { shape, re } of shapeMatchers) {
    const m = rest.match(re);
    if (m) {
      return {
        id,
        label: unquote(m[1]),
        shape,
        classes,
        explicit: true,
      };
    }
  }

  return null;
}

interface EdgeOpMatch {
  start: number;
  end: number;
  edgeStyle: FlowchartEdgeStyle;
  label?: string;
}

/**
 * Find the next edge operator in `line` starting from `fromIdx`,
 * skipping anything inside quotes ("..."), brackets ([...], (...), {...}), or pipes.
 */
function findNextEdgeOperator(line: string, fromIdx: number): EdgeOpMatch | null {
  let inQuotes = false;
  let sqDepth = 0;
  let parenDepth = 0;
  let braceDepth = 0;

  for (let i = fromIdx; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;

    if (ch === '[') {
      sqDepth++;
      continue;
    }
    if (ch === ']' && sqDepth > 0) {
      sqDepth--;
      continue;
    }
    if (ch === '(') {
      parenDepth++;
      continue;
    }
    if (ch === ')' && parenDepth > 0) {
      parenDepth--;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      continue;
    }
    if (ch === '}' && braceDepth > 0) {
      braceDepth--;
      continue;
    }

    if (sqDepth > 0 || parenDepth > 0 || braceDepth > 0) continue;

    // Only recognize edge operators when preceded by whitespace or node closing delimiter/identifier
    const sub = line.slice(i);

    // 1. Inline text edge syntax: -- text --> | -. text .-> | == text ==> | -- text ---
    const inlineArrow = sub.match(/^--\s+([^->|]+?)\s+--+[>ox]/);
    if (inlineArrow) {
      return {
        start: i,
        end: i + inlineArrow[0].length,
        edgeStyle: 'arrow',
        label: unquote(inlineArrow[1]),
      };
    }
    const inlineLine = sub.match(/^--\s+([^->|]+?)\s+---+/);
    if (inlineLine) {
      return {
        start: i,
        end: i + inlineLine[0].length,
        edgeStyle: 'line',
        label: unquote(inlineLine[1]),
      };
    }
    const inlineDotted = sub.match(/^-\.\s*([^\n]+?)\s*\.->/);
    if (inlineDotted) {
      return {
        start: i,
        end: i + inlineDotted[0].length,
        edgeStyle: 'dotted-arrow',
        label: unquote(inlineDotted[1]),
      };
    }
    const inlineThick = sub.match(/^==\s+([^=>|]+?)\s+==+>/);
    if (inlineThick) {
      return {
        start: i,
        end: i + inlineThick[0].length,
        edgeStyle: 'thick-arrow',
        label: unquote(inlineThick[1]),
      };
    }

    // 2. Standard edge operators with optional |label|
    const opPatterns: Array<{ style: FlowchartEdgeStyle; re: RegExp }> = [
      { style: 'bi-arrow', re: /^<--+[>](?:\s*\|([^|]*)\|)?/ },
      { style: 'dotted-arrow', re: /^-\.+->(?:\s*\|([^|]*)\|)?/ },
      { style: 'dotted-line', re: /^-\.+-(?!>)(?:\s*\|([^|]*)\|)?/ },
      { style: 'thick-arrow', re: /^==+>(?:\s*\|([^|]*)\|)?/ },
      { style: 'thick-line', re: /^===+(?!>)(?:\s*\|([^|]*)\|)?/ },
      { style: 'arrow', re: /^--+[>ox](?:\s*\|([^|]*)\|)?/ },
      { style: 'line', re: /^---+(?!>)(?:\s*\|([^|]*)\|)?/ },
    ];

    for (const { style, re } of opPatterns) {
      const m = sub.match(re);
      if (m) {
        return {
          start: i,
          end: i + m[0].length,
          edgeStyle: style,
          label: m[1] !== undefined ? unquote(m[1]) : undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Split a group of nodes separated by `&` outside brackets/quotes.
 */
function splitAmpersandGroup(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  let depth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '"' && expr[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if ((ch === ']' || ch === ')' || ch === '}') && depth > 0) depth--;
      else if (ch === '&' && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Split a line by `;` outside quotes/brackets so single-line multi-statement flowcharts parse cleanly.
 */
function splitStatements(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i - 1] !== '\\') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes) {
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if ((ch === ']' || ch === ')' || ch === '}') && depth > 0) depth--;
      else if (ch === ';' && depth === 0) {
        if (current.trim()) out.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function parseFlowchart(code: string): ParseResult<FlowchartAST> {
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const leadingLines: string[] = [];
  const extraLines: string[] = [];
  const warnings: ParseDiagnostic[] = [];

  let i = 0;
  let keyword: 'flowchart' | 'graph' = 'flowchart';
  let direction: FlowchartDirection = 'TD';
  let foundHeader = false;
  let inInitBlock = false;

  // 1. Find flowchart/graph header
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (inInitBlock) {
      leadingLines.push(raw);
      if (trimmed.includes('}%%')) inInitBlock = false;
      continue;
    }

    if (!trimmed) {
      if (leadingLines.length > 0) leadingLines.push(raw);
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      leadingLines.push(raw);
      if (!trimmed.includes('}%%')) inInitBlock = true;
      continue;
    }

    if (trimmed.startsWith('%%')) {
      leadingLines.push(raw);
      continue;
    }

    const headerMatch = trimmed.match(/^(flowchart|graph)(?:\s+(TD|TB|BT|RL|LR))?\s*;?\s*$/i);
    if (headerMatch) {
      keyword = headerMatch[1].toLowerCase() as 'flowchart' | 'graph';
      direction = normalizeDirection(headerMatch[2]);
      foundHeader = true;
      i++;
      break;
    }

    return {
      ok: false,
      error: {
        line: i + 1,
        message: `Expected "flowchart" or "graph" header, found "${trimmed}"`,
        severity: 'error',
      },
    };
  }

  if (!foundHeader) {
    return {
      ok: false,
      error: {
        line: 1,
        message: 'Missing "flowchart" or "graph" declaration',
        severity: 'error',
      },
    };
  }

  const nodeMap = new Map<string, FlowchartNode>();
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartEdge[] = [];
  const subgraphs: FlowchartSubgraph[] = [];
  const subgraphMap = new Map<string, FlowchartSubgraph>();
  const classDefs: FlowchartClassDef[] = [];
  const classDefMap = new Map<string, FlowchartClassDef>();
  const manualPosMap = new Map<string, { x: number; y: number }>();
  const pendingLinkStyles: Array<{ index: number; raw: string }> = [];

  const subgraphStack: string[] = [];
  let edgeSeq = 0;
  let autoSubgraphSeq = 0;

  const upsertNode = (expr: ParsedNodeExpr, lineNo: number): FlowchartNode => {
    const currentSubgraph = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined;
    const existing = nodeMap.get(expr.id);
    if (existing) {
      if (expr.explicit) {
        if (expr.label !== undefined) existing.label = expr.label;
        if (expr.shape !== undefined) existing.shape = expr.shape;
        existing.explicitlyDeclared = true;
      }
      if (currentSubgraph && !existing.subgraphId) {
        existing.subgraphId = currentSubgraph;
      }
      for (const cls of expr.classes) {
        if (!existing.classes.includes(cls)) existing.classes.push(cls);
      }
      return existing;
    }

    const node: FlowchartNode = {
      id: expr.id,
      label: expr.label ?? expr.id,
      shape: expr.shape ?? 'rect',
      subgraphId: currentSubgraph,
      classes: [...expr.classes],
      explicitlyDeclared: expr.explicit,
      lineNumber: lineNo,
    };
    nodeMap.set(expr.id, node);
    nodes.push(node);
    return node;
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNo = i + 1;

    if (!trimmed) continue;

    // Managed manual position comment: %% @pos NodeId:120,240
    const posMatch = trimmed.match(/^%%\s*@pos\s+([A-Za-z0-9_.-]+)\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (posMatch) {
      manualPosMap.set(posMatch[1], {
        x: Math.round(Number(posMatch[2])),
        y: Math.round(Number(posMatch[3])),
      });
      continue;
    }

    if (trimmed.startsWith('%%')) {
      extraLines.push(trimmed);
      continue;
    }

    const statements = splitStatements(trimmed);
    for (const stmt of statements) {
      // Subgraph open
      const sgMatch = stmt.match(/^subgraph\s+(.+)$/i);
      if (sgMatch) {
        const rest = sgMatch[1].trim();
        let sgId = '';
        let sgTitle = '';

        const idBracket = rest.match(/^([A-Za-z0-9_.-]+)\s*\[([\s\S]+)\]$/);
        if (idBracket) {
          sgId = idBracket[1];
          sgTitle = unquote(idBracket[2]);
        } else if (rest.startsWith('"') && rest.endsWith('"')) {
          sgId = `sg_${++autoSubgraphSeq}`;
          sgTitle = unquote(rest);
        } else if (/^[A-Za-z0-9_.-]+$/.test(rest)) {
          sgId = rest;
          sgTitle = rest;
        } else {
          sgId = `sg_${++autoSubgraphSeq}`;
          sgTitle = unquote(rest);
        }

        const parentId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : undefined;
        const sg: FlowchartSubgraph = { id: sgId, title: sgTitle, parentId };
        if (!subgraphMap.has(sgId)) {
          subgraphs.push(sg);
          subgraphMap.set(sgId, sg);
        }
        subgraphStack.push(sgId);
        continue;
      }

      // Subgraph close
      if (/^end$/i.test(stmt)) {
        if (subgraphStack.length === 0) {
          return {
            ok: false,
            error: {
              line: lineNo,
              message: 'Unexpected "end" without matching "subgraph"',
              severity: 'error',
            },
          };
        }
        subgraphStack.pop();
        continue;
      }

      // Direction inside subgraph
      const dirMatch = stmt.match(/^direction\s+(TD|TB|BT|RL|LR)$/i);
      if (dirMatch) {
        if (subgraphStack.length > 0) {
          const sg = subgraphMap.get(subgraphStack[subgraphStack.length - 1]);
          if (sg) sg.direction = normalizeDirection(dirMatch[1]);
        } else {
          direction = normalizeDirection(dirMatch[1]);
        }
        continue;
      }

      // style <id> fill:...,stroke:...
      const styleMatch = stmt.match(/^style\s+([A-Za-z0-9_.-]+)\s+(.+)$/i);
      if (styleMatch) {
        const targetId = styleMatch[1];
        const parsedStyle = parseStyleProps(styleMatch[2]);
        const targetSubgraph = subgraphMap.get(targetId);
        if (targetSubgraph) {
          targetSubgraph.style = { ...targetSubgraph.style, ...parsedStyle };
        } else {
          const existing = nodeMap.get(targetId);
          if (existing) {
            existing.style = { ...existing.style, ...parsedStyle };
          } else {
            // Node styled before declaration
            const node = upsertNode({ id: targetId, classes: [], explicit: false }, lineNo);
            node.style = parsedStyle;
          }
        }
        continue;
      }

      // classDef <name> <styles>
      const classDefMatch = stmt.match(/^classDef\s+([A-Za-z0-9_-]+)\s+(.+)$/i);
      if (classDefMatch) {
        const def: FlowchartClassDef = {
          name: classDefMatch[1],
          rawStyle: classDefMatch[2].trim(),
          parsedStyle: parseStyleProps(classDefMatch[2]),
        };
        classDefs.push(def);
        classDefMap.set(def.name, def);
        continue;
      }

      // class A,B className
      const classAssignMatch = stmt.match(/^class\s+([A-Za-z0-9_.,\s-]+)\s+([A-Za-z0-9_-]+)$/i);
      if (classAssignMatch) {
        const ids = classAssignMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        const clsName = classAssignMatch[2];
        for (const id of ids) {
          const node = nodeMap.get(id) ?? upsertNode({ id, classes: [], explicit: false }, lineNo);
          if (!node.classes.includes(clsName)) node.classes.push(clsName);
        }
        continue;
      }

      // linkStyle <index> <styles>
      const linkStyleMatch = stmt.match(/^linkStyle\s+(\d+)\s+(.+)$/i);
      if (linkStyleMatch) {
        pendingLinkStyles.push({ index: Number(linkStyleMatch[1]), raw: linkStyleMatch[2] });
        continue;
      }

      // click directives or other advanced statements
      if (/^click\s+/i.test(stmt)) {
        extraLines.push(stmt);
        continue;
      }

      // Try parsing as chained edges or standalone node
      const firstOp = findNextEdgeOperator(stmt, 0);
      if (!firstOp) {
        // Standalone node declaration
        const nodeTokens = splitAmpersandGroup(stmt);
        let parsedAny = false;
        for (const tok of nodeTokens) {
          const parsed = parseNodeExpr(tok);
          if (parsed) {
            upsertNode(parsed, lineNo);
            parsedAny = true;
          }
        }
        if (!parsedAny) {
          return {
            ok: false,
            error: {
              line: lineNo,
              message: `Could not parse flowchart statement: "${stmt}"`,
              severity: 'error',
            },
          };
        }
        continue;
      }

      // Edge chain: seg0 <op0> seg1 <op1> seg2 ...
      const segments: string[] = [];
      const ops: EdgeOpMatch[] = [];
      let cursor = 0;
      let op: EdgeOpMatch | null = firstOp;

      while (op) {
        segments.push(stmt.slice(cursor, op.start).trim());
        ops.push(op);
        cursor = op.end;
        op = findNextEdgeOperator(stmt, cursor);
      }
      segments.push(stmt.slice(cursor).trim());

      if (segments.some((s) => !s)) {
        return {
          ok: false,
          error: {
            line: lineNo,
            message: `Incomplete edge expression: "${stmt}"`,
            severity: 'error',
          },
        };
      }

      const segmentNodeGroups: FlowchartNode[][] = [];
      for (const seg of segments) {
        const groupTokens = splitAmpersandGroup(seg);
        const groupNodes: FlowchartNode[] = [];
        for (const tok of groupTokens) {
          const parsed = parseNodeExpr(tok);
          if (!parsed) {
            return {
              ok: false,
              error: {
                line: lineNo,
                message: `Invalid node syntax "${tok}"`,
                severity: 'error',
              },
            };
          }
          groupNodes.push(upsertNode(parsed, lineNo));
        }
        segmentNodeGroups.push(groupNodes);
      }

      for (let idx = 0; idx < ops.length; idx++) {
        const fromGroup = segmentNodeGroups[idx];
        const toGroup = segmentNodeGroups[idx + 1];
        const currentOp = ops[idx];
        for (const src of fromGroup) {
          for (const tgt of toGroup) {
            edges.push({
              id: `e_${++edgeSeq}`,
              source: src.id,
              target: tgt.id,
              label: currentOp.label || undefined,
              edgeStyle: currentOp.edgeStyle,
              lineNumber: lineNo,
            });
          }
        }
      }
    }
  }

  if (subgraphStack.length > 0) {
    return {
      ok: false,
      error: {
        line: lines.length,
        message: `Unclosed subgraph "${subgraphStack[subgraphStack.length - 1]}" (missing "end")`,
        severity: 'error',
      },
    };
  }

  // Apply manual positions from %% @pos comments
  for (const node of nodes) {
    const pos = manualPosMap.get(node.id);
    if (pos) node.manualPosition = pos;
  }

  // Apply linkStyles to edges
  for (const ls of pendingLinkStyles) {
    const edge = edges[ls.index];
    if (edge) {
      const props = parseStyleProps(ls.raw);
      if (props.stroke) edge.color = props.stroke;
      if (props.strokeWidth) edge.strokeWidth = props.strokeWidth;
    }
  }

  // Hydrate classDef styles for visual preview while keeping explicit styles prioritized
  for (const node of nodes) {
    for (const cls of node.classes) {
      const def = classDefMap.get(cls);
      if (def) {
        node.style = { ...def.parsedStyle, ...node.style };
      }
    }
  }

  while (leadingLines.length > 0 && leadingLines[leadingLines.length - 1].trim() === '') {
    leadingLines.pop();
  }

  return {
    ok: true,
    ast: {
      kind: 'flowchart',
      keyword,
      direction,
      leadingLines,
      nodes,
      edges,
      subgraphs,
      classDefs,
      extraLines,
      warnings,
    },
  };
}
