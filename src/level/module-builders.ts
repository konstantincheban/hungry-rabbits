import type { BuiltModule, GridCell, GridRect, PlacedTile, TileKind } from './level-types';
import type { ModulePlacement } from './module-types';

export function buildGroundStrip(placement: ModulePlacement): BuiltModule {
  const cells = createRectCells(placement.origin.col, placement.origin.row, placement.width, placement.height);
  return finalizeModule(placement, cells);
}

export function buildPlatform(placement: ModulePlacement): BuiltModule {
  const cells = createRectCells(placement.origin.col, placement.origin.row, placement.width, placement.height);

  // Slightly bevel the underside so platforms look less like plain bricks.
  if (placement.width >= 5 && placement.height >= 3) {
    const bottomRow = placement.origin.row + placement.height - 1;
    const trimmed = excludeCells(cells, [
      { col: placement.origin.col, row: bottomRow },
      { col: placement.origin.col + placement.width - 1, row: bottomRow },
    ]);

    return finalizeModule(placement, trimmed);
  }

  return finalizeModule(placement, cells);
}

export function buildFloatingPlatform(placement: ModulePlacement): BuiltModule {
  const cells: GridCell[] = [];

  for (let colOffset = 0; colOffset < placement.width; colOffset += 1) {
    cells.push({
      col: placement.origin.col + colOffset,
      row: placement.origin.row,
    });
  }

  for (let depth = 1; depth < placement.height; depth += 1) {
    const inset = 1;
    const start = placement.origin.col + inset;
    const end = (placement.origin.col + placement.width - 1) - inset;

    for (let col = start; col <= end; col += 1) {
      cells.push({
        col,
        row: placement.origin.row + depth,
      });
    }
  }

  // Small center nub makes floating modules feel hand-built from blocks.
  if (placement.width >= 4) {
    const centerCol = placement.origin.col + Math.floor(placement.width / 2);
    cells.push({
      col: centerCol,
      row: placement.origin.row + placement.height,
    });
  }

  return finalizeModule(placement, cells);
}

export function buildColumn(placement: ModulePlacement): BuiltModule {
  const cells = createRectCells(placement.origin.col, placement.origin.row, placement.width, placement.height);

  if (placement.height >= 5) {
    const topRow = placement.origin.row;
    cells.push({ col: placement.origin.col - 1, row: topRow });
    cells.push({ col: placement.origin.col + placement.width, row: topRow });
  }

  return finalizeModule(placement, cells);
}

export function buildCoverSection(placement: ModulePlacement): BuiltModule {
  let cells = createRectCells(placement.origin.col, placement.origin.row, placement.width, placement.height);

  // Carve a small step from upper-right to avoid monolithic blocks.
  if (placement.width >= 4 && placement.height >= 3) {
    cells = excludeCells(cells, [
      { col: placement.origin.col + placement.width - 1, row: placement.origin.row },
      { col: placement.origin.col + placement.width - 1, row: placement.origin.row + 1 },
    ]);
  }

  // Add a shallow top lip to make the silhouette read as cover.
  if (placement.width >= 3 && placement.height >= 3) {
    const lipWidth = Math.max(2, Math.floor(placement.width * 0.55));
    for (let colOffset = 0; colOffset < lipWidth; colOffset += 1) {
      cells.push({
        col: placement.origin.col + colOffset,
        row: placement.origin.row - 1,
      });
    }
  }

  return finalizeModule(placement, cells);
}

export function buildModuleFromTemplate(placement: ModulePlacement): BuiltModule {
  switch (placement.template.kind) {
    case 'ground-strip':
      return buildGroundStrip(placement);
    case 'low-platform':
    case 'medium-platform':
      return buildPlatform(placement);
    case 'floating-platform':
      return buildFloatingPlatform(placement);
    case 'tall-column':
      return buildColumn(placement);
    case 'cover-section':
      return buildCoverSection(placement);
    default: {
      const exhaustiveKind: never = placement.template.kind;
      throw new Error(`Unsupported module kind: ${String(exhaustiveKind)}`);
    }
  }
}

function finalizeModule(placement: ModulePlacement, rawCells: GridCell[]): BuiltModule {
  const occupiedCells = dedupeCells(rawCells);
  const occupiedSet = toCellSet(occupiedCells);

  const topSurfaceCells = occupiedCells
    .filter((cell) => !occupiedSet.has(toCellKey(cell.col, cell.row - 1)))
    .sort(compareCell);

  const topSurfaceSet = toCellSet(topSurfaceCells);

  const tiles: PlacedTile[] = occupiedCells
    .map((cell) => {
      const tile: TileKind = topSurfaceSet.has(toCellKey(cell.col, cell.row)) ? 'grass-top' : 'dirt';
      return {
        ...cell,
        tile,
      };
    })
    .sort(compareCell);

  const bounds = cellsToBounds(occupiedCells);
  const collisionRects = cellsToCollisionRects(occupiedCells);
  const rabbitStandCells = placement.template.canHostRabbits
    ? createRabbitStandCells(topSurfaceCells)
    : [];

  return {
    id: placement.template.id,
    kind: placement.template.kind,
    zone: placement.zone,
    origin: { ...placement.origin },
    width: bounds.width,
    height: bounds.height,
    tiles,
    occupiedCells,
    topSurfaceCells,
    rabbitStandCells,
    collisionRects,
    bounds,
  };
}

function createRectCells(startCol: number, startRow: number, width: number, height: number): GridCell[] {
  const cells: GridCell[] = [];

  for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
    for (let colOffset = 0; colOffset < width; colOffset += 1) {
      cells.push({
        col: startCol + colOffset,
        row: startRow + rowOffset,
      });
    }
  }

  return cells;
}

function excludeCells(cells: GridCell[], removedCells: GridCell[]): GridCell[] {
  if (removedCells.length === 0) {
    return [...cells];
  }

  const removed = toCellSet(removedCells);
  return cells.filter((cell) => !removed.has(toCellKey(cell.col, cell.row)));
}

function createRabbitStandCells(topSurfaceCells: GridCell[]): GridCell[] {
  const rows = new Map<number, GridCell[]>();
  for (const cell of topSurfaceCells) {
    const rowCells = rows.get(cell.row) ?? [];
    rowCells.push(cell);
    rows.set(cell.row, rowCells);
  }

  const standCells: GridCell[] = [];

  for (const rowCells of rows.values()) {
    const sorted = [...rowCells].sort((left, right) => left.col - right.col);
    const segments = splitIntoSegments(sorted);

    for (const segment of segments) {
      if (segment.length <= 2) {
        standCells.push(...segment);
        continue;
      }

      for (let index = 1; index < segment.length - 1; index += 2) {
        standCells.push(segment[index] as GridCell);
      }
    }
  }

  return dedupeCells(standCells);
}

function splitIntoSegments(sortedCells: GridCell[]): GridCell[][] {
  if (sortedCells.length === 0) {
    return [];
  }

  const segments: GridCell[][] = [];
  let current: GridCell[] = [sortedCells[0] as GridCell];

  for (let index = 1; index < sortedCells.length; index += 1) {
    const previous = sortedCells[index - 1] as GridCell;
    const currentCell = sortedCells[index] as GridCell;

    if (currentCell.col === previous.col + 1) {
      current.push(currentCell);
      continue;
    }

    segments.push(current);
    current = [currentCell];
  }

  segments.push(current);
  return segments;
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  const unique = new Map<string, GridCell>();

  for (const cell of cells) {
    unique.set(toCellKey(cell.col, cell.row), { col: cell.col, row: cell.row });
  }

  return [...unique.values()].sort(compareCell);
}

function cellsToBounds(cells: GridCell[]): GridRect {
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;

  for (const cell of cells) {
    minCol = Math.min(minCol, cell.col);
    maxCol = Math.max(maxCol, cell.col);
    minRow = Math.min(minRow, cell.row);
    maxRow = Math.max(maxRow, cell.row);
  }

  return {
    col: minCol,
    row: minRow,
    width: (maxCol - minCol) + 1,
    height: (maxRow - minRow) + 1,
  };
}

function cellsToCollisionRects(cells: GridCell[]): GridRect[] {
  const rows = new Map<number, number[]>();

  for (const cell of cells) {
    const rowCols = rows.get(cell.row) ?? [];
    rowCols.push(cell.col);
    rows.set(cell.row, rowCols);
  }

  const rects: GridRect[] = [];

  for (const [row, cols] of rows.entries()) {
    const sortedCols = [...cols].sort((left, right) => left - right);
    if (sortedCols.length === 0) {
      continue;
    }

    let startCol = sortedCols[0] as number;
    let previousCol = sortedCols[0] as number;

    for (let index = 1; index < sortedCols.length; index += 1) {
      const col = sortedCols[index] as number;

      if (col === previousCol + 1) {
        previousCol = col;
        continue;
      }

      rects.push({
        col: startCol,
        row,
        width: (previousCol - startCol) + 1,
        height: 1,
      });

      startCol = col;
      previousCol = col;
    }

    rects.push({
      col: startCol,
      row,
      width: (previousCol - startCol) + 1,
      height: 1,
    });
  }

  return rects.sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row;
    }

    return left.col - right.col;
  });
}

function compareCell(left: GridCell, right: GridCell): number {
  if (left.row !== right.row) {
    return left.row - right.row;
  }

  return left.col - right.col;
}

function toCellSet(cells: GridCell[]): Set<string> {
  const set = new Set<string>();

  for (const cell of cells) {
    set.add(toCellKey(cell.col, cell.row));
  }

  return set;
}

function toCellKey(col: number, row: number): string {
  return `${col}:${row}`;
}
