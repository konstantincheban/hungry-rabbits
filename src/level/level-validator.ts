import { LEVEL_VALIDATION_CONFIG } from './config';
import type { GeneratedLevelDraft, GridCell, GridRect, LevelMetrics, LevelValidationResult } from './level-types';

export interface LevelValidationOptions {
  turretSafeZone: GridRect;
}

export function validateGeneratedLevel(
  level: GeneratedLevelDraft,
  options: LevelValidationOptions,
): LevelValidationResult {
  const reasons: string[] = [];

  validateBounds(level, reasons);
  validateNoOverlaps(level, reasons);
  validateTurretSafeZone(level, options.turretSafeZone, reasons);
  validateStructureComposition(level, reasons);
  validateDensity(level, reasons);
  validateTopSurfaces(level, reasons);
  validateGeometryIntegrity(level, reasons);
  validateSilhouette(level, reasons);

  const uniqueReasons = dedupeReasons(reasons);
  const metrics = computeMetrics(level);

  return {
    valid: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    metrics,
  };
}

function validateBounds(level: GeneratedLevelDraft, reasons: string[]): void {
  const isOutside = (cell: GridCell): boolean => (
    cell.col < 0
    || cell.col >= level.cols
    || cell.row < 0
    || cell.row >= level.rows
  );

  if (level.tiles.some((tile) => isOutside(tile))) {
    reasons.push('Є тайли за межами арени.');
  }

  if (level.blockedCells.some((cell) => isOutside(cell))) {
    reasons.push('Є заблоковані клітинки за межами арени.');
  }
}

function validateNoOverlaps(level: GeneratedLevelDraft, reasons: string[]): void {
  const ownerByCell = new Map<string, string>();

  for (const module of level.modules) {
    for (const cell of module.occupiedCells) {
      const key = toCellKey(cell.col, cell.row);
      const previousOwner = ownerByCell.get(key);

      if (previousOwner && previousOwner !== module.id) {
        reasons.push('Модулі перетинаються між собою.');
        return;
      }

      ownerByCell.set(key, module.id);
    }
  }
}

function validateTurretSafeZone(level: GeneratedLevelDraft, turretSafeZone: GridRect, reasons: string[]): void {
  const nonGroundModules = level.modules.filter((module) => module.kind !== 'ground-strip');

  for (const module of nonGroundModules) {
    for (const cell of module.occupiedCells) {
      if (isCellInsideRect(cell, turretSafeZone)) {
        reasons.push('Зона турелі заблокована перешкодами.');
        return;
      }
    }
  }
}

function validateStructureComposition(level: GeneratedLevelDraft, reasons: string[]): void {
  const nonGroundModules = level.modules.filter((module) => module.kind !== 'ground-strip');

  if (nonGroundModules.length < LEVEL_VALIDATION_CONFIG.minModuleCount) {
    reasons.push('Рівень занадто порожній за кількістю модулів.');
  }

  const hasRaisedPlatform = nonGroundModules.some((module) => (
    (module.kind === 'low-platform'
      || module.kind === 'medium-platform'
      || module.kind === 'floating-platform')
    && module.bounds.row <= level.groundTopRow - 2
  ));

  if (!hasRaisedPlatform) {
    reasons.push('Немає піднятої платформи.');
  }

  const hasObstacle = nonGroundModules.some((module) => (
    module.kind === 'tall-column' || module.kind === 'cover-section'
  ));

  if (!hasObstacle) {
    reasons.push('Немає секції укриття або високої колони.');
  }

  const hasHigherTargetArea = level.standableCells.some((cell) => (
    cell.row <= (level.groundTopRow - LEVEL_VALIDATION_CONFIG.higherTargetRowsAboveGround)
  ));

  if (!hasHigherTargetArea) {
    reasons.push('Немає високої зони для цілей.');
  }

  const modulesWithSingleTile = nonGroundModules.some((module) => module.occupiedCells.length <= 1);
  if (modulesWithSingleTile) {
    reasons.push('Знайдено випадкові однотайлові модулі.');
  }
}

function validateDensity(level: GeneratedLevelDraft, reasons: string[]): void {
  const occupiedRatio = level.blockedCells.length / Math.max(1, level.cols * level.rows);

  if (occupiedRatio < LEVEL_VALIDATION_CONFIG.minOccupiedRatio) {
    reasons.push('Рівень занадто порожній за щільністю тайлів.');
  }

  if (occupiedRatio > LEVEL_VALIDATION_CONFIG.maxOccupiedRatio) {
    reasons.push('Рівень занадто щільний.');
  }

  if (level.standableCells.length < LEVEL_VALIDATION_CONFIG.minStandableSurfaceCells) {
    reasons.push('Недостатньо придатних поверхонь для стояння.');
  }
}

function validateTopSurfaces(level: GeneratedLevelDraft, reasons: string[]): void {
  const occupiedSet = toCellSet(level.blockedCells);
  const tileByCell = new Map<string, string>();

  for (const tile of level.tiles) {
    tileByCell.set(toCellKey(tile.col, tile.row), tile.tile);
  }

  for (const module of level.modules) {
    for (const topCell of module.topSurfaceCells) {
      const key = toCellKey(topCell.col, topCell.row);
      const tileKind = tileByCell.get(key);
      if (tileKind !== 'grass-top') {
        reasons.push('Верхня поверхня має некоректний тайл.');
        return;
      }

      if (occupiedSet.has(toCellKey(topCell.col, topCell.row - 1))) {
        reasons.push('Верхня поверхня перекрита іншим тайлом.');
        return;
      }
    }
  }
}

function validateGeometryIntegrity(level: GeneratedLevelDraft, reasons: string[]): void {
  const occupiedSet = toCellSet(level.blockedCells);
  let isolatedCount = 0;

  for (const cell of level.blockedCells) {
    const neighbors = countOrthogonalNeighbors(cell, occupiedSet);
    if (neighbors === 0) {
      isolatedCount += 1;
    }
  }

  if (isolatedCount > 0) {
    reasons.push('Геометрія містить ізольовані тайли.');
  }

  const nonGroundModules = level.modules.filter((module) => module.kind !== 'ground-strip');
  const sorted = [...nonGroundModules].sort((left, right) => left.bounds.col - right.bounds.col);

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]!;
    const next = sorted[index + 1]!;

    const horizontalGap = next.bounds.col - (current.bounds.col + current.bounds.width);
    const rowDistance = Math.abs(current.bounds.row - next.bounds.row);

    if (rowDistance <= 2 && horizontalGap < 1) {
      reasons.push('Модулі розміщені занадто щільно для мобільної читабельності.');
      return;
    }
  }
}

function validateSilhouette(level: GeneratedLevelDraft, reasons: string[]): void {
  const highestByCol = new Map<number, number>();

  for (const cell of level.standableCells) {
    const previous = highestByCol.get(cell.col);
    if (previous === undefined || cell.row < previous) {
      highestByCol.set(cell.col, cell.row);
    }
  }

  let jaggedSteps = 0;
  for (let col = 1; col < level.cols; col += 1) {
    const left = highestByCol.get(col - 1);
    const right = highestByCol.get(col);
    if (left === undefined || right === undefined) {
      continue;
    }

    if (Math.abs(left - right) >= 3) {
      jaggedSteps += 1;
    }
  }

  if (jaggedSteps > LEVEL_VALIDATION_CONFIG.maxJaggedSilhouetteSteps) {
    reasons.push('Силует рівня занадто рваний і нечитабельний.');
  }
}

function computeMetrics(level: GeneratedLevelDraft): LevelMetrics {
  const minRow = level.blockedCells.reduce((best, cell) => Math.min(best, cell.row), level.rows);

  return {
    moduleCount: level.modules.length,
    occupiedTileRatio: level.blockedCells.length / Math.max(1, level.cols * level.rows),
    maxHeightUsed: level.rows - minRow,
    standableSurfaceCount: level.standableCells.length,
  };
}

function countOrthogonalNeighbors(cell: GridCell, occupiedSet: Set<string>): number {
  const neighbors = [
    toCellKey(cell.col - 1, cell.row),
    toCellKey(cell.col + 1, cell.row),
    toCellKey(cell.col, cell.row - 1),
    toCellKey(cell.col, cell.row + 1),
  ];

  let count = 0;
  for (const neighbor of neighbors) {
    if (occupiedSet.has(neighbor)) {
      count += 1;
    }
  }

  return count;
}

function toCellSet(cells: GridCell[]): Set<string> {
  const set = new Set<string>();

  for (const cell of cells) {
    set.add(toCellKey(cell.col, cell.row));
  }

  return set;
}

function isCellInsideRect(cell: GridCell, rect: GridRect): boolean {
  return (
    cell.col >= rect.col
    && cell.col < rect.col + rect.width
    && cell.row >= rect.row
    && cell.row < rect.row + rect.height
  );
}

function dedupeReasons(reasons: string[]): string[] {
  const set = new Set<string>();
  const deduped: string[] = [];

  for (const reason of reasons) {
    if (set.has(reason)) {
      continue;
    }

    set.add(reason);
    deduped.push(reason);
  }

  return deduped;
}

function toCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}
