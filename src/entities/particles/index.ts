import { Graphics } from 'pixi.js';
import type { RabbitType, Vector2 } from '../../types/game';

export interface MissParticle {
  display: Graphics;
  position: Vector2;
  velocity: Vector2;
  ageMs: number;
  lifeMs: number;
  active: boolean;
  gravityScale: number;
  drag: number;
  rotationVelocity: number;
  scaleStart: number;
  scaleEnd: number;
}

export function createMissParticles(origin: Vector2, count: number): MissParticle[] {
  const particles: MissParticle[] = [];

  for (let i = 0; i < count; i += 1) {
    const speed = 80 + (Math.random() * 230);
    const angle = (-Math.PI * 0.96) + (Math.random() * (Math.PI * 0.92));
    const radius = 1.7 + (Math.random() * 3.5);

    const display = new Graphics();

    if (Math.random() > 0.5) {
      display.circle(0, 0, radius);
    } else {
      display.roundRect(-radius, -radius, radius * 2, radius * 2, Math.max(0.6, radius * 0.38));
      display.rotation = Math.random() * Math.PI;
    }

    display.fill(Math.random() > 0.5 ? 0xf97316 : 0xfacc15);
    display.position.set(origin.x, origin.y);

    particles.push({
      display,
      position: { ...origin },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      ageMs: 0,
      lifeMs: 320 + (Math.random() * 260),
      active: true,
      gravityScale: 1,
      drag: 0.985,
      rotationVelocity: (-4 + (Math.random() * 8)),
      scaleStart: 1,
      scaleEnd: 0.35,
    });
  }

  return particles;
}

export function createHitParticles(origin: Vector2, rabbitType: RabbitType): MissParticle[] {
  const particles: MissParticle[] = [];
  const count = rabbitType === 'golden' ? 16 : 11;

  for (let i = 0; i < count; i += 1) {
    const speed = 140 + (Math.random() * (rabbitType === 'golden' ? 290 : 210));
    const angle = Math.random() * Math.PI * 2;
    const radius = rabbitType === 'golden'
      ? 2.3 + (Math.random() * 3)
      : 1.8 + (Math.random() * 2.5);

    const display = new Graphics();
    display.circle(0, 0, radius);

    if (rabbitType === 'golden') {
      display.fill(Math.random() > 0.45 ? 0xfef08a : 0xfacc15);
    } else {
      display.fill(Math.random() > 0.45 ? 0xffedd5 : 0xfca5a5);
    }

    display.position.set(origin.x, origin.y);

    particles.push({
      display,
      position: { ...origin },
      velocity: {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      },
      ageMs: 0,
      lifeMs: 260 + (Math.random() * 250),
      active: true,
      gravityScale: 0.75,
      drag: 0.978,
      rotationVelocity: (-2 + (Math.random() * 4)),
      scaleStart: 1,
      scaleEnd: 0.18,
    });
  }

  return particles;
}

export function updateMissParticle(
  particle: MissParticle,
  deltaSeconds: number,
  gravity: number,
): boolean {
  if (!particle.active) {
    return false;
  }

  particle.ageMs += deltaSeconds * 1000;
  if (particle.ageMs >= particle.lifeMs) {
    particle.active = false;
    return false;
  }

  const gravityAmount = gravity * particle.gravityScale;

  particle.velocity.x *= Math.pow(particle.drag, deltaSeconds * 60);
  particle.velocity.y = (particle.velocity.y * Math.pow(particle.drag, deltaSeconds * 60)) + (gravityAmount * deltaSeconds);

  particle.position.x += particle.velocity.x * deltaSeconds;
  particle.position.y += particle.velocity.y * deltaSeconds;

  const progress = particle.ageMs / particle.lifeMs;
  const scale = particle.scaleStart + ((particle.scaleEnd - particle.scaleStart) * progress);

  particle.display.position.set(particle.position.x, particle.position.y);
  particle.display.alpha = Math.max(0, 1 - progress);
  particle.display.rotation += particle.rotationVelocity * deltaSeconds;
  particle.display.scale.set(scale);

  return true;
}
