// Shared layout constants for all CanvasArea renderers
// ── "Graph Paper" design system ──

// ── Layout sizes ──────────────────────────────────────────────────────────

// Linked list / generic node
export const NODE_W = 88;
export const NODE_H = 44;
export const NODE_GAP = 70;
export const NODE_RADIUS = 4; // was 6 — tighter, cleaner
export const START_X = 60;
export const CENTER_Y = 160;
export const CONTENT_MARGIN = 60;

// Tree layout
export const TREE_NODE_RADIUS = 20;
export const TREE_LEVEL_H = 72;

// Array layout
export const ARRAY_CELL_W = 72;
export const ARRAY_CELL_H = 40;
export const ARRAY_GAP = 4;
export const ARRAY_START_Y = 130;

// Stack layout
export const STACK_CELL_W = 88;
export const STACK_CELL_H = 36;
export const STACK_START_X = 100;
export const STACK_START_Y = 36;
export const STACK_GAP = 3;

// Queue layout
export const QUEUE_CELL_W = 72;
export const QUEUE_CELL_H = 40;

// Graph layout
export const GRAPH_NODE_RADIUS = 22;
export const GRAPH_CENTER_X = 300;
export const GRAPH_CENTER_Y = 200;
export const GRAPH_RADIUS = 140;

// Hashmap layout
export const HMAP_BUCKET_W = 88;
export const HMAP_BUCKET_H = 40;
export const HMAP_CHAIN_GAP = 60;

// B-tree layout
export const BTREE_KEY_W = 32;
export const BTREE_KEY_H = 28;
export const BTREE_KEY_GAP = 2;
export const BTREE_LAYER_GAP = 90;
export const BTREE_NODE_PAD = 10;

// ── Canvas color tokens (match design-tokens.css) ─────────────────────────

// Node colors — default
export const NODE_FILL = '#ffffff';
export const NODE_STROKE = '#e4e1da';
export const NODE_STROKE_WIDTH = 1.5;

// Node colors — with pointer
export const NODE_POINTED_FILL = '#ffffff';
export const NODE_POINTED_STROKE = '#1e4d7b';

// Node colors — active / current operation
export const NODE_ACTIVE_FILL = '#eaf1f7';
export const NODE_ACTIVE_STROKE = '#1e4d7b';

// Edges
export const EDGE_STROKE = '#2d8a7b';
export const EDGE_WIDTH = 1.5;

// Pointer labels
export const POINTER_LINE_COLOR = '#b8703d';
export const POINTER_TAG_FILL = '#ffffff';
export const POINTER_TAG_STROKE = '#b8703d';
export const POINTER_TEXT_COLOR = '#b8703d';
export const POINTER_FONT_SIZE = 10;

// Canvas text
export const CANVAS_TEXT_FILL = '#1c1c1c';
export const CANVAS_TEXT_SECONDARY = '#6b6b65';
export const CANVAS_TEXT_TERTIARY = '#9c9b95';
export const CANVAS_FONT = 'JetBrains Mono';

// Empty state
export const EMPTY_FILL = '#f5f4f0';
export const EMPTY_STROKE = '#e4e1da';

// Dot grid
export const DOT_GRID_SPACING = 24;
export const DOT_GRID_RADIUS = 1;
export const DOT_GRID_COLOR = '#ece9e2';

// Animation
export const ANIM_COMPARE_FILL = '#eaf1f7';
export const ANIM_SWAP_FILL = '#fdf3e8';
export const ANIM_CREATE_SCALE_START = 0.6;

// Structure-specific accent strokes (for hashmap buckets, B-tree keys etc.)
export const HMAP_BUCKET_STROKE = '#7986cb';
export const BTREE_STROKE = '#8d6e63';
export const BPLUSTREE_STROKE = '#689f38';
