import { useEffect } from 'react';
import {
  imageFromDataUrl,
  MAX_DSH_IMAGE_BYTES,
  MAX_DSH_IMAGES,
  mediaTypeFromName,
  type DshFailure,
  type DshImage,
} from '@shared/dshBridge';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { fmt, getDict } from '../i18n';
import type { I18nDict } from '../i18n/zh';

const POLL_FOCUSED_MS = 5000;
const POLL_BLURRED_MS = 30_000;
const ERROR_TOAST_MS = 5000;

export function describeDshFailure(dict: I18nDict, failure: DshFailure): string {
  return fmt(dict.dsh.errors[failure.code] ?? dict.dsh.errors.failed, { message: failure.message });
}

export function sessionLabel(dict: I18nDict, title: string | null): string {
  return title && title.trim() !== '' ? title : dict.dsh.untitledSession;
}

export async function refreshDshStatus(): Promise<void> {
  const api = window.mermindAPI?.dsh;
  if (!api) return;
  try {
    useAppStore.getState().setDshStatus(await api.getStatus());
  } catch (error) {
    useAppStore.getState().setDshStatus({ ok: false, code: 'failed', message: String(error) });
  }
}

/** Poll the bridge status: often while Mermind has focus, rarely in the background. */
export function useDshStatusPoller(): void {
  useEffect(() => {
    if (!window.mermindAPI?.dsh) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const loop = async () => {
      await refreshDshStatus();
      if (stopped) return;
      timer = setTimeout(loop, document.hasFocus() ? POLL_FOCUSED_MS : POLL_BLURRED_MS);
    };
    const onFocus = () => {
      clearTimeout(timer);
      void loop();
    };
    void loop();
    window.addEventListener('focus', onFocus);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}

/** Send the active tab's Mermaid code and its images to the session shown in DSH. */
export async function sendActiveTabToDsh(): Promise<void> {
  const store = useAppStore.getState();
  const dict = getDict(store.lang);
  const api = window.mermindAPI?.dsh;
  if (!api || store.dshSending) return;
  const tab = getActiveTab(store);
  store.setDshSending(true);
  try {
    const result = await api.send({
      text: tab.code,
      images: tab.attachments.map(({ name, mediaType, data }) => ({ name, mediaType, data })),
    });
    if (!result.ok) {
      store.showToast(describeDshFailure(dict, result), ERROR_TOAST_MS);
      return;
    }
    const title = sessionLabel(dict, result.title);
    const count = tab.attachments.length;
    store.showToast(count > 0 ? fmt(dict.dsh.sentWithImages, { title, count }) : fmt(dict.dsh.sent, { title }));
    // Like the DSH composer, delivered images leave the draft; the diagram stays for further edits.
    useAppStore.getState().clearAttachments(tab.id);
  } finally {
    useAppStore.getState().setDshSending(false);
    void refreshDshStatus();
  }
}

/** Add images to the active tab and report what was skipped. */
export function attachToActiveTab(images: DshImage[], rejected: string[] = []): void {
  const store = useAppStore.getState();
  const dict = getDict(store.lang);
  const tab = getActiveTab(store);
  const added = images.length > 0 ? store.addAttachments(tab.id, images) : 0;
  if (rejected.length > 0) {
    store.showToast(fmt(dict.dsh.rejectedImages, { names: rejected.join('、') }), ERROR_TOAST_MS);
  } else if (added < images.length) {
    store.showToast(fmt(dict.dsh.attachLimit, { max: MAX_DSH_IMAGES }), ERROR_TOAST_MS);
  } else if (added > 0) {
    store.showToast(fmt(dict.dsh.attached, { count: added }));
  }
}

export async function attachFromPicker(): Promise<void> {
  const api = window.mermindAPI?.dsh;
  if (!api) return;
  const { images, rejected } = await api.pickImages();
  attachToActiveTab(images, rejected);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** True for files the bridge can send as images. */
export function isAttachableImage(file: File): boolean {
  return /^image\/(png|jpeg|gif|webp)$/.test(file.type) || mediaTypeFromName(file.name) !== null;
}

/** Read pasted or dropped image files. */
export async function readImageFiles(files: File[]): Promise<{ images: DshImage[]; rejected: string[] }> {
  const images: DshImage[] = [];
  const rejected: string[] = [];
  for (const [index, file] of files.entries()) {
    const name = file.name || `image-${Date.now()}-${index + 1}.png`;
    if (file.size > MAX_DSH_IMAGE_BYTES) {
      rejected.push(name);
      continue;
    }
    const image = imageFromDataUrl(await readAsDataUrl(file), name);
    if (image) images.push(image);
    else rejected.push(name);
  }
  return { images, rejected };
}

/** Attach clipboard images; returns true when the paste carried images. */
export function handleImagePaste(event: ClipboardEvent): boolean {
  const files = Array.from(event.clipboardData?.files ?? []).filter(isAttachableImage);
  if (files.length === 0) return false;
  event.preventDefault();
  void readImageFiles(files).then(({ images, rejected }) => attachToActiveTab(images, rejected));
  return true;
}
