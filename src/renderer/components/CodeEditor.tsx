import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags as t } from '@lezer/highlight';
import { AlertTriangle, CheckCircle2, Code2 } from 'lucide-react';
import type { ParseDiagnostic } from '@shared/types';
import { fmt, getDict, type Language } from '../i18n';

const mermaidStreamLang = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^%%\{[\s\S]*?\}%%/)) return 'meta';
    if (stream.match(/^%%.*/)) return 'comment';
    if (stream.match(/^::icon\([^)]*\)/)) return 'attributeName';
    if (stream.match(/^:::[A-Za-z0-9_-]+/)) return 'typeName';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^`[^`]*`/)) return 'string';
    if (stream.match(/^\|[^|]*\|/)) return 'string';
    if (stream.match(/^(?:<-->|-\.+->|-\.+-|==+>|===+|--+[>ox]|---+|->>|-->>|<<->>)/)) {
      return 'operator';
    }
    if (
      stream.match(
        /^(?:mindmap|flowchart|graph|subgraph|end|direction|style|classDef|class|linkStyle|click|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph|journey|timeline|participant|actor|autonumber|TD|TB|LR|RL|BT)\b/,
      )
    ) {
      return 'keyword';
    }
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'atom';
    if (stream.match(/^(?:fill|stroke|color|stroke-width)(?=:)/)) return 'propertyName';
    if (stream.match(/^(?:\(\[|\[\(|\(\(|\[\[|\{\{|\)\)|\]\)|\]\]|\}\}|\(\(|\)\(|\[\s*\/|\/\s*\]|[()[\]{}])/)) {
      return 'bracket';
    }
    stream.next();
    return null;
  },
});

const lightHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#2563eb', fontWeight: '600' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.meta, color: '#7c3aed' },
  { tag: t.string, color: '#059669' },
  { tag: t.operator, color: '#d97706', fontWeight: '600' },
  { tag: t.bracket, color: '#64748b' },
  { tag: t.typeName, color: '#db2777' },
  { tag: t.attributeName, color: '#0891b2' },
  { tag: t.propertyName, color: '#0f766e' },
  { tag: t.atom, color: '#b45309' },
]);

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    borderRight: '1px solid #e2e8f0',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    color: '#2563eb',
  },
});

interface CodeEditorProps {
  code: string;
  onChange: (nextCode: string) => void;
  darkMode: boolean;
  lang: Language;
  parseError?: ParseDiagnostic;
  isReadOnlyVisual?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  darkMode,
  lang,
  parseError,
  isReadOnlyVisual,
}) => {
  const dict = getDict(lang);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const isExternalSyncRef = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;

    const themeExtensions = darkMode
      ? [oneDark]
      : [lightTheme, syntaxHighlighting(lightHighlight), syntaxHighlighting(defaultHighlightStyle)];

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        mermaidStreamLang,
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        themeCompRef.current.of(themeExtensions),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalSyncRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Reconfigure light/dark theme dynamically
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const themeExtensions = darkMode
      ? [oneDark]
      : [lightTheme, syntaxHighlighting(lightHighlight), syntaxHighlighting(defaultHighlightStyle)];
    view.dispatch({
      effects: themeCompRef.current.reconfigure(themeExtensions),
    });
  }, [darkMode]);

  // Sync external AST/tab updates into CodeMirror without breaking active typing cursor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === code) return;

    isExternalSyncRef.current = true;
    const sel = view.state.selection.main;
    const clampedPos = Math.min(sel.head, code.length);
    view.dispatch({
      changes: { from: 0, to: current.length, insert: code },
      selection: { anchor: clampedPos },
    });
    isExternalSyncRef.current = false;
  }, [code]);

  return (
    <div className="flex h-full flex-col border-r border-[var(--mm-border)] bg-[var(--mm-surface)]">
      {/* Code Pane Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--mm-border)] px-3 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-[var(--mm-text)]">
          <Code2 className="h-3.5 w-3.5 text-[var(--mm-accent)]" />
          <span>{dict.codePane.title}</span>
        </div>
        {parseError ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-3 w-3" />
            {dict.codePane.syntaxError} · {fmt(dict.codePane.line, { line: parseError.line })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            {dict.codePane.synced}
          </span>
        )}
      </div>

      {/* Non-blocking parse error banner */}
      {parseError && (
        <div className="shrink-0 border-b border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="font-medium">
            {fmt(dict.codePane.line, { line: parseError.line })}: {parseError.message}
          </div>
          <div className="mt-0.5 text-[11px] opacity-80">{dict.codePane.errorHint}</div>
        </div>
      )}

      {isReadOnlyVisual && !parseError && (
        <div className="shrink-0 border-b border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-700 dark:text-sky-300">
          {dict.codePane.readOnlyVisualHint}
        </div>
      )}

      {/* CodeMirror Container */}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden select-text" />
    </div>
  );
};
