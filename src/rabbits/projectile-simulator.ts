import type { SpawnedRabbit, ProjectileSimulationConfig, ProjectileSolutionSample, RabbitSpawnContext, TurretState } from './rabbit-types';

export const DEFAULT_PROJECTILE_SIMULATION_CONFIG: ProjectileSimulationConfig = {
  angleSamples: [],
  powerSamples: [0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68, 0.76, 0.84, 0.92, 1],
  stepSeconds: 1 / 90,
  maxSteps: 320,
  maxSolutionsPerRabbit: 5,
  maxCollisionChecksPerStep: 220,
  debug: false,
};

interface SimulationInput {
  angle: number;
  power: number;
  rabbit: SpawnedRabbit;
  context: RabbitSpawnContext;
  turretState: TurretState;
}

type SimulationResult =
  | { status: 'hit' }
  | { status: 'obstacle' | 'ground' | 'out' | 'max-steps' };

export function findReachableShotSamples(
  rabbit: SpawnedRabbit,
  turretState: TurretState,
  context: RabbitSpawnContext,
  config: ProjectileSimulationConfig,
): ProjectileSolutionSample[] {
  const results: ProjectileSolutionSample[] = [];
  const angleSamples = config.angleSamples.length > 0
    ? config.angleSamples
    : createUniformAngleSamples(turretState.minAngleRad, turretState.maxAngleRad, 20);

  for (const angle of angleSamples) {
    if (angle < turretState.minAngleRad || angle > turretState.maxAngleRad) {
      continue;
    }

    for (const power of config.powerSamples) {
      const outcome = simulateShot({
        angle,
        power,
        rabbit,
        context,
        turretState,
      }, config);

      if (outcome.status !== 'hit') {
        continue;
      }

      results.push({ angle, power });
      if (results.length >= config.maxSolutionsPerRabbit) {
        return results;
      }
    }
  }

  return results;
}

function simulateShot(input: SimulationInput, config: ProjectileSimulationConfig): SimulationResult {
  const speed = toShotSpeed(input.power, input.context.minShotSpeed, input.context.maxShotSpeed);
  let x = input.turretState.position.x;
  let y = input.turretState.position.y;
  const vx = Math.cos(input.angle) * speed;
  let vy = Math.sin(input.angle) * speed;

  const rabbitRadius = Math.max(input.rabbit.width, input.rabbit.height) * 0.25;
  const hitRadius = input.context.projectileRadius + rabbitRadius;
  const outTop = -(input.context.arenaHeight * 0.28);
  const outLeft = -input.context.projectileRadius * 2;
  const outRight = input.context.arenaWidth + (input.context.projectileRadius * 2);
  const outBottom = input.context.arenaHeight + (input.context.projectileRadius * 2);

  for (let step = 0; step < config.maxSteps; step += 1) {
    vy += input.context.gravity * config.stepSeconds;
    x += vx * config.stepSeconds;
    y += vy * config.stepSeconds;

    const rabbitDx = x - input.rabbit.worldX;
    const rabbitDy = y - input.rabbit.worldY;
    if ((rabbitDx * rabbitDx) + (rabbitDy * rabbitDy) <= (hitRadius * hitRadius)) {
      return { status: 'hit' };
    }

    if ((y + input.context.projectileRadius) >= input.context.groundY) {
      return { status: 'ground' };
    }

    if (doesProjectileHitCollision(x, y, input.context.projectileRadius, input.context.collisionRects, config.maxCollisionChecksPerStep)) {
      return { status: 'obstacle' };
    }

    if (x < outLeft || x > outRight || y < outTop || y > outBottom) {
      return { status: 'out' };
    }
  }

  return { status: 'max-steps' };
}

function createUniformAngleSamples(min: number, max: number, steps: number): number[] {
  if (steps <= 1) {
    return [min];
  }

  const samples: number[] = [];
  const count = Math.max(2, steps);
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    samples.push(min + ((max - min) * t));
  }

  return samples;
}

function toShotSpeed(power: number, minSpeed: number, maxSpeed: number): number {
  const clampedPower = clamp(power, 0, 1);
  return minSpeed + ((maxSpeed - minSpeed) * clampedPower);
}

function doesProjectileHitCollision(
  x: number,
  y: number,
  radius: number,
  collisionRects: RabbitSpawnContext['collisionRects'],
  maxChecks: number,
): boolean {
  const checks = Math.min(collisionRects.length, maxChecks);
  for (let index = 0; index < checks; index += 1) {
    const rect = collisionRects[index] as RabbitSpawnContext['collisionRects'][number];
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
