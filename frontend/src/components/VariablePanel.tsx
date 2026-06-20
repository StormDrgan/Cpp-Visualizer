import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Annotation } from '../types';

type AnnotationType = 'linked_list' | 'watch';

export default function VariablePanel() {
  const snapshot = useStore((s) => s.snapshot);
  const annotations = useStore((s) => s.annotations);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const locals = snapshot?.locals ?? [];
  const callStack = snapshot?.call_stack ?? [];

  // Annotation form state
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [annType, setAnnType] = useState<AnnotationType>('linked_list');
  const [annName, setAnnName] = useState('');
  const [annRoot, setAnnRoot] = useState('');
  const [annNext, setAnnNext] = useState('next');
  const [annWatchVars, setAnnWatchVars] = useState('');

  const handleAddAnnotation = () => {
    if (!annName.trim()) return;

    if (annType === 'linked_list') {
      if (!annRoot.trim()) return;
      addAnnotation({
        struct_type: 'linked_list',
        name: annName.trim(),
        root_var: annRoot.trim(),
        next_field: annNext.trim() || 'next',
        watched_vars: [],
      });
    } else {
      const vars = annWatchVars.split(',').map((v) => v.trim()).filter(Boolean);
      if (vars.length === 0) return;
      addAnnotation({
        struct_type: 'watch',
        name: '',
        root_var: '',
        next_field: '',
        watched_vars: vars,
      });
    }

    // Reset form
    setAnnName('');
    setAnnRoot('');
    setAnnWatchVars('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 局部变量 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            height: 32,
            background: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            flexShrink: 0,
          }}
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
        </div>

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
                <tr style={{ borderBottom: '1px solid #eee', color: '#999', fontSize: 11, textAlign: 'left' }}>
                  <th style={{ padding: '6px 12px', fontWeight: 500 }}>变量名</th>
                  <th style={{ padding: '6px 0', fontWeight: 500 }}>类型</th>
                  <th style={{ padding: '6px 12px', fontWeight: 500, textAlign: 'right' }}>值</th>
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
                        padding: '5px 12px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: '#1a73e8', fontWeight: 500,
                      }}
                    >
                      {v.name}
                    </td>
                    <td
                      style={{
                        padding: '5px 0',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace', color: '#888',
                      }}
                    >
                      {v.type}
                      {v.is_pointer && <span style={{ color: '#e65100' }}>*</span>}
                    </td>
                    <td
                      style={{
                        padding: '5px 12px',
                        fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                        color: v.is_pointer ? '#e65100' : '#2e7d32',
                        textAlign: 'right', fontWeight: v.is_pointer ? 500 : 400,
                        maxWidth: 180, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                      title={v.display_value || v.value}
                    >
                      {v.display_value || v.value}
                      {v.deref_type && (
                        <span style={{ color: '#999', fontSize: 10, marginLeft: 2 }}>
                          ({v.deref_type})
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 调用栈 */}
      <div style={{ borderTop: '2px solid #e8e8e8', display: 'flex', flexDirection: 'column', maxHeight: '42%' }}>
        <div
          style={{
            height: 32, background: '#fafafa', borderBottom: '1px solid #e8e8e8',
            display: 'flex', alignItems: 'center', padding: '0 12px', flexShrink: 0,
          }}
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
        </div>

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
      </div>

      {/* 标注管理 */}
      <div
        style={{
          borderTop: '2px solid #e8e8e8',
          display: 'flex', flexDirection: 'column',
          maxHeight: showAnnotations ? '36%' : undefined,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 32, background: '#fafafa', borderBottom: showAnnotations ? '1px solid #e8e8e8' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', flexShrink: 0, cursor: 'pointer',
          }}
          onClick={() => setShowAnnotations(!showAnnotations)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>🏷️ 标注</span>
            {annotations.length > 0 && (
              <span
                style={{
                  fontSize: 10, color: '#999', background: '#eee',
                  borderRadius: 8, padding: '1px 6px',
                }}
              >
                {annotations.length}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: '#ccc', transform: showAnnotations ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
            ▼
          </span>
        </div>

        {showAnnotations && (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {/* Existing annotations */}
            {annotations.length > 0 && (
              <div style={{ padding: '8px 12px 4px' }}>
                {annotations.map((ann, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', marginBottom: 4, borderRadius: 4,
                      background: '#f5f5f5', fontSize: 11,
                      fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                    }}
                  >
                    <span>
                      {ann.struct_type === 'linked_list' ? (
                        <>
                          <span style={{ color: '#1a73e8' }}>🔗</span>
                          {' '}{ann.name}: head={ann.root_var}.next_field={ann.next_field}
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#e65100' }}>👁️</span>
                          {' watch('}{ann.watched_vars.join(', ')}{')'}
                        </>
                      )}
                    </span>
                    <button
                      onClick={() => removeAnnotation(i)}
                      style={{
                        border: 'none', background: 'transparent', color: '#ccc',
                        cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1,
                      }}
                      title="删除标注"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add annotation form */}
            <div style={{ padding: '8px 12px', borderTop: annotations.length > 0 ? '1px solid #eee' : 'none' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                <button
                  onClick={() => setAnnType('linked_list')}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 3, border: '1px solid #ddd',
                    background: annType === 'linked_list' ? '#e3f2fd' : '#fff',
                    color: annType === 'linked_list' ? '#1a73e8' : '#999',
                    cursor: 'pointer', fontWeight: annType === 'linked_list' ? 600 : 400,
                  }}
                >
                  🔗 链表
                </button>
                <button
                  onClick={() => setAnnType('watch')}
                  style={{
                    flex: 1, padding: '4px 0', fontSize: 11, borderRadius: 3, border: '1px solid #ddd',
                    background: annType === 'watch' ? '#fff3e0' : '#fff',
                    color: annType === 'watch' ? '#e65100' : '#999',
                    cursor: 'pointer', fontWeight: annType === 'watch' ? 600 : 400,
                  }}
                >
                  👁️ 监视
                </button>
              </div>

              {annType === 'linked_list' ? (
                <>
                  <input
                    placeholder="标注名 例如 list1"
                    value={annName}
                    onChange={(e) => setAnnName(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="根变量 例如 head"
                    value={annRoot}
                    onChange={(e) => setAnnRoot(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="next 字段 默认 next"
                    value={annNext}
                    onChange={(e) => setAnnNext(e.target.value)}
                    style={inputStyle}
                  />
                </>
              ) : (
                <input
                  placeholder="监视变量 例如 slow, fast"
                  value={annWatchVars}
                  onChange={(e) => setAnnWatchVars(e.target.value)}
                  style={inputStyle}
                />
              )}

              <button
                onClick={handleAddAnnotation}
                style={{
                  width: '100%', padding: '5px 0', fontSize: 11, borderRadius: 4,
                  border: '1px solid #1a73e8', background: '#1a73e8', color: '#fff',
                  cursor: 'pointer', fontWeight: 600, marginTop: 4,
                }}
              >
                + 添加标注
              </button>

              <div style={{ fontSize: 10, color: '#ccc', marginTop: 6, textAlign: 'center' }}>
                添加后需重新编译运行生效
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  fontSize: 11,
  fontFamily: 'SF Mono, Menlo, Monaco, monospace',
  border: '1px solid #e8e8e8',
  borderRadius: 3,
  marginBottom: 4,
  outline: 'none',
  boxSizing: 'border-box',
};
