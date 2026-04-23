import {
  addDoc,
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import type { LeaderboardApi } from './leaderboard-api';
import type { LeaderboardEntry, LeaderboardSubmission } from '../../types/leaderboard';
import { getFirestoreDb } from '../firebase/firestore';
import { sanitizeUsername, validateSubmission } from './leaderboard-validation';

const LEADERBOARD_COLLECTION = 'leaderboard';
const NETWORK_TIMEOUT_MS = 8000;

interface FirebaseErrorLike {
  code?: string;
  message?: string;
}

export class FirestoreLeaderboardApi implements LeaderboardApi {
  public async getTopEntries(limit: number): Promise<LeaderboardEntry[]> {
    const db = getFirestoreDb();

    if (!db) {
      throw new Error('Firebase не налаштовано.');
    }

    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));

    const leaderboardQuery = query(
      collection(db, LEADERBOARD_COLLECTION),
      orderBy('score', 'desc'),
      firestoreLimit(safeLimit),
    );

    try {
      const snapshot = await withTimeout(getDocs(leaderboardQuery), NETWORK_TIMEOUT_MS);
      return snapshot.docs.map((doc) => this.toEntry(doc));
    } catch (error) {
      throw new Error(this.mapNetworkError(error, 'завантаження рейтингу'));
    }
  }

  public async submitEntry(submission: LeaderboardSubmission): Promise<void> {
    const db = getFirestoreDb();

    if (!db) {
      throw new Error('Firebase не налаштовано.');
    }

    const validationError = validateSubmission(submission);
    if (validationError) {
      throw new Error(validationError);
    }

    const payload: LeaderboardEntry = {
      username: sanitizeUsername(submission.username),
      score: Math.floor(submission.score),
      createdAt: new Date().toISOString(),
    };

    try {
      await withTimeout(addDoc(collection(db, LEADERBOARD_COLLECTION), payload), NETWORK_TIMEOUT_MS);
    } catch (error) {
      throw new Error(this.mapNetworkError(error, 'надсилання рахунку'));
    }
  }

  private toEntry(snapshot: QueryDocumentSnapshot<DocumentData>): LeaderboardEntry {
    const data = snapshot.data();

    return {
      username: typeof data.username === 'string' ? data.username : 'Невідомо',
      score: typeof data.score === 'number' && Number.isFinite(data.score)
        ? Math.max(0, Math.floor(data.score))
        : 0,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString(),
    };
  }

  private mapNetworkError(error: unknown, action: string): string {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
      return 'Немає з’єднання з мережею. Підключіться й спробуйте ще раз.';
    }

    const firebaseError = error as FirebaseErrorLike;
    const code = firebaseError?.code ?? '';

    if (code.includes('permission-denied')) {
      return 'Доступ заборонено правилами Firestore. Перевірте налаштування Firebase.';
    }

    if (code.includes('unavailable') || code.includes('deadline-exceeded')) {
      return 'Сервіс рейтингу тимчасово недоступний. Спробуйте ще раз.';
    }

    if (code.includes('failed-precondition')) {
      return 'Firestore ще не готовий. Переконайтесь, що база створена та проіндексована.';
    }

    if (code.includes('resource-exhausted')) {
      return 'Ліміт сервісу рейтингу вичерпано. Спробуйте пізніше.';
    }

    if (error instanceof Error && error.message.includes('timeout')) {
      return `Час очікування запиту вичерпано під час дії: ${action}.`;
    }

    return `Не вдалося виконати дію: ${action}. Спробуйте ще раз.`;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
