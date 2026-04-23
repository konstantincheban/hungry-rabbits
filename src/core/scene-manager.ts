import { Application, Container, Graphics } from 'pixi.js';

export interface Scene {
  key: string;
  container: Container;
  onEnter?: () => void | Promise<void>;
  onExit?: () => void | Promise<void>;
  onResize?: (width: number, height: number) => void;
  update?: (deltaMs: number) => void;
}

export interface SceneController {
  changeScene: (key: string) => Promise<void>;
  getCurrentSceneKey: () => string | null;
}

export interface SceneContext {
  app: Application;
  sceneController: SceneController;
}

export type SceneFactory = (context: SceneContext) => Scene;

export class SceneManager implements SceneController {
  private readonly sceneFactories = new Map<string, SceneFactory>();
  private readonly transitionOverlay = new Graphics();

  private currentScene: Scene | null = null;
  private currentSceneKey: string | null = null;
  private lastWidth = -1;
  private lastHeight = -1;

  private transitionQueue: Promise<void> = Promise.resolve();
  private transitionToken = 0;

  public constructor(
    private readonly app: Application,
    private readonly rootContainer: Container,
  ) {
    this.transitionOverlay.alpha = 1;
    this.transitionOverlay.eventMode = 'none';
    this.rootContainer.addChild(this.transitionOverlay);
  }

  public register(key: string, factory: SceneFactory): void {
    if (this.sceneFactories.has(key)) {
      throw new Error(`Scene "${key}" already registered.`);
    }

    this.sceneFactories.set(key, factory);
  }

  public changeScene(key: string): Promise<void> {
    this.transitionQueue = this.transitionQueue.catch(() => undefined).then(async () => {
      await this.performSceneChange(key);
    });

    return this.transitionQueue;
  }

  public getCurrentSceneKey(): string | null {
    return this.currentSceneKey;
  }

  public update(deltaMs: number): void {
    this.refreshResize();
    this.currentScene?.update?.(deltaMs);
  }

  private async performSceneChange(key: string): Promise<void> {
    const factory = this.sceneFactories.get(key);
    if (!factory) {
      throw new Error(`Unknown scene "${key}".`);
    }

    if (this.currentScene) {
      await this.fadeOverlay(0, 1, 170);
      await this.currentScene.onExit?.();
      this.rootContainer.removeChild(this.currentScene.container);
      this.currentScene.container.destroy({ children: true });
    }

    const nextScene = factory({
      app: this.app,
      sceneController: this,
    });

    this.currentScene = nextScene;
    this.currentSceneKey = key;

    this.rootContainer.addChildAt(nextScene.container, 0);
    this.rootContainer.addChild(this.transitionOverlay);

    this.applyResize();
    await nextScene.onEnter?.();
    await this.fadeOverlay(1, 0, 190);
  }

  private refreshResize(): void {
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    if (width === this.lastWidth && height === this.lastHeight) {
      return;
    }

    this.applyResize();
  }

  private applyResize(): void {
    this.lastWidth = this.app.screen.width;
    this.lastHeight = this.app.screen.height;

    this.currentScene?.onResize?.(this.lastWidth, this.lastHeight);
    this.drawTransitionOverlay();
  }

  private drawTransitionOverlay(): void {
    this.transitionOverlay.clear();
    this.transitionOverlay.rect(0, 0, this.lastWidth, this.lastHeight);
    this.transitionOverlay.fill(0x020617);
  }

  private async fadeOverlay(from: number, to: number, durationMs: number): Promise<void> {
    const token = ++this.transitionToken;

    if (durationMs <= 0) {
      this.transitionOverlay.alpha = to;
      return;
    }

    this.transitionOverlay.alpha = from;

    await new Promise<void>((resolve) => {
      let startedAtMs = 0;

      const step = (timestampMs: number): void => {
        if (token !== this.transitionToken) {
          resolve();
          return;
        }

        if (startedAtMs === 0) {
          startedAtMs = timestampMs;
        }

        const elapsedMs = timestampMs - startedAtMs;
        const progress = clamp(elapsedMs / durationMs, 0, 1);
        const eased = easeInOutQuad(progress);

        this.transitionOverlay.alpha = from + ((to - from) * eased);

        if (progress < 1) {
          requestAnimationFrame(step);
          return;
        }

        this.transitionOverlay.alpha = to;
        resolve();
      };

      requestAnimationFrame(step);
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function easeInOutQuad(progress: number): number {
  if (progress < 0.5) {
    return 2 * progress * progress;
  }

  return 1 - (Math.pow(-2 * progress + 2, 2) / 2);
}
