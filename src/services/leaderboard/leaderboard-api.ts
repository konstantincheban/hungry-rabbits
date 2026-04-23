import type { LeaderboardEntry, LeaderboardSubmission } from '../../types/leaderboard';

export interface LeaderboardApi {
  getTopEntries(limit: number): Promise<LeaderboardEntry[]>;
  submitEntry(entry: LeaderboardSubmission): Promise<void>;
}
