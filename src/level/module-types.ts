export type ModuleKind =
  | 'ground-strip'
  | 'low-platform'
  | 'medium-platform'
  | 'floating-platform'
  | 'tall-column'
  | 'cover-section';

export type LevelZone =
  | 'left-safe'
  | 'center-low'
  | 'center-mid'
  | 'right-low'
  | 'right-mid'
  | 'upper-right';

export interface GridCellLike {
  col: number;
  row: number;
}

export interface ModuleGenerationConstraints {
  minSpacingCols?: number;
  minSpacingRows?: number;
  minRow?: number;
  maxRow?: number;
  requiresSupport?: boolean;
}

export interface ModuleTemplate {
  id: string;
  kind: ModuleKind;
  widthRange: [number, number];
  heightRange: [number, number];
  allowedZones: LevelZone[];
  canHostRabbits: boolean;
  difficultyWeight: number;
  generationConstraints?: ModuleGenerationConstraints;
}

export interface ModulePlacement {
  template: ModuleTemplate;
  zone: LevelZone;
  origin: GridCellLike;
  width: number;
  height: number;
}
