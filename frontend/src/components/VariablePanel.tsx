import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { CandidateVar } from '../types';
import AnnotationPanel from './AnnotationPanel';

/** Shorten pointer addresses: "0x00005555555592b0 → {val=1}" → "…92b0 → {val=1}" */
function fmtDisplay(v: { is_pointer: boolean; display_value: string; value: string }): string {
  const raw = v.display_value || v.value;
  if (!v.is_pointer) return raw;
  // Shorten full hex address to last 4 digits for display
  return raw.replace(/0x[0-9a-fA-F]+/, (addr) => {
    if (addr.length > 8) return '…' + addr.slice(-4);
    return addr;
  });
}

/** Icon + color per struct type for the checkbox list */
function candidateIcon(st: string): string {
  switch (st) {
    case 'linked_list': return '🔗';
    case 'binary_tree': return '🌳';
    case 'array': return '📊';
    case 'stack': return '📚';
    case 'queue': return '🚶';
    case 'heap': return '⛰️';
    case 'graph': return '🕸️';
    case 'hashmap': return '#️⃣';
    default: return '📦';
  }
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

  // Collapse states — locals + output + targets open by default; call stack folded
  const [showLocals, setShowLocals] = useState(true);
  const [showCallStack, setShowCallStack] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [showTargets, setShowTargets] = useState(true);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 局部变量 */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: showLocals ? '1 1 auto' : '0 0 auto', minHeight: 0 }}>
        <div
          style={{
            height: 32,
            background: '#fafafa',
            borderBottom: showLocals ? '1px solid #e8e8e8' : 'none',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => setShowLocals(!showLocals)}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>📦 局部变量</span>
          {locals.length > 0 && (
            <span
              style={{
                fontSize: 10, color: '#999', background: '#eee',
                borderRadius: 8, padding: '1px 6px', marginLeft: 6,
              }}
            >
              {locals.length}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: showLocals ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {showLocals && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {locals.length === 0 ? (
            <div
              style={{
                fontSize: 12, color: '#bbb', padding: 24,
                textAlign: 'center', fontStyle: 'italic',
              }}
            >
              {snapshot ? '当前作用域无局部变量' : '编译运行代码后开始调试'}
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #eee', color: '#999', fontSize: 11, textAlign: 'center' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>变量名</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>类型</th>
                  <th style={{ padding: '6px 8px', fontWeight: 500 }}>值</th>
                </tr>
              </thead>
              <tbody>
                {locals.map((v, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid #f5f5f5', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td
                      style={{
                        padding: '5px 8px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: '#1a73e8', fontWeight: 500,
                        textAlign: 'center',
                      }}
                    >
                      {v.name}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace', color: '#888',
                        textAlign: 'center',
                      }}
                    >
                      {v.type}
                      {v.is_pointer && <span style={{ color: '#e65100' }}>*</span>}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: v.is_pointer ? '#e65100' : '#2e7d32',
                        textAlign: 'center', fontWeight: v.is_pointer ? 500 : 400,
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

      {/* 标注管理 — @viz panel */}
      <AnnotationPanel />

      {/* 可视化目标 — §v0.8 click-to-select checkboxes */}
      {candidates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: showTargets ? 0 : undefined }}>
          <div
            style={{
              height: 32, background: '#fafafa',
              borderTop: '2px solid #e8e8e8',
              borderBottom: showTargets ? '1px solid #e8e8e8' : 'none',
              display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={() => setShowTargets(!showTargets)}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>🎯 可视化目标</span>
            <span
              style={{
                fontSize: 10, color: '#999', background: '#e8f5e9',
                borderRadius: 8, padding: '1px 6px', marginLeft: 6,
              }}
            >
              {selectedVars.size}/{candidates.length}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: showTargets ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
              ▼
            </span>
          </div>

          {showTargets && (
            <div style={{ maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 4, padding: '4px 12px', borderBottom: '1px solid #f5f5f5' }}>
                <button
                  onClick={selectAllVars}
                  style={{
                    flex: 1, padding: '2px 0', fontSize: 10, borderRadius: 3,
                    border: '1px solid #e8e8e8', background: '#fff', color: '#666',
                    cursor: 'pointer',
                  }}
                >
                  全选
                </button>
                <button
                  onClick={deselectAllVars}
                  style={{
                    flex: 1, padding: '2px 0', fontSize: 10, borderRadius: 3,
                    border: '1px solid #e8e8e8', background: '#fff', color: '#666',
                    cursor: 'pointer',
                  }}
                >
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
                      opacity: checked ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Custom checkbox */}
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: checked ? 'none' : '1.5px solid #ccc',
                        background: checked ? '#1a73e8' : '#fff',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        transition: 'all 0.15s',
                      }}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span style={{ fontSize: 14 }}>{candidateIcon(c.struct_type)}</span>
                    <span style={{
                      fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                      color: '#1a73e8', fontWeight: 500,
                    }}>
                      {c.var_name}
                    </span>
                    <span style={{ color: '#999', fontSize: 10, marginLeft: 'auto' }}>
                      {candidateLabel(c.struct_type)}
                      {c.node_count > 0 && <span style={{ marginLeft: 4, color: '#ccc' }}>({c.node_count})</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 程序输出 */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: showOutput ? 0 : undefined }}>
        <div
          style={{
            height: 32, background: '#fafafa',
            borderTop: '2px solid #e8e8e8',
            borderBottom: showOutput ? '1px solid #e8e8e8' : 'none',
            display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => setShowOutput(!showOutput)}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>💻 程序输出</span>
          {stdout.length > 0 && (
            <span
              style={{
                fontSize: 10, color: '#999', background: '#eee',
                borderRadius: 8, padding: '1px 6px', marginLeft: 6,
              }}
            >
              {stdout.split('\n').filter(Boolean).length} 行
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: showOutput ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {showOutput && (
          <div style={{ maxHeight: 140, overflowY: 'auto' }}>
            {stdout.length === 0 ? (
              <div
                style={{
                  fontSize: 12, color: '#bbb', padding: 16,
                  textAlign: 'center', fontStyle: 'italic',
                }}
              >
                暂无输出
              </div>
            ) : (
              <pre
                style={{
                  margin: 0, padding: '8px 12px',
                  fontSize: 12, fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                  color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {stdout}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 调用栈 */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: showCallStack ? 0 : undefined }}>
        <div
          style={{
            height: 32, background: '#fafafa',
            borderBottom: showCallStack ? '1px solid #e8e8e8' : 'none',
            display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0,
            cursor: 'pointer',
          }}
          onClick={() => setShowCallStack(!showCallStack)}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>📚 调用栈</span>
          {callStack.length > 0 && (
            <span
              style={{
                fontSize: 10, color: '#999', background: '#eee',
                borderRadius: 8, padding: '1px 6px', marginLeft: 6,
              }}
            >
              {callStack.length}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: showCallStack ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {showCallStack && (
          <div style={{ overflowY: 'auto' }}>
            {callStack.length === 0 ? (
              <div
                style={{
                  fontSize: 12, color: '#bbb', padding: 16,
                  textAlign: 'center', fontStyle: 'italic',
                }}
              >
                —
              </div>
            ) : (
              callStack.map((f, i) => (
                <div
                  key={i}
                  style={{
                    padding: '5px 12px', fontSize: 11,
                    fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                    borderBottom: '1px solid #f5f5f5',
                    color: i === 0 ? '#1a73e8' : '#999',
                    fontWeight: i === 0 ? 500 : 400,
                  }}
                >
                  <span style={{ color: '#bbb', marginRight: 4 }}>#{i}</span>
                  {f.function || '??'}()
                  <span style={{ color: '#bbb', marginLeft: 6, fontSize: 10 }}>
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
