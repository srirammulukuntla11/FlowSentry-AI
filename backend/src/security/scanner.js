import { secretLikeValueRule } from './rules/secretLikeValue.rule.js';
import { externalHttpDestinationRule } from './rules/externalHttpDestination.rule.js';
import { sensitiveToExternalFlowRule } from './rules/sensitiveToExternalFlow.rule.js';
import { credentialReferenceReviewRule } from './rules/credentialReferenceReview.rule.js';
import { destructiveActionReviewRule } from './rules/destructiveActionReview.rule.js';
import { unknownNodeCoverageRule } from './rules/unknownNodeCoverage.rule.js';
import { deepRedact } from './redaction.js';
import { calculateRiskScore } from './riskScore.js';

export const ALL_RULES = [
  secretLikeValueRule,
  externalHttpDestinationRule,
  sensitiveToExternalFlowRule,
  credentialReferenceReviewRule,
  destructiveActionReviewRule,
  unknownNodeCoverageRule
];

/**
 * Executes all deterministic security rules on the parsed workflow and graph.
 * Sanitizes all findings so secrets are never echoed.
 *
 * @param {Array<object>} nodes - Parsed workflow nodes
 * @param {object} graphData - Normalized graph data (adjacencyList, graphEdges, etc.)
 * @returns {{
 *   findings: Array<object>,
 *   summary: {
 *     total: number,
 *     high: number,
 *     medium: number,
 *     low: number,
 *     info: number
 *   },
 *   riskScore: object
 * }}
 */
export function runSecurityScan(nodes = [], graphData = {}) {
  const rawFindings = [];

  for (const rule of ALL_RULES) {
    try {
      const ruleFindings = rule.run(nodes, graphData);
      if (Array.isArray(ruleFindings)) {
        rawFindings.push(...ruleFindings);
      }
    } catch (err) {
      console.error(`[Scanner Warning] Rule ${rule.id} failed:`, err.message);
      rawFindings.push({
        id: `finding-error-${rule.id}`,
        ruleId: rule.id,
        title: `Scanner rule execution error for ${rule.name}`,
        severity: 'info',
        affectedNodeIds: [],
        evidence: `Rule could not complete execution: ${err.message}`,
        explanation: 'An internal error occurred while executing this check.',
        recommendation: 'Check workflow structure or report an issue.',
        confidence: 'low',
        limitations: ['Internal rule failure']
      });
    }
  }

  // Deep redaction safety pass on all findings to guarantee zero leaked secrets
  const sanitizedFindings = rawFindings.map((finding) => deepRedact(finding));

  // Compute severity summary counts
  const summary = {
    total: sanitizedFindings.length,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  };

  for (const finding of sanitizedFindings) {
    const sev = (finding.severity || '').toLowerCase();
    if (sev in summary) {
      summary[sev] += 1;
    } else {
      summary.info += 1;
    }
  }

  // Compute deterministic overall workflow risk score
  const riskScore = calculateRiskScore(sanitizedFindings);

  return {
    findings: sanitizedFindings,
    summary,
    riskScore
  };
}
