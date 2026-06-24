import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../store/useStore';
import { STRUCT_TYPES, detectVariables, insertAnnotationAbove } from '../utils/annotations';
import AiPanel from './AiPanel';

export default function CodeEditor() {
  const code = useStore((s) => s.code);
  const setCode = useStore((s) => s.setCode);
  const loadCode = useStore((s) => s.loadCode);
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint);
  const breakpoints = useStore((s) => s.breakpoints);
  const currentLine = useStore((s) => s.snapshot?.source_line ?? null);
  const status = useStore((s) => s.status);
  const compileErrors = useStore((s) => s.compileErrors);
  const setCursorLine = useStore((s) => s.setCursorLine);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---- @viz popup state ----
  const [vizPopup, setVizPopup] = useState<{
    visible: boolean;
    top: number;
    left: number;
    targetLine: number;
  } | null>(null);

  const updateDecorations = useCallback(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const decs: unknown[] = [];

    // Current execution line
    if (currentLine != null && status !== 'idle' && status !== 'ready') {
      decs.push({
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-decoration',
        },
      });
    }

    // Compile errors
    for (const err of compileErrors) {
      if (err.line != null) {
        decs.push({
          range: new monaco.Range(err.line, 1, err.line, 1),
          options: {
            isWholeLine: true,
            className: 'error-line-decoration',
            hoverMessage: { value: err.message },
          },
        });
      }
    }

    // Breakpoints
    for (const bp of breakpoints) {
      decs.push({
        range: new monaco.Range(bp, 1, bp, 1),
        options: {
          glyphMarginClassName: 'breakpoint-glyph',
          glyphMarginHoverMessage: { value: `断点 — 第 ${bp} 行` },
        },
      });
    }

    decorationsRef.current = ed.deltaDecorations(decorationsRef.current, decs);
  }, [currentLine, status, compileErrors, breakpoints]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // ---- Define custom light theme ----
    monaco.editor.defineTheme('cppviz-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '9c9b95', fontStyle: 'italic' },
        { token: 'keyword', foreground: '1e4d7b', fontStyle: 'bold' },
        { token: 'string', foreground: '2d8a7b' },
        { token: 'number', foreground: 'b8703d' },
        { token: 'type', foreground: '1e4d7b' },
        { token: 'identifier', foreground: '1c1c1c' },
        { token: 'delimiter', foreground: '6b6b65' },
        { token: 'annotation', foreground: '9c9b95', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1c1c1c',
        'editor.lineHighlightBackground': '#fafaf7',
        'editor.selectionBackground': '#eaf1f7',
        'editor.inactiveSelectionBackground': '#f5f4f0',
        'editorLineNumber.foreground': '#c5c2ba',
        'editorLineNumber.activeForeground': '#6b6b65',
        'editorCursor.foreground': '#1e4d7b',
        'editorBracketMatch.background': '#f5f4f0',
        'editorBracketMatch.border': '#e4e1da',
        'editorGutter.background': '#fafaf7',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e4e1da',
      },
    });

    monaco.editor.setTheme('cppviz-light');

    // ---- Gutter interactions ----
    editor.onMouseDown((e: { target: { type: unknown; position?: { lineNumber: number } }; event: MouseEvent }) => {
      const ev = e.event as MouseEvent;
      const line = e.target.position?.lineNumber;
      if (!line) return;

      const isGutter = e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
                    || e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS;

      // Ctrl/Cmd/Alt + left-click on gutter → @viz popup
      if (isGutter && (ev.ctrlKey || ev.metaKey || ev.altKey)) {
        openVizPopup(line, ev.clientX, ev.clientY);
        return;
      }

      // Left-click on glyph margin → toggle breakpoint
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        toggleBreakpoint(line);
      }
    });

    // ---- Right-click on gutter → @viz popup ----
    const editorDom = editor.getDomNode();
    if (editorDom) {
      editorDom.addEventListener('contextmenu', (ev: MouseEvent) => {
        const target = ev.target as HTMLElement;
        const inGutter = target.closest('.glyph-margin')
                      || target.closest('.margin-view-overlays')
                      || target.closest('.line-numbers')
                      || target.closest('.margin');
        if (!inGutter) return;

        ev.preventDefault();
        ev.stopPropagation();

        const pos = editor.getTargetAtClientPoint(ev.clientX, ev.clientY);
        const ln = pos?.position?.lineNumber ?? null;
        if (ln) {
          openVizPopup(ln, ev.clientX, ev.clientY);
        }
      });
    }

    updateDecorations();

    editor.onDidChangeCursorPosition((e: { position: { lineNumber: number } }) => {
      setCursorLine(e.position.lineNumber);
    });
  };

  const openVizPopup = (line: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const left = Math.min(clientX - rect.left, rect.width - 320);
    const top = Math.min(clientY - rect.top, rect.height - 400);
    setVizPopup({
      visible: true,
      top: Math.max(0, top),
      left: Math.max(0, left),
      targetLine: line,
    });
  };

  const handleVizTypeSelect = (typeKey: string) => {
    if (!vizPopup) return;
    const def = STRUCT_TYPES.find((d) => d.type === typeKey);
    if (!def) return;

    const editor = editorRef.current;
    const targetLine = vizPopup.targetLine;
    let detectedVars: string[] = [];
    if (editor) {
      const lineText = editor.getModel()?.getLineContent(targetLine) ?? '';
      detectedVars = detectVariables(lineText);
    }

    const fields: Record<string, string> = { name: 'auto' };
    for (const field of def.fields) {
      if (field.key === 'root_var' && detectedVars.length > 0) {
        fields[field.key] = detectedVars[0];
      } else if (field.key === 'name' && detectedVars.length > 0) {
        fields[field.key] = detectedVars[0];
      } else if (field.key === 'show_vars') {
        fields[field.key] = detectedVars.join(', ');
      } else {
        fields[field.key] = field.placeholder;
      }
    }

    const annotation = def.format(fields.name ?? 'auto', fields);
    const newCode = insertAnnotationAbove(code, targetLine, annotation);
    setCode(newCode);
    setVizPopup(null);
  };

  useEffect(() => {
    updateDecorations();
  }, [updateDecorations]);

  useEffect(() => {
    if (!vizPopup) return;
    const onMouseDown = (e: MouseEvent) => {
      const popupEl = document.querySelector('.viz-popup-overlay');
      if (popupEl && popupEl.contains(e.target as Node)) return;
      setVizPopup(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [vizPopup]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const currentCode = editorRef.current?.getValue() ?? code;
        loadCode(currentCode);
      }
    },
    [code, loadCode]
  );

  const isIdle = status === 'idle' || status === 'ready';

  return (
    <div ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      <div
        style={{
          height: 32,
          background: 'var(--color-surface-alt)',
          borderBottom: 'var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* File tab */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: 'var(--border-hairline)',
            borderBottom: '1px solid var(--color-surface)',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            padding: '2px 12px',
            marginTop: 4,
            height: 28,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="var(--color-ink)">
            <path d="M4 1h6l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
            <text x="5" y="13" fontSize="9" fill="white" fontWeight="bold" fontFamily="monospace">C</text>
          </svg>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12, fontWeight: 500,
            color: 'var(--color-text)',
          }}>
            main.cpp
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* AI Analyze */}
        <AiPanel />

        {/* Run button */}
        <button
          onClick={() => {
            const currentCode = editorRef.current?.getValue() ?? code;
            loadCode(currentCode);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 12px',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
            color: '#ffffff',
            background: isIdle ? 'var(--color-ink)' : 'var(--color-teal)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="10" height="10" viewBox="0 0 10 12" fill="white">
            <path d="M0 0v12l10-6z" />
          </svg>
          {isIdle ? '编译运行' : '重新运行'}
        </button>
      </div>

      {/* Monaco editor */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height="100%"
          defaultLanguage="cpp"
          theme="cppviz-light"
          value={code}
          onChange={(val) => setCode(val ?? '')}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            lineHeight: 22,
            fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Monaco, monospace",
            lineNumbers: 'on',
            glyphMargin: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: false,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: 'on',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 8 },
          }}
        />

        {/* @viz popup */}
        {vizPopup && vizPopup.visible && (
          <div className="viz-popup-overlay" style={{
            position: 'absolute',
            top: vizPopup.top,
            left: vizPopup.left,
            zIndex: 100,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-popover)',
            width: 300,
            padding: '10px 12px 12px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-secondary)',
              }}>
                在第 {vizPopup.targetLine} 行上方添加标注
              </span>
              <button
                onClick={() => setVizPopup(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--color-text-tertiary)',
                  padding: 0, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-tertiary)', marginBottom: 8,
            }}>
              右键行号区域 · Ctrl+左键也可触发
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {STRUCT_TYPES.map((def) => (
                <button
                  key={def.type}
                  onClick={() => handleVizTypeSelect(def.type)}
                  title={def.label}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 6px', fontSize: 11,
                    fontFamily: 'var(--font-ui)', fontWeight: 500,
                    color: 'var(--color-text)',
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-ink-light)';
                    e.currentTarget.style.borderColor = 'var(--color-ink)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-alt)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <span style={{ fontSize: 13 }}>{def.icon}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{def.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compile error panel */}
      {compileErrors.length > 0 && (
        <div
          style={{
            maxHeight: 120,
            overflowY: 'auto',
            borderTop: '2px solid var(--color-red)',
            background: 'var(--color-red-light)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-ui)',
              color: 'var(--color-red)',
              padding: '6px 12px',
              background: 'var(--color-red-light)',
              borderBottom: '1px solid rgba(196, 49, 43, 0.2)',
            }}
          >
            编译错误 ({compileErrors.length})
          </div>
          {compileErrors.map((err, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-red)',
                padding: '4px 12px',
                borderBottom: '1px solid rgba(196, 49, 43, 0.12)',
              }}
            >
              {err.line != null && (
                <span style={{ color: 'var(--color-text-secondary)', marginRight: 6 }}>
                  第 {err.line} 行
                </span>
              )}
              {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
