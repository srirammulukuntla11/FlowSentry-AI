import { redactString } from '../redaction.js';

export const externalHttpDestinationRule = {
  id: 'EXTERNAL_HTTP_DESTINATION',
  name: 'External HTTP Request Destination Review',

  /**
   * Identifies HTTP Request nodes and summarizes destination hosts for manual review.
   *
   * @param {Array<object>} nodes
   * @param {object} graphData
   * @returns {Array<object>} findings
   */
  run(nodes, graphData) {
    const findings = [];

    for (const node of nodes) {
      const isHttpNode = 
        node.type === 'n8n-nodes-base.httpRequest' ||
        (typeof node.type === 'string' && node.type.toLowerCase().includes('httprequest'));

      if (!isHttpNode) continue;

      const rawUrl = node.parameters?.url;
      let destinationHost = 'dynamic / expression-defined URL';

      if (typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
        try {
          // Check if URL is an expression (starts with =)
          if (rawUrl.startsWith('=')) {
            destinationHost = 'Expression-defined URL (requires runtime resolution)';
          } else {
            const parsedUrl = new URL(rawUrl);
            destinationHost = parsedUrl.host;
          }
        } catch {
          // If URL cannot be parsed by URL constructor, sanitize and display summary
          destinationHost = redactString(rawUrl.split('?')[0]);
        }
      }

      findings.push({
        id: `finding-${node.id}-EXTERNAL_HTTP_DESTINATION`,
        ruleId: 'EXTERNAL_HTTP_DESTINATION',
        title: 'Outbound HTTP Request Destination Review',
        severity: 'medium',
        affectedNodeIds: [node.id],
        evidence: `Node '${node.name}' (${node.type}) sends outbound requests to destination: ${destinationHost}.`,
        explanation: `This node is configured to transmit data to an external HTTP service. While external API calls are normal in automations, outbound connections should be verified to prevent unintended data egress or integration with unauthorized third parties.`,
        recommendation: `Verify that destination '${destinationHost}' is an approved endpoint for your organization. Ensure HTTPS is enforced and sensitive payloads are not sent to unvetted services.`,
        confidence: 'medium',
        limitations: [
          'An external or unfamiliar destination is not proof of malicious activity.',
          'Dynamic expressions cannot be evaluated statically and require manual review in the n8n editor.'
        ]
      });
    }

    return findings;
  }
};
