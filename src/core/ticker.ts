import { Application } from 'pixi.js';

export class GameTicker {
  private readonly onTickInternal = (): void => {
    this.onTick(this.app.ticker.deltaMS);
  };

  public constructor(
    private readonly app: Application,
    private readonly onTick: (deltaMs: number) => void,
  ) {}

  public start(): void {
    this.app.ticker.add(this.onTickInternal);
  }

  public stop(): void {
    this.app.ticker.remove(this.onTickInternal);
  }
}
