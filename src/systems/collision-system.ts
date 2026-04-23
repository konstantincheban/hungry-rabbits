import type { CarrotProjectile } from '../entities/carrot';
import type { RabbitTarget } from '../entities/rabbit';
import type { RabbitType, Vector2 } from '../types/game';

export interface ProjectileRabbitHit {
  projectileId: number;
  rabbitId: number;
  rabbitType: RabbitType;
  position: Vector2;
}

export function detectProjectileRabbitHits(
  projectiles: readonly CarrotProjectile[],
  rabbits: readonly RabbitTarget[],
): ProjectileRabbitHit[] {
  const hits: ProjectileRabbitHit[] = [];
  const consumedProjectiles = new Set<number>();
  const consumedRabbits = new Set<number>();

  for (const projectile of projectiles) {
    if (consumedProjectiles.has(projectile.id)) {
      continue;
    }

    for (const rabbit of rabbits) {
      if (consumedRabbits.has(rabbit.id)) {
        continue;
      }

      const dx = projectile.position.x - rabbit.position.x;
      const dy = projectile.position.y - rabbit.position.y;
      const radiusSum = projectile.radius + rabbit.radius;

      if ((dx * dx) + (dy * dy) > radiusSum * radiusSum) {
        continue;
      }

      consumedProjectiles.add(projectile.id);
      consumedRabbits.add(rabbit.id);

      hits.push({
        projectileId: projectile.id,
        rabbitId: rabbit.id,
        rabbitType: rabbit.type,
        position: {
          x: rabbit.position.x,
          y: rabbit.position.y,
        },
      });

      break;
    }
  }

  return hits;
}
