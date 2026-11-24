import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  type Connection,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Pin } from 'lucide-react';
import type { FlowchartAST, FlowchartShape } from '@shared/types';
import {
  addFlowchartDownstreamNode,
  addFlowchartEdge,
  addFlowchartSiblingNode,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  setFlowchartNodeManualPosition,
  updateFlowchartNode,
} from '@shared/mermaid/flowchartOps';
import { serializeFlowchart } from '@shared/mermaid/flowchartSerializer';
import type { DiagramTheme } from '../themes/themes';
import {
  layoutFlowchart,
  type FlowchartRFNodeData,
  type SubgraphRFNodeData,
} from '../utils/layout';
import { useAppStore } from '../store/useAppStore';

interface FlowchartCanvasProps {
  ast: FlowchartAST;
  theme: DiagramTheme;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  selectedSubgraphId?: string;
  editingNodeId?: string;
  searchQuery: string;
  fitViewTrigger: number;
  onNodesMeasured?: (nodes: Node[]) => void;
}

function getFlowShapeStyle(shape: FlowchartShape): {
  className: string;
  clipPath?: string;
} {
  switch (shape) {
    case 'rounded':
      return { className: 'rounded-xl' };
    case 'stadium':
      return { className: 'rounded-full px-5' };
    case 'circle':
      return { className: 'rounded-full aspect-square' };
    case 'diamond':
      return {
        className: 'rounded-sm',
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      };
    case 'hexagon':
      return {
        className: 'rounded-sm px-5',
        clipPath: 'polygon(14px 0%, calc(100% - 14px) 0%, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0% 50%)',
      };
    case 'parallelogram':
      return {
        className: 'rounded-sm px-5',
        clipPath: 'polygon(14px 0%, 100% 0%, calc(100% - 14px) 100%, 0% 100%)',
      };
    case 'cylinder':
      return { className: 'rounded-[18px/12px] border-t-[4px] border-b-[4px]' };
    case 'subroutine':
      return { className: 'rounded-md border-x-[5px]' };
    case 'rect':
    default:
      return { className: 'rounded-md' };
  }
}

const FlowchartNodeCard: React.FC<NodeProps<Node<FlowchartRFNodeData>>> = ({
  id,
  data,
  selected,
}) => {
  const { node, theme, isSearchMatch, isPinned } = data;
  const activeTab = useAppStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateActiveCode = useAppStore((s) => s.updateActiveCode);
  const setEditingNodeId = useAppStore((s) => s.setEditingNodeId);

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
    if (activeTab?.flowchartAst && trimmed && trimmed !== node.label) {
      const nextAst = updateFlowchartNode(activeTab.flowchartAst, id, { label: trimmed });
      updateActiveCode(serializeFlowchart(nextAst), { selectNodeId: id });
    } else {
      setEditingNodeId(undefined);
    }
  };

  const bg = node.style?.fill ?? theme.flowNodeFill;
  const border = node.style?.stroke ?? theme.flowNodeStroke;
  const textColor = node.style?.color ?? theme.flowNodeText;
  const shapeInfo = getFlowShapeStyle(node.shape);
  const isSvgPolygon =
    node.shape === 'diamond' || node.shape === 'hexagon' || node.shape === 'parallelogram';

  const handleClass =
    '!h-2.5 !w-2.5 !border-2 !border-[var(--mm-surface)] !bg-sky-500 opacity-0 transition-opacity group-hover:opacity-100';

  const polygonPoints =
    node.shape === 'diamond'
      ? '50,2 98,50 50,98 2,50'
      : node.shape === 'hexagon'
        ? '12,2 88,2 98,50 88,98 12,98 2,50'
        : '14,2 98,2 86,98 2,98';

  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingNodeId(id);
      }}
      className="group relative h-full w-full"
    >
      {/* Connection handles on all 4 sides */}
      <Handle id={Position.Top} type="target" position={Position.Top} className={handleClass} />
      <Handle id={Position.Left} type="target" position={Position.Left} className={handleClass} />
      <Handle id={Position.Bottom} type="source" position={Position.Bottom} className={handleClass} />
      <Handle id={Position.Right} type="source" position={Position.Right} className={handleClass} />

      {isSvgPolygon ? (
        <div
          className={[
            'relative flex h-full w-full items-center justify-center px-5 py-2 text-center',
            selected ? 'drop-shadow-[0_0_8px_rgba(14,165,233,0.6)]' : 'drop-shadow-xs',
            isSearchMatch ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]' : '',
          ].join(' ')}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <polygon
              points={polygonPoints}
              fill={bg}
              stroke={selected ? '#0ea5e9' : border}
              strokeWidth={selected ? 3 : 2.2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ color: textColor }} className="relative z-10 w-full">
            {isEditing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    commitEdit();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setDraft(node.label);
                    setEditingNodeId(undefined);
                  }
                }}
                style={{ color: textColor }}
                className="nodrag nopan w-full bg-transparent text-center text-[13px] font-medium outline-none"
              />
            ) : (
              <span className="break-words text-[12.5px] font-medium leading-snug">{node.label}</span>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: bg,
            borderColor: border,
            color: textColor,
          }}
          className={[
            'flex h-full w-full items-center justify-center border-2 px-3.5 py-2 text-center shadow-sm transition-shadow',
            shapeInfo.className,
            selected ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-transparent shadow-md' : 'hover:shadow-md',
            isSearchMatch ? 'ring-2 ring-amber-400 ring-offset-2' : '',
          ].join(' ')}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  commitEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setDraft(node.label);
                  setEditingNodeId(undefined);
                }
              }}
              style={{ color: textColor }}
              className="nodrag nopan w-full bg-transparent text-center text-[13px] font-medium outline-none"
            />
          ) : (
            <span className="break-words text-[13px] font-medium leading-snug">{node.label}</span>
          )}
        </div>
      )}

      {/* Subtle indicator when node has manual %% @pos pin */}
      {isPinned && (
        <span
          title="Manual position pinned (%% @pos)"
          className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow"
        >
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
};

const SubgraphGroupNode: React.FC<NodeProps<Node<SubgraphRFNodeData>>> = ({ data, selected }) => {
  const { subgraph, theme } = data;
  return (
    <div
      style={{
        backgroundColor: subgraph.style?.fill ?? theme.subgraphBg,
        borderColor: selected ? '#0ea5e9' : subgraph.style?.stroke ?? theme.subgraphBorder,
      }}
      className="h-full w-full rounded-2xl border-[1.75px] border-dashed transition-colors"
    >
      <div
        style={{ color: subgraph.style?.color ?? theme.subgraphTitleColor }}
        className="inline-flex items-center rounded-br-xl rounded-tl-2xl px-3 py-1.5 text-xs font-semibold tracking-wide"
      >
        {subgraph.title}
      </div>
    </div>
  );
};

const nodeTypes = {
  flowchartNode: FlowchartNodeCard,
  subgraphNode: SubgraphGroupNode,
};

const FlowchartCanvasInner: React.FC<FlowchartCanvasProps> = ({
  ast,
  theme,
  selectedNodeId,
  selectedEdgeId,
  selectedSubgraphId,
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

  const [draggingPos, setDraggingPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasFittedInitial = useRef(false);

  const layouted = useMemo(
    () => layoutFlowchart(ast, theme, searchQuery),
    [ast, theme, searchQuery],
  );

  const nodes = useMemo(() => {
    return layouted.nodes.map((n) => {
      const isSg = n.id.startsWith('sg:');
      const sgId = isSg ? n.id.slice(3) : undefined;
      return {
        ...n,
        selected: isSg ? sgId === selectedSubgraphId : n.id === selectedNodeId,
        position:
          draggingPos && draggingPos.id === n.id
            ? { x: draggingPos.x, y: draggingPos.y }
            : n.position,
      };
    });
  }, [layouted.nodes, selectedNodeId, selectedSubgraphId, draggingPos]);

  const edges = useMemo(() => {
    return layouted.edges.map((e) => ({
      ...e,
      selected: e.id === selectedEdgeId,
      style: {
        ...e.style,
        stroke: e.id === selectedEdgeId ? '#0ea5e9' : e.style?.stroke,
        strokeWidth: e.id === selectedEdgeId ? 3.2 : e.style?.strokeWidth,
      },
    }));
  }, [layouted.edges, selectedEdgeId]);

  useEffect(() => {
    onNodesMeasured?.(nodes);
  }, [nodes, onNodesMeasured]);

  useEffect(() => {
    if (!hasFittedInitial.current) {
      hasFittedInitial.current = true;
      const t = setTimeout(() => fitView({ padding: 0.2, duration: 260 }), 40);
      return () => clearTimeout(t);
    }
  }, [fitView]);

  useEffect(() => {
    if (fitViewTrigger > 0) {
      fitView({ padding: 0.2, duration: 240 });
    }
  }, [fitViewTrigger, fitView]);

  // Keyboard shortcuts: Tab (downstream), Enter (sibling branch), F2 (edit), Delete
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

      const activeId = selectedNodeId ?? ast.nodes[0]?.id;

      if (e.key === 'Tab' && !e.shiftKey && activeId) {
        e.preventDefault();
        const label = lang === 'zh' ? '下一步' : 'Next Step';
        const { ast: nextAst, newNodeId } = addFlowchartDownstreamNode(ast, activeId, label);
        updateActiveCode(serializeFlowchart(nextAst), {
          selectNodeId: newNodeId,
          editingNodeId: newNodeId,
        });
        return;
      }

      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey && activeId) {
        e.preventDefault();
        const label = lang === 'zh' ? '分支步骤' : 'Branch Step';
        const { ast: nextAst, newNodeId } = addFlowchartSiblingNode(ast, activeId, label);
        updateActiveCode(serializeFlowchart(nextAst), {
          selectNodeId: newNodeId,
          editingNodeId: newNodeId,
        });
        return;
      }

      if (e.key === 'F2' && selectedNodeId) {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          e.preventDefault();
          const nextAst = deleteFlowchartEdge(ast, selectedEdgeId);
          updateActiveCode(serializeFlowchart(nextAst), { clearSelection: true });
        } else if (selectedNodeId) {
          e.preventDefault();
          const nextAst = deleteFlowchartNode(ast, selectedNodeId);
          updateActiveCode(serializeFlowchart(nextAst), { clearSelection: true });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ast, selectedNodeId, selectedEdgeId, editingNodeId, lang, updateActiveCode, setEditingNodeId]);

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    if (connection.source.startsWith('sg:') || connection.target.startsWith('sg:')) return;
    const { ast: nextAst } = addFlowchartEdge(ast, connection.source, connection.target, 'arrow');
    updateActiveCode(serializeFlowchart(nextAst));
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full w-full outline-none"
      style={{ backgroundColor: theme.canvasBg }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16, maxZoom: 1.05 }}
        onConnect={handleConnect}
        onNodeClick={(_e, node) => {
          if (node.id.startsWith('sg:')) {
            setSelection({ subgraphId: node.id.slice(3) });
          } else {
            setSelection({ nodeId: node.id });
          }
          containerRef.current?.focus();
        }}
        onEdgeClick={(_e, edge) => {
          setSelection({ edgeId: edge.id });
          containerRef.current?.focus();
        }}
        onPaneClick={() => {
          setSelection({});
          setEditingNodeId(undefined);
        }}
        onNodeDrag={(_e, node) => {
          if (node.id.startsWith('sg:')) return;
          setDraggingPos({ id: node.id, x: node.position.x, y: node.position.y });
        }}
        onNodeDragStop={(_e, node) => {
          setDraggingPos(null);
          if (node.id.startsWith('sg:')) return;
          const nextAst = setFlowchartNodeManualPosition(ast, node.id, node.position);
          updateActiveCode(serializeFlowchart(nextAst), { selectNodeId: node.id });
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
          nodeColor={(n) => (n.id.startsWith('sg:') ? 'transparent' : theme.flowNodeStroke)}
          maskColor={theme.isDarkCanvas ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.7)'}
        />
      </ReactFlow>
    </div>
  );
};

export const FlowchartCanvas: React.FC<FlowchartCanvasProps> = (props) => (
  <ReactFlowProvider>
    <FlowchartCanvasInner {...props} />
  </ReactFlowProvider>
);
