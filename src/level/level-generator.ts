import {
  LEVEL_GENERATION_CONFIG,
  LEVEL_ZONE_LAYOUT,
  LEVEL_ZONE_PLACEMENT_PLAN,
} from './config';
import type { LevelGrid } from './grid';
import { buildGroundStrip, buildModuleFromTemplate } from './module-builders';
import { getGroundStripTemplate, getZoneTemplates } from './module-library';
import type { BuiltModule, GeneratedLevel, GeneratedLevelDraft, GridCell, GridRect, PlacedTile } from './level-types';
import { validateGeneratedLevel } from './level-validator';
import type { LevelZone, ModuleKind, ModuleTemplate } from './module-types';

export interface GenerateLevelOptions {
  grid: LevelGrid;
  maxAttempts?: number;
  debug?: boolean;
  random?: () => number;
}

interface GenerateAttemptResult {
  levelDraft: GeneratedLevelDraft;
  turretSafeZone: GridRect;
  placementLogs: string[];
}

const ZONE_REQUIRED_KINDS: Record<Exclude<LevelZone, 'left-safe'>, ModuleKind[]> = {
  'center-low': ['low-platform', 'cover-section'],
  'center-mid': ['medium-platform'],
  'right-low': ['tall-column', 'cover-section'],
  'right-mid': ['medium-platform', 'floating-platform'],
  'upper-right': ['floating-platform'],
};

export function generateLevel(options: GenerateLevelOptions): GeneratedLevel {
  const rng = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? LEVEL_GENERATION_CONFIG.maxAttempts;
  const debug = options.debug ?? LEVEL_GENERATION_CONFIG.debugEnabled;

  const validationFailures: string[][] = [];
  let bestAttempt: { level: GeneratedLevel; logs: string[]; attempt: number } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const generated = generateSingleAttempt(options.grid, rng);
    const validation = validateGeneratedLevel(generated.levelDraft, {
      turretSafeZone: generated.turretSafeZone,
    });

    const level: GeneratedLevel = {
      ...generated.levelDraft,
      validation,
    };

    validationFailures.push(validation.reasons);

    if (debug) {
      logAttempt(attempt, maxAttempts, generated.placementLogs, validation.reasons);
    }

    if (validation.valid) {
      return {
        ...level,
        debug: {
          attempts: attempt,
          selectedAttempt: attempt,
          placementLogs: generated.placementLogs,
          validationFailures,
        },
      };
    }

    if (!bestAttempt || validation.reasons.length < bestAttempt.level.validation.reasons.length) {
      bestAttempt = {
        level,
        logs: generated.placementLogs,
        attempt,
      };
    }
  }

  if (!bestAttempt) {
    throw new Error('Не вдалося згенерувати жодної спроби рівня.');
  }

  return {
    ...bestAttempt.level,
    debug: {
      attempts: maxAttempts,
      selectedAttempt: bestAttempt.attempt,
      placementLogs: bestAttempt.logs,
      validationFailures,
    },
  };
}

export function serializeGeneratedLevel(level: GeneratedLevel): string {
  return JSON.stringify(level, null, 2);
}

function generateSingleAttempt(grid: LevelGrid, rng: () => number): GenerateAttemptResult {
  const placementLogs: string[] = [];
  const zoneBounds = resolveZoneBounds(grid);
  const turretSafeZone = createTurretSafeZone(grid);

  const modules: BuiltModule[] = [];
  const occupiedCells = new Set<string>();
  const placedBounds: GridRect[] = [];

  const commitModule = (module: BuiltModule): void => {
    modules.push(module);
    placedBounds.push(module.bounds);

    for (const cell of module.occupiedCells) {
      occupiedCells.add(toCellKey(cell.col, cell.row));
    }
  };

  const groundTemplate = getGroundStripTemplate();
  const groundModule = buildGroundStrip({
    template: groundTemplate,
    zone: 'center-low',
    origin: { col: 0, row: grid.groundTopRow },
    width: grid.cols,
    height: grid.groundRows,
  });

  commitModule(groundModule);
  placementLogs.push(`[ground] placed ${groundModule.id} at (0,${grid.groundTopRow}) size ${grid.cols}x${grid.groundRows}`);

  for (const zonePlan of LEVEL_ZONE_PLACEMENT_PLAN) {
    const zone = zonePlan.zone;
    const templates = getZoneTemplates(zone);
    const zoneRect = zoneBounds[zone];

    if (templates.length === 0) {
      placementLogs.push(`[${zone}] no templates found`);
      continue;
    }

    const targetCount = randomIntInRange(zonePlan.moduleCountRange, rng);
    const spreadCenters = createSpreadCenters(zoneRect, targetCount);
    const centerBiasCols = computeCenterBias(zoneRect, targetCount);
    placementLogs.push(`[${zone}] target modules: ${targetCount}`);
    placementLogs.push(`[${zone}] spread centers: ${spreadCenters.join(', ')}`);

    let placedCount = 0;
    const requiredKinds = ZONE_REQUIRED_KINDS[zone];
    const requiredTemplates = templates.filter((template) => requiredKinds.includes(template.kind));

    if (requiredTemplates.length > 0) {
      const requiredModule = tryPlaceModule({
        zone,
        templates: requiredTemplates,
        zoneRect,
        preferredCenterCol: spreadCenters[0],
        centerBiasCols,
        turretSafeZone,
        occupiedCells,
        placedBounds,
        grid,
        rng,
        placementLogs,
        slotLabel: 'anchor',
      });

      if (requiredModule) {
        commitModule(requiredModule);
        placementLogs.push(
          `[${zone}] anchor placed ${requiredModule.id} at `
          + `(${requiredModule.origin.col},${requiredModule.origin.row}) `
          + `size ${requiredModule.width}x${requiredModule.height}`,
        );
        placedCount += 1;
      } else {
        placementLogs.push(`[${zone}] anchor placement failed`);
      }
    }

    for (let index = placedCount; index < targetCount; index += 1) {
      const module = tryPlaceModule({
        zone,
        templates,
        zoneRect,
        preferredCenterCol: spreadCenters[Math.min(index, spreadCenters.length - 1)],
        centerBiasCols,
        turretSafeZone,
        occupiedCells,
        placedBounds,
        grid,
        rng,
        placementLogs,
        slotLabel: `slot #${index + 1}`,
      });

      if (!module) {
        placementLogs.push(`[${zone}] failed to place module slot #${index + 1}`);
        continue;
      }

      commitModule(module);
      placementLogs.push(
        `[${zone}] placed ${module.id} at (${module.origin.col},${module.origin.row}) `
        + `size ${module.width}x${module.height}`,
      );
    }
  }

  const tiles = composeTiles(modules);
  const blockedCells = dedupeCells(modules.flatMap((module) => module.occupiedCells));
  const collisionRects = dedupeRects(modules.flatMap((module) => module.collisionRects));
  const standableCells = dedupeCells(modules.flatMap((module) => module.rabbitStandCells));

  return {
    levelDraft: {
      cols: grid.cols,
      rows: grid.rows,
      groundTopRow: grid.groundTopRow,
      modules,
      tiles,
      blockedCells,
      collisionRects,
      standableCells,
    },
    turretSafeZone,
    placementLogs,
  };
}

interface TryPlaceModuleParams {
  zone: Exclude<LevelZone, 'left-safe'>;
  templates: ModuleTemplate[];
  zoneRect: GridRect;
  preferredCenterCol?: number;
  centerBiasCols?: number;
  turretSafeZone: GridRect;
  occupiedCells: Set<string>;
  placedBounds: GridRect[];
  grid: LevelGrid;
  rng: () => number;
  placementLogs: string[];
  slotLabel: string;
}

function tryPlaceModule(params: TryPlaceModuleParams): BuiltModule | null {
  for (let attempt = 0; attempt < LEVEL_GENERATION_CONFIG.placementAttemptsPerModule; attempt += 1) {
    const template = pickWeightedTemplate(params.templates, params.rng);
    const width = randomIntInRange(template.widthRange, params.rng);
    const height = randomIntInRange(template.heightRange, params.rng);
    const origin = sampleOrigin(
      params.zoneRect,
      width,
      height,
      params.rng,
      params.preferredCenterCol,
      params.centerBiasCols,
    );

    if (!origin) {
      params.placementLogs.push(
        `[${params.zone}] ${params.slotLabel} ${template.id} skip: zone too small for ${width}x${height}`,
      );
      continue;
    }

    const candidate = buildModuleFromTemplate({
      template,
      zone: params.zone,
      origin,
      width,
      height,
    });

    if (!isInsideGrid(candidate.occupiedCells, params.grid)) {
      params.placementLogs.push(`[${params.zone}] ${params.slotLabel} ${template.id} reject: outside bounds`);
      continue;
    }

    if (touchesTurretSafeZone(candidate.occupiedCells, params.turretSafeZone)) {
      params.placementLogs.push(`[${params.zone}] ${params.slotLabel} ${template.id} reject: turret safe zone`);
      continue;
    }

    if (hasOverlap(candidate.occupiedCells, params.occupiedCells)) {
      params.placementLogs.push(`[${params.zone}] ${params.slotLabel} ${template.id} reject: overlap`);
      continue;
    }

    if (violatesSpacing(candidate.bounds, params.placedBounds, template)) {
      params.placementLogs.push(`[${params.zone}] ${params.slotLabel} ${template.id} reject: spacing`);
      continue;
    }

    if (!satisfiesConstraints(candidate.occupiedCells, template, params.occupiedCells, params.grid)) {
      params.placementLogs.push(`[${params.zone}] ${params.slotLabel} ${template.id} reject: constraints`);
      continue;
    }

    return candidate;
  }

  return null;
}

function resolveZoneBounds(grid: LevelGrid): Record<LevelZone, GridRect> {
  const bounds = {} as Record<LevelZone, GridRect>;
  const maxModuleRow = Math.max(0, grid.groundTopRow - 1);

  for (const [zone, layout] of Object.entries(LEVEL_ZONE_LAYOUT) as Array<[LevelZone, typeof LEVEL_ZONE_LAYOUT[LevelZone]]>) {
    const colStart = clampInt(Math.floor(layout.colRange[0] * grid.cols), 0, grid.cols - 1);
    const colEnd = clampInt(Math.ceil(layout.colRange[1] * grid.cols) - 1, colStart, grid.cols - 1);

    const rowStart = clampInt(Math.floor(layout.rowRange[0] * grid.rows), 0, maxModuleRow);
    const rowEnd = clampInt(Math.ceil(layout.rowRange[1] * grid.rows) - 1, rowStart, maxModuleRow);

    bounds[zone] = {
      col: colStart,
      row: rowStart,
      width: (colEnd - colStart) + 1,
      height: (rowEnd - rowStart) + 1,
    };
  }

  return bounds;
}

function createTurretSafeZone(grid: LevelGrid): GridRect {
  return {
    col: 0,
    row: Math.max(0, grid.groundTopRow - LEVEL_GENERATION_CONFIG.turretSafeZoneRows),
    width: Math.min(grid.cols, LEVEL_GENERATION_CONFIG.turretSafeZoneCols),
    height: LEVEL_GENERATION_CONFIG.turretSafeZoneRows,
  };
}

function sampleOrigin(
  zone: GridRect,
  width: number,
  height: number,
  rng: () => number,
  preferredCenterCol?: number,
  centerBiasCols = 2,
): GridCell | null {
  const minCol = zone.col;
  const maxCol = (zone.col + zone.width) - width;
  const minRow = zone.row;
  const maxRow = (zone.row + zone.height) - height;

  if (maxCol < minCol || maxRow < minRow) {
    return null;
  }

  let sampledMinCol = minCol;
  let sampledMaxCol = maxCol;

  if (preferredCenterCol !== undefined) {
    const centeredOriginCol = Math.round(preferredCenterCol - (width * 0.5));
    const preferredMin = clampInt(centeredOriginCol - centerBiasCols, minCol, maxCol);
    const preferredMax = clampInt(centeredOriginCol + centerBiasCols, minCol, maxCol);

    if (preferredMin <= preferredMax) {
      sampledMinCol = preferredMin;
      sampledMaxCol = preferredMax;
    }
  }

  return {
    col: randomIntInRange([sampledMinCol, sampledMaxCol], rng),
    row: randomIntInRange([minRow, maxRow], rng),
  };
}

function createSpreadCenters(zone: GridRect, moduleCount: number): number[] {
  if (moduleCount <= 1) {
    return [zone.col + Math.floor(zone.width * 0.5)];
  }

  const centers: number[] = [];
  const maxCol = zone.col + zone.width - 1;

  for (let index = 0; index < moduleCount; index += 1) {
    const ratio = (index + 0.5) / moduleCount;
    const projectedCol = zone.col + Math.round((zone.width - 1) * ratio);
    centers.push(clampInt(projectedCol, zone.col, maxCol));
  }

  return centers;
}

function computeCenterBias(zone: GridRect, moduleCount: number): number {
  const safeCount = Math.max(1, moduleCount);
  return clampInt(Math.floor(zone.width / (safeCount * 3)), 1, 4);
}

function isInsideGrid(cells: GridCell[], grid: LevelGrid): boolean {
  return cells.every((cell) => (
    cell.col >= 0
    && cell.col < grid.cols
    && cell.row >= 0
    && cell.row < grid.rows
  ));
}

function touchesTurretSafeZone(cells: GridCell[], turretSafeZone: GridRect): boolean {
  return cells.some((cell) => (
    cell.col >= turretSafeZone.col
    && cell.col < turretSafeZone.col + turretSafeZone.width
    && cell.row >= turretSafeZone.row
    && cell.row < turretSafeZone.row + turretSafeZone.height
  ));
}

function hasOverlap(cells: GridCell[], occupiedCells: Set<string>): boolean {
  return cells.some((cell) => occupiedCells.has(toCellKey(cell.col, cell.row)));
}

function violatesSpacing(candidate: GridRect, existing: GridRect[], template: ModuleTemplate): boolean {
  const spacingCols = template.generationConstraints?.minSpacingCols ?? LEVEL_GENERATION_CONFIG.defaultSpacingCols;
  const spacingRows = template.generationConstraints?.minSpacingRows ?? LEVEL_GENERATION_CONFIG.defaultSpacingRows;

  for (const current of existing) {
    if (rectIntersects(expandRect(candidate, spacingCols, spacingRows), current)) {
      return true;
    }
  }

  return false;
}

function satisfiesConstraints(
  candidateCells: GridCell[],
  template: ModuleTemplate,
  occupiedCells: Set<string>,
  grid: LevelGrid,
): boolean {
  const constraints = template.generationConstraints;
  if (!constraints) {
    return true;
  }

  if (constraints.minRow !== undefined) {
    const minRow = candidateCells.reduce((best, cell) => Math.min(best, cell.row), Number.POSITIVE_INFINITY);
    if (minRow < constraints.minRow) {
      return false;
    }
  }

  if (constraints.maxRow !== undefined) {
    const maxRow = candidateCells.reduce((best, cell) => Math.max(best, cell.row), Number.NEGATIVE_INFINITY);
    if (maxRow > constraints.maxRow) {
      return false;
    }
  }

  if (!constraints.requiresSupport) {
    return true;
  }

  const bottomRow = candidateCells.reduce((best, cell) => Math.max(best, cell.row), Number.NEGATIVE_INFINITY);
  const bottomCells = candidateCells.filter((cell) => cell.row === bottomRow);

  let supportedCount = 0;
  for (const cell of bottomCells) {
    const belowRow = cell.row + 1;
    const hasSupportBelow = (
      belowRow >= grid.rows
      || occupiedCells.has(toCellKey(cell.col, belowRow))
    );

    if (hasSupportBelow) {
      supportedCount += 1;
    }
  }

  return supportedCount >= Math.ceil(bottomCells.length * 0.4);
}

function composeTiles(modules: GeneratedLevelDraft['modules']): PlacedTile[] {
  const tileByCell = new Map<string, PlacedTile>();

  for (const module of modules) {
    for (const tile of module.tiles) {
      const key = toCellKey(tile.col, tile.row);
      const existing = tileByCell.get(key);

      if (!existing || (existing.tile === 'dirt' && tile.tile === 'grass-top')) {
        tileByCell.set(key, tile);
      }
    }
  }

  return [...tileByCell.values()].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });
}

function pickWeightedTemplate(templates: ModuleTemplate[], rng: () => number): ModuleTemplate {
  const totalWeight = templates.reduce((sum, template) => sum + template.difficultyWeight, 0);
  let cursor = rng() * Math.max(0.001, totalWeight);

  for (const template of templates) {
    cursor -= template.difficultyWeight;
    if (cursor <= 0) {
      return template;
    }
  }

  return templates[templates.length - 1] as ModuleTemplate;
}

function randomIntInRange(range: [number, number], rng: () => number): number {
  const [rawMin, rawMax] = range;
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  return min + Math.floor(rng() * ((max - min) + 1));
}

function expandRect(rect: GridRect, paddingCols: number, paddingRows: number): GridRect {
  return {
    col: rect.col - paddingCols,
    row: rect.row - paddingRows,
    width: rect.width + (paddingCols * 2),
    height: rect.height + (paddingRows * 2),
  };
}

function rectIntersects(left: GridRect, right: GridRect): boolean {
  const leftRight = left.col + left.width;
  const rightRight = right.col + right.width;
  const leftBottom = left.row + left.height;
  const rightBottom = right.row + right.height;

  return (
    left.col < rightRight
    && leftRight > right.col
    && left.row < rightBottom
    && leftBottom > right.row
  );
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  const map = new Map<string, GridCell>();
  for (const cell of cells) {
    map.set(toCellKey(cell.col, cell.row), cell);
  }

  return [...map.values()].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });
}

function dedupeRects(rects: GridRect[]): GridRect[] {
  const map = new Map<string, GridRect>();
  for (const rect of rects) {
    const key = `${rect.col}:${rect.row}:${rect.width}:${rect.height}`;
    map.set(key, rect);
  }

  return [...map.values()].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });
}

function toCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(Math.max(min, Math.min(max, value)));
}

function logAttempt(
  attempt: number,
  maxAttempts: number,
  placementLogs: string[],
  validationReasons: string[],
): void {
  const title = validationReasons.length === 0 ? 'OK' : 'FAIL';
  console.groupCollapsed(`[level] attempt ${attempt}/${maxAttempts} ${title}`);

  for (const log of placementLogs) {
    console.info(log);
  }

  if (validationReasons.length > 0) {
    console.warn('Validation reasons:', validationReasons);
  }

  console.groupEnd();
}
