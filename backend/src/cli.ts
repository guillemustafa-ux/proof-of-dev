import { analyzeWallet } from './analyze';
import { EtherscanProvider } from './providers/etherscan';

/**
 * Quick terminal demo without the HTTP server:
 *   npm run analyze -- 0xYourWallet sepolia
 * Requires ETHERSCAN_API_KEY (and MAINNET_RPC_URL for ENS on mainnet).
 */
async function main() {
  const address = process.argv[2];
  const network = (process.argv[3] ?? 'sepolia') as 'mainnet' | 'sepolia';
  const includeENS = network === 'mainnet';

  if (!address) {
    console.error('Usage: npm run analyze -- <address> <mainnet|sepolia>');
    process.exit(1);
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    console.error('Set ETHERSCAN_API_KEY first.');
    process.exit(1);
  }

  const result = await analyzeWallet(
    { address, network, includeENS },
    { provider: new EtherscanProvider(apiKey), mainnetRpcUrl: process.env.MAINNET_RPC_URL },
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
