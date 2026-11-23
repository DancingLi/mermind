import type { MindmapAST, MindmapNode, NodeVisualStyle } from '../types';

const STYLE_CLASS_PREFIX = 'mm_s';

function styleSignature(style: NodeVisualStyle): string {
  return [
    style.fill ?? '',
    style.stroke ?? '',
    style.color ?? '',
    style.strokeWidth ?? '',
  ].join('|');
}

function hasCustomStyle(style?: NodeVisualStyle): style is NodeVisualStyle {
  return Boolean(style && (style.fill || style.stroke || style.color || style.strokeWidth));
}

function sanitizeLabel(label: string): string {
  return label.replace(/\r?\n/g, ' ').trim() || 'Untitled';
}

function needsQuotesForDefault(label: string): boolean {
  return /[()[\]{}]/.test(label) || /^::/.test(label) || /^%%/.test(label);
}

function formatMindmapNode(node: MindmapNode, isRoot: boolean): string {
  const cleanLabel = sanitizeLabel(node.label);
  const idPrefix = node.rawId ?? (isRoot && node.shape !== 'default' ? 'root' : '');

  switch (node.shape) {
    case 'circle':
      return `${idPrefix}((${cleanLabel}))`;
    case 'rounded':
      return `${idPrefix}(${cleanLabel})`;
    case 'square':
      return `${idPrefix}[${cleanLabel}]`;
    case 'bang':
      return `${idPrefix}))${cleanLabel}((`;
    case 'cloud':
      return `${idPrefix})${cleanLabel}(`;
    case 'hexagon':
      return `${idPrefix}{{${cleanLabel}}}`;
    case 'default':
    default: {
      if (needsQuotesForDefault(cleanLabel)) {
        const escaped = cleanLabel.replace(/"/g, "'");
        return `["${escaped}"]`;
      }
      return cleanLabel;
    }
  }
}

/**
 * Serialize a MindmapAST back into 100% standard Mermaid mindmap code.
 * Custom node colors emit a single standards-compliant %%{init: {"themeCSS": ...}}%% block
 * + :::mm_sN classes so official mermaid.js, GitHub, and Obsidian render the exact same colors.
 */
export function serializeMindmap(ast: MindmapAST): string {
  const styleRegistry = new Map<string, { className: string; style: NodeVisualStyle }>();

  const registerStyles = (node: MindmapNode) => {
    if (hasCustomStyle(node.style)) {
      const sig = styleSignature(node.style);
      if (!styleRegistry.has(sig)) {
        const className = `${STYLE_CLASS_PREFIX}${styleRegistry.size + 1}`;
        styleRegistry.set(sig, { className, style: node.style });
      }
    }
    for (const child of node.children) registerStyles(child);
  };
  registerStyles(ast.root);

  const lines: string[] = [];

  // Preserve leading user directives/comments
  for (const l of ast.leadingLines) {
    lines.push(l);
  }

  // Emit themeCSS directive ONLY if at least one node has custom colors
  if (styleRegistry.size > 0) {
    const cssRules: string[] = [];
    for (const { className, style } of styleRegistry.values()) {
      const shapeDecls: string[] = [];
      if (style.fill) shapeDecls.push(`fill: ${style.fill} !important`);
      if (style.stroke) shapeDecls.push(`stroke: ${style.stroke} !important`);
      if (style.strokeWidth) shapeDecls.push(`stroke-width: ${style.strokeWidth} !important`);
      if (shapeDecls.length > 0) {
        cssRules.push(
          `.${className} rect, .${className} path, .${className} circle, .${className} polygon { ${shapeDecls.join('; ')}; }`,
        );
      }
      if (style.color) {
        cssRules.push(
          `.${className} span, .${className} .nodeLabel, .${className} text { color: ${style.color} !important; fill: ${style.color} !important; }`,
        );
      }
    }
    if (cssRules.length > 0) {
      lines.push(`%%{init: ${JSON.stringify({ themeCSS: cssRules.join(' ') })}}%%`);
    }
  }

  lines.push('mindmap');

  const emitNode = (node: MindmapNode, depth: number) => {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}${formatMindmapNode(node, depth === 1)}`);

    const metaIndent = '  '.repeat(depth + 1);
    if (node.icon) {
      lines.push(`${metaIndent}::icon(${node.icon})`);
    }

    const classes = [...node.classes];
    if (hasCustomStyle(node.style)) {
      const reg = styleRegistry.get(styleSignature(node.style));
      if (reg && !classes.includes(reg.className)) {
        classes.push(reg.className);
      }
    }
    if (classes.length > 0) {
      lines.push(`${metaIndent}:::${classes.join(' ')}`);
    }

    for (const child of node.children) {
      emitNode(child, depth + 1);
    }
  };

  emitNode(ast.root, 1);

  for (const t of ast.trailingLines) {
    lines.push(`  ${t}`);
  }

  return lines.join('\n');
}
