import express from 'express';
import type { Request, Response } from 'express';
import { analyzeWallet, ValidationError } from './analyze';
import { EtherscanProvider } from './providers/etherscan';

const PORT = Number(process.env.PORT ?? 8000);
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? '';
const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL;

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// POST /api/analyze  (spec section 9.1)
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    if (!ETHERSCAN_API_KEY) {
      return res.status(500).json({ error: 'Server missing ETHERSCAN_API_KEY.' });
    }
    const { address, network, includeENS } = req.body ?? {};

    const provider = new EtherscanProvider(ETHERSCAN_API_KEY);
    const result = await analyzeWallet(
      { address, network, includeENS: Boolean(includeENS) },
      { provider, mainnetRpcUrl: MAINNET_RPC_URL },
    );

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: `Analysis pipeline failure: ${(err as Error).message}` });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proof of Dev API listening on :${PORT}`);
});
