import type { LevelZone } from './module-types';

export const LEVEL_GRID_CONFIG = {
  cols: 28,
  rows: 24,
  groundRows: 4,
  minTileSize: 12,
  maxTileSize: 30,
  targetTopPaddingPx: 28,
} as const;

export const LEVEL_ZONE_LAYOUT: Record<LevelZone, {
  colRange: [number, number];
  rowRange: [number, number];
}> = {
  'left-safe': { colRange: [0, 0.24], rowRange: [0.25, 0.95] },
  'center-low': { colRange: [0.24, 0.56], rowRange: [0.58, 0.9] },
  'center-mid': { colRange: [0.25, 0.56], rowRange: [0.36, 0.62] },
  'right-low': { colRange: [0.56, 0.98], rowRange: [0.58, 0.9] },
  'right-mid': { colRange: [0.56, 0.98], rowRange: [0.34, 0.62] },
  'upper-right': { colRange: [0.66, 0.98], rowRange: [0.12, 0.4] },
};

export const LEVEL_ZONE_PLACEMENT_PLAN: Array<{
  zone: Exclude<LevelZone, 'left-safe'>;
  moduleCountRange: [number, number];
}> = [
  { zone: 'center-low', moduleCountRange: [2, 2] },
  { zone: 'center-mid', moduleCountRange: [1, 2] },
  { zone: 'right-low', moduleCountRange: [4, 5] },
  { zone: 'right-mid', moduleCountRange: [3, 4] },
  { zone: 'upper-right', moduleCountRange: [3, 4] },
];

export const LEVEL_GENERATION_CONFIG = {
  maxAttempts: 40,
  placementAttemptsPerModule: 56,
  defaultSpacingCols: 1,
  defaultSpacingRows: 1,
  turretSafeZoneCols: 7,
  turretSafeZoneRows: 10,
  debugEnabled: false,
} as const;

export const LEVEL_VALIDATION_CONFIG = {
  minOccupiedRatio: 0.1,
  maxOccupiedRatio: 0.64,
  minModuleCount: 11,
  minStandableSurfaceCells: 10,
  higherTargetRowsAboveGround: 6,
  maxJaggedSilhouetteSteps: 12,
  maxOverlapTolerance: 0,
} as const;
