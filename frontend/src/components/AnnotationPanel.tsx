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

/** Icon per struct type */
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

  // ---- Add form state (type selector only, no field form) ----
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // ---- Delete ----
  const handleDelete = (line: number) => {
    setCode(removeAnnotationLine(code, line));
  };

  // ---- Select struct type → directly generate & insert ----
  const handleTypeSelect = (def: StructTypeDef) => {
    const targetLine = cursorLine;
    if (!targetLine) return;

    // Auto-detect variables from the cursor line
    const lines = code.split('\n');
    const lineText = lines[targetLine - 1] ?? '';
    const detectedVars = detectVariables(lineText);

    // Build fields with auto-detected values
    const fields: Record<string, string> = { name: 'auto' };
    for (const field of def.fields) {
      if (field.key === 'root_var' && detectedVars.length > 0) {
        fields[field.key] = detectedVars[0];
      } else if (field.key === 'name' && detectedVars.length > 0) {
        fields[field.key] = detectedVars[0];
      } else if (field.key === 'watched_vars') {
        fields[field.key] = detectedVars.join(', ');
      } else {
        fields[field.key] = field.placeholder;
      }
    }

    // Generate annotation and insert above the cursor line
    const annotation = def.format(fields.name ?? 'auto', fields);
    setCode(insertAnnotationAbove(code, targetLine, annotation));
    setShowTypeSelector(false);
  };

  // ---- Summary text for an annotation ----
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
      case 'watch': return `watch: ${ann.watched_vars.join(', ')}`;
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: collapsed ? '0 0 auto' : '1 1 auto', minHeight: 0 }}>
      {/* Header — click to toggle */}
      <div
        style={{
          height: 32,
          background: '#fafafa',
          borderBottom: collapsed ? 'none' : '1px solid #e8e8e8',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>🏷️ 标注管理</span>
        {annotations.length > 0 && (
          <span style={{
            fontSize: 10, color: '#999', background: '#eee',
            borderRadius: 8, padding: '1px 6px', marginLeft: 6,
          }}>
            {annotations.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ccc', transform: collapsed ? undefined : 'rotate(180deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Annotation list */}
          {annotations.length === 0 && !showTypeSelector ? (
            <div style={{ fontSize: 12, color: '#bbb', padding: 16, textAlign: 'center', fontStyle: 'italic' }}>
              暂无标注 — 点击下方按钮或右键代码区添加
            </div>
          ) : (
            <div style={{ padding: '4px 0' }}>
              {annotations.map((ann) => (
                <div
                  key={ann.line}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderBottom: '1px solid #f5f5f5',
                    fontSize: 11,
                    fontFamily: 'SF Mono, Menlo, Monaco, monospace',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{typeIcon(ann.struct_type)}</span>
                  <span style={{
                    flexShrink: 0,
                    fontWeight: 600,
                    color: '#1a73e8',
                    fontSize: 10,
                    minWidth: 50,
                  }}>
                    {typeLabel(ann.struct_type)}
                  </span>
                  <span style={{
                    flex: 1,
                    color: '#666',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 10,
                  }}>
                    {summaryText(ann)}
                  </span>
                  <span style={{ fontSize: 9, color: '#bbb', flexShrink: 0 }}>L{ann.line}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ann.line);
                    }}
                    title="删除此标注"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ccc',
                      fontSize: 14,
                      padding: '0 2px',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#ef5350')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
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
                margin: '8px 12px',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 500,
                color: cursorLine ? '#1a73e8' : '#bbb',
                background: cursorLine ? '#f0f7ff' : '#f5f5f5',
                border: cursorLine ? '1px dashed #1a73e8' : '1px dashed #ddd',
                borderRadius: 4,
                cursor: cursorLine ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!cursorLine) return;
                e.currentTarget.style.background = '#e3f0fd';
              }}
              onMouseLeave={(e) => {
                if (!cursorLine) return;
                e.currentTarget.style.background = '#f0f7ff';
              }}
            >
              {cursorLine ? `+ 在第 ${cursorLine} 行上方添加标注` : '+ 添加标注（先点击代码行）'}
            </button>
          )}

          {/* Type selector (simplified — no field form) */}
          {showTypeSelector && (
            <div style={{
              padding: '10px 12px',
              borderTop: '1px solid #e8e8e8',
              background: '#fafafa',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                选择数据结构类型：
              </div>
              {cursorLine && (
                <div style={{ fontSize: 10, color: '#999', marginBottom: 6 }}>
                  将插入到第 {cursorLine} 行上方 · 变量名自动检测
                </div>
              )}
              {!cursorLine && (
                <div style={{ fontSize: 10, color: '#ef5350', marginBottom: 6 }}>
                  ⚠ 未检测到光标位置，请先在代码编辑器中点击目标行
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'inherit',
                      color: cursorLine ? '#444' : '#ccc',
                      background: cursorLine ? '#fff' : '#f5f5f5',
                      border: '1px solid #e0e0e0',
                      borderRadius: 4,
                      cursor: cursorLine ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (!cursorLine) return;
                      e.currentTarget.style.background = '#f0f7ff';
                      e.currentTarget.style.borderColor = '#1a73e8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = cursorLine ? '#fff' : '#f5f5f5';
                      e.currentTarget.style.borderColor = '#e0e0e0';
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
                  marginTop: 8,
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  cursor: 'pointer',
                  fontSize: 11,
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

/**
 * Generate a @viz annotation string from type and fields.
 * Exported for use by the gutter popup in CodeEditor.
 */
export function buildAnnotation(
  typeKey: string,
  fields: Record<string, string>,
): string {
  const def = STRUCT_TYPES.find((d) => d.type === typeKey);
  if (!def) return '';
  return def.format(fields.name ?? 'auto', fields);
}
