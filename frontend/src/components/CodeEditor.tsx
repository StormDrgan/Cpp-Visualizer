import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useStore } from '../store/useStore';

export default function CodeEditor() {
  const code = useStore((s) => s.code);
  const setCode = useStore((s) => s.setCode);
  const loadCode = useStore((s) => s.loadCode);
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint);
  const breakpoints = useStore((s) => s.breakpoints);
  const currentLine = useStore((s) => s.snapshot?.source_line ?? null);
  const status = useStore((s) => s.status);
  const compileErrors = useStore((s) => s.compileErrors);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  const updateDecorations = useCallback(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const decs: unknown[] = [];

    // 当前执行行 — 绿色高亮
    if (currentLine != null && status !== 'idle' && status !== 'ready') {
      decs.push({
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-decoration',
        },
      });
    }

    // 编译错误标记
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

    // 断点标记
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

    // 点击行号区域设置断点
    editor.onMouseDown((e: { target: { type: unknown; position?: { lineNumber: number } } }) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) {
          toggleBreakpoint(line);
        }
      }
    });

    updateDecorations();
  };

  useEffect(() => {
    updateDecorations();
  }, [updateDecorations]);

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} onKeyDown={handleKeyDown}>
      {/* 工具栏 */}
      <div
        style={{
          height: 36,
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {/* 文件标签 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderBottom: '1px solid #fff',
            borderRadius: '4px 4px 0 0',
            padding: '3px 12px',
            marginTop: 4,
            height: 30,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="#1a73e8">
            <path d="M4 1h6l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
            <text x="5" y="13" fontSize="9" fill="white" fontWeight="bold" fontFamily="monospace">C</text>
          </svg>
          <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>main.cpp</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* 运行按钮 */}
        <button
          onClick={() => {
            const currentCode = editorRef.current?.getValue() ?? code;
            loadCode(currentCode);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 14px',
            fontSize: 12,
            fontWeight: 500,
            color: '#fff',
            background: isIdle ? '#1a73e8' : '#4caf50',
            border: 'none',
            borderRadius: 4,
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

      {/* Monaco 编辑器 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          height="100%"
          defaultLanguage="cpp"
          theme="vs"
          value={code}
          onChange={(val) => setCode(val ?? '')}
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            lineHeight: 22,
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
      </div>

      {/* 编译错误面板 */}
      {compileErrors.length > 0 && (
        <div
          style={{
            maxHeight: 120,
            overflowY: 'auto',
            borderTop: '2px solid #ef5350',
            background: '#fff5f5',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#c62828',
              padding: '6px 12px',
              background: '#ffebee',
              borderBottom: '1px solid #ffcdd2',
            }}
          >
            ⚠ 编译错误 ({compileErrors.length})
          </div>
          {compileErrors.map((err, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                color: '#c62828',
                padding: '4px 12px',
                borderBottom: '1px solid #ffcdd2',
              }}
            >
              {err.line != null && (
                <span style={{ color: '#888', marginRight: 6 }}>
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
