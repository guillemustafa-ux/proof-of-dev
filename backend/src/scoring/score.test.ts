import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreProfile, tierFor } from './score';
import type { ContractDeployment, EnsMetadata } from './types';

const DAY = 86_400;
const NOW = 1_700_000_000;

function deployment(daysAgo: number, isVerified: boolean): ContractDeployment {
  return {
    contractAddress: '0x' + '1'.repeat(40),
    transactionHash: '0x' + 'a'.repeat(64),
    blockNumber: 1,
    timestamp: NOW - daysAgo * DAY,
    isVerified,
  };
}

// Reproduces the worked example from spec section 7.4:
//   5 deployments older than 30 days, 3 verified, ENS with avatar + GitHub.
//   => contract 5*5*1.2=30, verified 3*10*1.2=36, ownership 2, metadata 6 = 74 (Prolific)
test('reproduces the spec section 7.4 worked example (74 -> Prolific)', () => {
  // Spaced 10 days apart so no 7-day burst window is triggered.
  const deployments: ContractDeployment[] = [
    deployment(90, true),
    deployment(80, true),
    deployment(70, true),
    deployment(60, false),
    deployment(50, false),
  ];
  const ens: EnsMetadata = { name: 'example.eth', avatar: 'https://img', github: 'username' };

  const p = scoreProfile(deployments, ens, NOW);

  assert.equal(p.breakdown.contractDeployments, 30);
  assert.equal(p.breakdown.verifiedContracts, 36);
  assert.equal(p.breakdown.ensOwnership, 2);
  assert.equal(p.breakdown.ensMetadata, 6);
  assert.equal(p.score, 74);
  assert.equal(p.tier, 'Prolific');
  assert.equal(p.summary.hasENS, true);
});

test('no activity scores 0 / No Activity', () => {
  const p = scoreProfile([], null, NOW);
  assert.equal(p.score, 0);
  assert.equal(p.tier, 'No Activity');
});

test('recent activity (<=30d) is down-weighted to 0.8x', () => {
  const p = scoreProfile([deployment(10, false)], null, NOW);
  // 5 * 0.8 = 4
  assert.equal(p.breakdown.contractDeployments, 4);
  assert.equal(p.tier, 'Early Activity');
});

test('deployment cap: only first 10 deployments are scored', () => {
  const many: ContractDeployment[] = [];
  for (let i = 0; i < 15; i++) many.push(deployment(200 - i * 9, false));
  const p = scoreProfile(many, null, NOW);
  // 10 established deployments * 5 * 1.2 = 60
  assert.equal(p.breakdown.contractDeployments, 60);
  assert.equal(p.cappedAt, 10);
  assert.ok(p.warnings.some((w) => w.includes('first 10 deployments')));
});

test('burst deployments (>=3 within 7 days) are down-weighted', () => {
  // Three deployments within a single 7-day window, all established.
  const burst: ContractDeployment[] = [
    deployment(60, false),
    deployment(58, false),
    deployment(56, false),
  ];
  const p = scoreProfile(burst, null, NOW);
  // each 5 * 1.2 * 0.8 = 4.8; the 3rd (and the 2nd vs 1st window) flag burst.
  assert.ok(p.warnings.some((w) => w.toLowerCase().includes('burst')));
});

test('tier boundaries match spec section 7.3', () => {
  assert.equal(tierFor(0), 'No Activity');
  assert.equal(tierFor(9), 'Early Activity');
  assert.equal(tierFor(10), 'Active Builder');
  assert.equal(tierFor(29), 'Active Builder');
  assert.equal(tierFor(30), 'Established');
  assert.equal(tierFor(59), 'Established');
  assert.equal(tierFor(60), 'Prolific');
  assert.equal(tierFor(99), 'Prolific');
  assert.equal(tierFor(100), 'Extensive');
});
