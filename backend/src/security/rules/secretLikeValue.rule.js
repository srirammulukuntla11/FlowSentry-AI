import { findSecrets, redactString } from '../redaction.js';

export const secretLikeValueRule = {
  id: 'SECRET_LIKE_VALUE',
  name: 'Potential Hardcoded Secret Value',

  /**
   * Evaluates nodes for hardcoded secrets in parameters.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];

    for (const node of nodes) {
      if (!node.parameters || typeof node.parameters !== 'object') continue;

      const secretMatches = findSecrets(node.parameters, 'parameters');

      if (secretMatches.length > 0) {
        // Collect parameter paths and pattern types (never raw values)
        const matchedPaths = secretMatches.map((m) => `${m.path} (${m.patternType})`).join(', ');

        findings.push({
          id: `finding-${node.id}-SECRET_LIKE_VALUE`,
          ruleId: 'SECRET_LIKE_VALUE',
          title: 'Potential Hardcoded Secret Value in Node Parameters',
          severity: 'high',
          affectedNodeIds: [node.id],
          evidence: `Secret-like pattern detected in parameter path(s): ${matchedPaths}. The value has been redacted immediately.`,
          explanation: `Exported workflow parameters contain text matching known credential, token, or private key patterns. Hardcoding secrets in workflows risks exposing them during exports, version control commits, or team sharing.`,
          recommendation: `Remove hardcoded secrets from the workflow parameters. Rotate the credential if it was ever active, and reference n8n managed credentials or environment variables instead.`,
          confidence: 'high',
          limitations: [
            'Pattern matching relies on known token formats and keywords. Synthetic test strings or placeholder tokens will also trigger this rule.'
          ]
        });
      }
    }

    return findings;
  }
};
