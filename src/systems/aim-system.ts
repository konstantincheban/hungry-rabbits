import type { Container, FederatedPointerEvent, PointData } from 'pixi.js';
import type { Vector2 } from '../types/game';

interface AimChangedPayload {
  angleRad: number;
  powerRatio: number;
  isDragging: boolean;
}

interface AimSystemOptions {
  minAngleRad: number;
  maxAngleRad: number;
  maxPullDistancePx: number;
  activationRadiusPx?: number;
  minPullDistancePx?: number;
  angleSmoothing?: number;
  powerCurveExponent?: number;
  getAimOrigin: () => Vector2;
  canShoot: () => boolean;
  onAimChanged: (payload: AimChangedPayload) => void;
  onShoot: (angleRad: number, powerRatio: number) => void;
}

export class AimSystem {
  private dragging = false;
  private angleRad = -0.6;
  private powerRatio = 0.45;
  private activeMaxPullDistance: number;

  private readonly onPointerDown = (event: FederatedPointerEvent): void => {
    if (!this.options.canShoot()) {
      return;
    }

    const localPointer = this.toLocalPointer(event.global);
    const origin = this.options.getAimOrigin();
    const activationRadius = Math.max(16, this.options.activationRadiusPx ?? 82);

    if (distance(localPointer, origin) > activationRadius) {
      return;
    }

    this.dragging = true;
    this.updateAimFromPointer(localPointer);
    this.emitAimChanged();
  };

  private readonly onPointerMove = (event: FederatedPointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    this.updateAimFromPointer(this.toLocalPointer(event.global));
    this.emitAimChanged();
  };

  private readonly onPointerUp = (event: FederatedPointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    this.updateAimFromPointer(this.toLocalPointer(event.global));
    this.dragging = false;
    this.emitAimChanged();

    if (!this.options.canShoot()) {
      return;
    }

    if (this.powerRatio <= 0.01) {
      return;
    }

    this.options.onShoot(this.angleRad, this.powerRatio);
  };

  private readonly onPointerCancel = (): void => {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.powerRatio = 0;
    this.emitAimChanged();
  };

  public constructor(
    private readonly interactionLayer: Container,
    private readonly options: AimSystemOptions,
  ) {
    this.activeMaxPullDistance = Math.max(24, options.maxPullDistancePx);

    this.interactionLayer.eventMode = 'static';
    this.interactionLayer.cursor = 'crosshair';

    this.interactionLayer.on('pointerdown', this.onPointerDown);
    this.interactionLayer.on('pointermove', this.onPointerMove);
    this.interactionLayer.on('pointerup', this.onPointerUp);
    this.interactionLayer.on('pointerupoutside', this.onPointerUp);
    this.interactionLayer.on('pointercancel', this.onPointerCancel);

    this.emitAimChanged();
  }

  public getAngleRad(): number {
    return this.angleRad;
  }

  public getPowerRatio(): number {
    return this.powerRatio;
  }

  public setAimState(angleRad: number, powerRatio: number): void {
    this.angleRad = clamp(angleRad, this.options.minAngleRad, this.options.maxAngleRad);
    this.powerRatio = clamp(powerRatio, 0, 1);
    this.emitAimChanged();
  }

  public setMaxPullDistance(maxPullDistancePx: number): void {
    this.activeMaxPullDistance = Math.max(24, maxPullDistancePx);
  }

  public cancelDrag(): void {
    if (!this.dragging && this.powerRatio === 0) {
      return;
    }

    this.dragging = false;
    this.powerRatio = 0;
    this.emitAimChanged();
  }

  public destroy(): void {
    this.interactionLayer.off('pointerdown', this.onPointerDown);
    this.interactionLayer.off('pointermove', this.onPointerMove);
    this.interactionLayer.off('pointerup', this.onPointerUp);
    this.interactionLayer.off('pointerupoutside', this.onPointerUp);
    this.interactionLayer.off('pointercancel', this.onPointerCancel);
  }

  private updateAimFromPointer(pointerPosition: PointData): void {
    const origin = this.options.getAimOrigin();
    const pullVector = {
      x: origin.x - pointerPosition.x,
      y: origin.y - pointerPosition.y,
    };
    const pullDistance = Math.hypot(pullVector.x, pullVector.y);
    const minPullDistance = Math.max(0, this.options.minPullDistancePx ?? 14);

    if (pullDistance >= Math.max(2, minPullDistance * 0.45)) {
      const targetAngle = clamp(
        Math.atan2(pullVector.y, pullVector.x),
        this.options.minAngleRad,
        this.options.maxAngleRad,
      );
      const angleSmoothing = clamp(this.options.angleSmoothing ?? 0.2, 0.05, 1);
      this.angleRad = lerpAngle(this.angleRad, targetAngle, angleSmoothing);
    }

    const effectivePull = Math.max(0, pullDistance - minPullDistance);
    const normalized = clamp(effectivePull / this.activeMaxPullDistance, 0, 1);
    const curve = this.options.powerCurveExponent ?? 1.24;
    this.powerRatio = Math.pow(normalized, curve);
  }

  private toLocalPointer(pointer: PointData): Vector2 {
    const local = this.interactionLayer.toLocal(pointer);
    return {
      x: local.x,
      y: local.y,
    };
  }

  private emitAimChanged(): void {
    this.options.onAimChanged({
      angleRad: this.angleRad,
      powerRatio: this.powerRatio,
      isDragging: this.dragging,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerpAngle(from: number, to: number, t: number): number {
  const delta = normalizeAngle(to - from);
  return from + (delta * t);
}

function normalizeAngle(angle: number): number {
  let result = angle;
  while (result > Math.PI) {
    result -= Math.PI * 2;
  }

  while (result < -Math.PI) {
    result += Math.PI * 2;
  }

  return result;
}

function distance(from: PointData, to: Vector2): number {
  return Math.hypot(from.x - to.x, from.y - to.y);
}
