# Proof of Dev — vertical slice

A working slice of the **Proof of Dev** spec (StableNaira, *On-Chain Developer
Reputation System*): a soulbound ERC-721 reputation token plus the deterministic
scoring engine and the real on-chain data path that feeds it.

This is intentionally a **vertical slice**, not the full platform — it proves the
load-bearing parts end to end (the smart contract, the deterministic scorer, and
live blockchain data) without re-implementing every "Should"-priority feature.
What's deferred is listed explicitly below.

---

## What's implemented

| Spec area | Status | Where |
|---|---|---|
| `ProofOfDev.sol` — soulbound ERC-721, one-per-address, on-chain metadata (§10) | ✅ Full + tests | [`contracts/src/ProofOfDev.sol`](contracts/src/ProofOfDev.sol) |
| Attester-gated minting (EIP-712) so scores can't be self-reported | ✅ | same |
| Deterministic scoring engine (§7, Appendix B) | ✅ + fixture tests | [`backend/src/scoring/`](backend/src/scoring/) |
| Reproduces the spec's worked example (74 → "Prolific") | ✅ verified in CI test | [`score.test.ts`](backend/src/scoring/score.test.ts) |
| Contract-deployment discovery + verification status (FR-02/FR-05) | ✅ Etherscan path | [`backend/src/providers/etherscan.ts`](backend/src/providers/etherscan.ts) |
| `POST /api/analyze` with validation + graceful degradation (§9.1, FR-01) | ✅ | [`backend/src/server.ts`](backend/src/server.ts) |
| ENS metadata, consent-gated, mainnet-only (FR-06, §11.3) | ✅ | [`backend/src/ens.ts`](backend/src/ens.ts) |
| Backend↔contract attestation bridge (signs what the contract verifies) | ✅ | [`backend/src/attest.ts`](backend/src/attest.ts) |

## Deferred (Should-priority / phase 2)

- Next.js + RainbowKit/Wagmi front-end (analysis dashboard + mint flow).
- Alchemy as **primary** provider with Etherscan fallback — the `DeploymentProvider`
  seam is already in place; Alchemy is a drop-in implementation behind it.
- EAS delegated attestations (`POST /api/attest`) and `GET /api/token/[id]`.
- Axjet worker queue and optional MongoDB persistence (both "Should"/optional in the spec).

These are scoped, not hard — happy to complete them on engagement.

---

## Key design decisions

- **Scores are attested, not self-reported.** A wallet can only mint with an
  EIP-712 signature from the off-chain `attester` over
  `(to, score, contractCount, verifiedCount)`. This closes the obvious hole in a
  "reputation NFT" — without it, anyone could mint a 100/Extensive token. It maps
  directly to the spec's server-side `ATTESTER_PRIVATE_KEY` and delegated-attestation
  model. See `test_RevertWhen_ScoreTamperedAfterSigning`.
- **The scorer is pure and clock-injected.** `now` is a parameter, never read from
  the system clock, so a given wallet snapshot always produces the same score —
  the property that makes the on-chain attestation auditable.
- **Provider failures degrade to warnings.** A down Etherscan/RPC yields a partial
  result with `warnings[]`, not a 500 (spec §13 Reliability, §8.2).
- **Soulbound via OZ v5 `_update`.** Mint and burn allowed; all transfers revert.

---

## Live on Sepolia

Deployed, verified and exercised for real on 2026-07-10:

| What | Evidence |
|---|---|
| `ProofOfDev` (soulbound ERC-721) | [`0x1Aa022E917d4Fb9BD6d5816671e99A47D2E16F38` — verified](https://sepolia.etherscan.io/address/0x1Aa022E917d4Fb9BD6d5816671e99A47D2E16F38#code) |
| Real attested mint — the spec's worked example (score **74**, 5 contracts, 3 verified) signed EIP-712 by the attester and minted as token #1 | [tx `0x8c3d8bcd…1047e9`](https://sepolia.etherscan.io/tx/0x8c3d8bcdd7aac58287bc76a359d54dfc933b716e645f50aff2bdf6ae521047e9) |

Tests: 9 Foundry (contract) + 6 node (deterministic scorer, reproduces the 74 → "Prolific" example).

## Run it

### Smart contract (Foundry)

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 foundry-rs/forge-std
forge test -vvv
```

Deploy + verify on Sepolia (fill `contracts/.env` from `.env.example` first):

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url sepolia --broadcast --verify -vvvv
```

### Backend (Node + TypeScript)

```bash
cd backend
npm install
npm test          # deterministic scorer — reproduces the spec's 74 -> Prolific example
npm run typecheck

cp .env.example .env   # add ETHERSCAN_API_KEY (+ MAINNET_RPC_URL for ENS)
npm run analyze -- 0xYourWallet sepolia   # live analysis from the terminal
npm run dev                               # POST /api/analyze on :8000
```

Example request:

```bash
curl -s localhost:8000/api/analyze \
  -H 'content-type: application/json' \
  -d '{"address":"0x...","network":"sepolia","includeENS":false}' | jq
```

The response matches spec §9.1: `address`, `ens`, `contracts[]`, and a `profile`
with `score`, `tier`, a `breakdown`, `explanations`, and `warnings`.
