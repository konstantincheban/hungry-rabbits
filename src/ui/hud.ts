import { Container, Graphics, Text, TextStyle } from 'pixi.js';

interface HudValues {
  ammo: number;
  score: number;
  combo: number;
  powerRatio?: number;
}

const BASE_STYLE = new TextStyle({
  fill: 0xf8fafc,
  fontFamily: 'Trebuchet MS, Arial, sans-serif',
  fontSize: 18,
  fontWeight: '700',
  stroke: { color: 0x0f172a, width: 3, join: 'round' },
  dropShadow: {
    alpha: 0.65,
    angle: Math.PI / 2,
    blur: 2,
    color: 0x000000,
    distance: 1,
  },
});

export class GameHud {
  public readonly container = new Container();

  private readonly panel = new Graphics();
  private readonly ammoText = new Text({ text: '', style: BASE_STYLE });
  private readonly scoreText = new Text({ text: '', style: BASE_STYLE });
  private readonly comboText = new Text({ text: '', style: BASE_STYLE });
  private readonly powerText = new Text({ text: '', style: BASE_STYLE });

  private comboPulseMs = 0;
  private comboFlashMs = 0;
  private previousCombo = 1;

  public constructor() {
    this.container.addChild(this.panel, this.ammoText, this.scoreText, this.comboText, this.powerText);

    this.ammoText.position.set(14, 12);
    this.scoreText.position.set(14, 42);
    this.comboText.position.set(14, 72);
    this.powerText.position.set(14, 102);

    this.update({ ammo: 0, score: 0, combo: 1, powerRatio: 0.45 });
  }

  public update(values: HudValues): void {
    this.ammoText.text = `Набої: ${values.ammo}`;
    this.scoreText.text = `Рахунок: ${values.score}`;
    this.comboText.text = `Комбо: x${values.combo}`;
    this.powerText.text = `Сила: ${Math.round((values.powerRatio ?? 0) * 100)}%`;

    if (values.combo > this.previousCombo) {
      this.comboPulseMs = 300;
      this.comboFlashMs = 230;
    }

    if (values.combo === 1 && this.previousCombo > 1) {
      this.comboFlashMs = 140;
    }

    this.previousCombo = values.combo;
  }

  public tick(deltaMs: number): void {
    if (this.comboPulseMs > 0) {
      this.comboPulseMs = Math.max(0, this.comboPulseMs - deltaMs);
    }

    if (this.comboFlashMs > 0) {
      this.comboFlashMs = Math.max(0, this.comboFlashMs - deltaMs);
    }

    const pulseStrength = this.comboPulseMs / 300;
    const comboScale = 1 + (0.2 * pulseStrength);
    this.comboText.scale.set(comboScale);

    if (this.comboFlashMs > 0) {
      this.comboText.tint = 0xfde68a;
    } else {
      this.comboText.tint = 0xf8fafc;
    }
  }

  public resize(width: number, height: number): void {
    const compactScale = width < 360 || height < 640
      ? 0.82
      : width < 420 || height < 730
        ? 0.9
        : 1;

    this.container.scale.set(compactScale);

    const panelWidth = Math.min(240, Math.max(190, width - 24));

    this.panel.clear();
    this.panel.roundRect(0, 0, panelWidth, 134, 12);
    this.panel.fill(0x020617);
    this.panel.alpha = 0.82;

    this.container.position.set(10, 10);
  }
}
