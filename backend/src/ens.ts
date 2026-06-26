import { JsonRpcProvider } from 'ethers';
import type { EnsMetadata } from './scoring/types';

/**
 * Resolves ENS profile metadata for a wallet (mainnet only).
 *
 * Privacy-first (spec FR-06 / 11.3): the caller decides whether to invoke this.
 * Anything that throws degrades to a warning rather than failing the analysis.
 */
export async function resolveEns(
  address: string,
  mainnetRpcUrl: string | undefined,
): Promise<{ ens: EnsMetadata | null; warnings: string[] }> {
  const warnings: string[] = [];
  if (!mainnetRpcUrl) {
    return { ens: null, warnings: ['ENS lookup skipped: no mainnet RPC configured.'] };
  }

  try {
    const provider = new JsonRpcProvider(mainnetRpcUrl);
    const name = await provider.lookupAddress(address);
    if (!name) return { ens: null, warnings: [] };

    const resolver = await provider.getResolver(name);
    const [avatar, url, github] = await Promise.all([
      provider.getAvatar(name).catch(() => null),
      resolver?.getText('url').catch(() => null) ?? null,
      resolver?.getText('com.github').catch(() => null) ?? null,
    ]);

    const ens: EnsMetadata = { name };
    if (avatar) ens.avatar = avatar;
    if (url) ens.url = url;
    if (github) ens.github = github;
    return { ens, warnings };
  } catch (err) {
    warnings.push(`ENS lookup failed: ${(err as Error).message}`);
    return { ens: null, warnings };
  }
}
