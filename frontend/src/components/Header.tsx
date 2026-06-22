import { useStore } from '../store/useStore';
import TemplatePicker from './TemplatePicker';

const 状态映射: Record<string, { 标签: string; 颜色: string }> = {
  idle: { 标签: '空闲', 颜色: '#9e9e9e' },
  ready: { 标签: '就绪', 颜色: '#ff9800' },
  stepping: { 标签: '执行中…', 颜色: '#2196f3' },
  running: { 标签: '运行中…', 颜色: '#7c4dff' },
  rewinding: { 标签: '回退中…', 颜色: '#ff7043' },
  paused: { 标签: '已暂停', 颜色: '#4caf50' },
  terminated: { 标签: '已结束', 颜色: '#ef5350' },
};

export default function Header() {
  const 状态 = useStore((s) => s.status);
  const 当前行 = useStore((s) => s.snapshot?.source_line ?? null);
  const 当前函数 = useStore((s) => s.snapshot?.current_function ?? null);
  const 会话ID = useStore((s) => s.sessionId);

  const info = 状态映射[状态] ?? 状态映射.idle;

  return (
    <header
      style={{
        height: 44,
        background: '#fff',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Logo 区域 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="16" rx="2" fill="#1a73e8" />
          <text x="6" y="15" fontSize="11" fill="white" fontWeight="bold" fontFamily="monospace">
            C++
          </text>
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#333', letterSpacing: '0.3px' }}>
          C/C++ Visualizer
        </span>
      </div>

      {/* 分割线 */}
      <div style={{ width: 1, height: 18, background: '#e0e0e0' }} />

      {/* 模板选择器 */}
      <TemplatePicker />

      {/* 状态指示器 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: info.颜色,
            ...(['stepping', 'running', 'rewinding'].includes(状态)
              ? { animation: 'pulse 1.2s ease-in-out infinite' }
              : {}),
          }}
        />
        <span style={{ fontSize: 12, color: '#666' }}>{info.标签}</span>
      </div>

      {/* 当前位置 */}
      {当前行 != null && (
        <>
          <div style={{ width: 1, height: 18, background: '#e0e0e0' }} />
          <span style={{ fontSize: 12, color: '#888' }}>
            第{' '}
            <span style={{ color: '#333', fontFamily: 'SF Mono, Menlo, Monaco, monospace', fontWeight: 500 }}>
              {当前行}
            </span>{' '}
            行
          </span>
        </>
      )}

      {当前函数 && (
        <span style={{ fontSize: 12, color: '#888' }}>
          in{' '}
          <span style={{ color: '#1a73e8', fontFamily: 'SF Mono, Menlo, Monaco, monospace' }}>
            {当前函数}()
          </span>
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* 会话 ID */}
      {会话ID && (
        <span style={{ fontSize: 11, color: '#bbb', fontFamily: 'SF Mono, Menlo, Monaco, monospace' }}>
          {会话ID}
        </span>
      )}
    </header>
  );
}
