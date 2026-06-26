import { POINTS, CAPS, TIME } from './constants';
import type {
  ContractDeployment,
  EnsMetadata,
  ReputationProfile,
  ReputationTier,
} from './types';

/**
 * Deterministic Proof of Dev reputation scorer (spec section 7).
 *
 * Pure and side-effect free: identical inputs always produce an identical
 * score, which is what makes the on-chain attestation auditable. `now` is
 * injected (never read from the clock) so the same fixture is reproducible
 * forever — see score.test.ts, which reproduces the spec's worked example
 * (74 points -> "Prolific").
 */
export function scoreProfile(
  deployments: ContractDeployment[],
  ens: EnsMetadata | null,
  now: number,
): ReputationProfile {
  const warnings: string[] = [];
  const explanations: string[] = [];

  // Chronological order; "first N" caps apply to the earliest activity.
  const sorted = [...deployments].sort((a, b) => a.timestamp - b.timestamp);

  const burstFlags = computeBurstFlags(sorted);

  // --- Deployment points (first 10 deployments) ---
  const scoredDeployments = sorted.slice(0, CAPS.MAX_DEPLOYMENTS_SCORED);
  let deploymentRaw = 0;
  let deploymentBase = 0;
  scoredDeployments.forEach((d, i) => {
    const mult = timeMultiplier(d.timestamp, now, burstFlags[i]);
    deploymentBase += POINTS.CONTRACT_DEPLOYMENT;
    deploymentRaw += POINTS.CONTRACT_DEPLOYMENT * mult;
  });

  // --- Verified points (first 10 verified deployments) ---
  const verified = sorted.filter((d) => d.isVerified);
  const scoredVerified = verified.slice(0, CAPS.MAX_VERIFIED_SCORED);
  let verifiedRaw = 0;
  let verifiedBase = 0;
  scoredVerified.forEach((d) => {
    const burst = burstFlags[sorted.indexOf(d)] ?? false;
    const mult = timeMultiplier(d.timestamp, now, burst);
    verifiedBase += POINTS.VERIFIED_CONTRACT;
    verifiedRaw += POINTS.VERIFIED_CONTRACT * mult;
  });

  const contractDeployments = Math.round(deploymentRaw);
  const verifiedContracts = Math.round(verifiedRaw);

  // --- ENS points ---
  let ensOwnership = 0;
  let ensMetadata = 0;
  if (ens) {
    if (ens.name) ensOwnership += POINTS.ENS_OWNERSHIP;
    if (ens.avatar) ensMetadata += POINTS.ENS_METADATA;
    if (ens.url) ensMetadata += POINTS.ENS_METADATA;
    if (ens.github) ensMetadata += POINTS.ENS_METADATA;
  }

  const score = contractDeployments + verifiedContracts + ensOwnership + ensMetadata;
  const tier = tierFor(score);

  // --- Caps / warnings ---
  let cappedAt: number | null = null;
  if (sorted.length > CAPS.MAX_DEPLOYMENTS_SCORED) {
    cappedAt = CAPS.MAX_DEPLOYMENTS_SCORED;
    warnings.push(
      `Only the first ${CAPS.MAX_DEPLOYMENTS_SCORED} deployments contribute to the score (found ${sorted.length}).`,
    );
  }
  if (verified.length > CAPS.MAX_VERIFIED_SCORED) {
    warnings.push(
      `Only the first ${CAPS.MAX_VERIFIED_SCORED} verified deployments contribute to the score (found ${verified.length}).`,
    );
  }
  if (burstFlags.some(Boolean)) {
    warnings.push(
      `Burst deployment activity detected (>=${CAPS.BURST_THRESHOLD} within ${CAPS.BURST_WINDOW_SECONDS / 86400} days); affected deployments were down-weighted.`,
    );
  }

  // --- Explanations (spec: every score includes human-readable breakdown) ---
  explanations.push(
    `${scoredDeployments.length} deployment(s) scored at ${POINTS.CONTRACT_DEPLOYMENT} pts each = ${contractDeployments} pts (after time weighting).`,
  );
  explanations.push(
    `${scoredVerified.length} verified contract(s) scored at ${POINTS.VERIFIED_CONTRACT} pts each = ${verifiedContracts} pts (after time weighting).`,
  );
  if (ensOwnership || ensMetadata) {
    explanations.push(`ENS contributed ${ensOwnership + ensMetadata} pts (ownership ${ensOwnership} + metadata ${ensMetadata}).`);
  } else {
    explanations.push('No ENS data counted (not provided or consent withheld).');
  }
  explanations.push(`Total score ${score} -> tier "${tier}".`);

  return {
    summary: {
      contractCount: sorted.length,
      verifiedContractCount: verified.length,
      hasENS: Boolean(ens?.name),
      ensName: ens?.name ?? null,
      tier,
    },
    score,
    tier,
    breakdown: {
      contractDeployments,
      verifiedContracts,
      ensOwnership,
      ensMetadata,
      timeMultiplierBonus: Math.round(deploymentRaw - deploymentBase + (verifiedRaw - verifiedBase)),
    },
    cappedAt,
    explanations,
    warnings,
  };
}

/** Established (>30d) => 1.2x, recent (<=30d) => 0.8x, burst => additional 0.8x. */
function timeMultiplier(timestamp: number, now: number, isBurst: boolean): number {
  const age = now - timestamp;
  const base =
    age > TIME.ESTABLISHED_THRESHOLD_SECONDS
      ? TIME.ESTABLISHED_MULTIPLIER
      : TIME.RECENT_BURST_MULTIPLIER;
  return isBurst ? base * TIME.RECENT_BURST_MULTIPLIER : base;
}

/**
 * Marks a deployment as bursty when its trailing BURST_WINDOW (7d) contains at
 * least BURST_THRESHOLD (3) deployments, including itself. Deterministic and
 * order-independent given a chronologically sorted input.
 */
function computeBurstFlags(sorted: ContractDeployment[]): boolean[] {
  return sorted.map((d, i) => {
    let count = 0;
    for (let j = 0; j <= i; j++) {
      if (d.timestamp - sorted[j].timestamp <= CAPS.BURST_WINDOW_SECONDS) count++;
    }
    return count >= CAPS.BURST_THRESHOLD;
  });
}

/** Reputation tiers — spec section 7.3. */
export function tierFor(score: number): ReputationTier {
  if (score <= 0) return 'No Activity';
  if (score <= 9) return 'Early Activity';
  if (score <= 29) return 'Active Builder';
  if (score <= 59) return 'Established';
  if (score <= 99) return 'Prolific';
  return 'Extensive';
}
