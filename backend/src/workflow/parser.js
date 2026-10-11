import crypto from 'crypto';

/**
 * Parses raw JSON string or Buffer into validated n8n workflow data structures.
 * Never executes code or logs sensitive contents.
 *
 * @param {string|Buffer} rawContent - Uploaded workflow file content
 * @returns {{
 *   metadata: { id: string, name: string, active: boolean, nodeCount: number },
 *   nodes: Array<object>,
 *   connections: object,
 *   warnings: Array<string>
 * }}
 */
export function parseWorkflowJson(rawContent) {
  const warnings = [];

  // 1. Safe JSON Syntax Parse
  let data;
  try {
    const text = typeof rawContent === 'string' ? rawContent : rawContent.toString('utf8');
    data = JSON.parse(text);
  } catch (err) {
    const parseError = new Error('Malformed JSON: File contains invalid JSON syntax.');
    parseError.code = 'MALFORMED_JSON';
    throw parseError;
  }

  // 2. Validate Root Object
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    const structError = new Error('Invalid workflow structure: Root must be a JSON object.');
    structError.code = 'INVALID_WORKFLOW_STRUCTURE';
    throw structError;
  }

  // 3. Validate Nodes Array
  if (!('nodes' in data)) {
    const structError = new Error("Invalid workflow structure: Missing required 'nodes' array.");
    structError.code = 'INVALID_WORKFLOW_STRUCTURE';
    throw structError;
  }

  if (!Array.isArray(data.nodes)) {
    const structError = new Error("Invalid workflow structure: 'nodes' must be an array.");
    structError.code = 'INVALID_WORKFLOW_STRUCTURE';
    throw structError;
  }

  if (data.nodes.length === 0) {
    const emptyError = new Error('Empty workflow: Workflow contains 0 nodes.');
    emptyError.code = 'EMPTY_WORKFLOW';
    throw emptyError;
  }

  // 4. Validate and Normalize Nodes
  const seenIds = new Set();
  const seenNames = new Set();
  const normalizedNodes = [];

  for (let i = 0; i < data.nodes.length; i++) {
    const rawNode = data.nodes[i];

    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      warnings.push(`Node at index ${i} is not a valid object and was skipped.`);
      continue;
    }

    // Determine or generate Node ID
    let nodeId = typeof rawNode.id === 'string' && rawNode.id.trim().length > 0 
      ? rawNode.id.trim() 
      : null;

    if (!nodeId) {
      nodeId = `node_${i}_${crypto.randomBytes(4).toString('hex')}`;
      warnings.push(`Node at index ${i} was missing an 'id'; generated fallback ID '${nodeId}'.`);
    } else if (seenIds.has(nodeId)) {
      const deduplicatedId = `${nodeId}_dup_${i}`;
      warnings.push(`Duplicate node ID '${nodeId}' found at index ${i}; renamed to '${deduplicatedId}'.`);
      nodeId = deduplicatedId;
    }
    seenIds.add(nodeId);

    // Node Name
    let nodeName = typeof rawNode.name === 'string' && rawNode.name.trim().length > 0
      ? rawNode.name.trim()
      : `Node ${i + 1}`;
    
    if (seenNames.has(nodeName)) {
      warnings.push(`Multiple nodes share the name '${nodeName}'. Connections may be ambiguous.`);
    }
    seenNames.add(nodeName);

    // Node Type
    const nodeType = typeof rawNode.type === 'string' && rawNode.type.trim().length > 0
      ? rawNode.type.trim()
      : 'n8n-nodes-base.unknown';

    // Position
    let position = [0, 0];
    if (Array.isArray(rawNode.position) && rawNode.position.length >= 2) {
      const x = Number(rawNode.position[0]) || 0;
      const y = Number(rawNode.position[1]) || 0;
      position = [x, y];
    } else if (rawNode.position && typeof rawNode.position === 'object') {
      const x = Number(rawNode.position.x) || 0;
      const y = Number(rawNode.position.y) || 0;
      position = [x, y];
    } else {
      warnings.push(`Node '${nodeName}' (${nodeId}) has missing or invalid position coordinates.`);
    }

    // Safe parameters extraction (preserve parameters object for security rules without logging)
    const parameters = rawNode.parameters && typeof rawNode.parameters === 'object' && !Array.isArray(rawNode.parameters)
      ? rawNode.parameters
      : {};

    // Credentials configuration
    const credentials = rawNode.credentials && typeof rawNode.credentials === 'object' && !Array.isArray(rawNode.credentials)
      ? rawNode.credentials
      : {};

    normalizedNodes.push({
      id: nodeId,
      name: nodeName,
      type: nodeType,
      typeVersion: rawNode.typeVersion || 1,
      position,
      disabled: Boolean(rawNode.disabled),
      notes: typeof rawNode.notes === 'string' ? rawNode.notes : '',
      parameters,
      credentials
    });
  }

  if (normalizedNodes.length === 0) {
    const error = new Error('Invalid workflow: No valid nodes could be parsed.');
    error.code = 'INVALID_WORKFLOW_STRUCTURE';
    throw error;
  }

  // 5. Validate Connections Object
  let connections = {};
  if ('connections' in data) {
    if (data.connections !== null && typeof data.connections === 'object' && !Array.isArray(data.connections)) {
      connections = data.connections;
    } else {
      warnings.push("Workflow 'connections' is malformed and must be an object. Connections skipped.");
    }
  }

  // Metadata
  const metadata = {
    id: typeof data.id === 'string' ? data.id : `scan_${crypto.randomBytes(6).toString('hex')}`,
    name: typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : 'Exported n8n Workflow',
    active: Boolean(data.active),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    nodeCount: normalizedNodes.length
  };

  return {
    metadata,
    nodes: normalizedNodes,
    connections,
    warnings
  };
}
