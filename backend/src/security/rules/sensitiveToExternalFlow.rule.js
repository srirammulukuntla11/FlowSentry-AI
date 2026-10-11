export const sensitiveToExternalFlowRule = {
  id: 'SENSITIVE_TO_EXTERNAL_FLOW',
  name: 'Sensitive Ingestion to External Request Flow',

  /**
   * Traces reachable graph paths from sensitive ingest nodes (webhooks, forms) to outbound HTTP nodes.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];
    const adjacency = graphData.adjacencyList || {};

    // Helper: Identify sensitive input nodes
    const isSensitiveSource = (node) => {
      const type = (node.type || '').toLowerCase();
      return (
        type.includes('webhook') ||
        type.includes('form') ||
        type.includes('typeform') ||
        type.includes('emailread') ||
        type.includes('imap')
      );
    };

    // Helper: Identify external destination nodes
    const isExternalDestination = (node) => {
      const type = (node.type || '').toLowerCase();
      return type.includes('httprequest');
    };

    const sourceNodes = nodes.filter(isSensitiveSource);
    const destNodes = nodes.filter(isExternalDestination);

    if (sourceNodes.length === 0 || destNodes.length === 0) {
      return findings;
    }

    const destIds = new Set(destNodes.map((n) => n.id));
    const nodeLookup = new Map(nodes.map((n) => [n.id, n]));

    // BFS to find shortest path from each sensitive source to any external destination
    for (const source of sourceNodes) {
      const queue = [[source.id]];
      const visited = new Set([source.id]);
      let detectedPath = null;

      while (queue.length > 0) {
        const currentPath = queue.shift();
        const currentId = currentPath[currentPath.length - 1];

        if (destIds.has(currentId) && currentId !== source.id) {
          detectedPath = currentPath;
          break;
        }

        const neighbors = adjacency[currentId] || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([...currentPath, neighbor]);
          }
        }
      }

      if (detectedPath) {
        const destNode = nodeLookup.get(detectedPath[detectedPath.length - 1]);
        const pathNames = detectedPath
          .map((id) => `'${nodeLookup.get(id)?.name || id}'`)
          .join(' → ');

        findings.push({
          id: `finding-${source.id}-to-${destNode?.id}-SENSITIVE_TO_EXTERNAL_FLOW`,
          ruleId: 'SENSITIVE_TO_EXTERNAL_FLOW',
          title: 'Potential Reachability from Ingest Node to Outbound HTTP Node',
          severity: 'medium',
          affectedNodeIds: detectedPath,
          evidence: `A directed graph path exists from ingest node '${source.name}' (${source.type}) to outbound HTTP node '${destNode?.name}' (${destNode?.type}) via path: ${pathNames}. Note: This demonstrates topological reachability only; it does not prove that sensitive payload fields are transmitted.`,
          explanation: `The workflow contains a graph path connecting an external data entry point (such as a webhook or form) to an outbound HTTP Request node. While graph reachability allows data to flow downstream, static analysis cannot determine whether incoming fields are actually forwarded, transformed, filtered, or discarded without runtime execution.`,
          recommendation: `Review intermediate nodes along the path (${pathNames}) to confirm whether sensitive payload fields are passed to the external request. Use explicit field mapping and avoid forwarding entire raw input objects.`,
          confidence: 'medium',
          limitations: [
            'Graph reachability establishes structural connectivity only, NOT confirmed sensitive data transmission or exfiltration.',
            'Static inspection cannot evaluate runtime JavaScript transformations ($json expressions) or conditional routing.'
          ]
        });
      }
    }

    return findings;
  }
};
