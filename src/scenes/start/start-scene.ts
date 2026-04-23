import { Container } from 'pixi.js';
import { SCENES } from '../../app/constants';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { audioSystem } from '../../systems/audio-system';
import { createTextButton } from '../../ui/button';
import { createBodyLabel, createTitleLabel } from '../shared/base-label';

export function createStartScene({ sceneController }: SceneContext): Scene {
  const container = new Container();
  const title = createTitleLabel('Голодні Кролики');
  const subtitle = createBodyLabel('Аркадна демо-гра', 22);

  const playButton = createTextButton({
    label: 'Грати',
    onPress: () => {
      void sceneController.changeScene(SCENES.GAME);
    },
  });

  const leaderboardButton = createTextButton({
    label: 'Рейтинг',
    onPress: () => {
      void sceneController.changeScene(SCENES.LEADERBOARD);
    },
    fontSize: 28,
  });

  const qrButton = createTextButton({
    label: 'QR-сторінка',
    onPress: () => {
      void sceneController.changeScene(SCENES.QR);
    },
    fontSize: 28,
  });

  const soundButton = createTextButton({
    label: getSoundEffectsLabel(audioSystem.isEnabled()),
    onPress: () => {
      const enabled = audioSystem.toggleEnabled();
      soundButton.setLabel(getSoundEffectsLabel(enabled));
    },
    fontSize: 22,
    playClickSound: false,
  });

  container.addChild(title, subtitle, playButton, leaderboardButton, qrButton, soundButton);

  const buttons = [playButton, leaderboardButton, qrButton, soundButton];

  return {
    key: SCENES.START,
    onEnter: () => {
      soundButton.setLabel(getSoundEffectsLabel(audioSystem.isEnabled()));
    },
    container,
    onResize: (width, height) => {
      const uiScale = clamp(Math.min(width / 390, height / 860), 0.75, 1);

      title.scale.set(uiScale);
      subtitle.scale.set(uiScale);

      title.x = width * 0.5;
      title.y = Math.max(72, height * 0.15);

      subtitle.x = width * 0.5;
      subtitle.y = title.y + (52 * uiScale);

      const startY = subtitle.y + (74 * uiScale);
      const spacing = 62 * uiScale;

      buttons.forEach((button, index) => {
        button.scale.set(uiScale);
        button.x = width * 0.5;
        button.y = startY + (index * spacing);
      });
    },
  };
}

function getSoundEffectsLabel(enabled: boolean): string {
  return enabled ? 'Звукові ефекти: Увімк.' : 'Звукові ефекти: Вимк.';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
