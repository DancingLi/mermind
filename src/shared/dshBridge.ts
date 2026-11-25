/**
 * Contract between Mermind and the DSH "Mermind bridge" plugin
 * (dsh-mermind-bridge). The plugin publishes `~/.mermind-dsh/bridge.json`
 * with its local origin and a bearer token; Mermind's main process reads it
 * and calls `/plugin/mermind-bridge/status` and `/plugin/mermind-bridge/send`.
 */

export const DSH_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export type DshImageMediaType = (typeof DSH_IMAGE_TYPES)[number];

/** Matches the plugin's per-message limit. */
export const MAX_DSH_IMAGES = 16;
export const MAX_DSH_IMAGE_BYTES = 20 * 1024 * 1024;

export interface DshImage {
  name: string;
  mediaType: DshImageMediaType;
  /** Base64 without a data-URL prefix. */
  data: string;
}

export interface DshAttachment extends DshImage {
  id: string;
  size: number;
}

export interface DshBridgeInfo {
  origin: string;
  token: string;
  outputDir?: string;
}

export interface DshTarget {
  sessionId: string;
  title: string | null;
  pageLive: boolean;
}

export type DshErrorCode =
  | 'not-installed'
  | 'not-running'
  | 'unauthorized'
  | 'no-session'
  | 'empty'
  | 'too-many-images'
  | 'bad-image'
  | 'attachment-rejected'
  | 'timeout'
  | 'failed';

export interface DshFailure {
  ok: false;
  code: DshErrorCode;
  message: string;
}

export type DshStatus =
  | { ok: true; target: DshTarget | null; outputDir: string; outputFile: string | null }
  | DshFailure;

export type DshSendResult =
  | { ok: true; sessionId: string; title: string | null; outputFile: string }
  | DshFailure;

export interface DshSendRequest {
  text: string;
  images: DshImage[];
}

export function isDshImageType(value: unknown): value is DshImageMediaType {
  return typeof value === 'string' && (DSH_IMAGE_TYPES as readonly string[]).includes(value);
}

/** Guess an image type from a file name; clipboard images carry their type instead. */
export function mediaTypeFromName(name: string): DshImageMediaType | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return null;
}

/** Bytes represented by a base64 string. */
export function base64Size(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

/**
 * Split a `data:<type>;base64,<data>` URL.
 * @returns the image, or null when it is not a supported base64 image.
 */
export function imageFromDataUrl(dataUrl: string, name: string): DshImage | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match || !isDshImageType(match[1]) || match[2] === '') return null;
  return { name, mediaType: match[1], data: match[2] };
}

/**
 * Validate the discovery file written by the DSH plugin.
 * @returns the bridge info, or the failure code to report.
 */
export function parseBridgeInfo(raw: string): DshBridgeInfo | { error: 'not-running' | 'not-installed' } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'not-installed' };
  }
  if (parsed === null || typeof parsed !== 'object') return { error: 'not-installed' };
  const record = parsed as Record<string, unknown>;
  if (typeof record.token !== 'string' || record.token === '') return { error: 'not-installed' };
  // The plugin writes `origin: null` when DSH shuts down cleanly.
  if (typeof record.origin !== 'string' || !/^https?:\/\//.test(record.origin)) return { error: 'not-running' };
  return {
    origin: record.origin.replace(/\/+$/, ''),
    token: record.token,
    ...(typeof record.outputDir === 'string' ? { outputDir: record.outputDir } : {}),
  };
}

/** Map a plugin error code (or HTTP status) to Mermind's error vocabulary. */
export function classifyBridgeError(status: number, code: unknown): DshErrorCode {
  if (status === 401) return 'unauthorized';
  if (code === 'no-session') return 'no-session';
  if (code === 'empty') return 'empty';
  if (code === 'too-many-images') return 'too-many-images';
  if (code === 'bad-image') return 'bad-image';
  if (typeof code === 'string' && code.startsWith('session/attachment')) return 'attachment-rejected';
  if (status === 404 && code === undefined) return 'not-installed';
  return 'failed';
}

/**
 * Check a send request before it leaves Mermind.
 * @returns a failure, or null when the request may be sent.
 */
export function validateSendRequest(request: DshSendRequest): DshFailure | null {
  if (request.text.trim() === '' && request.images.length === 0) {
    return { ok: false, code: 'empty', message: 'nothing to send' };
  }
  if (request.images.length > MAX_DSH_IMAGES) {
    return { ok: false, code: 'too-many-images', message: `at most ${MAX_DSH_IMAGES} images` };
  }
  for (const image of request.images) {
    if (!isDshImageType(image.mediaType)) {
      return { ok: false, code: 'bad-image', message: image.name };
    }
    if (base64Size(image.data) > MAX_DSH_IMAGE_BYTES) {
      return { ok: false, code: 'bad-image', message: image.name };
    }
  }
  return null;
}
