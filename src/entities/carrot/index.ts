import { Container, Graphics } from 'pixi.js';
import type { Vector2 } from '../../types/game';

export interface CarrotProjectile {
  id: number;
  container: Container;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  active: boolean;
}

export function createCarrotProjectile(
  id: number,
  position: Vector2,
  velocity: Vector2,
  radius: number,
): CarrotProjectile {
  const container = new Container();

  const body = new Graphics();
  body.ellipse(0, 0, radius * 1.2, radius * 0.72);
  body.fill(0xf97316);

  const tip = new Graphics();
  tip.moveTo(radius * 1.3, 0);
  tip.lineTo(radius * 0.55, -radius * 0.6);
  tip.lineTo(radius * 0.55, radius * 0.6);
  tip.closePath();
  tip.fill(0xea580c);

  const leaves = new Graphics();
  leaves.moveTo(-radius * 1.2, 0);
  leaves.lineTo(-radius * 0.35, -radius * 0.85);
  leaves.lineTo(-radius * 0.05, -radius * 0.15);
  leaves.closePath();
  leaves.fill(0x22c55e);

  const leaves2 = new Graphics();
  leaves2.moveTo(-radius * 1.2, 0);
  leaves2.lineTo(-radius * 0.35, radius * 0.85);
  leaves2.lineTo(-radius * 0.05, radius * 0.15);
  leaves2.closePath();
  leaves2.fill(0x16a34a);

  container.addChild(body, tip, leaves, leaves2);
  container.position.set(position.x, position.y);
  container.rotation = Math.atan2(velocity.y, velocity.x);

  return {
    id,
    container,
    position: { ...position },
    velocity: { ...velocity },
    radius,
    active: true,
  };
}

export function syncCarrotProjectile(projectile: CarrotProjectile): void {
  projectile.container.position.set(projectile.position.x, projectile.position.y);
  projectile.container.rotation = Math.atan2(projectile.velocity.y, projectile.velocity.x);
}
