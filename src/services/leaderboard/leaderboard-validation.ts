import type { LeaderboardSubmission } from '../../types/leaderboard';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 16;

export function sanitizeUsername(username: string): string {
  return username.trim();
}

export function validateUsername(username: string): string | null {
  const trimmed = sanitizeUsername(username);

  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return `Нік має містити ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} символів.`;
  }

  return null;
}

export function validateScore(score: number): string | null {
  if (!Number.isInteger(score) || score < 0) {
    return 'Рахунок має бути цілим числом >= 0.';
  }

  return null;
}

export function validateSubmission(submission: LeaderboardSubmission): string | null {
  const usernameError = validateUsername(submission.username);
  if (usernameError) {
    return usernameError;
  }

  const scoreError = validateScore(submission.score);
  if (scoreError) {
    return scoreError;
  }

  return null;
}
