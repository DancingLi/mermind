import { describe, expect, it } from 'vitest';
import { detectDiagramKind } from '@shared/mermaid/detect';
import { parseMindmap } from '@shared/mermaid/mindmapParser';
import { serializeMindmap } from '@shared/mermaid/mindmapSerializer';
import {
  addMindmapChild,
  addMindmapSibling,
  countMindmapNodes,
  deleteMindmapNode,
  mindmapToMarkdownOutline,
  moveMindmapNodeOrder,
  promoteMindmapNode,
  reparentMindmapNode,
  updateMindmapNodeLabel,
  updateMindmapNodeShape,
  updateMindmapNodeStyle,
} from '@shared/mermaid/mindmapOps';

describe('Mermaid diagram detection', () => {
  it('detects mindmap, flowchart, graph, and other diagrams with leading directives', () => {
    expect(detectDiagramKind('%% comment\nmindmap\n  root((A))')).toEqual({
      kind: 'mindmap',
      rawType: 'mindmap',
    });
    expect(detectDiagramKind('%%{init: {"theme": "dark"}}%%\nflowchart LR\n  A --> B')).toEqual({
      kind: 'flowchart',
      rawType: 'flowchart',
    });
    expect(detectDiagramKind('---\ntitle: Test\n---\ngraph TD\n  A --> B')).toEqual({
      kind: 'flowchart',
      rawType: 'graph',
    });
    expect(detectDiagramKind('sequenceDiagram\n  Alice->>Bob: Hi')).toEqual({
      kind: 'other',
      rawType: 'sequenceDiagram',
    });
  });
});

describe('Mindmap parser, serializer & AST ops', () => {
  const sample = `mindmap
  root((产品规划))
    核心能力
      sync["双向同步引擎"]
      ui(交互式画布)
      ::icon(fa fa-bolt)
    商业化
      plan{{订阅方案}}
      alert))风控告警((
      idea)头脑风暴(`;

  it('parses hierarchy, shapes, rawIds, and icons accurately', () => {
    const res = parseMindmap(sample);
    expect(res.ok).toBe(true);
    const ast = res.ast!;
    expect(ast.root.rawId).toBe('root');
    expect(ast.root.shape).toBe('circle');
    expect(ast.root.label).toBe('产品规划');
    expect(ast.root.children).toHaveLength(2);

    const core = ast.root.children[0];
    expect(core.label).toBe('核心能力');
    expect(core.children[0].shape).toBe('square');
    expect(core.children[0].label).toBe('双向同步引擎');
    expect(core.children[1].shape).toBe('rounded');
    expect(core.children[1].icon).toBe('fa fa-bolt');

    const biz = ast.root.children[1];
    expect(biz.children[0].shape).toBe('hexagon');
    expect(biz.children[1].shape).toBe('bang');
    expect(biz.children[2].shape).toBe('cloud');
    expect(countMindmapNodes(ast.root)).toBe(8);
  });

  it('round-trips cleanly without emitting extra directives when no custom styles exist', () => {
    const res = parseMindmap(sample);
    const serialized = serializeMindmap(res.ast!);
    expect(serialized).not.toContain('themeCSS');

    const reparsed = parseMindmap(serialized);
    expect(reparsed.ok).toBe(true);
    expect(countMindmapNodes(reparsed.ast!.root)).toBe(8);
    expect(reparsed.ast!.root.children[1].children[1].shape).toBe('bang');
    expect(reparsed.ast!.root.children[0].children[1].icon).toBe('fa fa-bolt');
  });

  it('supports Tab (addChild), Enter (addSibling), Delete, Reparent, Reorder, Promote', () => {
    const base = parseMindmap('mindmap\n  root((Root))\n    Branch A\n    Branch B').ast!;
    const branchA = base.root.children[0];
    const branchB = base.root.children[1];

    // Tab: add child to Branch A
    const afterChild = addMindmapChild(base, branchA.uid, 'Child A1');
    expect(afterChild.ast.root.children[0].children).toHaveLength(1);
    expect(afterChild.ast.root.children[0].children[0].label).toBe('Child A1');

    // Enter: add sibling right after Child A1
    const afterSibling = addMindmapSibling(afterChild.ast, afterChild.newNodeUid, 'Child A2');
    expect(afterSibling.ast.root.children[0].children.map((c) => c.label)).toEqual([
      'Child A1',
      'Child A2',
    ]);

    // Enter on root creates a child
    const afterRootEnter = addMindmapSibling(afterSibling.ast, base.root.uid, 'Branch C');
    expect(afterRootEnter.ast.root.children.map((c) => c.label)).toEqual([
      'Branch A',
      'Branch B',
      'Branch C',
    ]);

    // Reparent Child A2 under Branch B
    const afterReparent = reparentMindmapNode(afterSibling.ast, afterSibling.newNodeUid, branchB.uid);
    expect(afterReparent.root.children[0].children).toHaveLength(1);
    expect(afterReparent.root.children[1].children[0].label).toBe('Child A2');

    // Guard against cyclic reparenting (dropping Branch A into its own child Child A1)
    const cycleAttempt = reparentMindmapNode(afterReparent, branchA.uid, afterChild.newNodeUid);
    expect(cycleAttempt.root.children).toHaveLength(2);

    // Promote Child A2 up to root's children
    const afterPromote = promoteMindmapNode(afterReparent, afterSibling.newNodeUid);
    expect(afterPromote.root.children.map((c) => c.label)).toEqual([
      'Branch A',
      'Branch B',
      'Child A2',
    ]);

    // Reorder Branch B up
    const afterReorder = moveMindmapNodeOrder(afterPromote, branchB.uid, 'up');
    expect(afterReorder.root.children.map((c) => c.label)).toEqual([
      'Branch B',
      'Branch A',
      'Child A2',
    ]);

    // Delete Child A2
    const afterDelete = deleteMindmapNode(afterReorder, afterSibling.newNodeUid);
    expect(afterDelete.ast.root.children).toHaveLength(2);
  });

  it('round-trips per-node custom colors via standard Mermaid themeCSS + :::class', () => {
    let ast = parseMindmap('mindmap\n  root((Root))\n    Alert Node\n    Normal Node').ast!;
    const alertUid = ast.root.children[0].uid;

    ast = updateMindmapNodeShape(ast, alertUid, 'rounded');
    ast = updateMindmapNodeLabel(ast, alertUid, '高优先级风险');
    ast = updateMindmapNodeStyle(ast, alertUid, {
      fill: '#fee2e2',
      stroke: '#ef4444',
      color: '#991b1b',
    });

    const code = serializeMindmap(ast);
    expect(code).toContain('%%{init:');
    expect(code).toContain('themeCSS');
    expect(code).toContain(':::mm_s1');

    const reparsed = parseMindmap(code);
    expect(reparsed.ok).toBe(true);
    const node = reparsed.ast!.root.children[0];
    expect(node.label).toBe('高优先级风险');
    expect(node.shape).toBe('rounded');
    expect(node.style).toEqual({
      fill: '#fee2e2',
      stroke: '#ef4444',
      color: '#991b1b',
    });
  });

  it('exports clean Markdown outline', () => {
    const ast = parseMindmap('mindmap\n  root((主标题))\n    章节一\n      细节A\n    章节二').ast!;
    const md = mindmapToMarkdownOutline(ast);
    expect(md).toBe('# 主标题\n\n- 章节一\n  - 细节A\n- 章节二\n');
  });

  it('reports helpful error on invalid mindmap header or empty body', () => {
    expect(parseMindmap('flowchart TD\n  A --> B').ok).toBe(false);
    expect(parseMindmap('mindmap\n').ok).toBe(false);
  });
});
