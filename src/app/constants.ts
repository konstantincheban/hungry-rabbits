export const SCENES = {
  BOOT: 'boot',
  START: 'start',
  GAME: 'game',
  GAME_OVER: 'game-over',
  LEADERBOARD: 'leaderboard',
  QR: 'qr',
} as const;

export type SceneId = (typeof SCENES)[keyof typeof SCENES];
