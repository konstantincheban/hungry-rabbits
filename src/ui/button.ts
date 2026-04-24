import { Container, Rectangle, Text, TextStyle } from 'pixi.js';
import { audioSystem } from '../systems/audio-system';

interface TextButtonOptions {
  label: string;
  onPress: () => void;
  fontSize?: number;
  playClickSound?: boolean;
  minTouchWidth?: number;
  minTouchHeight?: number;
}

export interface TextButton extends Container {
  setLabel: (nextLabel: string) => void;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
}

export function createTextButton(options: TextButtonOptions): TextButton {
  const container = new Container() as TextButton;
  const content = new Container();

  const label = new Text({
    text: options.label,
    style: new TextStyle({
      fill: 0xfffbeb,
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: options.fontSize ?? 30,
      fontWeight: '700',
      align: 'center',
      stroke: { color: 0x111827, width: 5, join: 'round' },
      dropShadow: {
        alpha: 0.7,
        angle: Math.PI / 2,
        blur: 2,
        color: 0x000000,
        distance: 1,
      },
    }),
  });

  label.anchor.set(0.5);
  content.addChild(label);
  container.addChild(content);

  let enabled = true;
  const minTouchWidth = Math.max(32, options.minTouchWidth ?? 44);
  const minTouchHeight = Math.max(32, options.minTouchHeight ?? 44);

  const relayout = (): void => {
    const fullWidth = Math.max(minTouchWidth, label.width + 20);
    const fullHeight = Math.max(minTouchHeight, label.height + 16);

    label.position.set(0, 0);
    container.hitArea = new Rectangle(
      -fullWidth * 0.5,
      -fullHeight * 0.5,
      fullWidth,
      fullHeight,
    );
  };

  const setPressedVisual = (pressed: boolean): void => {
    if (!enabled) {
      return;
    }

    content.scale.set(pressed ? 0.965 : 1);
    label.alpha = pressed ? 0.88 : 1;
  };

  const resetVisual = (): void => {
    content.scale.set(1);
    label.alpha = enabled ? 1 : 0.5;
  };

  relayout();

  container.eventMode = 'static';
  container.cursor = 'pointer';

  container.on('pointerdown', () => {
    setPressedVisual(true);
  });

  container.on('pointertap', () => {
    if (!enabled) {
      return;
    }

    audioSystem.unlockFromGesture();

    if (options.playClickSound !== false) {
      audioSystem.play('ui-click');
    }

    setPressedVisual(false);
    options.onPress();
  });

  container.on('pointerover', () => {
    if (!enabled) {
      return;
    }

    label.alpha = 0.86;
  });

  container.on('pointerout', resetVisual);
  container.on('pointerup', resetVisual);
  container.on('pointerupoutside', resetVisual);

  container.setLabel = (nextLabel: string): void => {
    label.text = nextLabel;
    relayout();
  };

  container.setEnabled = (nextEnabled: boolean): void => {
    enabled = nextEnabled;
    container.cursor = nextEnabled ? 'pointer' : 'default';
    container.eventMode = nextEnabled ? 'static' : 'none';
    resetVisual();
  };

  container.isEnabled = (): boolean => enabled;

  return container;
}
