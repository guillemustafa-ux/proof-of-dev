import { Wallet } from 'ethers';
import type { Network } from './providers/types';
import { CHAIN_IDS } from './providers/types';

/**
 * Signs the EIP-712 mint attestation the ProofOfDev contract verifies.
 *
 * This is the bridge between the deterministic backend score and the on-chain
 * token: the attester key signs (to, score, contractCount, verifiedCount); only
 * a matching signature lets that wallet mint with that score. The domain/types
 * here MUST match `ProofOfDev`'s EIP712("ProofOfDev","1") and MINT_TYPEHASH.
 */
export interface MintAttestation {
  to: string;
  score: number;
  contractCount: number;
  verifiedCount: number;
}

export async function signMintAttestation(
  attesterPrivateKey: string,
  contractAddress: string,
  network: Network,
  data: MintAttestation,
): Promise<string> {
  const wallet = new Wallet(attesterPrivateKey);

  const domain = {
    name: 'ProofOfDev',
    version: '1',
    chainId: CHAIN_IDS[network],
    verifyingContract: contractAddress,
  };

  const types = {
    Mint: [
      { name: 'to', type: 'address' },
      { name: 'score', type: 'uint256' },
      { name: 'contractCount', type: 'uint256' },
      { name: 'verifiedCount', type: 'uint256' },
    ],
  };

  return wallet.signTypedData(domain, types, data);
}
