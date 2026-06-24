import { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  parseVizAnnotations,
  removeAnnotationLine,
  insertAnnotationAbove,
  detectVariables,
  STRUCT_TYPES,
  type StructTypeDef,
} from '../utils/annotations';

function typeIcon(st: string): string {
  const def = STRUCT_TYPES.find((d) => d.type === st);
  return def?.icon ?? '📦';
}

function typeLabel(st: string): string {
  const def = STRUCT_TYPES.find((d) => d.type === st);
  return def?.label ?? st;
}

export default function AnnotationPanel() {
  const code = useStore((s) => s.code);
  const setCode = useStore((s) => s.setCode);
  const cursorLine = useStore((s) => s.cursorLine);
  const [collapsed, setCollapsed] = useState(false);

  const annotations = parseVizAnnotations(code);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleDelete = (line: number) => {
    setCode(removeAnnotationLine(code, line));
  };

  const handleTypeSelect = (def: StructTypeDef) => {
    const targetLine = cursorLine;
    if (!targetLine) return;

    const lines = code.split('\n');
    const lineText = lines[targetLine - 1] ?? '';
    const detectedVars = detectVariables(lineText);

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
    setCode(insertAnnotationAbove(code, targetLine, annotation));
    setShowTypeSelector(false);
  };

  const summaryText = (ann: ReturnType<typeof parseVizAnnotations>[0]): string => {
    switch (ann.struct_type) {
      case 'linked_list': return ann.prev_field
        ? `${ann.name} ← head=${ann.root_var} next=${ann.next_field} prev=${ann.prev_field}`
        : `${ann.name} ← head=${ann.root_var} next=${ann.next_field}`;
      case 'binary_tree': return `${ann.name} ← root=${ann.root_var}`;
      case 'array': return `${ann.name} ← ${ann.root_var}[${ann.length_var}]`;
      case 'stack': return `${ann.name} ← ${ann.root_var}`;
      case 'queue': return `${ann.name} ← ${ann.root_var}`;
      case 'heap': return `${ann.name} ← ${ann.root_var}`;
      case 'graph': return `${ann.name} ← ${ann.root_var} (${ann.mode})`;
      case 'hashmap': return `${ann.name} ← ${ann.root_var} (${ann.mode})`;
      case 'recursion_tree': return ann.name;
      case 'show': return `show: ${ann.show_vars.join(', ')}`;
      default: return '';
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      flex: collapsed ? '0 0 auto' : '1 1 auto', minHeight: 0,
    }}>
      {/* Header */}
      <div
        style={{
          height: 30,
          background: 'var(--color-surface-alt)',
          borderBottom: collapsed ? 'none' : 'var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
        }}>
          🏷️ 标注管理
        </span>
        {annotations.length > 0 && (
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            color: 'var(--color-text-tertiary)',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-sm)',
            padding: '1px 6px', marginLeft: 6,
          }}>
            {annotations.length}
          </span>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: 10,
          color: 'var(--color-text-tertiary)',
          transform: collapsed ? undefined : 'rotate(180deg)',
          transition: 'transform 0.2s',
        }}>
          {'▼'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {annotations.length === 0 && !showTypeSelector ? (
            <div style={{
              fontSize: 12, fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-tertiary)', padding: 16,
              textAlign: 'center',
            }}>
              暂无标注
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {annotations.map((ann) => (
                <div
                  key={ann.line}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px',
                    borderBottom: 'var(--border-hairline)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-alt)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{typeIcon(ann.struct_type)}</span>
                  <span style={{
                    flexShrink: 0, fontWeight: 600,
                    color: 'var(--color-ink)', fontSize: 10,
                    minWidth: 50,
                  }}>
                    {typeLabel(ann.struct_type)}
                  </span>
                  <span style={{
                    flex: 1, color: 'var(--color-text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', fontSize: 10,
                  }}>
                    {summaryText(ann)}
                  </span>
                  <span style={{
                    fontSize: 9, color: 'var(--color-text-tertiary)',
                    flexShrink: 0,
                  }}>
                    L{ann.line}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(ann.line); }}
                    title="删除此标注"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-tertiary)', fontSize: 14,
                      padding: '0 2px', lineHeight: 1, flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-red)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {!showTypeSelector && (
            <button
              onClick={() => setShowTypeSelector(true)}
              disabled={!cursorLine}
              title={cursorLine ? `在当前光标行 ${cursorLine} 上方插入标注` : '请先在代码编辑器中点击目标行'}
              style={{
                margin: '8px 12px', padding: '6px 12px',
                fontSize: 11, fontWeight: 500,
                fontFamily: 'var(--font-ui)',
                color: cursorLine ? 'var(--color-ink)' : 'var(--color-text-tertiary)',
                background: cursorLine ? 'var(--color-ink-light)' : 'var(--color-surface-alt)',
                border: cursorLine ? '1px dashed var(--color-ink)' : '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: cursorLine ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
            >
              {cursorLine ? `+ 在第 ${cursorLine} 行上方添加标注` : '+ 添加标注（先点击代码行）'}
            </button>
          )}

          {/* Type selector */}
          {showTypeSelector && (
            <div style={{
              padding: '10px 12px',
              borderTop: 'var(--border-hairline)',
              background: 'var(--color-surface-alt)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}>
                选择数据结构类型：
              </div>
              {cursorLine && (
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 6,
                }}>
                  将插入到第 {cursorLine} 行上方 · 变量名自动检测
                </div>
              )}
              {!cursorLine && (
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  color: 'var(--color-red)', marginBottom: 6,
                }}>
                  {'⚠'} 未检测到光标位置，请先在代码编辑器中点击目标行
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {STRUCT_TYPES.map((def) => (
                  <button
                    key={def.type}
                    onClick={() => handleTypeSelect(def)}
                    disabled={!cursorLine}
                    title={def.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 8px', fontSize: 11,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 500,
                      color: cursorLine ? 'var(--color-text)' : 'var(--color-text-tertiary)',
                      background: cursorLine ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: cursorLine ? 'pointer' : 'not-allowed',
                      textAlign: 'left' as const,
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!cursorLine) return;
                      e.currentTarget.style.background = 'var(--color-ink-light)';
                      e.currentTarget.style.borderColor = 'var(--color-ink)';
                    }}
                    onMouseLeave={(e) => {
                      if (!cursorLine) return;
                      e.currentTarget.style.background = 'var(--color-surface)';
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{def.icon}</span>
                    <span>{def.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTypeSelector(false)}
                style={{
                  marginTop: 8, background: 'none', border: 'none',
                  color: 'var(--color-text-tertiary)', cursor: 'pointer',
                  fontSize: 11, fontFamily: 'var(--font-ui)',
                  padding: 0,
                }}
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function buildAnnotation(
  typeKey: string,
  fields: Record<string, string>,
): string {
  const def = STRUCT_TYPES.find((d) => d.type === typeKey);
  if (!def) return '';
  return def.format(fields.name ?? 'auto', fields);
}
