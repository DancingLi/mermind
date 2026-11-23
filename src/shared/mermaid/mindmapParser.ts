import type {
  MindmapAST,
  MindmapNode,
  MindmapShape,
  NodeVisualStyle,
  ParseDiagnostic,
  ParseResult,
} from '../types';

const STYLE_CLASS_PREFIX = 'mm_s';

interface ParsedStyleMap {
  [className: string]: NodeVisualStyle;
}

/**
 * Extract custom mindmap node styles from %%{init: {"themeCSS": ...}}%% or %% @style comments or classDef lines.
 */
function parseStyleHintsFromLine(line: string, styleMap: ParsedStyleMap): boolean {
  const trimmed = line.trim();

  // Check %% @style className fill:#...,stroke:#...,color:#...
  const commentStyle = trimmed.match(/^%%\s*@style\s+([A-Za-z0-9_-]+)\s+(.+)$/);
  if (commentStyle) {
    const [, cls, body] = commentStyle;
    styleMap[cls] = parseCssProps(body);
    return true;
  }

  // Check %%{init: {"themeCSS": "..."}}%% containing .mm_sN rules
  if (trimmed.startsWith('%%{') && trimmed.includes('themeCSS') && trimmed.includes(`.${STYLE_CLASS_PREFIX}`)) {
    const initMatch = trimmed.match(/^%%\{\s*init\s*:\s*(\{[\s\S]*\})\s*\}%%$/);
    if (initMatch) {
      try {
        const parsed = JSON.parse(initMatch[1]);
        if (typeof parsed.themeCSS === 'string') {
          extractThemeCssClasses(parsed.themeCSS, styleMap);
          return true;
        }
      } catch {
        // Fallback regex extraction if JSON has single quotes
        const cssMatch = trimmed.match(/themeCSS['"]?\s*:\s*['"]([^'"]+)['"]/);
        if (cssMatch) {
          extractThemeCssClasses(cssMatch[1], styleMap);
          return true;
        }
      }
    }
  }

  return false;
}

function extractThemeCssClasses(css: string, styleMap: ParsedStyleMap): void {
  // Match blocks like: .mm_s1 rect, .mm_s1 path { fill: #fee2e2 !important; stroke: #ef4444 !important; }
  const blockRe = /([^{}]+)\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css)) !== null) {
    const selector = m[1];
    const body = m[2];
    const clsMatches = selector.match(new RegExp(`\\.(${STYLE_CLASS_PREFIX}[A-Za-z0-9_-]*)`, 'g'));
    if (!clsMatches) continue;
    const cls = clsMatches[0].slice(1);
    const prev = styleMap[cls] ?? {};
    const fillMatch = body.match(/(?:^|;)\s*fill\s*:\s*([^;!]+)/i);
    const strokeMatch = body.match(/(?:^|;)\s*stroke\s*:\s*([^;!]+)/i);
    const colorMatch = body.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
    const strokeWidthMatch = body.match(/(?:^|;)\s*stroke-width\s*:\s*([^;!]+)/i);

    if (selector.includes('span') || selector.includes('nodeLabel') || selector.includes('text')) {
      if (colorMatch) prev.color = colorMatch[1].trim();
      else if (fillMatch && !prev.color) prev.color = fillMatch[1].trim();
    } else {
      if (fillMatch) prev.fill = fillMatch[1].trim();
      if (strokeMatch) prev.stroke = strokeMatch[1].trim();
      if (strokeWidthMatch) prev.strokeWidth = strokeWidthMatch[1].trim();
      if (colorMatch) prev.color = colorMatch[1].trim();
    }
    styleMap[cls] = prev;
  }
}

function parseCssProps(raw: string): NodeVisualStyle {
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

function unquoteLabel(raw: string): string {
  const s = raw.trim();
  if (s.length >= 2 && s.startsWith('"`') && s.endsWith('`"')) {
    return s.slice(2, -2);
  }
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"');
  }
  return s;
}

interface ParsedNodeToken {
  rawId?: string;
  label: string;
  shape: MindmapShape;
  inlineClasses: string[];
}

export function parseMindmapNodeToken(rawText: string): ParsedNodeToken {
  let text = rawText.trim();
  const inlineClasses: string[] = [];

  // Extract trailing inline :::className markers
  while (true) {
    const clsMatch = text.match(/\s*:::\s*([A-Za-z0-9_-]+)\s*$/);
    if (!clsMatch) break;
    inlineClasses.unshift(clsMatch[1]);
    text = text.slice(0, clsMatch.index).trim();
  }

  // Ordered shape matchers (longest delimiters first!)
  const shapePatterns: Array<{ shape: MindmapShape; re: RegExp }> = [
    { shape: 'circle', re: /^([A-Za-z0-9_-]*)\(\(([\s\S]+)\)\)$/ },
    { shape: 'bang', re: /^([A-Za-z0-9_-]*)\)\)([\s\S]+)\(\($/ },
    { shape: 'hexagon', re: /^([A-Za-z0-9_-]*)\{\{([\s\S]+)\}\}$/ },
    { shape: 'square', re: /^([A-Za-z0-9_-]*)\[([\s\S]+)\]$/ },
    { shape: 'rounded', re: /^([A-Za-z0-9_-]*)\(([\s\S]+)\)$/ },
    { shape: 'cloud', re: /^([A-Za-z0-9_-]*)\)([\s\S]+)\($/ },
  ];

  for (const { shape, re } of shapePatterns) {
    const m = text.match(re);
    if (m) {
      const rawId = m[1] ? m[1].trim() : undefined;
      const inner = unquoteLabel(m[2]);
      // Guard against false-positive shape match when inner has unbalanced brackets like "a) b (c"
      if (shape === 'cloud' && (inner.includes('(') || inner.includes(')'))) {
        continue;
      }
      return {
        rawId: rawId || undefined,
        label: inner,
        shape,
        inlineClasses,
      };
    }
  }

  return {
    label: unquoteLabel(text),
    shape: 'default',
    inlineClasses,
  };
}

function getIndentWidth(line: string): number {
  let indent = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === ' ') indent += 1;
    else if (ch === '\t') indent += 2;
    else break;
  }
  return indent;
}

export function parseMindmap(code: string): ParseResult<MindmapAST> {
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const leadingLines: string[] = [];
  const trailingLines: string[] = [];
  const warnings: ParseDiagnostic[] = [];
  const styleMap: ParsedStyleMap = {};

  let i = 0;
  let foundHeader = false;
  let inInitBlock = false;

  // 1. Scan leading lines until `mindmap`
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
      const isManagedStyle = parseStyleHintsFromLine(trimmed, styleMap);
      if (!isManagedStyle) {
        leadingLines.push(raw);
      }
      if (!trimmed.includes('}%%')) inInitBlock = true;
      continue;
    }

    if (trimmed.startsWith('%%')) {
      const isManagedStyle = parseStyleHintsFromLine(trimmed, styleMap);
      if (!isManagedStyle) {
        leadingLines.push(raw);
      }
      continue;
    }

    if (/^mindmap\b/i.test(trimmed)) {
      foundHeader = true;
      i++;
      break;
    }

    return {
      ok: false,
      error: {
        line: i + 1,
        message: `Expected "mindmap" header, found "${trimmed}"`,
        severity: 'error',
      },
    };
  }

  if (!foundHeader) {
    return {
      ok: false,
      error: {
        line: 1,
        message: 'Missing "mindmap" declaration',
        severity: 'error',
      },
    };
  }

  // 2. Parse indentation-based tree
  const stack: Array<{ indent: number; node: MindmapNode }> = [];
  let root: MindmapNode | null = null;
  let lastNode: MindmapNode | null = null;
  let nodeSeq = 0;

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const lineNo = i + 1;

    if (!trimmed) continue;

    if (trimmed.startsWith('%%')) {
      const isManagedStyle = parseStyleHintsFromLine(trimmed, styleMap);
      if (!isManagedStyle) {
        trailingLines.push(trimmed);
      }
      continue;
    }

    // classDef inside mindmap (in case user writes it manually)
    const classDefMatch = trimmed.match(/^classDef\s+([A-Za-z0-9_-]+)\s+(.+)$/i);
    if (classDefMatch) {
      styleMap[classDefMatch[1]] = parseCssProps(classDefMatch[2]);
      continue;
    }

    // Metadata line: ::icon(...)
    const iconMatch = trimmed.match(/^::icon\((.+)\)$/);
    if (iconMatch) {
      const target = lastNode ?? (stack.length > 0 ? stack[stack.length - 1].node : null);
      if (target) {
        target.icon = iconMatch[1].trim();
      } else {
        warnings.push({ line: lineNo, message: 'Orphan ::icon directive ignored', severity: 'warning' });
      }
      continue;
    }

    // Metadata line: :::class1 class2
    const clsLineMatch = trimmed.match(/^:::\s*(.+)$/);
    if (clsLineMatch) {
      const target = lastNode ?? (stack.length > 0 ? stack[stack.length - 1].node : null);
      if (target) {
        const classes = clsLineMatch[1]
          .split(/[\s,]+/)
          .map((c) => c.trim())
          .filter(Boolean);
        for (const cls of classes) {
          if (!target.classes.includes(cls)) target.classes.push(cls);
        }
      } else {
        warnings.push({ line: lineNo, message: 'Orphan :::class directive ignored', severity: 'warning' });
      }
      continue;
    }

    const indent = getIndentWidth(raw);
    const token = parseMindmapNodeToken(trimmed);
    const uid = `mm_${++nodeSeq}`;

    const node: MindmapNode = {
      uid,
      rawId: token.rawId,
      label: token.label,
      shape: token.shape,
      classes: [...token.inlineClasses],
      children: [],
      lineNumber: lineNo,
    };

    if (!root) {
      root = node;
      stack.push({ indent, node });
      lastNode = node;
      continue;
    }

    // Pop stack until we find a parent with strictly smaller indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (indent <= stack[0].indent) {
      // Multiple roots are invalid in Mermaid mindmap; attach under root with warning
      warnings.push({
        line: lineNo,
        message: `Node "${token.label}" has indent <= root; attached under root.`,
        severity: 'warning',
      });
      root.children.push(node);
      stack.length = 1;
      stack.push({ indent: stack[0].indent + 2, node });
    } else {
      stack[stack.length - 1].node.children.push(node);
      stack.push({ indent, node });
    }
    lastNode = node;
  }

  if (!root) {
    return {
      ok: false,
      error: {
        line: i,
        message: 'Mindmap must contain at least one root node',
        severity: 'error',
      },
    };
  }

  // 3. Hydrate custom styles from styleMap onto nodes
  const applyStyles = (node: MindmapNode) => {
    const remainingClasses: string[] = [];
    for (const cls of node.classes) {
      if (styleMap[cls]) {
        node.style = { ...node.style, ...styleMap[cls] };
        if (!cls.startsWith(STYLE_CLASS_PREFIX)) {
          remainingClasses.push(cls);
        }
      } else {
        remainingClasses.push(cls);
      }
    }
    node.classes = remainingClasses;
    for (const child of node.children) applyStyles(child);
  };
  applyStyles(root);

  // Trim blank trailing lines from leadingLines
  while (leadingLines.length > 0 && leadingLines[leadingLines.length - 1].trim() === '') {
    leadingLines.pop();
  }

  return {
    ok: true,
    ast: {
      kind: 'mindmap',
      leadingLines,
      root,
      trailingLines,
      warnings,
    },
  };
}
