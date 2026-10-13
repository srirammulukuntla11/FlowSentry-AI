import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRiskScore,
  deduplicateFindings,
  SEVERITY_WEIGHTS,
  RISK_THRESHOLDS
} from '../src/security/riskScore.js';

test('RISK SCORE: Zero findings returns score 0 and Minimal Risk', () => {
  const result = calculateRiskScore([]);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'Minimal Risk');
  assert.equal(result.category, 'minimal');
  assert.equal(result.breakdown.totalDeduplicated, 0);
  assert.match(result.explanation, /Zero security policy violations/i);
});

test('RISK SCORE: Handles null or non-array findings safely', () => {
  const resNull = calculateRiskScore(null);
  assert.equal(resNull.score, 0);
  assert.equal(resNull.level, 'Minimal Risk');

  const resUndefined = calculateRiskScore(undefined);
  assert.equal(resUndefined.score, 0);
});

test('RISK SCORE: Correctly applies severity weights', () => {
  assert.equal(SEVERITY_WEIGHTS.high, 30);
  assert.equal(SEVERITY_WEIGHTS.medium, 15);
  assert.equal(SEVERITY_WEIGHTS.low, 5);
  assert.equal(SEVERITY_WEIGHTS.info, 1);

  // Single High finding
  const resHigh = calculateRiskScore([{ id: 'f-1', severity: 'high' }]);
  assert.equal(resHigh.score, 30);
  assert.equal(resHigh.level, 'Medium Risk'); // 30 is in 30-69

  // Single Medium finding
  const resMed = calculateRiskScore([{ id: 'f-2', severity: 'medium' }]);
  assert.equal(resMed.score, 15);
  assert.equal(resMed.level, 'Low Risk');

  // Single Low finding
  const resLow = calculateRiskScore([{ id: 'f-3', severity: 'low' }]);
  assert.equal(resLow.score, 5);
  assert.equal(resLow.level, 'Low Risk');

  // Single Info finding
  const resInfo = calculateRiskScore([{ id: 'f-4', severity: 'info' }]);
  assert.equal(resInfo.score, 1);
  assert.equal(resInfo.level, 'Low Risk');
});

test('RISK SCORE: Deduplicates findings by stable finding ID', () => {
  const duplicates = [
    { id: 'finding_secret_1', severity: 'high' },
    { id: 'finding_secret_1', severity: 'high' }, // exact duplicate
    { id: 'finding_secret_1', severity: 'high' }  // exact duplicate
  ];

  const deduped = deduplicateFindings(duplicates);
  assert.equal(deduped.length, 1);

  const result = calculateRiskScore(duplicates);
  assert.equal(result.score, 30); // 1x 30, not 3x 30 = 90
  assert.equal(result.breakdown.totalDeduplicated, 1);
  assert.equal(result.breakdown.high, 1);
});

test('RISK SCORE: Deduplicates findings by fallback composite key when ID is missing', () => {
  const findingsWithoutId = [
    { ruleId: 'FS-SEC-001', affectedNodeIds: ['node_1'], severity: 'high' },
    { ruleId: 'FS-SEC-001', affectedNodeIds: ['node_1'], severity: 'high' }, // duplicate composite
    { ruleId: 'FS-SEC-002', affectedNodeIds: ['node_2'], severity: 'medium' }
  ];

  const deduped = deduplicateFindings(findingsWithoutId);
  assert.equal(deduped.length, 2);

  const result = calculateRiskScore(findingsWithoutId);
  assert.equal(result.score, 45); // 30 + 15
  assert.equal(result.breakdown.totalDeduplicated, 2);
});

test('RISK SCORE: Clamps maximum score to 100', () => {
  // 5 high findings would be 5 * 30 = 150 points
  const manyHigh = [
    { id: 'h1', severity: 'high' },
    { id: 'h2', severity: 'high' },
    { id: 'h3', severity: 'high' },
    { id: 'h4', severity: 'high' },
    { id: 'h5', severity: 'high' }
  ];

  const result = calculateRiskScore(manyHigh);
  assert.equal(result.score, 100);
  assert.equal(result.level, 'High Risk');
  assert.equal(result.category, 'high');
});

test('RISK SCORE: Threshold boundaries match requirements', () => {
  // Score 0: Minimal
  assert.equal(calculateRiskScore([]).level, 'Minimal Risk');

  // Score 1 - 29: Low Risk
  const lowFindings = [
    { id: 'l1', severity: 'low' },    // 5
    { id: 'l2', severity: 'low' },    // 5
    { id: 'l3', severity: 'medium' }  // 15 = 25 total
  ];
  assert.equal(calculateRiskScore(lowFindings).score, 25);
  assert.equal(calculateRiskScore(lowFindings).level, 'Low Risk');

  // Score 30 - 69: Medium Risk
  const medFindings = [
    { id: 'm1', severity: 'high' },   // 30
    { id: 'm2', severity: 'medium' }  // 15 = 45 total
  ];
  assert.equal(calculateRiskScore(medFindings).score, 45);
  assert.equal(calculateRiskScore(medFindings).level, 'Medium Risk');

  // Score 70 - 100: High Risk
  const highFindings = [
    { id: 'hf1', severity: 'high' },   // 30
    { id: 'hf2', severity: 'high' },   // 30
    { id: 'hf3', severity: 'medium' }  // 15 = 75 total
  ];
  assert.equal(calculateRiskScore(highFindings).score, 75);
  assert.equal(calculateRiskScore(highFindings).level, 'High Risk');
});

test('RISK SCORE: Risky Sample findings produce deterministic High Risk score', () => {
  // 1 High (30) + 3 Medium (45) + 1 Low (5) + 1 Info (1) = 81
  const riskyFindings = [
    { id: 'FS-SEC-001', severity: 'high' },
    { id: 'FS-SEC-002', severity: 'medium' },
    { id: 'FS-SEC-003', severity: 'medium' },
    { id: 'FS-SEC-004', severity: 'medium' },
    { id: 'FS-SEC-005', severity: 'low' },
    { id: 'FS-SEC-006', severity: 'info' }
  ];

  const result = calculateRiskScore(riskyFindings);
  assert.equal(result.score, 81);
  assert.equal(result.level, 'High Risk');
  assert.equal(result.category, 'high');
  assert.match(result.disclaimer, /Indicative heuristic/i);
});
