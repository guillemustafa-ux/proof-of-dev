import { isAddress } from 'ethers';
import { scoreProfile } from './scoring/score';
import { resolveEns } from './ens';
import type { DeploymentProvider, Network } from './providers/types';
import type { ContractDeployment } from './scoring/types';

export class ValidationError extends Error {}

export interface AnalyzeInput {
  address: string;
  network: Network;
  includeENS: boolean;
}

export interface AnalyzeDeps {
  provider: DeploymentProvider;
  mainnetRpcUrl?: string;
  now?: () => number;
}

const NETWORKS: Network[] = ['mainnet', 'sepolia'];

/** Validates input (FR-01) and returns the full /api/analyze response (section 9.1). */
export async function analyzeWallet(input: AnalyzeInput, deps: AnalyzeDeps) {
  const { address, network, includeENS } = input;

  if (!address || !isAddress(address)) {
    throw new ValidationError('Invalid Ethereum address.');
  }
  if (!NETWORKS.includes(network)) {
    throw new ValidationError(`Unsupported network. Use one of: ${NETWORKS.join(', ')}.`);
  }

  const warnings: string[] = [];

  let deployments: ContractDeployment[] = [];
  try {
    deployments = await deps.provider.getDeployments(address, network);
  } catch (err) {
    // Graceful degradation (spec 8.2 / 13 Reliability): surface, don't crash.
    warnings.push(`Deployment provider (${deps.provider.name}) failed: ${(err as Error).message}`);
  }

  // ENS is mainnet-only and consent-gated (FR-06).
  let ens = null;
  if (includeENS) {
    if (network !== 'mainnet') {
      warnings.push('ENS metadata is only resolved on mainnet; skipped for this network.');
    } else {
      const res = await resolveEns(address, deps.mainnetRpcUrl);
      ens = res.ens;
      warnings.push(...res.warnings);
    }
  }

  const now = Math.floor((deps.now?.() ?? Date.now()) / 1000);
  const profile = scoreProfile(deployments, ens, now);
  profile.warnings.push(...warnings);

  return {
    address,
    ens,
    contracts: deployments,
    profile,
    analyzedAt: now,
    includesENS: Boolean(includeENS && ens),
  };
}
