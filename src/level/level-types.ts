import type { LevelZone, ModuleKind } from './module-types';

export type TileKind = 'dirt' | 'grass-top';

export interface GridCell {
  col: number;
  row: number;
}

export interface GridRect {
  col: number;
  row: number;
  width: number;
  height: number;
}

export interface PlacedTile extends GridCell {
  tile: TileKind;
}

export interface BuiltModule {
  id: string;
  kind: ModuleKind;
  zone: LevelZone;
  origin: GridCell;
  width: number;
  height: number;
  tiles: PlacedTile[];
  occupiedCells: GridCell[];
  topSurfaceCells: GridCell[];
  rabbitStandCells: GridCell[];
  collisionRects: GridRect[];
  bounds: GridRect;
}

export interface LevelMetrics {
  moduleCount: number;
  occupiedTileRatio: number;
  maxHeightUsed: number;
  standableSurfaceCount: number;
}

export interface LevelValidationResult {
  valid: boolean;
  reasons: string[];
  metrics: LevelMetrics;
}

export interface LevelGenerationDebug {
  attempts: number;
  selectedAttempt: number;
  placementLogs: string[];
  validationFailures: string[][];
}

export interface GeneratedLevel {
  cols: number;
  rows: number;
  groundTopRow: number;
  modules: BuiltModule[];
  tiles: PlacedTile[];
  blockedCells: GridCell[];
  collisionRects: GridRect[];
  standableCells: GridCell[];
  validation: LevelValidationResult;
  debug?: LevelGenerationDebug;
}

export type GeneratedLevelDraft = Omit<GeneratedLevel, 'validation' | 'debug'>;
