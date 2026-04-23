import { Container } from 'pixi.js';
import { SCENES } from '../../app/constants';
import { preloadAssets } from '../../assets/loader';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { createBodyLabel, createTitleLabel } from '../shared/base-label';

export function createBootScene({ sceneController }: SceneContext): Scene {
  const container = new Container();
  const title = createTitleLabel('Голодні Кролики');
  const status = createBodyLabel('Завантаження...', 22);

  container.addChild(title, status);

  return {
    key: SCENES.BOOT,
    container,
    onEnter: () => {
      void preloadAssets()
        .catch(() => {
          status.text = 'Помилка ініціалізації ресурсів, продовжуємо...';
        })
        .finally(() => {
          void sceneController.changeScene(SCENES.START);
        });
    },
    onResize: (width, height) => {
      title.x = width * 0.5;
      title.y = height * 0.42;

      status.x = width * 0.5;
      status.y = height * 0.55;
    },
  };
}
