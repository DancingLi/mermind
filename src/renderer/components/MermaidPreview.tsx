import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertTriangle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { DiagramTheme } from '../themes/themes';

interface MermaidPreviewProps {
  code: string;
  theme: DiagramTheme;
  fitViewTrigger: number;
}

let renderCounter = 0;

export const MermaidPreview: React.FC<MermaidPreviewProps> = ({ code, theme, fitViewTrigger }) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [fitViewTrigger]);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mermind_svg_${++renderCounter}`;

    const run = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: theme.mermaidTheme,
          flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
          mindmap: { useMaxWidth: false },
          sequence: { useMaxWidth: false },
        });
        const { svg } = await mermaid.render(renderId, code);
        if (!cancelled) {
          setSvgHtml(svg);
          setErrorMsg(null);
        }
      } catch (err) {
        if (!cancelled) {
          // Clean up any temporary mermaid error element inserted in DOM
          const stray = document.getElementById(`d${renderId}`);
          stray?.remove();
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      }
    };

    const timer = setTimeout(run, 140);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, theme.mermaidTheme]);

  return (
    <div
      style={{ backgroundColor: theme.canvasBg }}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.1 : 0.1;
          setZoom((z) => Math.min(3, Math.max(0.25, Number((z + delta).toFixed(2)))));
        }
      }}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        draggingRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          origX: offset.x,
          origY: offset.y,
        };
      }}
      onMouseMove={(e) => {
        if (!draggingRef.current) return;
        setOffset({
          x: draggingRef.current.origX + (e.clientX - draggingRef.current.startX),
          y: draggingRef.current.origY + (e.clientY - draggingRef.current.startY),
        });
      }}
      onMouseUp={() => {
        draggingRef.current = null;
      }}
      onMouseLeave={() => {
        draggingRef.current = null;
      }}
    >
      {/* Subtle error toast if native Mermaid parser rejects mid-edit */}
      {errorMsg && (
        <div className="absolute left-4 top-4 z-20 flex max-w-lg items-start gap-2 rounded-xl border border-rose-500/30 bg-[var(--mm-surface)]/95 px-3.5 py-2.5 text-xs text-rose-600 shadow-lg backdrop-blur dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="break-words font-mono text-[11px] leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {/* Rendered SVG viewport */}
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
        className="cursor-grab active:cursor-grabbing"
      >
        <div
          data-mermind-export="native-svg"
          className="p-8"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      </div>

      {/* Bottom-left zoom controls */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 rounded-xl border border-[var(--mm-border)] bg-[var(--mm-surface)]/95 p-1 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.15).toFixed(2))))}
          className="rounded-lg p-1.5 text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-[44px] text-center text-xs font-medium text-[var(--mm-text-muted)]">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
          className="rounded-lg p-1.5 text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="rounded-lg p-1.5 text-[var(--mm-text)] hover:bg-[var(--mm-surface-muted)]"
          title="Reset View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
