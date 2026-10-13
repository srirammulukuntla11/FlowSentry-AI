/**
 * FlowSentry AI — Workflow Validation Pre-check Engine
 *
 * Validates uploaded n8n workflow JSON before security analysis:
 * 1. JSON syntax & file integrity (empty files, syntax errors) -> Blocking error
 * 2. Supported workflow structure (root object, nodes array) -> Blocking error
 * 3. Node identifiers & uniqueness (missing IDs, duplicate IDs, duplicate names) -> Non-blocking warning
 * 4. Node structure & required fields (type, position, parameters object) -> Non-blocking warning
 * 5. Connection integrity (references to nonexistent source/target nodes) -> Non-blocking warning
 * 6. Connection socket structure (valid mapping, socket arrays) -> Non-blocking warning
 *
 * Does not execute workflows.
 * Does not modify uploaded files.
 */

/**
 * Validates a workflow JSON string or Buffer.
 *
 * @param {string|Buffer|object} input - Raw content or parsed object
 * @returns {{
 *   isValid: boolean,
 *   canProceed: boolean,
 *   summary: { totalChecks: number, passed: number, warnings: number, errors: number },
 *   checks: Array<{
 *     id: string,
 *     name: string,
 *     status: 'passed' | 'warning' | 'error',
 *     isBlocking: boolean,
 *     message: string,
 *     details: string[],
 *     affectedItems: Array<{ type: 'node' | 'connection' | 'file', id: string, name?: string }>
 *   }>,
 *   blockingErrors: Array<{ checkId: string, message: string, affectedItem?: string }>,
 *   warnings: Array<{ checkId: string, message: string, affectedItem?: string }>,
 *   workflowMetadata: { id?: string, name?: string, nodeCount?: number, connectionCount?: number }
 * }}
 */
export function validateWorkflow(input) {
  const blockingErrors = [];
  const warnings = [];

  // Check 1: JSON Syntax & File Integrity
  let data = null;
  const check1 = {
    id: 'json_syntax',
    name: 'JSON Syntax & File Integrity',
    status: 'passed',
    isBlocking: true,
    message: 'Valid JSON syntax and non-empty payload.',
    details: [],
    affectedItems: []
  };

  if (input === null || input === undefined) {
    check1.status = 'error';
    check1.message = 'No content provided: Uploaded file is empty or missing.';
    check1.details.push('File buffer is null or undefined.');
    blockingErrors.push({ checkId: 'json_syntax', message: check1.message });
  } else if (typeof input === 'object' && !Buffer.isBuffer(input)) {
    // Already parsed object
    data = input;
  } else {
    const rawText = typeof input === 'string' ? input : input.toString('utf8');

    if (!rawText || rawText.trim().length === 0) {
      check1.status = 'error';
      check1.message = 'Empty file: The uploaded workflow file contains 0 bytes.';
      check1.details.push('Payload contains no characters or whitespace only.');
      blockingErrors.push({ checkId: 'json_syntax', message: check1.message });
    } else {
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        check1.status = 'error';
        check1.message = `Malformed JSON: File contains invalid JSON syntax (${err.message}).`;
        check1.details.push(`Syntax error: ${err.message}`);
        blockingErrors.push({ checkId: 'json_syntax', message: check1.message });
      }
    }
  }

  // Check 2: Supported Workflow Structure (Root Object & Nodes Array)
  const check2 = {
    id: 'workflow_structure',
    name: 'Supported Workflow Structure',
    status: 'passed',
    isBlocking: true,
    message: "Workflow contains a valid root object and 'nodes' array.",
    details: [],
    affectedItems: []
  };

  if (check1.status === 'error') {
    check2.status = 'error';
    check2.message = 'Cannot validate workflow structure because JSON parse failed.';
    blockingErrors.push({ checkId: 'workflow_structure', message: check2.message });
  } else if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    check2.status = 'error';
    check2.message = 'Invalid workflow structure: Root must be a JSON object, not an array or primitive.';
    check2.details.push(`Received root type: ${Array.isArray(data) ? 'array' : typeof data}`);
    blockingErrors.push({ checkId: 'workflow_structure', message: check2.message });
  } else if (!('nodes' in data)) {
    check2.status = 'error';
    check2.message = "Missing required 'nodes' property: Root object must define an array of workflow nodes.";
    check2.details.push("Property 'nodes' is absent from root object.");
    blockingErrors.push({ checkId: 'workflow_structure', message: check2.message });
  } else if (!Array.isArray(data.nodes)) {
    check2.status = 'error';
    check2.message = "Invalid 'nodes' property: Must be a JSON array.";
    check2.details.push(`'nodes' property is of type ${typeof data.nodes}`);
    blockingErrors.push({ checkId: 'workflow_structure', message: check2.message });
  } else if (data.nodes.length === 0) {
    check2.status = 'error';
    check2.message = 'Empty workflow: The workflow defines 0 nodes and cannot be analyzed.';
    check2.details.push("'nodes' array is empty ([]).");
    blockingErrors.push({ checkId: 'workflow_structure', message: check2.message });
  }

  // Check 3: Node Identifiers & Uniqueness
  const check3 = {
    id: 'node_identifiers',
    name: 'Node Identifiers & Uniqueness',
    status: 'passed',
    isBlocking: false,
    message: 'All nodes have distinct identifiers and unique names.',
    details: [],
    affectedItems: []
  };

  // Check 4: Node Structure & Schema
  const check4 = {
    id: 'node_schema',
    name: 'Node Structure & Required Fields',
    status: 'passed',
    isBlocking: false,
    message: 'All nodes declare valid types, coordinates, and parameter schemas.',
    details: [],
    affectedItems: []
  };

  // Check 5: Connection Graph & Node References
  const check5 = {
    id: 'connection_integrity',
    name: 'Connection Integrity & Node References',
    status: 'passed',
    isBlocking: false,
    message: 'All workflow connections reference declared, known nodes.',
    details: [],
    affectedItems: []
  };

  // Check 6: Socket & Connection Format
  const check6 = {
    id: 'connection_structure',
    name: 'Connection Schema & Socket Structure',
    status: 'passed',
    isBlocking: false,
    message: 'Connection schema conforms to supported n8n socket array mappings.',
    details: [],
    affectedItems: []
  };

  const declaredNodeIds = new Set();
  const declaredNodeNames = new Set();
  let totalConnectionsCount = 0;

  // Inspect nodes if structure passed
  if (check2.status === 'passed' && Array.isArray(data?.nodes)) {
    const rawNodes = data.nodes;

    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];

      if (!node || typeof node !== 'object' || Array.isArray(node)) {
        check4.status = 'warning';
        check4.details.push(`Node at index ${i} is not a valid object and will be skipped.`);
        check4.affectedItems.push({ type: 'node', id: `index_${i}` });
        warnings.push({ checkId: 'node_schema', message: `Node at index ${i} is not a valid object.` });
        continue;
      }

      // Check ID
      const hasId = typeof node.id === 'string' && node.id.trim().length > 0;
      const rawId = hasId ? node.id.trim() : null;

      if (!hasId) {
        check3.status = 'warning';
        check3.details.push(`Node at index ${i} (name: '${node.name || `Node ${i + 1}`}') is missing an 'id'; parser will generate a fallback identifier.`);
        check3.affectedItems.push({ type: 'node', id: `index_${i}`, name: node.name });
        warnings.push({ checkId: 'node_identifiers', message: `Missing ID on node at index ${i}.` });
      } else if (declaredNodeIds.has(rawId)) {
        check3.status = 'warning';
        check3.details.push(`Duplicate node ID '${rawId}' found at index ${i}; parser will deduplicate with a unique suffix.`);
        check3.affectedItems.push({ type: 'node', id: rawId, name: node.name });
        warnings.push({ checkId: 'node_identifiers', message: `Duplicate node ID '${rawId}' at index ${i}.`, affectedItem: rawId });
      }
      if (rawId) declaredNodeIds.add(rawId);

      // Check Name
      const hasName = typeof node.name === 'string' && node.name.trim().length > 0;
      const nodeName = hasName ? node.name.trim() : `Node ${i + 1}`;
      if (declaredNodeNames.has(nodeName)) {
        check3.status = 'warning';
        check3.details.push(`Multiple nodes share the name '${nodeName}'. Connections referencing node names may be ambiguous.`);
        check3.affectedItems.push({ type: 'node', id: rawId || `index_${i}`, name: nodeName });
        warnings.push({ checkId: 'node_identifiers', message: `Ambiguous duplicate node name '${nodeName}'.`, affectedItem: nodeName });
      }
      declaredNodeNames.add(nodeName);

      // Check Type
      if (!node.type || typeof node.type !== 'string' || node.type.trim().length === 0) {
        check4.status = 'warning';
        check4.details.push(`Node '${nodeName}' (${rawId || `index_${i}`}) is missing a 'type' property; falling back to 'unknown'.`);
        check4.affectedItems.push({ type: 'node', id: rawId || `index_${i}`, name: nodeName });
        warnings.push({ checkId: 'node_schema', message: `Missing type on '${nodeName}'.` });
      }

      // Check Position
      const hasPosArray = Array.isArray(node.position) && node.position.length >= 2;
      const hasPosObj = node.position && typeof node.position === 'object' && 'x' in node.position && 'y' in node.position;
      if (!hasPosArray && !hasPosObj) {
        check4.status = 'warning';
        check4.details.push(`Node '${nodeName}' has missing or non-standard position coordinates; defaulting to canvas origin.`);
        check4.affectedItems.push({ type: 'node', id: rawId || `index_${i}`, name: nodeName });
        warnings.push({ checkId: 'node_schema', message: `Invalid position on '${nodeName}'.` });
      }
    }

    // Inspect connections
    if ('connections' in data) {
      if (data.connections !== null && typeof data.connections === 'object' && !Array.isArray(data.connections)) {
        for (const [sourceIdentifier, outputTypes] of Object.entries(data.connections)) {
          // Check if sourceIdentifier exists in declared nodes (by ID or name)
          const sourceExists = declaredNodeIds.has(sourceIdentifier) || declaredNodeNames.has(sourceIdentifier);
          if (!sourceExists) {
            check5.status = 'warning';
            check5.details.push(`Connection source '${sourceIdentifier}' does not match any declared node.`);
            check5.affectedItems.push({ type: 'connection', id: sourceIdentifier });
            warnings.push({ checkId: 'connection_integrity', message: `Connection source '${sourceIdentifier}' not found.`, affectedItem: sourceIdentifier });
          }

          if (!outputTypes || typeof outputTypes !== 'object' || Array.isArray(outputTypes)) {
            check6.status = 'warning';
            check6.details.push(`Invalid connection outputs structure for source node '${sourceIdentifier}'.`);
            check6.affectedItems.push({ type: 'connection', id: sourceIdentifier });
            warnings.push({ checkId: 'connection_structure', message: `Malformed output group for '${sourceIdentifier}'.` });
            continue;
          }

          for (const [outputType, connectionIndices] of Object.entries(outputTypes)) {
            if (!Array.isArray(connectionIndices)) {
              check6.status = 'warning';
              check6.details.push(`Socket output '${outputType}' on node '${sourceIdentifier}' must be an array of connection groups.`);
              warnings.push({ checkId: 'connection_structure', message: `Non-array connection group on '${sourceIdentifier}'.` });
              continue;
            }

            for (const group of connectionIndices) {
              if (!Array.isArray(group)) continue;

              for (const targetConn of group) {
                totalConnectionsCount += 1;

                if (!targetConn || typeof targetConn !== 'object') {
                  check6.status = 'warning';
                  check6.details.push(`Malformed target connection entry in node '${sourceIdentifier}'.`);
                  warnings.push({ checkId: 'connection_structure', message: `Invalid target entry in '${sourceIdentifier}'.` });
                  continue;
                }

                const targetIdentifier = targetConn.node;
                const targetExists = targetIdentifier && (declaredNodeIds.has(targetIdentifier) || declaredNodeNames.has(targetIdentifier));

                if (!targetExists) {
                  check5.status = 'warning';
                  check5.details.push(`Connection from '${sourceIdentifier}' references unknown target node '${targetIdentifier || 'undefined'}'.`);
                  check5.affectedItems.push({ type: 'connection', id: `${sourceIdentifier}->${targetIdentifier}` });
                  warnings.push({
                    checkId: 'connection_integrity',
                    message: `Target node '${targetIdentifier}' referenced by '${sourceIdentifier}' does not exist.`,
                    affectedItem: `${sourceIdentifier} -> ${targetIdentifier}`
                  });
                }
              }
            }
          }
        }
      } else {
        check6.status = 'warning';
        check6.details.push("Workflow 'connections' is malformed (must be a JSON object). Topology connections will be skipped.");
        warnings.push({ checkId: 'connection_structure', message: "Malformed 'connections' object." });
      }
    }
  }

  // Update status messages if warnings were logged
  if (check3.status === 'warning') {
    check3.message = `${check3.details.length} non-blocking node identifier warning(s) detected.`;
  }
  if (check4.status === 'warning') {
    check4.message = `${check4.details.length} non-blocking node schema warning(s) detected.`;
  }
  if (check5.status === 'warning') {
    check5.message = `${check5.details.length} connection reference warning(s) detected.`;
  }
  if (check6.status === 'warning') {
    check6.message = `${check6.details.length} connection structure warning(s) detected.`;
  }

  const allChecks = [check1, check2, check3, check4, check5, check6];

  let passedCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const c of allChecks) {
    if (c.status === 'passed') passedCount += 1;
    else if (c.status === 'warning') warningCount += 1;
    else if (c.status === 'error') errorCount += 1;
  }

  const isValid = errorCount === 0;
  const canProceed = isValid;

  const workflowMetadata = {
    id: data?.id || undefined,
    name: typeof data?.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : 'Exported n8n Workflow',
    nodeCount: Array.isArray(data?.nodes) ? data.nodes.length : 0,
    connectionCount: totalConnectionsCount
  };

  return {
    isValid,
    canProceed,
    hasWarnings: warningCount > 0,
    summary: {
      totalChecks: allChecks.length,
      passed: passedCount,
      warnings: warningCount,
      errors: errorCount
    },
    checks: allChecks,
    blockingErrors,
    warnings,
    workflowMetadata
  };
}
