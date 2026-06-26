// Domain types — aligned with spec Appendix A (Data Models) and section 9.1.

export interface ContractDeployment {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number; // unix seconds
  isVerified: boolean;
}

export interface EnsMetadata {
  name?: string;
  avatar?: string;
  url?: string;
  github?: string;
}

export type ReputationTier =
  | 'No Activity'
  | 'Early Activity'
  | 'Active Builder'
  | 'Established'
  | 'Prolific'
  | 'Extensive';

export interface ReputationBreakdown {
  contractDeployments: number;
  verifiedContracts: number;
  ensOwnership: number;
  ensMetadata: number;
  timeMultiplierBonus: number; // informational: already included in the buckets above
}

export interface ProfileSummary {
  contractCount: number;
  verifiedContractCount: number;
  hasENS: boolean;
  ensName: string | null;
  tier: ReputationTier;
}

export interface ReputationProfile {
  summary: ProfileSummary;
  score: number;
  tier: ReputationTier;
  breakdown: ReputationBreakdown;
  cappedAt: number | null;
  explanations: string[];
  warnings: string[];
}
