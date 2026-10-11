// Standard prefixes recognized in the official n8n open-source node distribution
const STANDARD_NODE_PREFIXES = [
  'n8n-nodes-base.',
  '@n8n/n8n-nodes-langchain.'
];

export const unknownNodeCoverageRule = {
  id: 'UNKNOWN_NODE_COVERAGE',
  name: 'Unknown or Custom Node Coverage Limitation',

  /**
   * Identifies custom, third-party, or legacy nodes where static coverage is limited.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];

    for (const node of nodes) {
      const type = node.type || '';
      const isStandard = STANDARD_NODE_PREFIXES.some((prefix) => type.startsWith(prefix));

      if (!isStandard || type.includes('unknown')) {
        findings.push({
          id: `finding-${node.id}-UNKNOWN_NODE_COVERAGE`,
          ruleId: 'UNKNOWN_NODE_COVERAGE',
          title: 'Unverified or Custom Node Type (Limited Static Coverage)',
          severity: 'info',
          affectedNodeIds: [node.id],
          evidence: `Node '${node.name}' uses node type '${type}', which is not part of the standard verified n8n-nodes-base distribution.`,
          explanation: `This node is a custom, community-contributed, or third-party extension. While custom nodes expand automation capability, their parameter schemas, execution behaviors, and security semantics cannot be fully validated by static heuristic analysis.`,
          recommendation: `Inspect the custom node package source code and dependencies. Ensure community nodes are installed from trusted publishers and adhere to organizational security standards.`,
          confidence: 'high',
          limitations: [
            'Informational coverage warning only. Custom node types are not inherently risky or unsafe.'
          ]
        });
      }
    }

    return findings;
  }
};
