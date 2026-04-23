export interface Vector2 {
  x: number;
  y: number;
}

export type RabbitType = 'normal' | 'golden';

export interface ArenaBounds {
  width: number;
  height: number;
  groundY: number;
}

export interface RectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
