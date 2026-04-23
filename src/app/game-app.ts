import { Application, Container } from 'pixi.js';
import { GAME_CONFIG } from './config';
import { SCENES } from './constants';
import { SceneManager } from '../core/scene-manager';
import { GameTicker } from '../core/ticker';
import { createBootScene } from '../scenes/boot';
import { createStartScene } from '../scenes/start';
import { createGameScene } from '../scenes/game';
import { createGameOverScene } from '../scenes/game-over';
import { createLeaderboardScene } from '../scenes/leaderboard';
import { createQrScene } from '../scenes/qr';

export class GameApp {
  private readonly app = new Application();
  private sceneManager: SceneManager | null = null;
  private ticker: GameTicker | null = null;

  public constructor(private readonly mountNode: HTMLElement) {}

  public async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.mountNode,
      background: GAME_CONFIG.backgroundColor,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, GAME_CONFIG.maxDevicePixelRatio),
    });

    this.mountNode.appendChild(this.app.canvas);

    const rootContainer = new Container();
    this.app.stage.addChild(rootContainer);

    this.sceneManager = new SceneManager(this.app, rootContainer);
    this.registerScenes(this.sceneManager);

    this.ticker = new GameTicker(this.app, (deltaMs) => {
      this.sceneManager?.update(deltaMs);
    });

    this.ticker.start();
    await this.sceneManager.changeScene(SCENES.BOOT);
  }

  private registerScenes(sceneManager: SceneManager): void {
    sceneManager.register(SCENES.BOOT, createBootScene);
    sceneManager.register(SCENES.START, createStartScene);
    sceneManager.register(SCENES.GAME, createGameScene);
    sceneManager.register(SCENES.GAME_OVER, createGameOverScene);
    sceneManager.register(SCENES.LEADERBOARD, createLeaderboardScene);
    sceneManager.register(SCENES.QR, createQrScene);
  }
}
