import type { LevelGrid } from '../level/grid';
import type { GeneratedLevel } from '../level/level-types';
import type { ModuleKind } from '../level/module-types';
import type { RabbitType, RectBounds, Vector2 } from '../types/game';

export type RabbitHeightBand = 'ground' | 'low' | 'mid' | 'high';
export type RabbitDifficultyBand = 'easy' | 'medium' | 'hard';

export interface TurretState {
  position: Vector2;
  minAngleRad: number;
  maxAngleRad: number;
}

export interface RabbitSpawnSlot {
  id: string;
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  sourceModuleId: string;
  sourceModuleKind: ModuleKind;
  heightBand: RabbitHeightBand;
  coverScore: number;
  difficultyScore: number;
  difficultyBand: RabbitDifficultyBand;
  allowedTypes: RabbitType[];
}

export interface SpawnedRabbit {
  id: string;
  type: RabbitType;
  slotId: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  difficultyScore: number;
}

export interface ProjectileSolutionSample {
  angle: number;
  power: number;
}

export interface RabbitSpawnValidation {
  valid: boolean;
  reasons: string[];
  reachableSolutions: Record<string, ProjectileSolutionSample[]>;
}

export interface RabbitSpawnContext {
  level: GeneratedLevel;
  grid: LevelGrid;
  arenaWidth: number;
  arenaHeight: number;
  groundY: number;
  rabbitRadius: number;
  projectileRadius: number;
  gravity: number;
  minShotSpeed: number;
  maxShotSpeed: number;
  collisionRects: RectBounds[];
}

export interface ProjectileSimulationConfig {
  angleSamples: number[];
  powerSamples: number[];
  stepSeconds: number;
  maxSteps: number;
  maxSolutionsPerRabbit: number;
  maxCollisionChecksPerStep: number;
  debug: boolean;
}

export interface RabbitSlotBuilderConfig {
  edgePaddingPx: number;
  topPaddingPx: number;
  minTurretDistancePx: number;
  minSlotSeparationPx: number;
  debug: boolean;
}

export interface RabbitSpawnGeneratorConfig {
  targetRabbitCount: number;
  maxAttempts: number;
  goldenMaxCount: number;
  minHorizontalSpreadPx: number;
  maxBandShare: number;
  maxGroundShare: number;
  easyTargetMinPerSet: number;
  debug: boolean;
}

export interface GeneratedRabbitSet {
  rabbits: SpawnedRabbit[];
  slots: RabbitSpawnSlot[];
  validation: RabbitSpawnValidation;
  attempts: number;
  debugLogs?: string[];
}
