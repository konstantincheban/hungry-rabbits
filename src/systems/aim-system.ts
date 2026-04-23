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
  maxDragDistance: number;
  minPullDistance?: number;
  minAngleDragDistance?: number;
  angleSmoothing?: number;
  frontPowerScale?: number;
  behindPowerScale?: number;
  sideSwitchDeadzone?: number;
  powerCurveExponent?: number;
  getAimOrigin: () => Vector2;
  canShoot: () => boolean;
  onAimChanged: (payload: AimChangedPayload) => void;
  onShoot: (angleRad: number, powerRatio: number) => void;
}

export class AimSystem {
  private dragging = false;
  private dragStart: Vector2 | null = null;
  private dragMode: 'front' | 'behind' = 'front';
  private angleRad = -0.6;
  private powerRatio = 0.45;
  private activeMaxDragDistance: number;

  private readonly onPointerDown = (event: FederatedPointerEvent): void => {
    if (!this.options.canShoot()) {
      return;
    }

    this.dragging = true;
    this.dragStart = {
      x: event.global.x,
      y: event.global.y,
    };
    this.dragMode = this.resolveDragMode(event.global.x);
    this.powerRatio = 0;
    this.emitAimChanged();
  };

  private readonly onPointerMove = (event: FederatedPointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    this.updateAimFromDrag(event.global);
    this.emitAimChanged();
  };

  private readonly onPointerUp = (event: FederatedPointerEvent): void => {
    if (!this.dragging) {
      return;
    }

    this.updateAimFromDrag(event.global);
    this.dragging = false;
    this.dragStart = null;
    this.dragMode = 'front';
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
    this.dragStart = null;
    this.dragMode = 'front';
    this.powerRatio = 0;
    this.emitAimChanged();
  };

  public constructor(
    private readonly interactionLayer: Container,
    private readonly options: AimSystemOptions,
  ) {
    this.activeMaxDragDistance = Math.max(20, options.maxDragDistance);

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

  public setMaxDragDistance(maxDragDistance: number): void {
    this.activeMaxDragDistance = Math.max(20, maxDragDistance);
  }

  public destroy(): void {
    this.interactionLayer.off('pointerdown', this.onPointerDown);
    this.interactionLayer.off('pointermove', this.onPointerMove);
    this.interactionLayer.off('pointerup', this.onPointerUp);
    this.interactionLayer.off('pointerupoutside', this.onPointerUp);
    this.interactionLayer.off('pointercancel', this.onPointerCancel);
  }

  private updateAimFromDrag(pointerPosition: PointData): void {
    const dragStart = this.dragStart ?? {
      x: pointerPosition.x,
      y: pointerPosition.y,
    };
    this.dragMode = this.resolveDragMode(pointerPosition.x);

    const dragX = pointerPosition.x - dragStart.x;
    const dragY = pointerPosition.y - dragStart.y;
    const dragDistance = Math.hypot(dragX, dragY);

    const minAngleDragDistance = this.options.minAngleDragDistance ?? 12;
    if (dragDistance >= minAngleDragDistance) {
      // Front drag: follows movement direction.
      // Behind drag: behaves like pull-back slingshot.
      const directionX = this.dragMode === 'behind' ? -dragX : dragX;
      const directionY = this.dragMode === 'behind' ? -dragY : dragY;
      const targetAngle = clamp(
        Math.atan2(directionY, directionX),
        this.options.minAngleRad,
        this.options.maxAngleRad,
      );
      const angleSmoothing = clamp(this.options.angleSmoothing ?? 0.28, 0.05, 1);
      this.angleRad = lerpAngle(this.angleRad, targetAngle, angleSmoothing);
    }

    const pullDistance = dragDistance;
    const effectivePull = Math.max(0, pullDistance - (this.options.minPullDistance ?? 8));
    const powerScale = this.dragMode === 'behind'
      ? (this.options.behindPowerScale ?? 1)
      : (this.options.frontPowerScale ?? 0.45);
    const normalized = clamp((effectivePull * powerScale) / this.activeMaxDragDistance, 0, 1);
    const curve = this.options.powerCurveExponent ?? 0.74;
    this.powerRatio = Math.pow(normalized, curve);
  }

  private resolveDragMode(pointerX: number): 'front' | 'behind' {
    const origin = this.options.getAimOrigin();
    const deltaX = pointerX - origin.x;
    const deadzone = Math.max(0, this.options.sideSwitchDeadzone ?? 26);

    if (deltaX <= -deadzone) {
      return 'behind';
    }

    if (deltaX >= deadzone) {
      return 'front';
    }

    return this.dragMode;
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
