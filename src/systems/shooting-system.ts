import type { GameSessionState } from '../state/game-session';
import type { Vector2 } from '../types/game';

export interface ShootingTuning {
  minSpeed: number;
  maxSpeed: number;
}

export interface ShotDefinition {
  position: Vector2;
  velocity: Vector2;
}

export class ShootingSystem {
  public constructor(
    private readonly session: GameSessionState,
    private readonly tuning: ShootingTuning,
  ) {}

  public canShoot(): boolean {
    return this.session.ammo > 0;
  }

  public buildShot(
    origin: Vector2,
    angleRad: number,
    powerRatio: number,
    speedMultiplier = 1,
  ): ShotDefinition | null {
    if (!this.canShoot()) {
      return null;
    }

    this.session.ammo -= 1;
    this.session.shotsFired += 1;

    const clampedPower = Math.max(0, Math.min(1, powerRatio));
    const baseSpeed = this.tuning.minSpeed + ((this.tuning.maxSpeed - this.tuning.minSpeed) * clampedPower);
    const speed = baseSpeed * Math.max(0.5, speedMultiplier);

    return {
      position: { ...origin },
      velocity: {
        x: Math.cos(angleRad) * speed,
        y: Math.sin(angleRad) * speed,
      },
    };
  }
}
