import type { DiagramDetection } from '../types';

/**
 * Detect whether Mermaid source text is a mindmap, flowchart/graph, or another diagram type.
 * Properly skips leading blank lines, comments (%% ...), init directives (%%{...}%%), and YAML frontmatter.
 */
export function detectDiagramKind(code: string): DiagramDetection {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  let i = 0;

  // Skip leading whitespace
  while (i < lines.length && lines[i].trim() === '') i++;

  // Skip YAML frontmatter --- ... ---
  if (i < lines.length && lines[i].trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    if (i < lines.length && lines[i].trim() === '---') i++;
  }

  let inInitBlock = false;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    if (inInitBlock) {
      if (trimmed.includes('}%%')) {
        inInitBlock = false;
      }
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      if (!trimmed.includes('}%%')) {
        inInitBlock = true;
      }
      continue;
    }

    if (trimmed.startsWith('%%')) continue;

    // Found the first semantic diagram declaration line
    if (/^mindmap\b/i.test(trimmed)) {
      return { kind: 'mindmap', rawType: 'mindmap' };
    }

    const flowMatch = trimmed.match(/^(flowchart|graph)(?:\s+(TD|TB|BT|RL|LR))?\b/i);
    if (flowMatch) {
      return { kind: 'flowchart', rawType: flowMatch[1].toLowerCase() };
    }

    const tokenMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)/);
    return {
      kind: 'other',
      rawType: tokenMatch ? tokenMatch[1] : 'unknown',
    };
  }

  return { kind: 'other', rawType: 'empty' };
}
