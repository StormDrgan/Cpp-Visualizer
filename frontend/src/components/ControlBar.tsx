import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';

const baseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'var(--font-ui)',
  color: 'var(--color-text-secondary)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  outline: 'none',
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

  useEffect(() => {
    if (histOpen && listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [histOpen]);

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

  const stepItems = historySteps.map((s) => {
    const lineText = lines[s.source_line - 1]?.trim() ?? '';
    const summary = lineText.length > 60
      ? lineText.substring(0, 60) + '…'
      : lineText;
    return { ...s, summary };
  });

  const primaryBtn: React.CSSProperties = {
    ...baseBtn,
    background: canStep ? 'var(--color-ink)' : 'var(--color-surface-alt)',
    color: canStep ? '#ffffff' : 'var(--color-text-tertiary)',
    fontWeight: 600,
  };

  const secondaryBtn: React.CSSProperties = {
    ...baseBtn,
    color: canStep ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
  };

  return (
    <div
      style={{
        height: 36,
        background: 'var(--color-surface)',
        borderTop: 'var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 2,
        flexShrink: 0,
      }}
    >
      {/* Reset */}
      <button
        onClick={reset}
        disabled={isIdle || isBusy}
        style={{ ...baseBtn, color: 'var(--color-text-secondary)', fontWeight: 500 }}
        title="回到起点 (Reset)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        重置
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

      {/* Back */}
      <button onClick={() => back(1)} disabled={!canStep} style={secondaryBtn} title="后退一步">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 6l-6 6 6 6V6z" />
          <path d="M7 12h14" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        后退
      </button>

      {/* Step (primary) */}
      <button onClick={() => step('step_over')} disabled={!canStep} style={primaryBtn} title="前进一步 (Step Over)">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 2l16 10L4 22V2z" />
        </svg>
        步进
      </button>

      {/* Step Into */}
      <button onClick={() => step('step_into')} disabled={!canStep} style={secondaryBtn} title="步入函数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4 21h16" strokeWidth="1.5" />
        </svg>
        步入
      </button>

      {/* Step Out */}
      <button onClick={() => step('step_out')} disabled={!canStep} style={secondaryBtn} title="跳出函数">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 21V9" />
          <path d="M8 13l4-4 4 4" />
          <path d="M4 3h16" strokeWidth="1.5" />
        </svg>
        跳出
      </button>

      {/* Forward (redo) */}
      <button onClick={forward} disabled={!canStep} style={secondaryBtn} title="前进（重做）">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 6l6 6-6 6V6z" />
          <path d="M17 12H3" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
        前进
      </button>

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

      {/* Run to breakpoint */}
      <button onClick={runTo} disabled={!canStep} style={secondaryBtn} title="运行到断点">
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
            title="执行历史"
            style={{
              ...baseBtn,
              gap: 6,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              background: histOpen ? 'var(--color-ink-light)' : 'transparent',
              color: histOpen ? 'var(--color-ink)' : 'var(--color-text-secondary)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Step {curStep}/{totalSteps}
            <span style={{ fontSize: 9, opacity: 0.5 }}>{histOpen ? '▴' : '▾'}</span>
          </button>

          {histOpen && (
            <div ref={histPanelRef} style={{
              position: 'fixed',
              bottom: 44,
              right: 12,
              zIndex: 1000,
            }}>
              <div style={{
                width: 340,
                maxHeight: 360,
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-popover)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '8px 12px',
                  borderBottom: 'var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    执行历史
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-tertiary)',
                  }}>
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
                    <div style={{
                      padding: 24,
                      textAlign: 'center',
                      fontSize: 12,
                      color: 'var(--color-text-tertiary)',
                    }}>
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
                            fontSize: 11,
                            fontFamily: 'var(--font-mono)',
                            background: isActive ? 'var(--color-ink-light)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--color-ink)' : '2px solid transparent',
                            color: isActive ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                            fontWeight: isActive ? 500 : 400,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = 'var(--color-surface-alt)';
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
                          }}>
                            {item.summary}
                          </span>
                          {isActive && (
                            <span style={{ fontSize: 10, flexShrink: 0 }}>{'◀'}</span>
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
