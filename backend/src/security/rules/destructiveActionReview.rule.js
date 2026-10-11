import { redactString } from '../redaction.js';

// Specific high-impact destructive patterns
const DESTRUCTIVE_SQL_REGEX = /\b(DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE|VIEW)|TRUNCATE\s+(?:TABLE)?|ALTER\s+TABLE\s+[\w.]+\s+DROP)\b/i;
const DESTRUCTIVE_CMD_REGEX = /\b(rm\s+-[rf]{1,2}|del\s+\/[fq]|format\s+[a-z]:|dropdb)\b/i;

export const destructiveActionReviewRule = {
  id: 'DESTRUCTIVE_ACTION_REVIEW',
  name: 'Potentially Destructive Action Review',

  /**
   * Scans parameters for explicit destructive database or command operations.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];

    for (const node of nodes) {
      if (!node.parameters || typeof node.parameters !== 'object') continue;

      const type = (node.type || '').toLowerCase();
      let detectedOperation = null;
      let matchedSnippet = '';

      // Check database nodes (postgres, mysql, mongodb, mssql, etc.)
      const isDbNode = 
        type.includes('postgres') ||
        type.includes('mysql') ||
        type.includes('mongodb') ||
        type.includes('database') ||
        type.includes('mssql') ||
        type.includes('sqlite');

      // Check command execution nodes
      const isCommandNode = 
        type.includes('executecommand') || 
        type.includes('ssh') || 
        type.includes('bash');

      // Recursively search strings in parameters for destructive patterns
      const searchParams = (val, path = '') => {
        if (typeof val === 'string') {
          if (isDbNode && DESTRUCTIVE_SQL_REGEX.test(val)) {
            const match = val.match(DESTRUCTIVE_SQL_REGEX);
            detectedOperation = `Destructive SQL statement (${match[0].toUpperCase().trim()})`;
            matchedSnippet = `Parameter '${path}' matches '${match[0].toUpperCase().trim()}'; full statement omitted for data safety.`;
          } else if (isCommandNode && DESTRUCTIVE_CMD_REGEX.test(val)) {
            const match = val.match(DESTRUCTIVE_CMD_REGEX);
            detectedOperation = `Destructive system command (${match[0].trim()})`;
            matchedSnippet = `Parameter '${path}' matches command '${match[0].trim()}'; full command omitted for data safety.`;
          } else if (val.toLowerCase() === 'delete' || val.toLowerCase() === 'dropcollection') {
            detectedOperation = `Destructive operation mode (${val.trim()})`;
            matchedSnippet = `Parameter '${path}' set to '${val.trim()}'.`;
          }
        } else if (Array.isArray(val)) {
          val.forEach((item, idx) => searchParams(item, `${path}[${idx}]`));
        } else if (val && typeof val === 'object') {
          for (const [k, v] of Object.entries(val)) {
            searchParams(v, path ? `${path}.${k}` : k);
          }
        }
      };

      searchParams(node.parameters);

      if (detectedOperation) {
        findings.push({
          id: `finding-${node.id}-DESTRUCTIVE_ACTION_REVIEW`,
          ruleId: 'DESTRUCTIVE_ACTION_REVIEW',
          title: 'Potentially Destructive Data or System Operation',
          severity: 'medium',
          affectedNodeIds: [node.id],
          evidence: `Node '${node.name}' (${node.type}) performs ${detectedOperation}. ${matchedSnippet}`,
          explanation: `The node is configured with an operation or command that performs permanent data deletion, table truncation, or filesystem removal. If triggered accidentally or with malformed inputs, data loss could occur.`,
          recommendation: `Confirm that destructive actions have strict guardrails, parameterized filters, and error handling. Ensure soft-deletes or database backup checkpoints exist before running automated purge tasks.`,
          confidence: 'high',
          limitations: [
            'Static inspection checks for explicit delete/drop patterns. Legitimate scheduled cleanup jobs may intentionally utilize these commands.'
          ]
        });
      }
    }

    return findings;
  }
};
