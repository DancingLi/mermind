/**
 * Extract all ```mermaid ... ``` fenced code blocks from a Markdown document.
 */
export function extractMermaidBlocksFromMarkdown(markdown: string): string[] {
  const blocks: string[] = [];
  const normalized = markdown.replace(/\r\n/g, '\n');
  const re = /```mermaid[ \t]*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    const body = match[1].trim();
    if (body) blocks.push(body);
  }
  return blocks;
}

/**
 * Wrap Mermaid source code into a Markdown fenced block for clipboard copy or export.
 */
export function wrapAsMarkdownBlock(code: string): string {
  return `\`\`\`mermaid\n${code.trimEnd()}\n\`\`\`\n`;
}
