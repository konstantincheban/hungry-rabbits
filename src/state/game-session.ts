export interface GameSessionState {
  ammo: number;
  score: number;
  combo: number;
  bestCombo: number;
  shotsFired: number;
  hits: number;
  misses: number;
}

export interface GameRunSummary {
  score: number;
  bestCombo: number;
  shotsFired: number;
  hits: number;
  misses: number;
}

let latestGameRunSummary: GameRunSummary | null = null;

export function createInitialSessionState(initialAmmo = 30): GameSessionState {
  return {
    ammo: initialAmmo,
    score: 0,
    combo: 1,
    bestCombo: 1,
    shotsFired: 0,
    hits: 0,
    misses: 0,
  };
}

export function createRunSummary(state: GameSessionState): GameRunSummary {
  return {
    score: state.score,
    bestCombo: state.bestCombo,
    shotsFired: state.shotsFired,
    hits: state.hits,
    misses: state.misses,
  };
}

export function setLatestGameRunSummary(summary: GameRunSummary): void {
  latestGameRunSummary = summary;
}

export function getLatestGameRunSummary(): GameRunSummary | null {
  return latestGameRunSummary;
}
