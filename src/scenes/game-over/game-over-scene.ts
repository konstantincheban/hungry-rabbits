import { Container } from 'pixi.js';
import { SCENES } from '../../app/constants';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { isFirebaseConfigured } from '../../services/firebase/app';
import { FirestoreLeaderboardApi } from '../../services/leaderboard/firestore-leaderboard-api';
import { sanitizeUsername, validateSubmission, validateUsername } from '../../services/leaderboard/leaderboard-validation';
import { getLatestGameRunSummary } from '../../state/game-session';
import { audioSystem } from '../../systems/audio-system';
import { createTextButton } from '../../ui/button';
import { createBodyLabel, createTitleLabel } from '../shared/base-label';

const USERNAME_STORAGE_KEY = 'hungry-rabbits:username';

export function createGameOverScene({ sceneController }: SceneContext): Scene {
  const container = new Container();
  const leaderboardApi = new FirestoreLeaderboardApi();

  const title = createTitleLabel('Гру завершено');
  const finalScoreLabel = createBodyLabel('Рахунок: 0', 28);
  const bestComboLabel = createBodyLabel('Найкраще комбо: x1', 24);
  const runStatsLabel = createBodyLabel('', 18);
  const usernameLabel = createBodyLabel('Нік: (не задано)', 18);
  const submitStatusLabel = createBodyLabel('', 16);

  const setUsernameButton = createTextButton({
    label: 'Задати нік',
    onPress: () => {
      handleSetUsername();
    },
    fontSize: 24,
  });

  const submitButton = createTextButton({
    label: 'Надіслати рахунок',
    onPress: () => {
      void handleSubmitScore();
    },
    fontSize: 24,
  });

  const playAgainButton = createTextButton({
    label: 'Ще раз',
    onPress: () => {
      void sceneController.changeScene(SCENES.GAME);
    },
    fontSize: 26,
  });

  const leaderboardButton = createTextButton({
    label: 'Рейтинг',
    onPress: () => {
      void sceneController.changeScene(SCENES.LEADERBOARD);
    },
    fontSize: 24,
  });

  const startButton = createTextButton({
    label: 'На головну',
    onPress: () => {
      void sceneController.changeScene(SCENES.START);
    },
    fontSize: 24,
  });

  container.addChild(
    title,
    finalScoreLabel,
    bestComboLabel,
    runStatsLabel,
    usernameLabel,
    submitStatusLabel,
    setUsernameButton,
    submitButton,
    playAgainButton,
    leaderboardButton,
    startButton,
  );

  const buttons = [setUsernameButton, submitButton, playAgainButton, leaderboardButton, startButton];

  let username = '';
  let runScore = 0;
  let submitting = false;
  let submitted = false;

  function setSubmitStatus(message: string, color: number): void {
    submitStatusLabel.text = message;
    submitStatusLabel.tint = color;
  }

  function restoreUsername(): void {
    try {
      const cached = localStorage.getItem(USERNAME_STORAGE_KEY);
      username = cached ? sanitizeUsername(cached) : '';
    } catch {
      username = '';
    }
  }

  function persistUsername(): void {
    try {
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
    } catch {
      // Ignore storage failures on restricted browsers.
    }
  }

  function syncUsernameLabel(): void {
    usernameLabel.text = username ? `Нік: ${username}` : 'Нік: (не задано)';
  }

  function handleSetUsername(): void {
    const candidate = window.prompt('Введіть нік (3-16 символів):', username);

    if (candidate === null) {
      return;
    }

    const sanitized = sanitizeUsername(candidate);
    const error = validateUsername(sanitized);

    if (error) {
      setSubmitStatus(error, 0xfca5a5);
      return;
    }

    username = sanitized;
    persistUsername();
    syncUsernameLabel();
    setSubmitStatus('Нік готовий до надсилання.', 0xa7f3d0);
  }

  async function handleSubmitScore(): Promise<void> {
    if (submitting) {
      return;
    }

    if (submitted) {
      setSubmitStatus('Рахунок уже надіслано для цього забігу.', 0xfde68a);
      return;
    }

    if (!isFirebaseConfigured()) {
      setSubmitStatus('Firebase не налаштовано. Заповніть VITE_FIREBASE_*.', 0xfde68a);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      audioSystem.play('network-error');
      setSubmitStatus('Ви офлайн. Підключіться до мережі й спробуйте ще раз.', 0xfde68a);
      return;
    }

    const validationError = validateSubmission({ username, score: runScore });
    if (validationError) {
      setSubmitStatus(validationError, 0xfca5a5);
      return;
    }

    submitting = true;
    submitButton.setEnabled(false);
    setSubmitStatus('Надсилаємо рахунок...', 0xcbd5e1);

    try {
      await leaderboardApi.submitEntry({ username, score: runScore });
      submitted = true;
      audioSystem.play('submit-success');
      setSubmitStatus('Рахунок надіслано до рейтингу.', 0xa7f3d0);
    } catch (error) {
      audioSystem.play('network-error');
      setSubmitStatus(error instanceof Error ? error.message : 'Не вдалося надіслати рахунок.', 0xfca5a5);
    } finally {
      submitting = false;
      submitButton.setEnabled(true);
    }
  }

  return {
    key: SCENES.GAME_OVER,
    container,
    onEnter: () => {
      const summary = getLatestGameRunSummary();
      runScore = summary?.score ?? 0;
      submitted = false;
      submitting = false;
      submitButton.setEnabled(true);

      restoreUsername();
      syncUsernameLabel();

      finalScoreLabel.text = `Рахунок: ${summary?.score ?? 0}`;
      bestComboLabel.text = `Найкраще комбо: x${summary?.bestCombo ?? 1}`;

      if (!summary) {
        runStatsLabel.text = 'Дані забігу відсутні';
      } else {
        runStatsLabel.text = `Постріли: ${summary.shotsFired}  Влучання: ${summary.hits}  Промахи: ${summary.misses}`;
      }

      if (isFirebaseConfigured()) {
        setSubmitStatus('Задайте нік і надішліть рахунок.', 0xcbd5e1);
      } else {
        setSubmitStatus('Firebase не налаштовано. Надсилання вимкнено.', 0xfde68a);
      }
    },
    onResize: (width, height) => {
      const uiScale = clamp(Math.min(width / 390, height / 890), 0.72, 1);

      title.scale.set(uiScale);
      finalScoreLabel.scale.set(uiScale);
      bestComboLabel.scale.set(uiScale);
      runStatsLabel.scale.set(uiScale);
      usernameLabel.scale.set(uiScale);
      submitStatusLabel.scale.set(uiScale);

      title.x = width * 0.5;
      title.y = Math.max(66, height * 0.085);

      finalScoreLabel.x = width * 0.5;
      finalScoreLabel.y = title.y + (54 * uiScale);

      bestComboLabel.x = width * 0.5;
      bestComboLabel.y = finalScoreLabel.y + (42 * uiScale);

      runStatsLabel.x = width * 0.5;
      runStatsLabel.y = bestComboLabel.y + (34 * uiScale);

      usernameLabel.x = width * 0.5;
      usernameLabel.y = runStatsLabel.y + (34 * uiScale);

      submitStatusLabel.x = width * 0.5;
      submitStatusLabel.y = usernameLabel.y + (32 * uiScale);

      const startY = submitStatusLabel.y + (44 * uiScale);
      const spacing = 52 * uiScale;

      buttons.forEach((button, index) => {
        button.scale.set(uiScale);
        button.x = width * 0.5;
        button.y = startY + (index * spacing);
      });
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
