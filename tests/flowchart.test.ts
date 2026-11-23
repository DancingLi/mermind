import { describe, expect, it } from 'vitest';
import { parseFlowchart } from '@shared/mermaid/flowchartParser';
import { serializeFlowchart } from '@shared/mermaid/flowchartSerializer';
import {
  addFlowchartDownstreamNode,
  addFlowchartEdge,
  addFlowchartNode,
  addFlowchartSiblingNode,
  addFlowchartSubgraph,
  clearAllManualPositions,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  setFlowchartDirection,
  setFlowchartNodeManualPosition,
  updateFlowchartEdge,
  updateFlowchartNode,
} from '@shared/mermaid/flowchartOps';

describe('Flowchart parser, serializer & AST ops', () => {
  const sample = `flowchart TD
  Start([提交需求]) --> Check{是否通过}
  Check -->|通过| Dev[进入开发]
  Check -- 驳回 --> Revise(补充材料)
  Revise -.-> Start

  subgraph QAStage[测试阶段]
    Dev ==> Test[(自动化测试)]
    Test <--> Verify((验收))
  end

  style Start fill:#dbeafe,stroke:#2563eb,color:#1e3a8a
  %% @pos Check:320,180`;

  it('parses direction, shapes, edges, subgraphs, styles, and %% @pos comments', () => {
    const res = parseFlowchart(sample);
    expect(res.ok).toBe(true);
    const ast = res.ast!;
    expect(ast.direction).toBe('TD');
    expect(ast.nodes).toHaveLength(6);
    expect(ast.edges).toHaveLength(6);
    expect(ast.subgraphs).toHaveLength(1);
    expect(ast.subgraphs[0]).toMatchObject({ id: 'QAStage', title: '测试阶段' });

    const start = ast.nodes.find((n) => n.id === 'Start')!;
    expect(start.shape).toBe('stadium');
    expect(start.style).toEqual({ fill: '#dbeafe', stroke: '#2563eb', color: '#1e3a8a' });

    const check = ast.nodes.find((n) => n.id === 'Check')!;
    expect(check.shape).toBe('diamond');
    expect(check.manualPosition).toEqual({ x: 320, y: 180 });

    const testNode = ast.nodes.find((n) => n.id === 'Test')!;
    expect(testNode.shape).toBe('cylinder');
    expect(testNode.subgraphId).toBe('QAStage');

    const reviseEdge = ast.edges.find((e) => e.source === 'Revise' && e.target === 'Start')!;
    expect(reviseEdge.edgeStyle).toBe('dotted-arrow');

    const rejectEdge = ast.edges.find((e) => e.source === 'Check' && e.target === 'Revise')!;
    expect(rejectEdge.label).toBe('驳回');
  });

  it('round-trips flowchart AST including subgraphs, styles, and %% @pos', () => {
    const ast = parseFlowchart(sample).ast!;
    const code = serializeFlowchart(ast);
    expect(code).toContain('%% @pos Check:320,180');
    expect(code).toContain('style Start fill:#dbeafe,stroke:#2563eb,color:#1e3a8a');
    expect(code).toContain('subgraph QAStage[测试阶段]');

    const reparsed = parseFlowchart(code);
    expect(reparsed.ok).toBe(true);
    expect(reparsed.ast!.nodes).toHaveLength(6);
    expect(reparsed.ast!.edges).toHaveLength(6);
    expect(reparsed.ast!.nodes.find((n) => n.id === 'Check')!.manualPosition).toEqual({
      x: 320,
      y: 180,
    });
  });

  it('supports Tab downstream, Enter sibling, manual positioning, auto-tidy clear, and subgraph creation', () => {
    let ast = parseFlowchart('flowchart LR\n  A[Start] --> B[Step 1]').ast!;

    // Tab on B -> adds downstream connected node C
    const tabRes = addFlowchartDownstreamNode(ast, 'B', 'Step 2');
    ast = tabRes.ast;
    expect(ast.nodes).toHaveLength(3);
    expect(ast.edges.some((e) => e.source === 'B' && e.target === tabRes.newNodeId)).toBe(true);

    // Enter on B -> adds sibling connected from A
    const enterRes = addFlowchartSiblingNode(ast, 'B', 'Step 1B');
    ast = enterRes.ast;
    expect(ast.edges.some((e) => e.source === 'A' && e.target === enterRes.newNodeId)).toBe(true);

    // Manual drag position persists as %% @pos, then Auto-Tidy clears all %% @pos comments
    ast = setFlowchartNodeManualPosition(ast, 'B', { x: 412.6, y: 98.2 });
    const withPos = serializeFlowchart(ast);
    expect(withPos).toContain('%% @pos B:413,98');

    ast = clearAllManualPositions(ast);
    const cleaned = serializeFlowchart(ast);
    expect(cleaned).not.toContain('%% @pos');

    // Direction, node style, edge update, subgraph, delete
    ast = setFlowchartDirection(ast, 'TD');
    ast = updateFlowchartNode(ast, 'A', {
      shape: 'stadium',
      style: { fill: '#fef3c7', stroke: '#d97706', color: '#92400e' },
    });
    const edgeId = ast.edges[0].id;
    ast = updateFlowchartEdge(ast, edgeId, { label: '开始', edgeStyle: 'thick-arrow', color: '#dc2626' });
    const sgRes = addFlowchartSubgraph(ast, '主流程', ['B', tabRes.newNodeId]);
    ast = sgRes.ast;

    const addedNode = addFlowchartNode(ast, { label: '独立节点', shape: 'hexagon' });
    ast = addFlowchartEdge(addedNode.ast, tabRes.newNodeId, addedNode.newNodeId, 'dotted-arrow', '异步').ast;

    const finalCode = serializeFlowchart(ast);
    const reparsed = parseFlowchart(finalCode);
    expect(reparsed.ok).toBe(true);
    expect(reparsed.ast!.direction).toBe('TD');
    expect(reparsed.ast!.subgraphs).toHaveLength(1);
    const abEdge = reparsed.ast!.edges.find((e) => e.source === 'A' && e.target === 'B');
    expect(abEdge?.color).toBe('#dc2626');
    expect(abEdge?.label).toBe('开始');

    // Delete edge & node
    const afterDelEdge = deleteFlowchartEdge(reparsed.ast!, reparsed.ast!.edges[0].id);
    expect(afterDelEdge.edges).toHaveLength(reparsed.ast!.edges.length - 1);
    const afterDelNode = deleteFlowchartNode(afterDelEdge, 'A');
    expect(afterDelNode.nodes.find((n) => n.id === 'A')).toBeUndefined();
  });

  it('handles chained edges and ampersand fan-out', () => {
    const res = parseFlowchart('flowchart LR\n  A & B --> C --> D');
    expect(res.ok).toBe(true);
    expect(res.ast!.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(res.ast!.edges).toHaveLength(3);
  });

  it('reports syntax errors cleanly on unclosed subgraph', () => {
    const res = parseFlowchart('flowchart TD\n  subgraph G1[Group]\n    A --> B');
    expect(res.ok).toBe(false);
    expect(res.error?.message).toContain('Unclosed subgraph');
  });
});
