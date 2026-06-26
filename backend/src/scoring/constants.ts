// Scoring constants — verbatim from "Proof of Dev" spec, Appendix B.
// These are the single source of truth for the deterministic scorer.

export const POINTS = {
  CONTRACT_DEPLOYMENT: 5,
  VERIFIED_CONTRACT: 10,
  ENS_OWNERSHIP: 2,
  ENS_METADATA: 3,
} as const;

export const CAPS = {
  MAX_DEPLOYMENTS_SCORED: 10,
  MAX_VERIFIED_SCORED: 10,
  BURST_THRESHOLD: 3,
  BURST_WINDOW_SECONDS: 7 * 24 * 60 * 60,
} as const;

export const TIME = {
  ESTABLISHED_THRESHOLD_SECONDS: 30 * 24 * 60 * 60,
  ESTABLISHED_MULTIPLIER: 1.2,
  RECENT_BURST_MULTIPLIER: 0.8,
} as const;
