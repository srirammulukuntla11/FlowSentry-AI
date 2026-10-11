/**
 * Normalizes parsed n8n nodes and connections into a standard graph representation
 * compatible with @xyflow/react and internal reachability analysis.
 *
 * @param {Array<object>} nodes - Parsed nodes from parseWorkflowJson
 * @param {object} connections - Parsed connections from parseWorkflowJson
 * @returns {{
 *   graphNodes: Array<object>,
 *   graphEdges: Array<object>,
 *   graphWarnings: Array<string>,
 *   adjacencyList: Record<string, string[]>
 * }}
 */
export function normalizeWorkflowGraph(nodes = [], connections = {}) {
  const graphWarnings = [];

  // Lookup maps for fast and robust resolution by node name and by node id
  const idToNode = new Map();
  const nameToId = new Map();

  for (const node of nodes) {
    idToNode.set(node.id, node);
    if (!nameToId.has(node.name)) {
      nameToId.set(node.name, node.id);
    }
  }

  // Helper to resolve an identifier (could be name or id) to the canonical node id
  const resolveNodeId = (identifier) => {
    if (!identifier || typeof identifier !== 'string') return null;
    if (idToNode.has(identifier)) return identifier;
    if (nameToId.has(identifier)) return nameToId.get(identifier);
    return null;
  };

  // Build clean graph nodes (without raw parameter blobs or secrets)
  const graphNodes = nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    typeVersion: node.typeVersion,
    position: {
      x: node.position[0],
      y: node.position[1]
    },
    disabled: node.disabled,
    hasNotes: Boolean(node.notes && node.notes.trim().length > 0),
    parameterCount: Object.keys(node.parameters || {}).length,
    credentialTypes: Object.keys(node.credentials || {})
  }));

  // Build graph edges and adjacency list
  const graphEdges = [];
  const adjacencyList = {};
  for (const node of nodes) {
    adjacencyList[node.id] = [];
  }

  const seenEdgeKeys = new Set();
  let edgeCounter = 0;

  if (connections && typeof connections === 'object') {
    for (const [sourceIdentifier, outputTypes] of Object.entries(connections)) {
      const sourceId = resolveNodeId(sourceIdentifier);

      if (!sourceId) {
        graphWarnings.push(`Connection source '${sourceIdentifier}' does not match any known node.`);
        continue;
      }

      if (!outputTypes || typeof outputTypes !== 'object' || Array.isArray(outputTypes)) {
        graphWarnings.push(`Invalid connection outputs for node '${sourceIdentifier}'.`);
        continue;
      }

      for (const [outputType, connectionIndices] of Object.entries(outputTypes)) {
        if (!Array.isArray(connectionIndices)) {
          continue;
        }

        connectionIndices.forEach((connectionGroup, outputIndex) => {
          if (!Array.isArray(connectionGroup)) {
            return;
          }

          connectionGroup.forEach((targetConn, inputIndex) => {
            if (!targetConn || typeof targetConn !== 'object') {
              return;
            }

            const targetIdentifier = targetConn.node;
            const targetId = resolveNodeId(targetIdentifier);

            if (!targetId) {
              graphWarnings.push(
                `Connection from '${sourceIdentifier}' targets unknown node '${targetIdentifier}'.`
              );
              return;
            }

            const edgeKey = `${sourceId}:${outputType}:${outputIndex}->${targetId}:${targetConn.type || 'main'}:${targetConn.index || 0}`;

            if (!seenEdgeKeys.has(edgeKey)) {
              seenEdgeKeys.add(edgeKey);
              edgeCounter += 1;

              const edgeId = `edge_${edgeCounter}_${sourceId}_to_${targetId}`;
              graphEdges.push({
                id: edgeId,
                source: sourceId,
                target: targetId,
                sourceOutput: outputType,
                outputIndex,
                targetInput: targetConn.type || 'main',
                inputIndex: targetConn.index || 0
              });

              if (!adjacencyList[sourceId].includes(targetId)) {
                adjacencyList[sourceId].push(targetId);
              }
            }
          });
        });
      }
    }
  }

  return {
    graphNodes,
    graphEdges,
    graphWarnings,
    adjacencyList
  };
}
