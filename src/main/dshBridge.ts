import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyBridgeError,
  mediaTypeFromName,
  MAX_DSH_IMAGE_BYTES,
  parseBridgeInfo,
  validateSendRequest,
  type DshBridgeInfo,
  type DshFailure,
  type DshImage,
  type DshSendRequest,
  type DshSendResult,
  type DshStatus,
} from '../shared/dshBridge';

const STATUS_TIMEOUT_MS = 4000;
const SEND_TIMEOUT_MS = 150_000;

export function bridgeFilePath(): string {
  return process.env.MERMIND_DSH_BRIDGE_FILE || path.join(os.homedir(), '.mermind-dsh', 'bridge.json');
}

function failure(code: DshFailure['code'], message: string): DshFailure {
  return { ok: false, code, message };
}

function readBridge(): DshBridgeInfo | DshFailure {
  let raw: string;
  try {
    raw = fs.readFileSync(bridgeFilePath(), 'utf-8');
  } catch {
    return failure('not-installed', bridgeFilePath());
  }
  const info = parseBridgeInfo(raw);
  return 'error' in info ? failure(info.error, bridgeFilePath()) : info;
}

/** Call one bridge route; the token stays in the main process. */
async function call(
  pathname: string,
  init: { method: 'GET' | 'POST'; body?: string },
  timeoutMs: number,
): Promise<{ ok: true; body: Record<string, unknown> } | DshFailure> {
  const bridge = readBridge();
  if ('ok' in bridge) return bridge;
  let response: Response;
  try {
    response = await fetch(`${bridge.origin}${pathname}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${bridge.token}`,
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: init.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') return failure('timeout', String(error));
    // Connection refused: DSH is not running (or crashed without retiring the file).
    return failure('not-running', String((error as Error)?.message ?? error));
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // A non-JSON answer means the route is not ours (e.g. the plugin is disabled).
  }
  if (!response.ok || body.ok !== true) {
    const message = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
    return failure(classifyBridgeError(response.status, body.code), message);
  }
  return { ok: true, body };
}

export async function getDshStatus(): Promise<DshStatus> {
  const result = await call('/plugin/mermind-bridge/status', { method: 'GET' }, STATUS_TIMEOUT_MS);
  if (!result.ok) return result;
  const { target, outputDir, outputFile } = result.body as {
    target?: { sessionId?: unknown; title?: unknown; pageLive?: unknown } | null;
    outputDir?: unknown;
    outputFile?: unknown;
  };
  return {
    ok: true,
    target:
      target && typeof target.sessionId === 'string'
        ? {
            sessionId: target.sessionId,
            title: typeof target.title === 'string' ? target.title : null,
            pageLive: target.pageLive === true,
          }
        : null,
    outputDir: typeof outputDir === 'string' ? outputDir : '',
    outputFile: typeof outputFile === 'string' ? outputFile : null,
  };
}

export async function sendToDsh(request: DshSendRequest): Promise<DshSendResult> {
  const invalid = validateSendRequest(request);
  if (invalid) return invalid;
  const result = await call(
    '/plugin/mermind-bridge/send',
    {
      method: 'POST',
      body: JSON.stringify({
        text: request.text,
        images: request.images.map(({ name, mediaType, data }) => ({ name, mediaType, data })),
        clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    },
    SEND_TIMEOUT_MS,
  );
  if (!result.ok) return result;
  const { sessionId, title, outputFile } = result.body;
  return {
    ok: true,
    sessionId: String(sessionId),
    title: typeof title === 'string' ? title : null,
    outputFile: String(outputFile ?? ''),
  };
}

/** Read picked image files; unsupported or oversized files are reported by name. */
export function readImageFiles(filePaths: string[]): { images: DshImage[]; rejected: string[] } {
  const images: DshImage[] = [];
  const rejected: string[] = [];
  for (const filePath of filePaths) {
    const name = path.basename(filePath);
    const mediaType = mediaTypeFromName(name);
    try {
      if (!mediaType || fs.statSync(filePath).size > MAX_DSH_IMAGE_BYTES) {
        rejected.push(name);
        continue;
      }
      images.push({ name, mediaType, data: fs.readFileSync(filePath).toString('base64') });
    } catch {
      rejected.push(name);
    }
  }
  return { images, rejected };
}

/** Open the session's reply file, or its folder before the first reply lands. */
export function resolveOutputPath(outputFile: string | null, outputDir: string | null): string | null {
  if (outputFile && fs.existsSync(outputFile)) return outputFile;
  if (outputDir && fs.existsSync(outputDir)) return outputDir;
  return null;
}
