import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import type { MindmapAST, MindmapLayoutMode, MindmapShape } from '@shared/types';
import {
  addMindmapChild,
  addMindmapSibling,
  deleteMindmapNode,
  findMindmapNode,
  isDescendant,
  promoteMindmapNode,
  reparentMindmapNode,
  updateMindmapNodeLabel,
} from '@shared/mermaid/mindmapOps';
import { serializeMindmap } from '@shared/mermaid/mindmapSerializer';
import type { DiagramTheme } from '../themes/themes';
import { layoutMindmap, type MindmapFlowNodeData } from '../utils/layout';
import { useAppStore } from '../store/useAppStore';

interface MindmapCanvasProps {
  ast: MindmapAST;
  theme: DiagramTheme;
  layoutMode: MindmapLayoutMode;
  collapsedUids: string[];
  selectedNodeId?: string;
  editingNodeId?: string;
  searchQuery: string;
  fitViewTrigger: number;
  onNodesMeasured?: (nodes: Node[]) => void;
}

function getShapeClasses(shape: MindmapShape, isRoot: boolean): string {
  switch (shape) {
    case 'circle':
      return 'rounded-full px-5 py-2.5';
    case 'rounded':
      return 'rounded-2xl px-4 py-2';
    case 'square':
      return 'rounded-[3px] px-3.5 py-2';
    case 'cloud':
      return 'rounded-[26px] border-dashed px-4 py-2';
    case 'bang':
      return 'rounded-xl border-double border-[3px] px-4 py-2';
    case 'hexagon':
      return 'rounded-md px-5 py-2';
    case 'default':
    default:
      return isRoot ? 'rounded-2xl px-5 py-2.5' : 'rounded-xl px-3.5 py-1.5';
  }
}

const MindmapNodeCard: React.FC<NodeProps<Node<MindmapFlowNodeData>>> = ({
  id,
  data,
  selected,
}) => {
  const { node, depth, branchIndex, side, collapsed, hiddenChildCount, theme, isSearchMatch, isDropTarget } =
    data;

  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const setEditingNodeId = useAppStore((s) => s.setEditingNodeId);
  const toggleCollapseUid = useAppStore((s) => s.toggleCollapseUid);

  const isEditing = activeTab?.editingNodeId === id;
  const [draft, setDraft] = useState(node.label);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(node.label);
  }, [node.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (activeTab?.mindmapAst && trimmed && trimmed !== node.label) {
      const nextAst = updateMindmapNodeLabel(activeTab.mindmapAst, id, trimmed);
      updateActiveCode(serializeMindmap(nextAst), { selectNodeId: id });
    } else {
      setEditingNodeId(undefined);
    }
  };

  const isRoot = depth === 0;
  const palette = theme.branchPalette[branchIndex % theme.branchPalette.length];

  const bg = node.style?.fill ?? (isRoot ? theme.rootFill : depth === 1 ? palette.fill : theme.leafFill);
  const border =
    node.style?.stroke ?? (isRoot ? theme.rootStroke : depth === 1 ? palette.stroke : palette.stroke + '99');
  const textColor =
    node.style?.color ?? (isRoot ? theme.rootText : depth === 1 ? palette.text : theme.leafText);

  const hasChildren = node.children.length > 0;
  const showLeftCollapse = hasChildren && side === 'left';
  const showRightCollapse = hasChildren && (side === 'right' || side === 'center');
  const showBottomCollapse = hasChildren && side === 'down';

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingNodeId(id);
      }}
      style={{
        backgroundColor: bg,
        borderColor: isDropTarget ? '#2563eb' : border,
        color: textColor,
        clipPath:
          node.shape === 'hexagon'
            ? 'polygon(10px 0%, calc(100% - 10px) 0%, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0% 50%)'
            : undefined,
      }}
      className={[
        'group relative flex min-h-[36px] min-w-[84px] max-w-[280px] items-center justify-center border-[1.75px] shadow-sm transition-shadow duration-150',
        getShapeClasses(node.shape, isRoot),
        selected ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-transparent shadow-md' : 'hover:shadow-md',
        isSearchMatch ? 'ring-2 ring-amber-400 ring-offset-2' : '',
        isDropTarget ? 'scale-[1.04] ring-2 ring-blue-500 ring-offset-2 border-dashed' : '',
      ].join(' ')}
    >
      {/* Hidden directional handles for smooth bezier branch curves */}
      <Handle id="left-target" type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />
      <Handle id="right-target" type="target" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />
      <Handle id="top-target" type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />
      <Handle id="right-source" type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />
      <Handle id="left-source" type="source" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0" />

      {isEditing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commitEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(node.label);
              setEditingNodeId(undefined);
            }
          }}
          style={{ color: textColor }}
          className="nodrag nopan w-full min-w-[70px] bg-transparent text-center text-sm font-medium outline-none"
        />
      ) : (
        <span
          className={[
            'break-words text-center leading-snug',
            isRoot ? 'text-[15px] font-semibold tracking-tight' : depth === 1 ? 'text-[13.5px] font-semibold' : 'text-[13px] font-medium',
          ].join(' ')}
        >
          {node.label}
        </span>
      )}

      {/* Collapse / Expand toggle badge */}
      {!isRoot && showRightCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapseUid(id);
          }}
          style={{ borderColor: border }}
          className="nodrag nopan absolute -right-3 top-1/2 flex h-5 min-w-[20px] -translate-y-1/2 items-center justify-center rounded-full border bg-[var(--mm-surface)] px-1 text-[10px] font-bold text-[var(--mm-text)] opacity-85 shadow-sm transition hover:scale-110 hover:opacity-100"
        >
          {collapsed ? `+${hiddenChildCount}` : '−'}
        </button>
      )}
      {!isRoot && showLeftCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapseUid(id);
          }}
          style={{ borderColor: border }}
          className="nodrag nopan absolute -left-3 top-1/2 flex h-5 min-w-[20px] -translate-y-1/2 items-center justify-center rounded-full border bg-[var(--mm-surface)] px-1 text-[10px] font-bold text-[var(--mm-text)] opacity-85 shadow-sm transition hover:scale-110 hover:opacity-100"
        >
          {collapsed ? `+${hiddenChildCount}` : '−'}
        </button>
      )}
      {!isRoot && showBottomCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapseUid(id);
          }}
          style={{ borderColor: border }}
          className="nodrag nopan absolute -bottom-3 left-1/2 flex h-5 min-w-[20px] -translate-x-1/2 items-center justify-center rounded-full border bg-[var(--mm-surface)] px-1 text-[10px] font-bold text-[var(--mm-text)] opacity-85 shadow-sm transition hover:scale-110 hover:opacity-100"
        >
          {collapsed ? `+${hiddenChildCount}` : '−'}
        </button>
      )}
    </div>
  );
};

const nodeTypes = { mindmapNode: MindmapNodeCard };

const MindmapCanvasInner: React.FC<MindmapCanvasProps> = ({
  ast,
  theme,
  layoutMode,
  collapsedUids,
  selectedNodeId,
  editingNodeId,
  searchQuery,
  fitViewTrigger,
  onNodesMeasured,
}) => {
  const { fitView } = useReactFlow();
  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const setSelection = useAppStore((s) => s.setSelection);
  const setEditingNodeId = useAppStore((s) => s.setEditingNodeId);
  const lang = useAppStore((s) => s.lang);

  const [dropTargetUid, setDropTargetUid] = useState<string | undefined>(undefined);
  const [draggingNodePos, setDraggingNodePos] = useState<{ id: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasFittedInitial = useRef(false);

  const collapsedSet = useMemo(() => new Set(collapsedUids), [collapsedUids]);

  const layouted = useMemo(
    () => layoutMindmap(ast, layoutMode, collapsedSet, theme, searchQuery, dropTargetUid),
    [ast, layoutMode, collapsedSet, theme, searchQuery, dropTargetUid],
  );

  // Merge active drag preview position & selection state
  const nodes = useMemo(() => {
    return layouted.nodes.map((n) => ({
      ...n,
      selected: n.id === selectedNodeId,
      position:
        draggingNodePos && draggingNodePos.id === n.id
          ? { x: draggingNodePos.x, y: draggingNodePos.y }
          : n.position,
    }));
  }, [layouted.nodes, selectedNodeId, draggingNodePos]);

  useEffect(() => {
    onNodesMeasured?.(nodes);
  }, [nodes, onNodesMeasured]);

  useEffect(() => {
    if (!hasFittedInitial.current) {
      hasFittedInitial.current = true;
      const t = setTimeout(() => fitView({ padding: 0.22, duration: 260 }), 40);
      return () => clearTimeout(t);
    }
  }, [fitView]);

  useEffect(() => {
    if (fitViewTrigger > 0) {
      fitView({ padding: 0.22, duration: 240 });
    }
  }, [fitViewTrigger, fitView]);

  // Keyboard workflow: Tab (child), Enter (sibling), Shift+Tab (promote), Delete, F2, Arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.cm-editor')
      ) {
        return;
      }

      if (editingNodeId) return;

      const activeUid = selectedNodeId ?? ast.root.uid;
      const defaultChildText = lang === 'zh' ? '子主题' : 'Subtopic';
      const defaultSiblingText = lang === 'zh' ? '同级主题' : 'Topic';

      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const { ast: nextAst, newNodeUid } = addMindmapChild(ast, activeUid, defaultChildText);
        updateActiveCode(serializeMindmap(nextAst), {
          selectNodeId: newNodeUid,
          editingNodeId: newNodeUid,
        });
        return;
      }

      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const nextAst = promoteMindmapNode(ast, activeUid);
        if (nextAst !== ast) {
          updateActiveCode(serializeMindmap(nextAst), { selectNodeId: activeUid });
        }
        return;
      }

      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const { ast: nextAst, newNodeUid } = addMindmapSibling(ast, activeUid, defaultSiblingText);
        updateActiveCode(serializeMindmap(nextAst), {
          selectNodeId: newNodeUid,
          editingNodeId: newNodeUid,
        });
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        setEditingNodeId(activeUid);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeUid === ast.root.uid) return;
        e.preventDefault();
        const { ast: nextAst, nextSelectUid } = deleteMindmapNode(ast, activeUid);
        updateActiveCode(serializeMindmap(nextAst), { selectNodeId: nextSelectUid });
        return;
      }

      // Arrow key navigation
      const found = findMindmapNode(ast.root, activeUid);
      if (!found) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (found.node.children.length > 0 && !collapsedSet.has(found.node.uid)) {
          setSelection({ nodeId: found.node.children[0].uid });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (found.parent) setSelection({ nodeId: found.parent.uid });
      } else if (e.key === 'ArrowUp' && found.parent && found.index > 0) {
        e.preventDefault();
        setSelection({ nodeId: found.parent.children[found.index - 1].uid });
      } else if (
        e.key === 'ArrowDown' &&
        found.parent &&
        found.index < found.parent.children.length - 1
      ) {
        e.preventDefault();
        setSelection({ nodeId: found.parent.children[found.index + 1].uid });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ast, selectedNodeId, editingNodeId, collapsedSet, lang, updateActiveCode, setSelection, setEditingNodeId]);

  const findDropTarget = useCallback(
    (draggedNode: Node): string | undefined => {
      if (draggedNode.id === ast.root.uid) return undefined;
      const sourceFound = findMindmapNode(ast.root, draggedNode.id);
      if (!sourceFound) return undefined;

      const dragCenterX = draggedNode.position.x + (draggedNode.width ?? 120) / 2;
      const dragCenterY = draggedNode.position.y + (draggedNode.height ?? 40) / 2;

      let bestUid: string | undefined;
      let bestDist = Infinity;

      for (const candidate of layouted.nodes) {
        if (candidate.id === draggedNode.id) continue;
        if (isDescendant(sourceFound.node, candidate.id)) continue;

        const w = candidate.width ?? 120;
        const h = candidate.height ?? 40;
        const pad = 22;
        const inside =
          dragCenterX >= candidate.position.x - pad &&
          dragCenterX <= candidate.position.x + w + pad &&
          dragCenterY >= candidate.position.y - pad &&
          dragCenterY <= candidate.position.y + h + pad;

        if (inside) {
          const cx = candidate.position.x + w / 2;
          const cy = candidate.position.y + h / 2;
          const dist = Math.hypot(dragCenterX - cx, dragCenterY - cy);
          if (dist < bestDist) {
            bestDist = dist;
            bestUid = candidate.id;
          }
        }
      }
      return bestUid;
    },
    [ast.root, layouted.nodes],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full w-full outline-none"
      style={{ backgroundColor: theme.canvasBg }}
    >
      <ReactFlow
        nodes={nodes}
        edges={layouted.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
        nodesConnectable={false}
        onNodeClick={(_e, node) => {
          setSelection({ nodeId: node.id });
          containerRef.current?.focus();
        }}
        onPaneClick={() => {
          setSelection({});
          setEditingNodeId(undefined);
        }}
        onNodeDrag={(_e, node) => {
          if (node.id === ast.root.uid) return;
          setDraggingNodePos({ id: node.id, x: node.position.x, y: node.position.y });
          setDropTargetUid(findDropTarget(node));
        }}
        onNodeDragStop={(_e, node) => {
          const targetUid = findDropTarget(node);
          setDraggingNodePos(null);
          setDropTargetUid(undefined);
          if (targetUid && node.id !== ast.root.uid) {
            const nextAst = reparentMindmapNode(ast, node.id, targetUid);
            if (nextAst !== ast) {
              updateActiveCode(serializeMindmap(nextAst), { selectNodeId: node.id });
            }
          }
        }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color={theme.dotColor} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor={(n) => {
            const d = n.data as MindmapFlowNodeData;
            return d?.depth === 0 ? theme.rootFill : theme.branchPalette[(d?.branchIndex ?? 0) % theme.branchPalette.length].stroke;
          }}
          maskColor={theme.isDarkCanvas ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
        />
      </ReactFlow>
    </div>
  );
};

export const MindmapCanvas: React.FC<MindmapCanvasProps> = (props) => (
  <ReactFlowProvider>
    <MindmapCanvasInner {...props} />
  </ReactFlowProvider>
);
