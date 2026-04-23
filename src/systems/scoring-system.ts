import type { GameSessionState } from '../state/game-session';
import type { RabbitType } from '../types/game';

export function getBasePoints(type: RabbitType): number {
  return type === 'golden' ? 3 : 1;
}

export function applyHitScore(
  session: GameSessionState,
  rabbitType: RabbitType,
  comboMultiplier: number,
): number {
  const gainedScore = getBasePoints(rabbitType) * comboMultiplier;
  session.score += gainedScore;
  return gainedScore;
}
