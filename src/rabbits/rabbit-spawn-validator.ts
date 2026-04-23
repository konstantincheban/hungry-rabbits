import type { GeneratedLevel } from '../level/level-types';
import type { RabbitSpawnContext, RabbitSpawnValidation, SpawnedRabbit, TurretState } from './rabbit-types';
import type { ProjectileSimulationConfig } from './rabbit-types';
import { DEFAULT_PROJECTILE_SIMULATION_CONFIG, findReachableShotSamples } from './projectile-simulator';

export interface RabbitSetValidatorConfig {
  minHorizontalSpreadPx: number;
  minRabbitDistancePx: number;
  requireEasyTarget: boolean;
  easyDifficultyThreshold: number;
  maxGoldenCount: number;
  debug: boolean;
}

export const DEFAULT_RABBIT_SET_VALIDATOR_CONFIG: RabbitSetValidatorConfig = {
  minHorizontalSpreadPx: 180,
  minRabbitDistancePx: 42,
  requireEasyTarget: true,
  easyDifficultyThreshold: 0.34,
  maxGoldenCount: 1,
  debug: false,
};

export function validateRabbitSet(
  level: GeneratedLevel,
  turretState: TurretState,
  rabbits: SpawnedRabbit[],
  context: RabbitSpawnContext,
  simulationConfig: ProjectileSimulationConfig = DEFAULT_PROJECTILE_SIMULATION_CONFIG,
  config: Partial<RabbitSetValidatorConfig> = {},
): RabbitSpawnValidation {
  const settings = {
    ...DEFAULT_RABBIT_SET_VALIDATOR_CONFIG,
    ...config,
  };

  const reasons: string[] = [];
  const reachableSolutions: RabbitSpawnValidation['reachableSolutions'] = {};

  if (rabbits.length === 0) {
    reasons.push('Немає кандидатів для спавну кроликів.');
    return {
      valid: false,
      reasons,
      reachableSolutions,
    };
  }

  validateRabbitOverlaps(rabbits, settings.minRabbitDistancePx, reasons);
  validateCollisionIntersections(rabbits, context.collisionRects, reasons);
  validateSpread(rabbits, settings.minHorizontalSpreadPx, reasons);
  validateGoldenCount(rabbits, settings.maxGoldenCount, reasons);
  validateEasyTarget(rabbits, settings, reasons);

  for (const rabbit of rabbits) {
    const solutions = findReachableShotSamples(rabbit, turretState, context, simulationConfig);
    reachableSolutions[rabbit.id] = solutions;
    if (solutions.length === 0) {
      reasons.push(`Кролик ${rabbit.id} недосяжний жодною траєкторією.`);
    }
  }

  const dedupedReasons = dedupeReasons(reasons);

  if (settings.debug || simulationConfig.debug) {
    console.info('[rabbits] validation', {
      valid: dedupedReasons.length === 0,
      reasons: dedupedReasons,
      rabbitCount: rabbits.length,
      reachable: Object.fromEntries(
        rabbits.map((rabbit) => [rabbit.id, reachableSolutions[rabbit.id]?.length ?? 0]),
      ),
      moduleCount: level.modules.length,
    });
  }

  return {
    valid: dedupedReasons.length === 0,
    reasons: dedupedReasons,
    reachableSolutions,
  };
}

function validateRabbitOverlaps(
  rabbits: SpawnedRabbit[],
  minDistancePx: number,
  reasons: string[],
): void {
  for (let i = 0; i < rabbits.length; i += 1) {
    const left = rabbits[i] as SpawnedRabbit;
    const leftRadius = Math.max(left.width, left.height) * 0.25;

    for (let j = i + 1; j < rabbits.length; j += 1) {
      const right = rabbits[j] as SpawnedRabbit;
      const rightRadius = Math.max(right.width, right.height) * 0.25;
      const requiredDistance = Math.max(minDistancePx, leftRadius + rightRadius);
      const dx = left.worldX - right.worldX;
      const dy = left.worldY - right.worldY;
      if ((dx * dx) + (dy * dy) < requiredDistance * requiredDistance) {
        reasons.push(`Кролики ${left.id} та ${right.id} розміщені занадто близько.`);
        return;
      }
    }
  }
}

function validateCollisionIntersections(
  rabbits: SpawnedRabbit[],
  collisionRects: RabbitSpawnContext['collisionRects'],
  reasons: string[],
): void {
  for (const rabbit of rabbits) {
    const radius = Math.max(rabbit.width, rabbit.height) * 0.25;
    if (doesCircleIntersectCollision(rabbit.worldX, rabbit.worldY, radius, collisionRects)) {
      reasons.push(`Кролик ${rabbit.id} перетинає геометрію рівня.`);
      return;
    }
  }
}

function validateSpread(
  rabbits: SpawnedRabbit[],
  minHorizontalSpreadPx: number,
  reasons: string[],
): void {
  const minX = rabbits.reduce((best, rabbit) => Math.min(best, rabbit.worldX), Number.POSITIVE_INFINITY);
  const maxX = rabbits.reduce((best, rabbit) => Math.max(best, rabbit.worldX), Number.NEGATIVE_INFINITY);

  if ((maxX - minX) < minHorizontalSpreadPx) {
    reasons.push('Спавн кроликів має слабкий горизонтальний розкид.');
  }
}

function validateGoldenCount(rabbits: SpawnedRabbit[], maxGoldenCount: number, reasons: string[]): void {
  const goldenCount = rabbits.filter((rabbit) => rabbit.type === 'golden').length;
  if (goldenCount > maxGoldenCount) {
    reasons.push(`Занадто багато золотих кроликів (${goldenCount}).`);
  }
}

function validateEasyTarget(
  rabbits: SpawnedRabbit[],
  config: RabbitSetValidatorConfig,
  reasons: string[],
): void {
  if (!config.requireEasyTarget) {
    return;
  }

  const hasEasy = rabbits.some((rabbit) => rabbit.difficultyScore <= config.easyDifficultyThreshold);
  if (!hasEasy) {
    reasons.push('У наборі немає хоча б однієї відносно легкої цілі.');
  }
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

function dedupeReasons(reasons: string[]): string[] {
  const unique = new Set<string>();
  const result: string[] = [];

  for (const reason of reasons) {
    if (unique.has(reason)) {
      continue;
    }

    unique.add(reason);
    result.push(reason);
  }

  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
