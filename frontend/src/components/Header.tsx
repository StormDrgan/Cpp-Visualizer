import { useStore } from '../store/useStore';
import TemplatePicker from './TemplatePicker';

const 状态映射: Record<string, { 标签: string; 颜色: string }> = {
  idle: { 标签: '空闲', 颜色: 'var(--status-idle)' },
  ready: { 标签: '就绪', 颜色: 'var(--status-ready)' },
  stepping: { 标签: '执行中…', 颜色: 'var(--status-stepping)' },
  running: { 标签: '运行中…', 颜色: 'var(--status-running)' },
  rewinding: { 标签: '回退中…', 颜色: 'var(--status-rewinding)' },
  paused: { 标签: '已暂停', 颜色: 'var(--status-paused)' },
  terminated: { 标签: '已结束', 颜色: 'var(--status-terminated)' },
};

export default function Header() {
  const 状态 = useStore((s) => s.status);
  const 当前行 = useStore((s) => s.snapshot?.source_line ?? null);
  const 当前函数 = useStore((s) => s.snapshot?.current_function ?? null);
  const 会话ID = useStore((s) => s.sessionId);

  const info = 状态映射[状态] ?? 状态映射.idle;
  const isActive = ['stepping', 'running', 'rewinding'].includes(状态);

  return (
    <header
      style={{
        height: 40,
        background: 'var(--color-page)',
        borderBottom: 'var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="3" width="20" height="16" rx="2" fill="var(--color-ink)" />
          <text x="6" y="15" fontSize="10" fill="white" fontWeight="bold" fontFamily="var(--font-mono)">
            C++
          </text>
        </svg>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--color-text)',
          letterSpacing: '0.04em',
        }}>
          C/C++ Visualizer
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />

      {/* Template picker */}
      <TemplatePicker />

      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: info.颜色,
            flexShrink: 0,
            ...(isActive
              ? { animation: 'pulse 1.2s ease-in-out infinite' }
              : {}),
          }}
        />
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>
          {info.标签}
        </span>
      </div>

      {/* Current position */}
      {当前行 != null && (
        <>
          <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
          }}>
            第{' '}
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              color: 'var(--color-text)',
            }}>
              {当前行}
            </span>{' '}
            行
          </span>
        </>
      )}

      {当前函数 && (
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--color-text-tertiary)',
        }}>
          in{' '}
          <span style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink)',
          }}>
            {当前函数}()
          </span>
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Session ID */}
      {会话ID && (
        <span style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-mono)',
        }}>
          {会话ID}
        </span>
      )}
    </header>
  );
}
