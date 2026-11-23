import { describe, expect, it } from 'vitest';
import { extractMermaidBlocksFromMarkdown, wrapAsMarkdownBlock } from '@shared/mermaid/markdown';

describe('Markdown Mermaid extraction', () => {
  it('extracts multiple fenced mermaid code blocks cleanly', () => {
    const md = `# Architecture Notes

Here is the overview:

\`\`\`mermaid
mindmap
  root((System))
    Frontend
    Backend
\`\`\`

Some prose and a non-mermaid block:

\`\`\`ts
const x = 1;
\`\`\`

And a flow:

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`
`;
    const blocks = extractMermaidBlocksFromMarkdown(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('root((System))');
    expect(blocks[1]).toContain('flowchart LR');
  });

  it('wraps Mermaid source cleanly into a fenced Markdown block', () => {
    expect(wrapAsMarkdownBlock('mindmap\n  root((A))')).toBe('```mermaid\nmindmap\n  root((A))\n```\n');
  });
});
