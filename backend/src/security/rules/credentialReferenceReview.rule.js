export const credentialReferenceReviewRule = {
  id: 'CREDENTIAL_REFERENCE_REVIEW',
  name: 'Credential Reference Configuration Review',

  /**
   * Identifies nodes referencing managed credentials for access governance review.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];

    for (const node of nodes) {
      if (!node.credentials || typeof node.credentials !== 'object') continue;

      const credKeys = Object.keys(node.credentials);
      if (credKeys.length === 0) continue;

      // Extract referenced credential names and types (without assuming secrets exist)
      const credSummary = credKeys.map((type) => {
        const credObj = node.credentials[type];
        const credName = typeof credObj === 'object' && credObj?.name ? credObj.name : 'managed credential';
        return `${type} ('${credName}')`;
      }).join(', ');

      findings.push({
        id: `finding-${node.id}-CREDENTIAL_REFERENCE_REVIEW`,
        ruleId: 'CREDENTIAL_REFERENCE_REVIEW',
        title: 'Node Configured with Managed Credential Reference',
        severity: 'low',
        affectedNodeIds: [node.id],
        evidence: `Node '${node.name}' (${node.type}) references credentials: ${credSummary}.`,
        explanation: `This node is linked to one or more managed credentials stored within the n8n environment. While n8n workflow exports typically store only references (identifiers and names) rather than actual secret keys, workflows with credential bindings should be reviewed to verify appropriate access permissions.`,
        recommendation: `Confirm that the referenced credentials follow the principle of least privilege in your n8n instance. When sharing or exporting workflows across teams or public repositories, verify that credential permissions are appropriately scoped.`,
        confidence: 'high',
        limitations: [
          'n8n workflow exports contain credential metadata and references, but generally do not contain the underlying secret or password.',
          'This finding represents an informational configuration audit rather than an exposed credential vulnerability.'
        ]
      });
    }

    return findings;
  }
};
