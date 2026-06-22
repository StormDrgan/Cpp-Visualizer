// Shared layout types for CanvasArea renderers

export interface ContentBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}


export interface LLLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}


export interface BTLayout {
  positions: Record<number, { x: number; y: number }>;
  bounds: ContentBounds;
}


export interface ArrayLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}


export interface StackLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  bounds: ContentBounds;
}


export interface QueueLayout {
  positions: Record<string, { x: number; y: number; cx: number; cy: number }>;
  startX: number;
  bounds: ContentBounds;
}


export interface BTreeNodeLayout {
  x: number;
  y: number;
  width: number;
  keys: string[];
  addr: string;
}

