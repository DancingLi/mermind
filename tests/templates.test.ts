import { describe, expect, it } from 'vitest';
import { DIAGRAM_TEMPLATES, getTemplateById } from '../src/shared/mermaid/templates';
import { detectDiagramKind } from '../src/shared/mermaid/detect';
import { parseMindmap } from '../src/shared/mermaid/mindmapParser';
import { parseFlowchart } from '../src/shared/mermaid/flowchartParser';

describe('DIAGRAM_TEMPLATES', () => {
  it('includes blank templates for mindmap, flowchart, and sequence diagram', () => {
    const ids = DIAGRAM_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('mindmap-blank');
    expect(ids).toContain('flowchart-blank');
    expect(ids).toContain('other-sequence-blank');

    expect(getTemplateById('flowchart-blank').kind).toBe('flowchart');
    expect(getTemplateById('other-sequence-blank').kind).toBe('other');
  });

  it('every template detects and parses cleanly in both zh and en', () => {
    for (const tpl of DIAGRAM_TEMPLATES) {
      for (const lang of ['zh', 'en'] as const) {
        const code = tpl.code[lang];
        const detected = detectDiagramKind(code);
        expect(detected.kind).toBe(tpl.kind);

        if (tpl.kind === 'mindmap') {
          const parsed = parseMindmap(code);
          expect(parsed.ok).toBe(true);
        } else if (tpl.kind === 'flowchart') {
          const parsed = parseFlowchart(code);
          expect(parsed.ok).toBe(true);
          expect(parsed.ast?.nodes.length).toBeGreaterThanOrEqual(2);
        } else {
          expect(detected.rawType).toBe('sequenceDiagram');
        }
      }
    }
  });
});
