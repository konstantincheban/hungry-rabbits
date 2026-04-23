import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ASSET_KEYS } from '../../assets/manifest';
import type { RabbitType, Vector2 } from '../../types/game';

export interface RabbitTarget {
  id: number;
  slotId: number;
  type: RabbitType;
  container: Container;
  position: Vector2;
  radius: number;
  active: boolean;
}

export interface RabbitTargetOptions {
  id: number;
  slotId: number;
  type: RabbitType;
  position: Vector2;
  radius: number;
}

export function createRabbitTarget(options: RabbitTargetOptions): RabbitTarget {
  const container = new Container();
  const isGolden = options.type === 'golden';
  const textureKey = isGolden ? ASSET_KEYS.GOLDEN_RABBIT : ASSET_KEYS.RABBIT;
  const rabbitTexture = Assets.get<Texture>(textureKey);

  if (rabbitTexture && rabbitTexture !== Texture.EMPTY) {
    const rabbitSprite = Sprite.from(rabbitTexture);
    const targetHeight = options.radius * 2.95;
    const scale = targetHeight / Math.max(1, rabbitTexture.height);

    // Keep collision center around torso while sprite sits naturally on platforms.
    rabbitSprite.anchor.set(0.5, 0.64);
    rabbitSprite.scale.set(scale);
    rabbitSprite.roundPixels = true;

    if (isGolden) {
      const goldenAura = new Graphics();
      goldenAura.circle(0, 0, options.radius * 1.08);
      goldenAura.fill({ color: 0xfacc15, alpha: 0.2 });
      container.addChild(goldenAura);
    }

    container.addChild(rabbitSprite);
  } else {
    // Fallback avoids white-square placeholders if an asset is missing.
    const fallback = buildFallbackRabbitGraphics(options.radius, isGolden);
    container.addChild(fallback);
  }

  container.position.set(options.position.x, options.position.y);

  return {
    id: options.id,
    slotId: options.slotId,
    type: options.type,
    container,
    position: { ...options.position },
    radius: options.radius,
    active: true,
  };
}

export function setRabbitPosition(rabbit: RabbitTarget, position: Vector2): void {
  rabbit.position = { ...position };
  rabbit.container.position.set(position.x, position.y);
}

function buildFallbackRabbitGraphics(radius: number, isGolden: boolean): Container {
  const fallback = new Container();

  const bodyColor = isGolden ? 0xfacc15 : 0xe2e8f0;
  const detailColor = isGolden ? 0xfef08a : 0xcbd5e1;

  const leftEar = new Graphics();
  leftEar.ellipse(-radius * 0.45, -radius * 1.25, radius * 0.24, radius * 0.62);
  leftEar.fill(bodyColor);

  const rightEar = new Graphics();
  rightEar.ellipse(radius * 0.45, -radius * 1.25, radius * 0.24, radius * 0.62);
  rightEar.fill(bodyColor);

  const body = new Graphics();
  body.circle(0, 0, radius);
  body.fill(bodyColor);

  const belly = new Graphics();
  belly.ellipse(0, radius * 0.24, radius * 0.54, radius * 0.42);
  belly.fill(detailColor);

  const eyeLeft = new Graphics();
  eyeLeft.circle(-radius * 0.27, -radius * 0.12, radius * 0.1);
  eyeLeft.fill(0x0f172a);

  const eyeRight = new Graphics();
  eyeRight.circle(radius * 0.27, -radius * 0.12, radius * 0.1);
  eyeRight.fill(0x0f172a);

  const nose = new Graphics();
  nose.circle(0, radius * 0.05, radius * 0.09);
  nose.fill(isGolden ? 0xb45309 : 0xf97316);

  fallback.addChild(leftEar, rightEar, body, belly, eyeLeft, eyeRight, nose);
  return fallback;
}
