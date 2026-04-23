import type { GridCell } from '../level/level-types';
import type { ModuleKind } from '../level/module-types';
import type { RabbitType } from '../types/game';
import type { RabbitDifficultyBand, RabbitHeightBand } from './rabbit-types';

interface DifficultyInput {
  slotCell: GridCell;
  moduleKind: ModuleKind;
  surfaceWidth: number;
  coverScore: number;
  lineObstructionScore: number;
  groundTopRow: number;
}

export interface RabbitDifficultyScore {
  score: number;
  band: RabbitDifficultyBand;
  heightBand: RabbitHeightBand;
  allowedTypes: RabbitType[];
}

export function deriveHeightBand(row: number, groundTopRow: number): RabbitHeightBand {
  const delta = Math.max(0, groundTopRow - row);

  if (delta <= 1) {
    return 'ground';
  }

  if (delta <= 4) {
    return 'low';
  }

  if (delta <= 8) {
    return 'mid';
  }

  return 'high';
}

export function scoreRabbitDifficulty(input: DifficultyInput): RabbitDifficultyScore {
  const heightBand = deriveHeightBand(input.slotCell.row, input.groundTopRow);
  const heightFactor = clamp((input.groundTopRow - input.slotCell.row) / 10, 0, 1);
  const coverFactor = clamp(input.coverScore, 0, 1);
  const obstructionFactor = clamp(input.lineObstructionScore, 0, 1);
  const narrownessFactor = clamp((5 - input.surfaceWidth) / 4, 0, 1);
  const moduleBonus = moduleDifficultyBias(input.moduleKind);

  const rawScore = (
    (heightFactor * 0.36)
    + (coverFactor * 0.24)
    + (obstructionFactor * 0.2)
    + (narrownessFactor * 0.14)
    + moduleBonus
  );
  const score = clamp(rawScore, 0, 1);
  const band = toDifficultyBand(score);
  const allowedTypes = decideAllowedTypes(score, heightBand, coverFactor);

  return {
    score,
    band,
    heightBand,
    allowedTypes,
  };
}

export function computeCoverScore(slot: GridCell, blockedCellSet: Set<string>): number {
  let samples = 0;
  let blocked = 0;

  for (let col = slot.col - 4; col <= slot.col - 1; col += 1) {
    for (let row = slot.row - 2; row <= slot.row + 1; row += 1) {
      samples += 1;
      if (blockedCellSet.has(toCellKey(col, row))) {
        blocked += 1;
      }
    }
  }

  return samples > 0 ? clamp(blocked / samples, 0, 1) : 0;
}

export function computeLineObstructionScore(
  from: GridCell,
  to: GridCell,
  blockedCellSet: Set<string>,
): number {
  const cells = bresenhamLine(from.col, from.row, to.col, to.row);
  if (cells.length <= 2) {
    return 0;
  }

  let blockedCount = 0;
  for (let index = 1; index < cells.length - 1; index += 1) {
    const cell = cells[index] as GridCell;
    if (blockedCellSet.has(toCellKey(cell.col, cell.row))) {
      blockedCount += 1;
    }
  }

  const denominator = Math.max(1, cells.length - 2);
  return clamp(blockedCount / denominator, 0, 1);
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): GridCell[] {
  const cells: GridCell[] = [];

  let currentX = x0;
  let currentY = y0;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ col: currentX, row: currentY });
    if (currentX === x1 && currentY === y1) {
      break;
    }

    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      currentX += sx;
    }

    if (e2 < dx) {
      err += dx;
      currentY += sy;
    }
  }

  return cells;
}

function moduleDifficultyBias(kind: ModuleKind): number {
  switch (kind) {
    case 'ground-strip':
      return -0.12;
    case 'low-platform':
      return -0.04;
    case 'medium-platform':
      return 0.06;
    case 'floating-platform':
      return 0.12;
    case 'tall-column':
      return 0.1;
    case 'cover-section':
      return 0.08;
    default:
      return 0;
  }
}

function decideAllowedTypes(
  score: number,
  heightBand: RabbitHeightBand,
  coverScore: number,
): RabbitType[] {
  const allowsGolden = (
    score >= 0.56
    && (heightBand === 'mid' || heightBand === 'high')
    && coverScore >= 0.1
  );

  return allowsGolden ? ['normal', 'golden'] : ['normal'];
}

function toDifficultyBand(score: number): RabbitDifficultyBand {
  if (score < 0.34) {
    return 'easy';
  }

  if (score < 0.67) {
    return 'medium';
  }

  return 'hard';
}

function toCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
