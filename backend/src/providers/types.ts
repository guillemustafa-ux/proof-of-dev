import type { ContractDeployment } from '../scoring/types';

export type Network = 'mainnet' | 'sepolia';

export const CHAIN_IDS: Record<Network, number> = {
  mainnet: 1,
  sepolia: 11155111,
};

/**
 * Source of contract-deployment activity for a wallet.
 *
 * The spec ranks Alchemy as primary with Etherscan fallback (FR-03/FR-04).
 * This interface is that seam: `EtherscanProvider` is implemented end-to-end
 * here; an `AlchemyProvider` is a drop-in behind the same contract and can be
 * composed as `new FallbackProvider([alchemy, etherscan])` in production.
 */
export interface DeploymentProvider {
  readonly name: string;
  getDeployments(address: string, network: Network): Promise<ContractDeployment[]>;
}
