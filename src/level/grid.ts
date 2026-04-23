import { LEVEL_GRID_CONFIG } from './config';
import type { GridCell, GridRect } from './level-types';

export interface LevelGrid {
  cols: number;
  rows: number;
  groundRows: number;
  groundTopRow: number;
  tileSize: number;
  originX: number;
  originY: number;
}

export interface CreateLevelGridParams {
  arenaWidth: number;
  arenaHeight: number;
  groundY: number;
  cols?: number;
  rows?: number;
  groundRows?: number;
}

export function createLevelGrid(params: CreateLevelGridParams): LevelGrid {
  const cols = params.cols ?? LEVEL_GRID_CONFIG.cols;
  const rows = params.rows ?? LEVEL_GRID_CONFIG.rows;
  const groundRows = params.groundRows ?? LEVEL_GRID_CONFIG.groundRows;
  const groundTopRow = Math.max(1, rows - groundRows);
  const playableRows = Math.max(1, groundTopRow);

  const tileSizeByWidth = params.arenaWidth / cols;
  const availableAboveGround = Math.max(80, params.groundY - LEVEL_GRID_CONFIG.targetTopPaddingPx);
  const tileSizeByHeight = availableAboveGround / playableRows;

  const tileSize = clamp(
    Math.min(tileSizeByWidth, tileSizeByHeight),
    LEVEL_GRID_CONFIG.minTileSize,
    LEVEL_GRID_CONFIG.maxTileSize,
  );

  const originX = Math.max(0, (params.arenaWidth - (cols * tileSize)) * 0.5);
  const originY = params.groundY - (groundTopRow * tileSize);

  return {
    cols,
    rows,
    groundRows,
    groundTopRow,
    tileSize,
    originX,
    originY,
  };
}

export function gridToWorld(cell: GridCell, grid: LevelGrid): { x: number; y: number } {
  return {
    x: grid.originX + (cell.col * grid.tileSize),
    y: grid.originY + (cell.row * grid.tileSize),
  };
}

export function worldToGrid(point: { x: number; y: number }, grid: LevelGrid): GridCell {
  return {
    col: clampInt(Math.floor((point.x - grid.originX) / grid.tileSize), 0, grid.cols - 1),
    row: clampInt(Math.floor((point.y - grid.originY) / grid.tileSize), 0, grid.rows - 1),
  };
}

export function gridRectToWorldRect(rect: GridRect, grid: LevelGrid): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const world = gridToWorld(rect, grid);

  return {
    x: world.x,
    y: world.y,
    width: rect.width * grid.tileSize,
    height: rect.height * grid.tileSize,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clamp(value, min, max));
}
