import { CHAIN_IDS, type DeploymentProvider, type Network } from './types';
import type { ContractDeployment } from '../scoring/types';

const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';

interface EtherscanTx {
  to: string;
  from: string;
  hash: string;
  blockNumber: string;
  timeStamp: string;
  contractAddress: string;
  isError: string;
}

/**
 * Etherscan-backed deployment provider (real, working path).
 *
 * 1. `account/txlist` -> contract-creation txs are those where `to` is empty;
 *    the created address is in `contractAddress`.
 * 2. `contract/getsourcecode` -> a non-empty `SourceCode` means verified.
 *
 * Respects FR-02/FR-05 (deployment fields + verification status). Verification
 * lookups are bounded and throttled to stay under the free-tier rate limit.
 */
export class EtherscanProvider implements DeploymentProvider {
  readonly name = 'etherscan';
  private readonly maxVerificationChecks: number;

  constructor(
    private readonly apiKey: string,
    opts: { maxVerificationChecks?: number } = {},
  ) {
    if (!apiKey) throw new Error('EtherscanProvider requires an API key');
    this.maxVerificationChecks = opts.maxVerificationChecks ?? 25;
  }

  async getDeployments(address: string, network: Network): Promise<ContractDeployment[]> {
    const chainId = CHAIN_IDS[network];
    const txs = await this.txlist(address, chainId);

    const creations = txs.filter(
      (t) => (t.to === '' || t.to === null) && t.contractAddress && t.isError === '0',
    );

    const deployments: ContractDeployment[] = creations.map((t) => ({
      contractAddress: t.contractAddress,
      transactionHash: t.hash,
      blockNumber: Number(t.blockNumber),
      timestamp: Number(t.timeStamp),
      isVerified: false,
    }));

    // Verification status, bounded + throttled.
    const toCheck = deployments.slice(0, this.maxVerificationChecks);
    for (const d of toCheck) {
      d.isVerified = await this.isVerified(d.contractAddress, chainId);
      await sleep(220); // ~4-5 req/s free-tier ceiling
    }

    return deployments;
  }

  private async txlist(address: string, chainId: number): Promise<EtherscanTx[]> {
    const url =
      `${ETHERSCAN_V2}?chainid=${chainId}&module=account&action=txlist` +
      `&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${this.apiKey}`;
    const json = await fetchJson(url);
    // status "0" with "No transactions found" is a valid empty result, not an error.
    if (json.status === '1' && Array.isArray(json.result)) return json.result as EtherscanTx[];
    if (json.status === '0' && /no transactions/i.test(String(json.message))) return [];
    throw new Error(`Etherscan txlist error: ${json.message ?? 'unknown'} (${json.result ?? ''})`);
  }

  private async isVerified(contractAddress: string, chainId: number): Promise<boolean> {
    const url =
      `${ETHERSCAN_V2}?chainid=${chainId}&module=contract&action=getsourcecode` +
      `&address=${contractAddress}&apikey=${this.apiKey}`;
    const json = await fetchJson(url);
    const source = Array.isArray(json.result) ? json.result[0]?.SourceCode : '';
    return typeof source === 'string' && source.trim().length > 0;
  }
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Etherscan HTTP ${res.status}`);
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
