import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

const 按钮样式: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  height: 30,
  padding: '0 12px',
  fontSize: 12,
  fontWeight: 500,
  color: '#555',
  background: '#fff',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

export default function ControlBar() {
  const status = useStore((s) => s.status);
  const step = useStore((s) => s.step);
  const back = useStore((s) => s.back);
  const forward = useStore((s) => s.forward);
  const runTo = useStore((s) => s.runTo);
  const reset = useStore((s) => s.reset);
  const snapshot = useStore((s) => s.snapshot);
  const historySteps = useStore((s) => s.historySteps);
  const jumpToStep = useStore((s) => s.jumpToStep);
  const code = useStore((s) => s.code);

  // ---- Step history popover state ----
  const [histOpen, setHistOpen] = useState(false);
  const histBtnRef = useRef<HTMLButtonElement>(null);
  const histPanelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current step when opening
  useEffect(() => {
    if (histOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [histOpen]);

  // Close on outside click
  useEffect(() => {
    if (!histOpen) return;
    const onDown = (e: MouseEvent) => {
      if (histPanelRef.current && !histPanelRef.current.contains(e.target as Node) &&
          histBtnRef.current && !histBtnRef.current.contains(e.target as Node)) {
        setHistOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [histOpen]);

  const isIdle = status === 'idle' || status === 'ready';
  const isTerminated = status === 'terminated';
  const isBusy = status === 'stepping' || status === 'running' || status === 'rewinding';
  const canStep = !isIdle && !isTerminated && !isBusy;

  const curStep = snapshot?.step_number ?? 0;
  const totalSteps = historySteps.length;
  const lines = code.split('\n');

  // Build step list items
  const stepItems = historySteps.map((s) => {
    const lineText = lines[s.source_line - 1]?.trim() ?? '';
    const summary = lineText.length > 60
      ? lineText.substring(0, 60) + '…'
      : lineText;
    return { ...s, summary };
  });

  const 主按钮样式: React.CSSProperties = {
    ...按钮样式,
    background: canStep ? '#1a73e8' : '#f5f5f5',
    color: canStep ? '#fff' : '#bbb',
    border: canStep ? '1px solid #1a73e8' : '1px solid #d9d9d9',
    fontWeight: 600,
  };

  const 次要按钮样式: React.CSSProperties = {
    ...按钮样式,
    background: canStep ? '#fff' : '#fafafa',
    color: canStep ? '#555' : '#ccc',
  };

  return (
    <div
      style={{
        height: 40,
        background: '#fff',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* 重置 */}
      <button
        onClick={reset}
        disabled={isIdle || isBusy}
        style={{
          ...按钮样式,
          color: '#888',
          fontWeight: 600,
        }}
        title="回到起点"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        重置
      </button>

      <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 4px' }} />

      {/* 后退 */}
      <button
        onClick={() => back(1)}
        disabled={!canStep}
        style={次要按钮样式}
        title="后退一步"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 6l-6 6 6 6V6z" />
          <path d="M7 12h14" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        后退
      </button>

      {/* 前进一步（主按钮） */}
      <button
        onClick={() => step('step_over')}
        disabled={!canStep}
        style={主按钮样式}
        title="前进一步（Step Over）"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 2l16 10L4 22V2z" />
        </svg>
        步进
      </button>

      {/* 步入 */}
      <button
        onClick={() => step('step_into')}
        disabled={!canStep}
        style={次要按钮样式}
        title="步入函数"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 21h16" strokeWidth="1.5" />
        </svg>
        步入
      </button>

      {/* 步出 */}
      <button
        onClick={() => step('step_out')}
        disabled={!canStep}
        style={次要按钮样式}
        title="跳出函数"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21V9" />
          <path d="M8 13l4-4 4 4" />
          <path d="M4 3h16" strokeWidth="1.5" />
        </svg>
        跳出
      </button>

      {/* 前进（重做） */}
      <button
        onClick={forward}
        disabled={!canStep}
        style={次要按钮样式}
        title="前进（重做）"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 6l6 6-6 6V6z" />
          <path d="M17 12H3" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        前进
      </button>

      <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 4px' }} />

      {/* 运行到断点 */}
      <button
        onClick={runTo}
        disabled={!canStep}
        style={次要按钮样式}
        title="运行到断点"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 2l16 10L4 22V2z" />
          <rect x="20" y="2" width="2" height="20" rx="1" fill="currentColor" />
        </svg>
        运行到断点
      </button>

      <div style={{ flex: 1 }} />

      {/* ---- Step history indicator + popover ---- */}
      {totalSteps > 0 && (
        <div style={{ position: 'relative' }}>
          <button
            ref={histBtnRef}
            onClick={() => setHistOpen((v) => !v)}
            title="执行历史（点击查看所有步骤）"
            style={{
              ...按钮样式,
              gap: 6,
              fontSize: 11,
              fontFamily: 'SF Mono, Menlo, Monaco, monospace',
              background: histOpen ? '#e8f0fe' : '#fafafa',
              border: histOpen ? '1px solid #1a73e8' : '1px solid #e0e0e0',
              color: histOpen ? '#1a73e8' : '#666',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Step {curStep}/{totalSteps}
            <span style={{ fontSize: 9, opacity: 0.5 }}>{histOpen ? '▴' : '▾'}</span>
          </button>

          {/* Popover — opens upward */}
          {histOpen && (
            <div ref={histPanelRef} style={{
              position: 'fixed',
              bottom: 48,
              right: 12,
              zIndex: 1000,
            }}>
              <div style={{
                width: 340,
                maxHeight: 360,
                background: '#fff',
                borderRadius: 8,
                boxShadow: '0 -4px 24px rgba(0,0,0,0.12), 0 -1px 4px rgba(0,0,0,0.06)',
                border: '1px solid #e8e8e8',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>
                    📋 执行历史
                  </span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>
                    {totalSteps} 步
                  </span>
                </div>

                {/* Step list */}
                <div ref={listRef} style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '4px 0',
                }}>
                  {stepItems.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: '#ccc' }}>
                      暂无步骤
                    </div>
                  ) : (
                    stepItems.map((item) => {
                      const isActive = item.step_number === curStep;
                      return (
                        <div
                          key={item.step_number}
                          data-active={isActive ? 'true' : 'false'}
                          onClick={() => {
                            jumpToStep(item.step_number);
                            setHistOpen(false);
                          }}
                          title={`跳转到步骤 ${item.step_number} · 第 ${item.source_line} 行`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '5px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                            background: isActive ? '#e8f0fe' : 'transparent',
                            borderLeft: isActive ? '2px solid #1a73e8' : '2px solid transparent',
                            color: isActive ? '#1a73e8' : '#555',
                            fontWeight: isActive ? 600 : 400,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = '#fafafa';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{
                            flexShrink: 0,
                            width: 32,
                            fontSize: 10,
                            opacity: 0.6,
                            textAlign: 'right',
                          }}>
                            S{item.step_number}
                          </span>
                          <span style={{
                            flexShrink: 0,
                            width: 28,
                            fontSize: 10,
                            opacity: 0.5,
                          }}>
                            L{item.source_line}
                          </span>
                          <span style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 11,
                          }}>
                            {item.summary}
                          </span>
                          {isActive && (
                            <span style={{ fontSize: 10, flexShrink: 0 }}>◀</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
