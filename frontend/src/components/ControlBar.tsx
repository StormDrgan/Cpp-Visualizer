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

  const isIdle = status === 'idle' || status === 'ready';
  const isTerminated = status === 'terminated';
  const isBusy = status === 'stepping' || status === 'running' || status === 'rewinding';
  const canStep = !isIdle && !isTerminated && !isBusy;

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
        height: 44,
        background: '#fff',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 6,
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

      {/* 状态信息 */}
      {snapshot && (
        <span style={{ fontSize: 11, color: '#999' }}>
          步骤{' '}
          <span style={{ color: '#555', fontFamily: 'SF Mono, Menlo, Monaco, monospace' }}>
            {snapshot.step_number}
          </span>
          {'  '}
          {snapshot.current_function && (
            <span style={{ color: '#1a73e8', fontFamily: 'SF Mono, Menlo, Monaco, monospace' }}>
              {snapshot.current_function}()
            </span>
          )}
        </span>
      )}
    </div>
  );
}
