import { Container } from 'pixi.js';
import { SCENES } from '../../app/constants';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { isFirebaseConfigured } from '../../services/firebase/app';
import { FirestoreLeaderboardApi } from '../../services/leaderboard/firestore-leaderboard-api';
import { audioSystem } from '../../systems/audio-system';
import type { LeaderboardEntry } from '../../types/leaderboard';
import { createTextButton } from '../../ui/button';
import { createBodyLabel, createTitleLabel } from '../shared/base-label';

const LEADERBOARD_CACHE_KEY = 'hungry-rabbits:leaderboard-cache-v1';

interface LeaderboardCache {
  entries: LeaderboardEntry[];
  fetchedAt: string;
}

export function createLeaderboardScene({ sceneController }: SceneContext): Scene {
  const container = new Container();
  const leaderboardApi = new FirestoreLeaderboardApi();

  const title = createTitleLabel('Рейтинг');
  const subtitle = createBodyLabel('Топ-10 за весь час', 20);
  const statusLabel = createBodyLabel('', 16);
  const entriesLabel = createBodyLabel('Завантаження...', 20);

  const refreshButton = createTextButton({
    label: 'Оновити',
    onPress: () => {
      void loadTopEntries(true);
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

  const gameButton = createTextButton({
    label: 'До гри',
    onPress: () => {
      void sceneController.changeScene(SCENES.GAME);
    },
    fontSize: 24,
  });

  container.addChild(title, subtitle, statusLabel, entriesLabel, refreshButton, startButton, gameButton);

  let loading = false;
  let sceneActive = false;

  function setLoadingState(nextLoading: boolean): void {
    loading = nextLoading;
    refreshButton.setEnabled(!nextLoading);
    refreshButton.setLabel(nextLoading ? 'Завантаження...' : 'Оновити');
  }

  function formatEntries(entries: LeaderboardEntry[]): string {
    if (entries.length === 0) {
      return 'Ще немає результатів.\nСтань першим!';
    }

    return entries
      .map((entry, index) => {
        const rank = `${index + 1}.`.padEnd(4, ' ');
        const username = entry.username.slice(0, 16).padEnd(16, ' ');
        return `${rank}${username} ${entry.score}`;
      })
      .join('\n');
  }

  function readCache(): LeaderboardCache | null {
    try {
      const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<LeaderboardCache>;

      if (!Array.isArray(parsed.entries) || typeof parsed.fetchedAt !== 'string') {
        return null;
      }

      const entries = parsed.entries
        .map((entry) => sanitizeCachedEntry(entry))
        .filter((entry): entry is LeaderboardEntry => entry !== null);

      return {
        entries,
        fetchedAt: parsed.fetchedAt,
      };
    } catch {
      return null;
    }
  }

  function writeCache(entries: LeaderboardEntry[]): void {
    try {
      const payload: LeaderboardCache = {
        entries,
        fetchedAt: new Date().toISOString(),
      };

      localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore cache write failure.
    }
  }

  function formatCachedDate(isoDate: string): string {
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'невідомий час';
    }

    return parsed.toLocaleString();
  }

  async function loadTopEntries(triggeredByUser = false): Promise<void> {
    if (loading) {
      return;
    }

    if (!isFirebaseConfigured()) {
      const cached = readCache();

      statusLabel.text = 'Firebase не налаштовано. Показуємо локальний кеш, якщо він є.';
      statusLabel.tint = 0xfde68a;
      entriesLabel.text = cached ? formatEntries(cached.entries) : 'Рейтинг недоступний.';
      return;
    }

    setLoadingState(true);
    statusLabel.text = 'Завантаження рейтингу...';
    statusLabel.tint = 0xcbd5e1;

    try {
      const entries = await leaderboardApi.getTopEntries(10);

      if (!sceneActive) {
        return;
      }

      entriesLabel.text = formatEntries(entries);
      statusLabel.text = triggeredByUser
        ? 'Рейтинг оновлено.'
        : 'Показано топ-10 за рахунком.';
      statusLabel.tint = 0xa7f3d0;

      writeCache(entries);
    } catch (error) {
      if (!sceneActive) {
        return;
      }

      audioSystem.play('network-error');

      const message = error instanceof Error
        ? error.message
        : 'Не вдалося завантажити рейтинг.';

      const cached = readCache();

      if (cached) {
        entriesLabel.text = formatEntries(cached.entries);
        statusLabel.text = `${message}\nПоказано кеш від ${formatCachedDate(cached.fetchedAt)}.`;
        statusLabel.tint = 0xfde68a;
      } else {
        entriesLabel.text = 'Не вдалося завантажити рейтинг.';
        statusLabel.text = message;
        statusLabel.tint = 0xfca5a5;
      }
    } finally {
      setLoadingState(false);
    }
  }

  return {
    key: SCENES.LEADERBOARD,
    container,
    onEnter: () => {
      sceneActive = true;
      void loadTopEntries(false);
    },
    onExit: () => {
      sceneActive = false;
      setLoadingState(false);
    },
    onResize: (width, height) => {
      const uiScale = clamp(Math.min(width / 390, height / 860), 0.72, 1);

      title.scale.set(uiScale);
      subtitle.scale.set(uiScale);
      statusLabel.scale.set(uiScale);
      entriesLabel.scale.set(uiScale);

      title.x = width * 0.5;
      title.y = Math.max(64, height * 0.095);

      subtitle.x = width * 0.5;
      subtitle.y = title.y + (46 * uiScale);

      statusLabel.x = width * 0.5;
      statusLabel.y = subtitle.y + (32 * uiScale);

      entriesLabel.x = width * 0.5;
      entriesLabel.y = statusLabel.y + (116 * uiScale);

      refreshButton.scale.set(uiScale);
      startButton.scale.set(uiScale);
      gameButton.scale.set(uiScale);

      refreshButton.x = width * 0.5;
      refreshButton.y = Math.max(height * 0.66, entriesLabel.y + (142 * uiScale));

      startButton.x = width * 0.5;
      startButton.y = refreshButton.y + (52 * uiScale);

      gameButton.x = width * 0.5;
      gameButton.y = startButton.y + (52 * uiScale);
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeCachedEntry(entry: unknown): LeaderboardEntry | null {
  if (typeof entry !== 'object' || entry === null) {
    return null;
  }

  const record = entry as Partial<LeaderboardEntry>;

  if (typeof record.username !== 'string' || typeof record.score !== 'number') {
    return null;
  }

  return {
    username: record.username.slice(0, 16),
    score: Math.max(0, Math.floor(record.score)),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date(0).toISOString(),
  };
}
