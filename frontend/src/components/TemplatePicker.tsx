import { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { TEMPLATES, Template } from '../templates';

// ---- Category definitions ----
interface Category {
  name: string;
  ids: string[];
}

const CATEGORIES: Category[] = [
  {
    name: '链表',
    ids: ['linked_list_reverse', 'linked_list_middle', 'linked_list_cycle', 'doubly_linked_list'],
  },
  {
    name: '栈 / 队列',
    ids: ['stack_sequential', 'stack_linked', 'queue_circular', 'queue_linked', 'deque_array'],
  },
  {
    name: '树',
    ids: ['bst_search', 'bst_insert', 'avl_insert', 'huffman_tree', 'fibonacci_recursion'],
  },
  {
    name: '堆 / 图',
    ids: ['max_heap', 'graph_adjlist', 'graph_adjmatrix', 'bfs_traversal', 'dfs_traversal'],
  },
  {
    name: '数组 / 查找',
    ids: ['bubble_sort', 'selection_sort', 'binary_search'],
  },
  {
    name: '哈希表',
    ids: ['hashmap_chaining', 'hashmap_open_addressing'],
  },
  {
    name: 'B树 / B+树',
    ids: ['btree_insert', 'btree_search', 'bplustree_search', 'bplustree_insert'],
  },
];

// Build a quick lookup map
const TEMPLATE_MAP: Record<string, Template> = {};
TEMPLATES.forEach((t) => (TEMPLATE_MAP[t.id] = t));

export default function TemplatePicker() {
  const activeTemplateId = useStore((s) => s.activeTemplateId);
  const loadTemplate = useStore((s) => s.loadTemplate);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Compute panel position relative to trigger
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const recalcPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: Math.max(8, rect.left - 120),
      zIndex: 1000,
    });
  };

  useEffect(() => {
    if (open) {
      recalcPosition();
      window.addEventListener('resize', recalcPosition);
    }
    return () => window.removeEventListener('resize', recalcPosition);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Filter templates by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.toLowerCase();
    return CATEGORIES.map((cat) => ({
      ...cat,
      ids: cat.ids.filter((id) => {
        const t = TEMPLATE_MAP[id];
        if (!t) return false;
        return (
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q)
        );
      }),
    })).filter((cat) => cat.ids.length > 0);
  }, [search]);

  const activeTemplate = activeTemplateId ? TEMPLATE_MAP[activeTemplateId] : null;

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        title="选择模板"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: 28,
          padding: '0 8px',
          fontSize: 12,
          fontFamily: 'inherit',
          color: '#444',
          background: open ? '#e8f0fe' : '#fafafa',
          border: open ? '1px solid #1a73e8' : '1px solid #e0e0e0',
          borderRadius: 4,
          cursor: 'pointer',
          outline: 'none',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        {activeTemplate ? `${activeTemplate.icon} ${activeTemplate.label}` : '选择模板'}
        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>{open ? '▴' : '▾'}</span>
      </button>

      {/* Popover panel */}
      {open && (
        <div ref={panelRef} style={panelStyle}>
          <div style={{
            width: 520,
            maxHeight: 420,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e8e8e8',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Search bar */}
            <div style={{
              padding: '10px 12px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索模板..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: '#333',
                  background: 'transparent',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    fontSize: 14,
                    color: '#999',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category grid */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 12px 14px',
            }}>
              {filteredCategories.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: 32,
                  color: '#bbb',
                  fontSize: 13,
                }}>
                  没有匹配的模板
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <div key={cat.name} style={{ marginBottom: 14 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#999',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: 6,
                      paddingLeft: 2,
                    }}>
                      {cat.name}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: 6,
                    }}>
                      {cat.ids.map((id) => {
                        const t = TEMPLATE_MAP[id];
                        if (!t) return null;
                        const isActive = id === activeTemplateId;
                        return (
                          <button
                            key={id}
                            onClick={() => {
                              loadTemplate(id);
                              setOpen(false);
                              setSearch('');
                            }}
                            title={t.description}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '7px 10px',
                              fontSize: 12,
                              fontFamily: 'inherit',
                              color: isActive ? '#1a73e8' : '#444',
                              background: isActive ? '#e8f0fe' : '#fafafa',
                              border: isActive ? '1px solid #1a73e8' : '1px solid #f0f0f0',
                              borderRadius: 5,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.12s',
                              outline: 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = '#f0f0f0';
                                e.currentTarget.style.borderColor = '#d0d0d0';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.background = '#fafafa';
                                e.currentTarget.style.borderColor = '#f0f0f0';
                              }
                            }}
                          >
                            <span style={{ fontSize: 15, flexShrink: 0 }}>{t.icon}</span>
                            <span style={{ fontWeight: isActive ? 600 : 400 }}>
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
