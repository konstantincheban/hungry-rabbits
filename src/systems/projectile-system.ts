import type { Container } from 'pixi.js';
import { createCarrotProjectile, syncCarrotProjectile, type CarrotProjectile } from '../entities/carrot';
import type { ArenaBounds, Vector2 } from '../types/game';

interface ProjectileSystemOptions {
  gravity: number;
  projectileRadius: number;
}

export class ProjectileSystem {
  private readonly projectiles: CarrotProjectile[] = [];
  private nextProjectileId = 1;
  private projectileRadius: number;
  private gravity: number;

  public constructor(
    private readonly layer: Container,
    private readonly options: ProjectileSystemOptions,
  ) {
    this.projectileRadius = Math.max(3, options.projectileRadius);
    this.gravity = options.gravity;
  }

  public spawn(position: Vector2, velocity: Vector2): void {
    const projectile = createCarrotProjectile(
      this.nextProjectileId,
      position,
      velocity,
      this.projectileRadius,
    );

    this.nextProjectileId += 1;
    this.projectiles.push(projectile);
    this.layer.addChild(projectile.container);
  }

  public setProjectileRadius(radius: number): void {
    const nextRadius = Math.max(3, radius);
    if (Math.abs(nextRadius - this.projectileRadius) < 0.2) {
      return;
    }

    for (const projectile of this.projectiles) {
      const ratio = nextRadius / Math.max(0.001, projectile.radius);
      projectile.radius = nextRadius;
      projectile.container.scale.set(
        projectile.container.scale.x * ratio,
        projectile.container.scale.y * ratio,
      );
    }

    this.projectileRadius = nextRadius;
  }

  public setGravity(gravity: number): void {
    this.gravity = gravity;
  }

  public getProjectiles(): readonly CarrotProjectile[] {
    return this.projectiles;
  }

  public getCount(): number {
    return this.projectiles.length;
  }

  public removeById(id: number): void {
    const index = this.projectiles.findIndex((projectile) => projectile.id === id);
    if (index < 0) {
      return;
    }

    this.removeAt(index);
  }

  public update(
    deltaSeconds: number,
    bounds: ArenaBounds,
    onMiss: (impactPosition: Vector2) => void,
  ): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];

      projectile.velocity.y += this.gravity * deltaSeconds;
      projectile.position.x += projectile.velocity.x * deltaSeconds;
      projectile.position.y += projectile.velocity.y * deltaSeconds;
      syncCarrotProjectile(projectile);

      if (projectile.position.y + projectile.radius >= bounds.groundY) {
        onMiss({ x: projectile.position.x, y: bounds.groundY });
        this.removeAt(index);
        continue;
      }

      const offRight = projectile.position.x > (bounds.width + projectile.radius);
      const offLeft = projectile.position.x < -projectile.radius;
      const offBottom = projectile.position.y > (bounds.height + projectile.radius);
      const offTop = projectile.position.y < -(bounds.height * 0.2);

      if (offRight || offLeft || offBottom || offTop) {
        onMiss({
          x: clamp(projectile.position.x, 0, bounds.width),
          y: Math.min(projectile.position.y, bounds.groundY),
        });
        this.removeAt(index);
      }
    }
  }

  public destroy(): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      this.removeAt(index);
    }
  }

  private removeAt(index: number): void {
    const [projectile] = this.projectiles.splice(index, 1);
    if (!projectile) {
      return;
    }

    projectile.active = false;
    this.layer.removeChild(projectile.container);
    projectile.container.destroy({ children: true });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
