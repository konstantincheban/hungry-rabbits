import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import QRCode from 'qrcode';
import { SCENES } from '../../app/constants';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { audioSystem } from '../../systems/audio-system';
import { createTextButton } from '../../ui/button';
import { createBodyLabel, createTitleLabel } from '../shared/base-label';

export function createQrScene({ sceneController }: SceneContext): Scene {
  const container = new Container();

  const title = createTitleLabel('QR-сторінка');
  const subtitle = createBodyLabel('Скануй, щоб грати', 22);
  const statusLabel = createBodyLabel('Генеруємо QR...', 16);
  const urlLabel = createBodyLabel('', 14);

  const qrFrame = new Graphics();

  const startButton = createTextButton({
    label: 'На головну',
    onPress: () => {
      void sceneController.changeScene(SCENES.START);
    },
    fontSize: 24,
  });

  const gameButton = createTextButton({
    label: 'До гри',
    onPress: () => {
      void sceneController.changeScene(SCENES.GAME);
    },
    fontSize: 24,
  });

  container.addChild(title, subtitle, qrFrame, statusLabel, urlLabel, startButton, gameButton);

  let qrSprite: Sprite | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let sceneActive = false;

  function getGameUrl(): string {
    const envUrl = import.meta.env.VITE_GAME_URL?.trim();

    if (envUrl) {
      return envUrl;
    }

    return window.location.origin;
  }

  function removeCurrentQrSprite(): void {
    if (!qrSprite) {
      return;
    }

    container.removeChild(qrSprite);
    qrSprite.destroy({ texture: true, textureSource: true });
    qrSprite = null;
  }

  function layout(width: number, height: number): void {
    lastWidth = width;
    lastHeight = height;

    const uiScale = clamp(Math.min(width / 390, height / 860), 0.74, 1);

    title.scale.set(uiScale);
    subtitle.scale.set(uiScale);
    statusLabel.scale.set(uiScale);
    urlLabel.scale.set(uiScale);

    title.x = width * 0.5;
    title.y = Math.max(66, height * 0.085);

    subtitle.x = width * 0.5;
    subtitle.y = title.y + (48 * uiScale);

    const qrSize = Math.min(width * 0.72, height * 0.42, 360);
    const frameSize = qrSize + 28;
    const frameY = subtitle.y + (frameSize * 0.56);

    qrFrame.clear();
    qrFrame.roundRect((width * 0.5) - (frameSize * 0.5), frameY - (frameSize * 0.5), frameSize, frameSize, 14);
    qrFrame.fill(0xffffff);

    if (qrSprite) {
      qrSprite.anchor.set(0.5);
      qrSprite.width = qrSize;
      qrSprite.height = qrSize;
      qrSprite.x = width * 0.5;
      qrSprite.y = frameY;
    }

    statusLabel.x = width * 0.5;
    statusLabel.y = frameY + (frameSize * 0.5) + (20 * uiScale);

    urlLabel.x = width * 0.5;
    urlLabel.y = statusLabel.y + (22 * uiScale);

    startButton.scale.set(uiScale);
    gameButton.scale.set(uiScale);

    startButton.x = width * 0.5;
    startButton.y = Math.min(height - (90 * uiScale), urlLabel.y + (58 * uiScale));

    gameButton.x = width * 0.5;
    gameButton.y = startButton.y + (50 * uiScale);
  }

  async function buildQr(): Promise<void> {
    const gameUrl = getGameUrl();

    statusLabel.text = 'Генеруємо QR...';
    statusLabel.tint = 0xcbd5e1;
    urlLabel.text = formatDisplayUrl(gameUrl);

    try {
      const dataUrl = await QRCode.toDataURL(gameUrl, {
        width: 768,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });

      if (!sceneActive) {
        return;
      }

      removeCurrentQrSprite();
      const texture = Texture.from(dataUrl);
      qrSprite = new Sprite(texture);
      container.addChild(qrSprite);

      layout(lastWidth, lastHeight);
      statusLabel.text = 'Скануйте код, щоб відкрити гру.';
      statusLabel.tint = 0xa7f3d0;
    } catch {
      if (!sceneActive) {
        return;
      }

      audioSystem.play('network-error');
      statusLabel.text = 'Не вдалося згенерувати QR-код. Перевірте VITE_GAME_URL.';
      statusLabel.tint = 0xfca5a5;
    }
  }

  return {
    key: SCENES.QR,
    container,
    onEnter: () => {
      sceneActive = true;
      void buildQr();
    },
    onExit: () => {
      sceneActive = false;
      removeCurrentQrSprite();
    },
    onResize: (width, height) => {
      layout(width, height);
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatDisplayUrl(url: string): string {
  const maxLength = 36;
  if (url.length <= maxLength) {
    return url;
  }

  const head = url.slice(0, maxLength - 3);
  return `${head}...`;
}
