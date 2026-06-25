import { describe, it, expect } from 'vitest';
import {
  parseVizAnnotations,
  removeAnnotationLine,
  insertAnnotationAbove,
  detectVariables,
} from '../../utils/annotations';

// ── parseVizAnnotations: one per annotation type ──────────────────────

describe('parseVizAnnotations', () => {
  it('parses singly linked_list', () => {
    const result = parseVizAnnotations('// @viz linked_list(list1) head=head.next_field=next');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'linked_list',
      name: 'list1',
      root_var: 'head',
      next_field: 'next',
      prev_field: '',
      line: 1,
    });
  });

  it('parses doubly linked_list', () => {
    const result = parseVizAnnotations('// @viz linked_list(dlist) head=head.next_field=next.prev_field=prev');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'linked_list',
      name: 'dlist',
      root_var: 'head',
      next_field: 'next',
      prev_field: 'prev',
    });
  });

  it('parses binary_tree', () => {
    const result = parseVizAnnotations('// @viz binary_tree(t) root=root.left_field=left.right_field=right');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'binary_tree',
      name: 't',
      root_var: 'root',
      left_field: 'left',
      right_field: 'right',
    });
  });

  it('parses array', () => {
    const result = parseVizAnnotations('// @viz array(arr) var=arr.length_var=n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'array',
      name: 'arr',
      root_var: 'arr',
      length_var: 'n',
    });
  });

  it('parses stack sequential', () => {
    const result = parseVizAnnotations('// @viz stack(s) var=data.top_var=top');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'stack',
      name: 's',
      root_var: 'data',
      top_var: 'top',
    });
  });

  it('parses stack linked', () => {
    const result = parseVizAnnotations('// @viz stack(s) var=top.next_field=next');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'stack',
      name: 's',
      root_var: 'top',
      next_field: 'next',
    });
  });

  it('parses queue circular', () => {
    const result = parseVizAnnotations('// @viz queue(q) var=data.front_var=front.rear_var=rear');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'queue',
      name: 'q',
      root_var: 'data',
      front_var: 'front',
      rear_var: 'rear',
    });
  });

  it('parses queue linked', () => {
    const result = parseVizAnnotations('// @viz queue(q) var=front.next_field=next');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'queue',
      name: 'q',
      root_var: 'front',
      next_field: 'next',
    });
  });

  it('parses heap with length_var', () => {
    const result = parseVizAnnotations('// @viz heap(h) var=data.length_var=size');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'heap',
      name: 'h',
      root_var: 'data',
      length_var: 'size',
    });
  });

  it('parses heap without length_var', () => {
    const result = parseVizAnnotations('// @viz heap(h) var=data');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'heap',
      name: 'h',
      root_var: 'data',
      length_var: '',
    });
  });

  it('parses graph matrix', () => {
    const result = parseVizAnnotations('// @viz graph(g) var=mat.mode=matrix.size_var=n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'graph',
      mode: 'matrix',
      length_var: 'n',
    });
  });

  it('parses graph adjlist', () => {
    const result = parseVizAnnotations('// @viz graph(g) var=adj.size_var=n');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'graph',
      mode: 'adjlist',
    });
  });

  it('parses hashmap', () => {
    const result = parseVizAnnotations('// @viz hashmap(hm) var=table.mode=chaining');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'hashmap',
      name: 'hm',
      root_var: 'table',
      mode: 'chaining',
    });
  });

  it('parses hashmap defaults to chaining', () => {
    const result = parseVizAnnotations('// @viz hashmap(hm) var=table');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'hashmap',
      mode: 'chaining',
    });
  });

  it('parses recursion_tree', () => {
    const result = parseVizAnnotations('// @viz recursion_tree(rt)');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'recursion_tree',
      name: 'rt',
    });
  });

  it('parses b_tree', () => {
    const result = parseVizAnnotations('// @viz b_tree(bt) root=root.order=5');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'b_tree',
      name: 'bt',
      length_var: '5',
    });
  });

  it('parses bplustree', () => {
    const result = parseVizAnnotations('// @viz bplustree(bp) root=root.order=6');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'bplustree',
      name: 'bp',
      length_var: '6',
    });
  });

  it('parses show with multiple variables', () => {
    const result = parseVizAnnotations('// @viz show(slow, fast, cur)');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      struct_type: 'show',
      show_vars: ['slow', 'fast', 'cur'],
    });
  });

  it('parses show with single variable', () => {
    const result = parseVizAnnotations('// @viz show(ptr)');
    expect(result).toHaveLength(1);
    expect(result[0].show_vars).toEqual(['ptr']);
  });
});

// ── Line number tracking ──────────────────────────────────────────────

describe('parseVizAnnotations line tracking', () => {
  it('assigns correct line numbers (1-indexed)', () => {
    const code = [
      '#include <iostream>',
      '// @viz linked_list(l) head=head.next_field=next',
      '',
      'int main() {',
      '  // @viz array(a) var=arr.length_var=n',
      '  return 0;',
      '}',
    ].join('\n');

    const result = parseVizAnnotations(code);
    expect(result).toHaveLength(2);
    expect(result[0].line).toBe(2);
    expect(result[1].line).toBe(5);
  });

  it('raw field preserves original text', () => {
    const result = parseVizAnnotations('  // @viz linked_list(l) head=head.next_field=next');
    expect(result[0].raw).toBe('// @viz linked_list(l) head=head.next_field=next');
  });
});

// ── //@viz variant (no space) ─────────────────────────────────────────

describe('parseVizAnnotations variant syntax', () => {
  it('parses //@viz without space', () => {
    const result = parseVizAnnotations('//@viz linked_list(l) head=head.next_field=next');
    expect(result).toHaveLength(1);
    expect(result[0].struct_type).toBe('linked_list');
  });
});

// ── Multi-annotation / edge cases ─────────────────────────────────────

describe('parseVizAnnotations edge cases', () => {
  it('returns empty for no annotations', () => {
    expect(parseVizAnnotations('int x = 5;\nreturn x;\n')).toEqual([]);
  });

  it('skips non-@viz comments', () => {
    const result = parseVizAnnotations('// This is a comment\n// @viz array(a) var=a.length_var=n');
    expect(result).toHaveLength(1);
  });

  it('handles empty string', () => {
    expect(parseVizAnnotations('')).toEqual([]);
  });

  it('handles malformed @viz line gracefully', () => {
    const result = parseVizAnnotations('// @viz unknown_type(x) var=x\n// @viz array(');
    expect(result).toEqual([]);
  });

  it('handles mixed valid and invalid', () => {
    const code = '// @viz linked_list(l) head=h.next_field=n\n// plain comment\n// @viz show(p)';
    const result = parseVizAnnotations(code);
    expect(result).toHaveLength(2);
  });
});

// ── removeAnnotationLine ──────────────────────────────────────────────

describe('removeAnnotationLine', () => {
  it('removes first line', () => {
    const result = removeAnnotationLine('line1\nline2\nline3', 1);
    expect(result).toBe('line2\nline3');
  });

  it('removes last line', () => {
    const result = removeAnnotationLine('line1\nline2\nline3', 3);
    expect(result).toBe('line1\nline2');
  });

  it('removes middle line', () => {
    const result = removeAnnotationLine('line1\nline2\nline3', 2);
    expect(result).toBe('line1\nline3');
  });

  it('removes only line', () => {
    const result = removeAnnotationLine('only', 1);
    expect(result).toBe('');
  });
});

// ── insertAnnotationAbove ─────────────────────────────────────────────

describe('insertAnnotationAbove', () => {
  it('inserts at beginning', () => {
    const result = insertAnnotationAbove('line1\nline2', 1, '// @viz show(x)');
    expect(result).toBe('// @viz show(x)\nline1\nline2');
  });

  it('inserts in middle', () => {
    const result = insertAnnotationAbove('line1\nline2\nline3', 2, '// @viz show(x)');
    expect(result).toBe('line1\n// @viz show(x)\nline2\nline3');
  });

  it('inserts at end', () => {
    const result = insertAnnotationAbove('line1\nline2', 3, '// @viz show(x)');
    expect(result).toBe('line1\nline2\n// @viz show(x)');
  });
});

// ── detectVariables ───────────────────────────────────────────────────

describe('detectVariables', () => {
  it('detects pointer declaration', () => {
    const vars = detectVariables('Node* head = nullptr;');
    expect(vars).toContain('head');
  });

  it('detects int declaration', () => {
    const vars = detectVariables('int n = 5;');
    expect(vars).toContain('n');
  });

  it('detects size_t declaration', () => {
    const vars = detectVariables('size_t count = 0;');
    expect(vars).toContain('count');
  });

  it('returns empty for no match', () => {
    expect(detectVariables('printf("hello");')).toEqual([]);
  });
});
