import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { CandidateVar } from '../types';
import AnnotationPanel from './AnnotationPanel';

function fmtDisplay(v: { is_pointer: boolean; display_value: string; value: string }): string {
  const raw = v.display_value || v.value;
  if (!v.is_pointer) return raw;
  return raw.replace(/0x[0-9a-fA-F]+/, (addr) => {
    if (addr.length > 8) return '…' + addr.slice(-4);
    return addr;
  });
}

function candidateLabel(st: string): string {
  switch (st) {
    case 'linked_list': return '链表';
    case 'binary_tree': return '二叉树';
    case 'array': return '数组';
    case 'stack': return '栈';
    case 'queue': return '队列';
    case 'heap': return '堆';
    case 'graph': return '图';
    case 'hashmap': return '哈希表';
    default: return st;
  }
}

// Section header style
const sectionHeader: React.CSSProperties = {
  height: 30,
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  flexShrink: 0,
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid transparent',
  transition: 'background 0.1s',
};

const sectionLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
};

const sectionBadge: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-text-tertiary)',
  background: 'var(--color-surface-alt)',
  borderRadius: 'var(--radius-sm)',
  padding: '1px 6px',
  marginLeft: 6,
};

export default function VariablePanel() {
  const snapshot = useStore((s) => s.snapshot);
  const selectedVars = useStore((s) => s.selectedVars);
  const toggleVar = useStore((s) => s.toggleVar);
  const selectAllVars = useStore((s) => s.selectAllVars);
  const deselectAllVars = useStore((s) => s.deselectAllVars);
  const locals = snapshot?.locals ?? [];
  const callStack = snapshot?.call_stack ?? [];
  const stdout = snapshot?.stdout ?? '';
  const candidates: CandidateVar[] = snapshot?.candidates ?? [];

  const [showLocals, setShowLocals] = useState(true);
  const [showCallStack, setShowCallStack] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [showTargets, setShowTargets] = useState(true);

  const arrow = (open: boolean) => (
    <span style={{
      marginLeft: 'auto',
      fontSize: 10,
      color: 'var(--color-text-tertiary)',
      transform: open ? 'rotate(180deg)' : undefined,
      transition: 'transform 0.2s',
    }}>
      {'▼'}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── Local Variables ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        flex: showLocals ? '1 1 auto' : '0 0 auto', minHeight: 0,
      }}>
        <div
          style={{
            ...sectionHeader,
            background: 'var(--color-surface-alt)',
            borderBottom: showLocals ? 'var(--border-hairline)' : 'none',
          }}
          onClick={() => setShowLocals(!showLocals)}
        >
          <span style={sectionLabel}>Local Variables</span>
          {locals.length > 0 && <span style={sectionBadge}>{locals.length}</span>}
          {arrow(showLocals)}
        </div>

        {showLocals && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {locals.length === 0 ? (
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-tertiary)', padding: 24,
                textAlign: 'center',
              }}>
                {snapshot ? '当前作用域无局部变量' : '编译运行代码后开始调试'}
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{
                    borderBottom: 'var(--border-hairline)',
                    color: 'var(--color-text-tertiary)',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                  }}>
                    <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'center' }}>Name</th>
                    <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'center' }}>Type</th>
                    <th style={{ padding: '4px 8px', fontWeight: 500, textAlign: 'center' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {locals.map((v, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{
                        padding: '5px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--color-copper)',
                        fontWeight: 500,
                        textAlign: 'center',
                      }}>
                        {v.name}
                      </td>
                      <td style={{
                        padding: '5px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        textAlign: 'center',
                      }}>
                        {v.type}
                        {v.is_pointer && <span style={{ color: 'var(--color-copper)' }}>*</span>}
                      </td>
                      <td style={{
                        padding: '5px 8px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: v.is_pointer ? 'var(--color-copper)' : 'var(--color-teal)',
                        textAlign: 'center',
                        fontWeight: v.is_pointer ? 500 : 400,
                        maxWidth: 200, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                        title={(v.display_value || v.value) + (v.is_pointer ? '' : '')}
                      >
                        {fmtDisplay(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Annotation Panel ────────────────────────────────────── */}
      <AnnotationPanel />

      {/* ── Visualization Targets ───────────────────────────────── */}
      {candidates.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          flexShrink: showTargets ? 0 : undefined,
        }}>
          <div
            style={{
              ...sectionHeader,
              background: 'var(--color-surface-alt)',
              borderTop: showTargets ? 'var(--border-hairline)' : 'none',
              borderBottom: showTargets ? 'var(--border-hairline)' : 'none',
            }}
            onClick={() => setShowTargets(!showTargets)}
          >
            <span style={sectionLabel}>Viz Targets</span>
            <span style={{
              ...sectionBadge,
              color: 'var(--color-teal)',
              background: 'var(--color-teal-light)',
            }}>
              {selectedVars.size}/{candidates.length}
            </span>
            {arrow(showTargets)}
          </div>

          {showTargets && (
            <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
              <div style={{
                display: 'flex', gap: 4, padding: '4px 12px',
                borderBottom: 'var(--border-hairline)',
              }}>
                <button onClick={selectAllVars} style={{
                  flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-ui)', fontWeight: 500,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-secondary)', cursor: 'pointer',
                }}>
                  全选
                </button>
                <button onClick={deselectAllVars} style={{
                  flex: 1, padding: '3px 0', fontSize: 10, borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-ui)', fontWeight: 500,
                  border: '1px solid var(--color-border)', background: 'transparent',
                  color: 'var(--color-text-secondary)', cursor: 'pointer',
                }}>
                  全不选
                </button>
              </div>

              {candidates.map((c) => {
                const checked = selectedVars.has(c.var_name);
                return (
                  <div
                    key={c.var_name}
                    onClick={() => toggleVar(c.var_name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 12px', cursor: 'pointer',
                      fontSize: 12, userSelect: 'none',
                      transition: 'background 0.1s',
                      opacity: checked ? 1 : 0.45,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 16, height: 16, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                      border: checked ? 'none' : '1.5px solid var(--color-border)',
                      background: checked ? 'var(--color-ink)' : 'transparent',
                      color: '#ffffff', fontSize: 10, fontWeight: 700,
                      transition: 'all 0.15s',
                    }}>
                      {checked ? '✓' : ''}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: checked ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                      fontWeight: 500,
                    }}>
                      {c.var_name}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--color-text-tertiary)',
                      marginLeft: 'auto',
                    }}>
                      {candidateLabel(c.struct_type)}
                      {c.node_count > 0 && (
                        <span style={{ marginLeft: 4, color: 'var(--color-text-tertiary)' }}>
                          ({c.node_count})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Program Output ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        flexShrink: showOutput ? 0 : undefined,
      }}>
        <div
          style={{
            ...sectionHeader,
            background: 'var(--color-surface-alt)',
            borderTop: showOutput ? 'var(--border-hairline)' : 'none',
            borderBottom: showOutput ? 'var(--border-hairline)' : 'none',
          }}
          onClick={() => setShowOutput(!showOutput)}
        >
          <span style={sectionLabel}>Stdout</span>
          {stdout.length > 0 && (
            <span style={sectionBadge}>
              {stdout.split('\n').filter(Boolean).length} lines
            </span>
          )}
          {arrow(showOutput)}
        </div>

        {showOutput && (
          <div style={{ maxHeight: 140, overflowY: 'auto' }}>
            {stdout.length === 0 ? (
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-tertiary)', padding: 16,
                textAlign: 'center',
              }}>
                暂无输出
              </div>
            ) : (
              <pre style={{
                margin: 0, padding: '8px 12px',
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--color-text)', lineHeight: '1.6',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'var(--color-surface-alt)',
              }}>
                {stdout}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* ── Call Stack ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        flexShrink: showCallStack ? 0 : undefined,
      }}>
        <div
          style={{
            ...sectionHeader,
            background: 'var(--color-surface-alt)',
            borderBottom: showCallStack ? 'var(--border-hairline)' : 'none',
          }}
          onClick={() => setShowCallStack(!showCallStack)}
        >
          <span style={sectionLabel}>Call Stack</span>
          {callStack.length > 0 && <span style={sectionBadge}>{callStack.length}</span>}
          {arrow(showCallStack)}
        </div>

        {showCallStack && (
          <div style={{ overflowY: 'auto' }}>
            {callStack.length === 0 ? (
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)',
                color: 'var(--color-text-tertiary)', padding: 16,
                textAlign: 'center',
              }}>
                {'—'}
              </div>
            ) : (
              callStack.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '5px 12px', fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    borderBottom: 'var(--border-hairline)',
                    color: i === 0 ? 'var(--color-ink)' : 'var(--color-text-secondary)',
                    fontWeight: i === 0 ? 500 : 400,
                  }}
                >
                  <span style={{ color: 'var(--color-text-tertiary)', marginRight: 4 }}>#{i}</span>
                  {f.function || '??'}()
                  <span style={{
                    color: 'var(--color-text-tertiary)',
                    marginLeft: 6, fontSize: 10,
                  }}>
                    {f.file}:{f.line}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}
