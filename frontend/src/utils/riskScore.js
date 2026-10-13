/**
 * FlowSentry AI — Deterministic Workflow Risk Scoring Utility (Frontend)
 *
 * Scoring Formula:
 * 1. Findings are deduplicated by stable finding ID (or ruleId + affected nodes composite).
 * 2. Each unique finding is assigned a severity weight:
 *    - HIGH: 30 points
 *    - MEDIUM: 15 points
 *    - LOW: 5 points
 *    - INFO: 1 point
 * 3. The overall score is the sum of weights, clamped strictly to [0, 100]:
 *    Score = Math.min(100, Math.max(0, sum(weights)))
 *
 * Risk Thresholds:
 * - 0: "Minimal Risk" (Clean / Safe)
 * - 1–29: "Low Risk"
 * - 30–69: "Medium Risk"
 * - 70–100: "High Risk"
 *
 * Disclaimer:
 * Indicative heuristic risk score based on static analysis. Not a certified security rating.
 */

export const SEVERITY_WEIGHTS = {
  high: 30,
  medium: 15,
  low: 5,
  info: 1
};

export const RISK_THRESHOLDS = {
  minimal: { max: 0, level: 'Minimal Risk', category: 'minimal' },
  low: { min: 1, max: 29, level: 'Low Risk', category: 'low' },
  medium: { min: 30, max: 69, level: 'Medium Risk', category: 'medium' },
  high: { min: 70, max: 100, level: 'High Risk', category: 'high' }
};

export const INDICATIVE_DISCLAIMER =
  'Indicative heuristic risk score based on static workflow analysis. Not a certified penetration test rating.';

/**
 * Deduplicates findings array by stable finding ID.
 * Falls back to composite key: `${ruleId}_${affectedNodeIds.sort().join('_')}` if id is missing.
 *
 * @param {Array<object>} findings
 * @returns {Array<object>}
 */
export function deduplicateFindings(findings = []) {
  if (!Array.isArray(findings)) return [];

  const seenKeys = new Set();
  const deduped = [];

  for (const f of findings) {
    if (!f || typeof f !== 'object') continue;

    let key = f.id;
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      const ruleId = f.ruleId || 'unknown_rule';
      const affected = Array.isArray(f.affectedNodeIds) ? [...f.affectedNodeIds].sort().join('_') : '';
      key = `${ruleId}_${affected}`;
    }

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(f);
    }
  }

  return deduped;
}

/**
 * Calculates deterministic overall risk score from findings.
 *
 * @param {Array<object>} findings - List of scan findings
 * @returns {{
 *   score: number,
 *   level: string,
 *   category: 'minimal' | 'low' | 'medium' | 'high',
 *   explanation: string,
 *   breakdown: { high: number, medium: number, low: number, info: number, totalDeduplicated: number },
 *   formula: string,
 *   thresholds: object,
 *   disclaimer: string
 * }}
 */
export function calculateRiskScore(findings = []) {
  const deduped = deduplicateFindings(findings);

  const breakdown = {
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    totalDeduplicated: deduped.length
  };

  let rawScore = 0;

  for (const f of deduped) {
    const sev = (f.severity || '').toLowerCase();
    if (sev === 'high') {
      breakdown.high += 1;
      rawScore += SEVERITY_WEIGHTS.high;
    } else if (sev === 'medium') {
      breakdown.medium += 1;
      rawScore += SEVERITY_WEIGHTS.medium;
    } else if (sev === 'low') {
      breakdown.low += 1;
      rawScore += SEVERITY_WEIGHTS.low;
    } else {
      breakdown.info += 1;
      rawScore += SEVERITY_WEIGHTS.info;
    }
  }

  // Clamped strictly to [0, 100]
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Determine threshold category and explanation
  let level = RISK_THRESHOLDS.minimal.level;
  let category = RISK_THRESHOLDS.minimal.category;
  let explanation = 'No deterministic security policy violations or high-risk heuristics detected.';

  if (score === 0) {
    level = 'Minimal Risk';
    category = 'minimal';
    explanation = 'Zero security policy violations or high-risk heuristics detected. Baseline configuration looks clean.';
  } else if (score <= 29) {
    level = 'Low Risk';
    category = 'low';
    explanation = 'Minor audit suggestions or low-impact credential reviews flagged. Low probability of security compromise.';
  } else if (score <= 69) {
    level = 'Medium Risk';
    category = 'medium';
    explanation = 'Moderate security risks detected, such as external data flows or destructive queries requiring review.';
  } else {
    level = 'High Risk';
    category = 'high';
    explanation = 'Critical security vulnerabilities detected, such as hardcoded secrets or multiple combined risk vectors.';
  }

  const formula = `Weighted sum: High(${breakdown.high}x30) + Med(${breakdown.medium}x15) + Low(${breakdown.low}x5) + Info(${breakdown.info}x1) = ${rawScore} (clamped to max 100)`;

  return {
    score,
    level,
    category,
    explanation,
    breakdown,
    formula,
    thresholds: {
      minimal: '0',
      low: '1–29',
      medium: '30–69',
      high: '70–100'
    },
    disclaimer: INDICATIVE_DISCLAIMER
  };
}
