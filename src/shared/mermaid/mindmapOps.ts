import type { MindmapAST, MindmapNode, MindmapShape, NodeVisualStyle } from '../types';

function cloneNode(node: MindmapNode): MindmapNode {
  return {
    ...node,
    classes: [...node.classes],
    style: node.style ? { ...node.style } : undefined,
    children: node.children.map(cloneNode),
  };
}

export function cloneMindmapAST(ast: MindmapAST): MindmapAST {
  return {
    ...ast,
    leadingLines: [...ast.leadingLines],
    trailingLines: [...ast.trailingLines],
    warnings: [...ast.warnings],
    root: cloneNode(ast.root),
  };
}

function generateUid(root: MindmapNode): string {
  const used = new Set<string>();
  const walk = (n: MindmapNode) => {
    used.add(n.uid);
    n.children.forEach(walk);
  };
  walk(root);
  let i = used.size + 1;
  while (used.has(`mm_${i}`)) i++;
  return `mm_${i}`;
}

export function findMindmapNode(
  root: MindmapNode,
  uid: string,
): { node: MindmapNode; parent: MindmapNode | null; index: number } | null {
  if (root.uid === uid) return { node: root, parent: null, index: 0 };
  const walk = (parent: MindmapNode): { node: MindmapNode; parent: MindmapNode; index: number } | null => {
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child.uid === uid) return { node: child, parent, index: i };
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  return walk(root);
}

export function isDescendant(ancestor: MindmapNode, targetUid: string): boolean {
  for (const child of ancestor.children) {
    if (child.uid === targetUid || isDescendant(child, targetUid)) return true;
  }
  return false;
}

export function countMindmapNodes(root: MindmapNode): number {
  let count = 1;
  for (const child of root.children) count += countMindmapNodes(child);
  return count;
}

export function addMindmapChild(
  ast: MindmapAST,
  parentUid: string,
  label = '新主题',
): { ast: MindmapAST; newNodeUid: string } {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, parentUid);
  const target = found ? found.node : next.root;
  const newNodeUid = generateUid(next.root);
  target.children.push({
    uid: newNodeUid,
    label,
    shape: 'default',
    classes: [],
    children: [],
  });
  return { ast: next, newNodeUid };
}

export function addMindmapSibling(
  ast: MindmapAST,
  siblingUid: string,
  label = '新主题',
): { ast: MindmapAST; newNodeUid: string } {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, siblingUid);
  if (!found || !found.parent) {
    // Pressing Enter on root creates a child
    return addMindmapChild(ast, next.root.uid, label);
  }
  const newNodeUid = generateUid(next.root);
  found.parent.children.splice(found.index + 1, 0, {
    uid: newNodeUid,
    label,
    shape: 'default',
    classes: [],
    children: [],
  });
  return { ast: next, newNodeUid };
}

export function updateMindmapNodeLabel(ast: MindmapAST, uid: string, label: string): MindmapAST {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, uid);
  if (found) {
    found.node.label = label.trim() || found.node.label;
  }
  return next;
}

export function updateMindmapNodeShape(ast: MindmapAST, uid: string, shape: MindmapShape): MindmapAST {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, uid);
  if (found) {
    found.node.shape = shape;
  }
  return next;
}

export function updateMindmapNodeStyle(
  ast: MindmapAST,
  uid: string,
  style: NodeVisualStyle | undefined,
): MindmapAST {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, uid);
  if (found) {
    if (!style || (!style.fill && !style.stroke && !style.color && !style.strokeWidth)) {
      found.node.style = undefined;
    } else {
      found.node.style = { ...style };
    }
  }
  return next;
}

export function deleteMindmapNode(
  ast: MindmapAST,
  uid: string,
): { ast: MindmapAST; nextSelectUid: string } {
  if (ast.root.uid === uid) {
    return { ast, nextSelectUid: ast.root.uid };
  }
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, uid);
  if (!found || !found.parent) {
    return { ast: next, nextSelectUid: next.root.uid };
  }
  found.parent.children.splice(found.index, 1);
  const sibling = found.parent.children[Math.max(0, found.index - 1)];
  return {
    ast: next,
    nextSelectUid: sibling ? sibling.uid : found.parent.uid,
  };
}

export function reparentMindmapNode(
  ast: MindmapAST,
  nodeUid: string,
  newParentUid: string,
  insertIndex?: number,
): MindmapAST {
  if (nodeUid === ast.root.uid || nodeUid === newParentUid) return ast;
  const next = cloneMindmapAST(ast);
  const source = findMindmapNode(next.root, nodeUid);
  const target = findMindmapNode(next.root, newParentUid);
  if (!source || !source.parent || !target) return ast;

  // Prevent cycles (cannot drop node into its own subtree)
  if (isDescendant(source.node, newParentUid)) return ast;

  source.parent.children.splice(source.index, 1);
  if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= target.node.children.length) {
    target.node.children.splice(insertIndex, 0, source.node);
  } else {
    target.node.children.push(source.node);
  }
  return next;
}

export function moveMindmapNodeOrder(
  ast: MindmapAST,
  nodeUid: string,
  direction: 'up' | 'down',
): MindmapAST {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, nodeUid);
  if (!found || !found.parent) return ast;
  const siblings = found.parent.children;
  const newIdx = direction === 'up' ? found.index - 1 : found.index + 1;
  if (newIdx < 0 || newIdx >= siblings.length) return ast;
  const [item] = siblings.splice(found.index, 1);
  siblings.splice(newIdx, 0, item);
  return next;
}

export function promoteMindmapNode(ast: MindmapAST, nodeUid: string): MindmapAST {
  const next = cloneMindmapAST(ast);
  const found = findMindmapNode(next.root, nodeUid);
  if (!found || !found.parent) return ast;
  const parentFound = findMindmapNode(next.root, found.parent.uid);
  if (!parentFound || !parentFound.parent) return ast;

  found.parent.children.splice(found.index, 1);
  parentFound.parent.children.splice(parentFound.index + 1, 0, found.node);
  return next;
}

export function mindmapToMarkdownOutline(ast: MindmapAST): string {
  const lines: string[] = [];
  const walk = (node: MindmapNode, depth: number) => {
    if (depth === 0) {
      lines.push(`# ${node.label}`);
      lines.push('');
    } else {
      lines.push(`${'  '.repeat(depth - 1)}- ${node.label}`);
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };
  walk(ast.root, 0);
  return lines.join('\n') + '\n';
}
