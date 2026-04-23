import { gridToWorld, worldToGrid } from '../level/grid';
import type { BuiltModule, GeneratedLevel, GridCell } from '../level/level-types';
import type { TurretState } from './rabbit-types';
import {
  computeCoverScore,
  computeLineObstructionScore,
  scoreRabbitDifficulty,
} from './rabbit-difficulty';
import type {
  RabbitSlotBuilderConfig,
  RabbitSpawnContext,
  RabbitSpawnSlot,
} from './rabbit-types';

const DEFAULT_SLOT_BUILDER_CONFIG: RabbitSlotBuilderConfig = {
  edgePaddingPx: 36,
  topPaddingPx: 18,
  minTurretDistancePx: 128,
  minSlotSeparationPx: 48,
  debug: false,
};

export function buildRabbitSpawnSlots(
  level: GeneratedLevel,
  turretState: TurretState,
  context: RabbitSpawnContext,
  config: Partial<RabbitSlotBuilderConfig> = {},
): RabbitSpawnSlot[] {
  const settings = {
    ...DEFAULT_SLOT_BUILDER_CONFIG,
    ...config,
  };

  const blockedCellSet = new Set<string>();
  for (const cell of level.blockedCells) {
    blockedCellSet.add(toCellKey(cell.col, cell.row));
  }

  const turretCell = worldToGrid(turretState.position, context.grid);
  const selectedSlots: RabbitSpawnSlot[] = [];

  for (const module of level.modules) {
    if (module.rabbitStandCells.length === 0) {
      continue;
    }

    const segmentSizes = buildSegmentSizeMap(module);
    for (const standCell of module.rabbitStandCells) {
      if (!isSlotCellValid(standCell, blockedCellSet, level)) {
        continue;
      }

      const worldCell = gridToWorld(standCell, context.grid);
      const slotWorldX = worldCell.x + (context.grid.tileSize * 0.5);
      const slotWorldY = worldCell.y - context.rabbitRadius - 2;

      if (!hasVisualPadding(slotWorldX, slotWorldY, context, settings)) {
        continue;
      }

      if (distanceToTurret(slotWorldX, slotWorldY, turretState.position) < settings.minTurretDistancePx) {
        continue;
      }

      if (doesCircleIntersectCollision(slotWorldX, slotWorldY, context.rabbitRadius * 0.95, context.collisionRects)) {
        continue;
      }

      if (isNearExistingSlot(slotWorldX, slotWorldY, selectedSlots, settings.minSlotSeparationPx)) {
        continue;
      }

      const coverScore = computeCoverScore(standCell, blockedCellSet);
      const lineObstructionScore = computeLineObstructionScore(turretCell, standCell, blockedCellSet);
      const difficulty = scoreRabbitDifficulty({
        slotCell: standCell,
        moduleKind: module.kind,
        surfaceWidth: segmentSizes.get(toCellKey(standCell.col, standCell.row)) ?? 1,
        coverScore,
        lineObstructionScore,
        groundTopRow: level.groundTopRow,
      });

      selectedSlots.push({
        id: `${module.id}:${standCell.col}:${standCell.row}`,
        col: standCell.col,
        row: standCell.row,
        worldX: slotWorldX,
        worldY: slotWorldY,
        sourceModuleId: module.id,
        sourceModuleKind: module.kind,
        heightBand: difficulty.heightBand,
        coverScore,
        difficultyScore: difficulty.score,
        difficultyBand: difficulty.band,
        allowedTypes: [...difficulty.allowedTypes],
      });
    }
  }

  const sorted = [...selectedSlots].sort((left, right) => {
    if (left.worldX !== right.worldX) {
      return left.worldX - right.worldX;
    }

    return left.worldY - right.worldY;
  });

  if (settings.debug) {
    console.info('[rabbits] candidate slots built', {
      count: sorted.length,
      samples: sorted.slice(0, 6).map((slot) => ({
        id: slot.id,
        band: slot.heightBand,
        difficulty: Number(slot.difficultyScore.toFixed(3)),
      })),
    });
  }

  return sorted;
}

function buildSegmentSizeMap(module: BuiltModule): Map<string, number> {
  const rows = new Map<number, GridCell[]>();
  for (const cell of module.topSurfaceCells) {
    const list = rows.get(cell.row) ?? [];
    list.push(cell);
    rows.set(cell.row, list);
  }

  const segmentSizeByCell = new Map<string, number>();

  for (const rowCells of rows.values()) {
    const sorted = [...rowCells].sort((left, right) => left.col - right.col);
    let runStart = 0;

    for (let index = 1; index <= sorted.length; index += 1) {
      const current = sorted[index];
      const previous = sorted[index - 1] as GridCell;
      const contiguous = current && current.col === previous.col + 1;

      if (contiguous) {
        continue;
      }

      const runCells = sorted.slice(runStart, index);
      const size = runCells.length;

      for (const cell of runCells) {
        segmentSizeByCell.set(toCellKey(cell.col, cell.row), size);
      }

      runStart = index;
    }
  }

  return segmentSizeByCell;
}

function isSlotCellValid(cell: GridCell, blockedCellSet: Set<string>, level: GeneratedLevel): boolean {
  if (cell.col < 0 || cell.col >= level.cols || cell.row < 0 || cell.row >= level.rows) {
    return false;
  }

  // A stand surface must stay open above the rabbit's feet.
  const aboveClear = !blockedCellSet.has(toCellKey(cell.col, cell.row - 1));
  if (!aboveClear) {
    return false;
  }

  return true;
}

function hasVisualPadding(
  worldX: number,
  worldY: number,
  context: RabbitSpawnContext,
  settings: RabbitSlotBuilderConfig,
): boolean {
  if (worldX - context.rabbitRadius < settings.edgePaddingPx) {
    return false;
  }

  if (worldX + context.rabbitRadius > context.arenaWidth - settings.edgePaddingPx) {
    return false;
  }

  if (worldY - context.rabbitRadius < settings.topPaddingPx) {
    return false;
  }

  return true;
}

function distanceToTurret(worldX: number, worldY: number, turretPosition: { x: number; y: number }): number {
  return Math.hypot(worldX - turretPosition.x, worldY - turretPosition.y);
}

function isNearExistingSlot(
  worldX: number,
  worldY: number,
  existing: RabbitSpawnSlot[],
  minDistancePx: number,
): boolean {
  for (const slot of existing) {
    const distance = Math.hypot(worldX - slot.worldX, worldY - slot.worldY);
    if (distance < minDistancePx) {
      return true;
    }
  }

  return false;
}

function doesCircleIntersectCollision(
  x: number,
  y: number,
  radius: number,
  collisionRects: RabbitSpawnContext['collisionRects'],
): boolean {
  for (const rect of collisionRects) {
    const closestX = clamp(x, rect.x, rect.x + rect.width);
    const closestY = clamp(y, rect.y, rect.y + rect.height);
    const dx = x - closestX;
    const dy = y - closestY;
    if ((dx * dx) + (dy * dy) <= radius * radius) {
      return true;
    }
  }

  return false;
}

function toCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
