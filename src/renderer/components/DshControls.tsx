import React from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { getActiveTab, useAppStore } from '../store/useAppStore';
import { fmt, getDict } from '../i18n';
import {
  attachFromPicker,
  describeDshFailure,
  sendActiveTabToDsh,
  sessionLabel,
} from '../dsh/dshActions';

const btnCls =
  'inline-flex h-7 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-[var(--mm-text)] transition hover:bg-[var(--mm-surface-muted)] disabled:opacity-35 disabled:pointer-events-none';

/** Toolbar pair: attach images, then send the diagram to the session shown in DSH. */
export const DshToolbarControls: React.FC = () => {
  const lang = useAppStore((s) => s.lang);
  const status = useAppStore((s) => s.dshStatus);
  const sending = useAppStore((s) => s.dshSending);
  const attachmentCount = useAppStore((s) => getActiveTab(s).attachments.length);
  const dict = getDict(lang);
  if (!window.mermindAPI?.dsh) return null;

  const target = status?.ok ? status.target : null;
  const tooltip = target
    ? `${dict.dsh.sendTip}\n${fmt(dict.dsh.sendTarget, { title: sessionLabel(dict, target.title) })}`
    : status && !status.ok
      ? `${dict.dsh.sendTip}\n${describeDshFailure(dict, status)}`
      : dict.dsh.sendTip;

  return (
    <>
      <button type="button" onClick={() => void attachFromPicker()} title={dict.dsh.attachTip} className={btnCls}>
        <ImagePlus className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">{dict.dsh.attach}</span>
        {attachmentCount > 0 && (
          <span className="rounded-full bg-[var(--mm-accent-soft)] px-1.5 text-[10px] font-semibold text-[var(--mm-accent)]">
            {attachmentCount}
          </span>
        )}
      </button>
      {/* Icon only; the tooltip names the target session and screen readers get the label. */}
      <button
        type="button"
        onClick={() => void sendActiveTabToDsh()}
        disabled={sending}
        title={tooltip}
        aria-label={sending ? dict.dsh.sending : dict.dsh.send}
        aria-busy={sending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      </button>
    </>
  );
};

/** Thumbnails of the images that go out with the next send. */
export const AttachmentTray: React.FC = () => {
  const tab = useAppStore(getActiveTab);
  const lang = useAppStore((s) => s.lang);
  const removeAttachment = useAppStore((s) => s.removeAttachment);
  const clearAttachments = useAppStore((s) => s.clearAttachments);
  const dict = getDict(lang);
  if (tab.attachments.length === 0) return null;

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-t border-[var(--mm-border)] bg-[var(--mm-surface)] px-3">
      <span className="shrink-0 text-[11px] font-medium text-[var(--mm-text-muted)]">
        {dict.dsh.attachmentsTitle}
      </span>
      {tab.attachments.map((attachment) => (
        <div
          key={attachment.id}
          title={attachment.name}
          className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[var(--mm-border)] bg-[var(--mm-bg)]"
        >
          <img
            src={`data:${attachment.mediaType};base64,${attachment.data}`}
            alt={attachment.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
          <button
            type="button"
            onClick={() => removeAttachment(tab.id, attachment.id)}
            title={dict.dsh.removeAttachment}
            aria-label={`${dict.dsh.removeAttachment}: ${attachment.name}`}
            className="absolute right-0 top-0 hidden h-4 w-4 items-center justify-center rounded-bl-md bg-slate-900/75 text-white group-hover:flex"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => clearAttachments(tab.id)}
        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-[var(--mm-text-muted)] hover:bg-[var(--mm-surface-muted)] hover:text-[var(--mm-text)]"
      >
        {dict.dsh.clearAttachments}
      </button>
    </div>
  );
};

/** Status bar item: which DSH session a send goes to; clicking opens its reply file. */
export const DshStatusIndicator: React.FC = () => {
  const lang = useAppStore((s) => s.lang);
  const status = useAppStore((s) => s.dshStatus);
  const showToast = useAppStore((s) => s.showToast);
  const dict = getDict(lang);
  const api = window.mermindAPI?.dsh;
  if (!api || status === null) return null;

  let dot = 'bg-slate-400';
  let label = dict.dsh.statusOffline;
  let title = '';
  if (status.ok && status.target) {
    dot = 'bg-emerald-500';
    label = fmt(dict.dsh.statusConnected, { title: sessionLabel(dict, status.target.title) });
    title = status.outputFile ? fmt(dict.dsh.openOutputTip, { file: status.outputFile }) : '';
  } else if (status.ok) {
    dot = 'bg-amber-500';
    label = dict.dsh.statusNoSession;
  } else {
    if (status.code === 'not-installed') label = dict.dsh.statusNotInstalled;
    title = describeDshFailure(dict, status);
  }

  const openOutput = async () => {
    if (!status.ok) return;
    const opened = await api.openOutput({ outputFile: status.outputFile, outputDir: status.outputDir });
    if (!opened) showToast(fmt(dict.dsh.openOutputFailed, { file: status.outputFile ?? status.outputDir }));
  };

  return (
    <button
      type="button"
      onClick={() => void openOutput()}
      title={title}
      className="inline-flex max-w-[260px] items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-[var(--mm-surface-muted)] hover:text-[var(--mm-text)]"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{label}</span>
    </button>
  );
};
