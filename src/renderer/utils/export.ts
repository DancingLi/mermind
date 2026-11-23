import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';

export interface ExportCaptureOptions {
  backgroundColor: string;
  scale?: number;
  nodes?: Node[];
}

function downloadInBrowser(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function dataUrlToBase64(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  return commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
}

function decodeSvgDataUrl(dataUrl: string): string {
  const commaIdx = dataUrl.indexOf(',');
  const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  if (dataUrl.includes(';base64,')) {
    return atob(payload);
  }
  return decodeURIComponent(payload);
}

/**
 * Find the currently visible SVG (in native Mermaid preview) or React Flow viewport container.
 */
export async function captureDiagramAsSvg(options: ExportCaptureOptions): Promise<string> {
  // 1. Check if native Mermaid preview SVG is active
  const nativeSvg = document.querySelector<SVGSVGElement>('[data-mermind-export="native-svg"] svg');
  if (nativeSvg) {
    const clone = nativeSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const styleBg = options.backgroundColor;
    clone.style.backgroundColor = styleBg;
    return new XMLSerializer().serializeToString(clone);
  }

  // 2. Capture React Flow viewport with tight bounding-box fit
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new Error('No diagram viewport available to export');
  }

  const padding = 48;
  let width = 1280;
  let height = 760;
  let transformStyle: Record<string, string> = {};

  if (options.nodes && options.nodes.length > 0) {
    const bounds = getNodesBounds(options.nodes);
    width = Math.max(480, Math.ceil(bounds.width + padding * 2));
    height = Math.max(320, Math.ceil(bounds.height + padding * 2));
    const vp = getViewportForBounds(bounds, width, height, 0.25, 2, 0.08);
    transformStyle = {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    };
  }

  const dataUrl = await toSvg(viewport, {
    backgroundColor: options.backgroundColor,
    width,
    height,
    style: transformStyle,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.classList.contains('react-flow__controls') && !node.classList.contains('react-flow__minimap');
    },
  });

  return decodeSvgDataUrl(dataUrl);
}

export async function captureDiagramAsPngDataUrl(options: ExportCaptureOptions): Promise<string> {
  const scale = options.scale ?? 2;

  const nativeContainer = document.querySelector<HTMLElement>('[data-mermind-export="native-svg"]');
  if (nativeContainer) {
    const svg = nativeContainer.querySelector('svg');
    if (svg) {
      const rect = svg.getBoundingClientRect();
      return await toPng(nativeContainer, {
        backgroundColor: options.backgroundColor,
        pixelRatio: scale,
        width: Math.max(400, Math.ceil(rect.width + 64)),
        height: Math.max(300, Math.ceil(rect.height + 64)),
      });
    }
  }

  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new Error('No diagram viewport available to export');
  }

  const padding = 48;
  let width = 1280;
  let height = 760;
  let transformStyle: Record<string, string> = {};

  if (options.nodes && options.nodes.length > 0) {
    const bounds = getNodesBounds(options.nodes);
    width = Math.max(480, Math.ceil(bounds.width + padding * 2));
    height = Math.max(320, Math.ceil(bounds.height + padding * 2));
    const vp = getViewportForBounds(bounds, width, height, 0.25, 2, 0.08);
    transformStyle = {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    };
  }

  return await toPng(viewport, {
    backgroundColor: options.backgroundColor,
    pixelRatio: scale,
    width,
    height,
    style: transformStyle,
  });
}

export async function saveSvgExport(defaultBaseName: string, options: ExportCaptureOptions): Promise<boolean> {
  const svgText = await captureDiagramAsSvg(options);
  const fileName = `${defaultBaseName}.svg`;
  if (window.mermindAPI) {
    const res = await window.mermindAPI.exportBinaryOrText({
      defaultName: fileName,
      filters: [{ name: 'SVG Vector Image', extensions: ['svg'] }],
      contentText: svgText,
    });
    return !res.canceled;
  }
  downloadInBrowser(fileName, new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  return true;
}

export async function savePngExport(defaultBaseName: string, options: ExportCaptureOptions): Promise<boolean> {
  const dataUrl = await captureDiagramAsPngDataUrl(options);
  const fileName = `${defaultBaseName}.png`;
  if (window.mermindAPI) {
    const res = await window.mermindAPI.exportBinaryOrText({
      defaultName: fileName,
      filters: [{ name: 'PNG Image', extensions: ['png'] }],
      contentBase64: dataUrlToBase64(dataUrl),
    });
    return !res.canceled;
  }
  const res = await fetch(dataUrl);
  downloadInBrowser(fileName, await res.blob());
  return true;
}

export async function savePdfExport(defaultBaseName: string, options: ExportCaptureOptions): Promise<boolean> {
  const svgText = await captureDiagramAsSvg(options);
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4 landscape; margin: 12mm; }
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    background: ${options.backgroundColor};
    display: flex; align-items: center; justify-content: center;
  }
  svg {
    max-width: 100%;
    max-height: 100vh;
    width: auto;
    height: auto;
  }
</style>
</head>
<body>${svgText}</body>
</html>`;

  if (window.mermindAPI) {
    const res = await window.mermindAPI.exportPdfFromHtml({
      html,
      defaultName: `${defaultBaseName}.pdf`,
    });
    return !res.canceled;
  }
  // Browser fallback: open printable window
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
  return true;
}

export async function saveTextExport(
  defaultName: string,
  text: string,
  ext: string,
  filterLabel: string,
): Promise<boolean> {
  if (window.mermindAPI) {
    const res = await window.mermindAPI.exportBinaryOrText({
      defaultName,
      filters: [{ name: filterLabel, extensions: [ext] }],
      contentText: text,
    });
    return !res.canceled;
  }
  downloadInBrowser(defaultName, new Blob([text], { type: 'text/plain;charset=utf-8' }));
  return true;
}
