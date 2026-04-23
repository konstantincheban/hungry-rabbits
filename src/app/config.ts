export interface GameConfig {
  appName: string;
  backgroundColor: number;
  maxDevicePixelRatio: number;
  minGameWidth: number;
}

export const GAME_CONFIG: GameConfig = {
  appName: 'Hungry Rabbits',
  backgroundColor: 0x0a1020,
  maxDevicePixelRatio: 2,
  minGameWidth: 768,
};

export interface GameplayConfig {
  initialAmmo: number;
  gravity: number;
  minShotSpeed: number;
  maxShotSpeed: number;
  maxDragDistance: number;
  minAimAngleDeg: number;
  maxAimAngleDeg: number;
  turretOffsetX: number;
  turretOffsetFromGround: number;
  groundHeight: number;
  rabbitRadius: number;
  projectileRadius: number;
  goldenRabbitChance: number;
  rabbitRespawnDelayMs: number;
  missParticleCount: number;
  missParticleGravity: number;
}

export const GAMEPLAY_CONFIG: GameplayConfig = {
  initialAmmo: 30,
  gravity: 1100,
  minShotSpeed: 420,
  maxShotSpeed: 1450,
  maxDragDistance: 220,
  minAimAngleDeg: -84,
  maxAimAngleDeg: 0,
  turretOffsetX: 72,
  turretOffsetFromGround: 14,
  groundHeight: 112,
  rabbitRadius: 24,
  projectileRadius: 10,
  goldenRabbitChance: 0.2,
  rabbitRespawnDelayMs: 650,
  missParticleCount: 10,
  missParticleGravity: 760,
};
