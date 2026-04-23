import type { GameSessionState } from '../state/game-session';

export function consumeComboMultiplierOnHit(session: GameSessionState): number {
  const comboMultiplier = session.combo;
  session.bestCombo = Math.max(session.bestCombo, comboMultiplier);
  session.combo += 1;
  return comboMultiplier;
}

export function resetComboOnMiss(session: GameSessionState): void {
  session.combo = 1;
}
