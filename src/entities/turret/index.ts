import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ASSET_KEYS } from '../../assets/manifest';
import type { Vector2 } from '../../types/game';

export interface TurretEntity {
  container: Container;
  setPosition: (x: number, y: number) => void;
  getBasePosition: () => Vector2;
  setAimAngle: (angleRad: number) => void;
  getMuzzlePosition: () => Vector2;
}

export function createTurretEntity(): TurretEntity {
  const container = new Container();
  const barrelPivot = new Container();

  let muzzleLocal: Vector2;
  const turretTexture = Assets.get<Texture>(ASSET_KEYS.TURRET);

  if (turretTexture && turretTexture !== Texture.EMPTY) {
    const targetWidth = 166;
    const scale = targetWidth / Math.max(1, turretTexture.width);
    const displayWidth = turretTexture.width * scale;
    const displayHeight = turretTexture.height * scale;
    const pivotX = 0.445;
    const pivotY = 0.43;
    const spriteLift = targetWidth * 0.24;

    const turretSprite = Sprite.from(turretTexture);
    turretSprite.anchor.set(pivotX, pivotY);
    turretSprite.scale.set(scale);
    turretSprite.y = -spriteLift;
    turretSprite.roundPixels = true;

    const baseShadow = new Graphics();
    baseShadow.ellipse(0, 10, 34, 13);
    baseShadow.fill({ color: 0x0f172a, alpha: 0.38 });

    barrelPivot.addChild(turretSprite);
    container.addChild(baseShadow, barrelPivot);

    muzzleLocal = {
      x: displayWidth * (0.905 - pivotX),
      y: (displayHeight * (0.351 - pivotY)) - spriteLift,
    };
  } else {
    const barrelLength = 64;

    const baseShadow = new Graphics();
    baseShadow.circle(0, 7, 28);
    baseShadow.fill(0x0f172a);
    baseShadow.alpha = 0.55;

    const base = new Graphics();
    base.circle(0, 0, 24);
    base.fill(0x334155);

    const barrel = new Graphics();
    barrel.roundRect(0, -7, barrelLength, 14, 7);
    barrel.fill(0x94a3b8);

    const muzzle = new Graphics();
    muzzle.roundRect(barrelLength - 4, -9, 14, 18, 7);
    muzzle.fill(0xcbd5e1);

    const pivotCap = new Graphics();
    pivotCap.circle(0, 0, 8);
    pivotCap.fill(0x64748b);

    barrelPivot.addChild(barrel, muzzle);
    container.addChild(baseShadow, barrelPivot, base, pivotCap);

    muzzleLocal = {
      x: barrelLength + 8,
      y: 0,
    };
  }

  return {
    container,
    setPosition: (x, y) => {
      container.position.set(x, y);
    },
    getBasePosition: () => ({
      x: container.x,
      y: container.y,
    }),
    setAimAngle: (angleRad) => {
      barrelPivot.rotation = angleRad;
    },
    getMuzzlePosition: () => {
      const global = barrelPivot.toGlobal({ x: muzzleLocal.x, y: muzzleLocal.y });
      return {
        x: global.x,
        y: global.y,
      };
    },
  };
}
