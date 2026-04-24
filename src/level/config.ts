import type { LevelMotifTemplate, LevelZone } from './module-types';

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
  'center-low': { colRange: [0.24, 0.56], rowRange: [0.66, 0.9] },
  'center-mid': { colRange: [0.25, 0.56], rowRange: [0.38, 0.6] },
  'right-low': { colRange: [0.56, 0.98], rowRange: [0.64, 0.9] },
  'right-mid': { colRange: [0.56, 0.98], rowRange: [0.32, 0.56] },
  'upper-right': { colRange: [0.66, 0.98], rowRange: [0.06, 0.28] },
};

export const LEVEL_ZONE_PLACEMENT_PLAN: Array<{
  zone: Exclude<LevelZone, 'left-safe'>;
  moduleCountRange: [number, number];
}> = [
  { zone: 'center-low', moduleCountRange: [3, 4] },
  { zone: 'center-mid', moduleCountRange: [3, 5] },
  { zone: 'right-low', moduleCountRange: [5, 7] },
  { zone: 'right-mid', moduleCountRange: [5, 7] },
  { zone: 'upper-right', moduleCountRange: [4, 6] },
];

export const LEVEL_GENERATION_CONFIG = {
  maxAttempts: 40,
  placementAttemptsPerModule: 56,
  defaultSpacingCols: 2,
  defaultSpacingRows: 1,
  minPlatformModulesTarget: 9,
  minUpperLayerPlatformsTarget: 4,
  platformTopUpAttempts: 240,
  turretSafeZoneCols: 7,
  turretSafeZoneRows: 10,
  debugEnabled: false,
} as const;

export const LEVEL_VALIDATION_CONFIG = {
  minOccupiedRatio: 0.1,
  maxOccupiedRatio: 0.69,
  minModuleCount: 11,
  minPlatformModules: 9,
  minStandableSurfaceCells: 10,
  higherTargetRowsAboveGround: 6,
  maxJaggedSilhouetteSteps: 12,
  maxOverlapTolerance: 0,
} as const;

export const LEVEL_MOTIF_CONFIG = {
  attemptsPerZone: 3,
  minCoverageShare: 0.48,
  centerBiasCols: 2,
} as const;

export const LEVEL_MOTIF_LIBRARY: LevelMotifTemplate[] = [
  {
    id: 'motif-step-chain-center',
    kind: 'step-chain',
    zone: 'center-low',
    weight: 1.2,
    anchorKinds: ['low-platform'],
    linkedSteps: [
      {
        requiredKinds: ['medium-platform', 'cover-section'],
        centerOffsetRange: [2, 5],
        rowOffsetRange: [-3, -1],
      },
      {
        requiredKinds: ['medium-platform', 'floating-platform'],
        centerOffsetRange: [4, 8],
        rowOffsetRange: [-6, -3],
      },
    ],
  },
  {
    id: 'motif-supported-tower-right',
    kind: 'supported-tower',
    zone: 'right-low',
    weight: 1.62,
    anchorKinds: ['tall-column'],
    linkedSteps: [
      {
        requiredKinds: ['cover-section', 'low-platform'],
        centerOffsetRange: [-4, -1],
        rowOffsetRange: [1, 3],
      },
      {
        requiredKinds: ['cover-section', 'low-platform'],
        centerOffsetRange: [1, 4],
        rowOffsetRange: [-3, -1],
      },
      {
        requiredKinds: ['tall-column', 'cover-section'],
        centerOffsetRange: [3, 6],
        rowOffsetRange: [1, 4],
      },
    ],
  },
  {
    id: 'motif-cover-overhang-right-mid',
    kind: 'cover-overhang',
    zone: 'right-mid',
    weight: 1.34,
    anchorKinds: ['medium-platform'],
    linkedSteps: [
      {
        requiredKinds: ['floating-platform'],
        centerOffsetRange: [0, 3],
        rowOffsetRange: [-5, -2],
      },
      {
        requiredKinds: ['medium-platform'],
        centerOffsetRange: [-4, -1],
        rowOffsetRange: [1, 3],
      },
      {
        requiredKinds: ['tall-column', 'floating-platform'],
        centerOffsetRange: [2, 5],
        rowOffsetRange: [2, 6],
      },
    ],
  },
  {
    id: 'motif-bridge-pillar-upper',
    kind: 'bridge-pillar',
    zone: 'upper-right',
    weight: 1.44,
    anchorKinds: ['floating-platform'],
    linkedSteps: [
      {
        requiredKinds: ['floating-platform'],
        centerOffsetRange: [-3, 0],
        rowOffsetRange: [3, 6],
      },
      {
        requiredKinds: ['floating-platform'],
        centerOffsetRange: [2, 5],
        rowOffsetRange: [-1, 2],
      },
      {
        requiredKinds: ['floating-platform'],
        centerOffsetRange: [-1, 3],
        rowOffsetRange: [2, 5],
      },
    ],
  },
];
