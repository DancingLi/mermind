import { describe, expect, it } from 'vitest';
import {
  base64Size,
  classifyBridgeError,
  imageFromDataUrl,
  mediaTypeFromName,
  parseBridgeInfo,
  validateSendRequest,
} from '@shared/dshBridge';

describe('dshBridge', () => {
  it('parses the discovery file written by the DSH plugin', () => {
    expect(parseBridgeInfo(JSON.stringify({ origin: 'http://127.0.0.1:56379/', token: 'abc', outputDir: 'D:/out' }))).toEqual({
      origin: 'http://127.0.0.1:56379',
      token: 'abc',
      outputDir: 'D:/out',
    });
    expect(parseBridgeInfo(JSON.stringify({ origin: null, token: 'abc' }))).toEqual({ error: 'not-running' });
    expect(parseBridgeInfo(JSON.stringify({ origin: 'http://x' }))).toEqual({ error: 'not-installed' });
    expect(parseBridgeInfo('{broken')).toEqual({ error: 'not-installed' });
  });

  it('maps plugin errors to Mermind error codes', () => {
    expect(classifyBridgeError(401, 'unauthorized')).toBe('unauthorized');
    expect(classifyBridgeError(409, 'no-session')).toBe('no-session');
    expect(classifyBridgeError(422, 'session/attachment-invalid')).toBe('attachment-rejected');
    expect(classifyBridgeError(404, undefined)).toBe('not-installed');
    expect(classifyBridgeError(502, 'session/agent-busy')).toBe('failed');
  });

  it('reads images from data URLs and file names', () => {
    expect(imageFromDataUrl('data:image/png;base64,iVBORw0KGgo=', 'a.png')).toEqual({
      name: 'a.png',
      mediaType: 'image/png',
      data: 'iVBORw0KGgo=',
    });
    expect(imageFromDataUrl('data:image/bmp;base64,AAAA', 'a.bmp')).toBeNull();
    expect(imageFromDataUrl('data:text/plain,hello', 'a.txt')).toBeNull();
    expect(mediaTypeFromName('Shot.JPG')).toBe('image/jpeg');
    expect(mediaTypeFromName('notes.md')).toBeNull();
    expect(base64Size('iVBORw0KGgo=')).toBe(8);
  });

  it('refuses empty or oversized sends before they leave Mermind', () => {
    expect(validateSendRequest({ text: '  ', images: [] })?.code).toBe('empty');
    expect(validateSendRequest({ text: 'mindmap', images: [] })).toBeNull();
    const image = { name: 'a.png', mediaType: 'image/png' as const, data: 'AAAA' };
    expect(validateSendRequest({ text: '', images: [image] })).toBeNull();
    expect(validateSendRequest({ text: '', images: Array.from({ length: 17 }, () => image) })?.code).toBe('too-many-images');
    expect(validateSendRequest({ text: '', images: [{ ...image, data: 'A'.repeat(28 * 1024 * 1024) }] })?.code).toBe('bad-image');
  });
});
