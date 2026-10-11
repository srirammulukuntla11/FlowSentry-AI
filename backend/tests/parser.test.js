import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../src/server.js';
import { parseWorkflowJson } from '../src/workflow/parser.js';
import { normalizeWorkflowGraph } from '../src/workflow/graph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

test('UNIT: parseWorkflowJson handles safe-sample.json cleanly', () => {
  const content = fs.readFileSync(path.join(SAMPLES_DIR, 'safe-sample.json'), 'utf8');
  const result = parseWorkflowJson(content);

  assert.equal(result.metadata.name, 'Customer Feedback Notification Flow (Safe Sample)');
  assert.equal(result.nodes.length, 3);
  assert.equal(result.metadata.nodeCount, 3);
  assert.ok(result.connections['Webhook - Inbound Feedback']);
});

test('UNIT: parseWorkflowJson handles risky-sample.json cleanly', () => {
  const content = fs.readFileSync(path.join(SAMPLES_DIR, 'risky-sample.json'), 'utf8');
  const result = parseWorkflowJson(content);

  assert.equal(result.metadata.name, 'Sync Lead Form to External Collector (Risky Sample)');
  assert.equal(result.nodes.length, 4);
});

test('UNIT: parseWorkflowJson rejects malformed JSON', () => {
  const badJson = '{"name": "Broken", "nodes": [ { "id": "1", ';
  assert.throws(
    () => parseWorkflowJson(badJson),
    (err) => {
      assert.equal(err.code, 'MALFORMED_JSON');
      assert.match(err.message, /invalid JSON/i);
      return true;
    }
  );
});

test('UNIT: parseWorkflowJson rejects non-object root or missing nodes', () => {
  assert.throws(
    () => parseWorkflowJson('["not", "an", "object"]'),
    (err) => err.code === 'INVALID_WORKFLOW_STRUCTURE'
  );

  assert.throws(
    () => parseWorkflowJson('{"name": "No nodes property"}'),
    (err) => err.code === 'INVALID_WORKFLOW_STRUCTURE'
  );

  assert.throws(
    () => parseWorkflowJson('{"nodes": "not-an-array"}'),
    (err) => err.code === 'INVALID_WORKFLOW_STRUCTURE'
  );
});

test('UNIT: parseWorkflowJson rejects empty workflow (0 nodes)', () => {
  assert.throws(
    () => parseWorkflowJson('{"name": "Empty", "nodes": []}'),
    (err) => err.code === 'EMPTY_WORKFLOW'
  );
});

test('UNIT: parseWorkflowJson deduplicates duplicate node IDs with warning', () => {
  const workflowWithDups = {
    name: 'Duplicate IDs Flow',
    nodes: [
      { id: 'node_dup', name: 'First Node', type: 'n8n-nodes-base.webhook' },
      { id: 'node_dup', name: 'Second Node', type: 'n8n-nodes-base.code' }
    ]
  };

  const result = parseWorkflowJson(JSON.stringify(workflowWithDups));
  assert.equal(result.nodes.length, 2);
  assert.equal(result.nodes[0].id, 'node_dup');
  assert.notEqual(result.nodes[1].id, 'node_dup');
  assert.ok(result.nodes[1].id.includes('node_dup_dup_1'));
  assert.ok(result.warnings.some((w) => w.includes('Duplicate node ID')));
});

test('UNIT: normalizeWorkflowGraph handles missing/broken connections gracefully', () => {
  const nodes = [
    { id: 'n1', name: 'Start Node', type: 'n8n-nodes-base.webhook', position: [0, 0] },
    { id: 'n2', name: 'End Node', type: 'n8n-nodes-base.slack', position: [100, 100] }
  ];

  const connections = {
    'Start Node': {
      main: [
        [
          { node: 'End Node', type: 'main', index: 0 },
          { node: 'Ghost Node That Does Not Exist', type: 'main', index: 0 }
        ]
      ]
    },
    'Unknown Source Node': {
      main: [[{ node: 'End Node' }]]
    }
  };

  const graph = normalizeWorkflowGraph(nodes, connections);
  assert.equal(graph.graphNodes.length, 2);
  // Only the valid edge from n1 to n2 is created
  assert.equal(graph.graphEdges.length, 1);
  assert.equal(graph.graphEdges[0].source, 'n1');
  assert.equal(graph.graphEdges[0].target, 'n2');
  // Warnings are captured for the broken connections without crashing
  assert.ok(graph.graphWarnings.some((w) => w.includes('Ghost Node')));
  assert.ok(graph.graphWarnings.some((w) => w.includes('Unknown Source Node')));
});

// HTTP Integration Tests
test('HTTP: POST /api/scans with valid workflow returns 200 and normalized graph', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const safeContent = fs.readFileSync(path.join(SAMPLES_DIR, 'safe-sample.json'), 'utf8');
    const formData = new FormData();
    formData.append('workflow', new Blob([safeContent], { type: 'application/json' }), 'safe-sample.json');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.scanId);
    assert.equal(body.workflow.name, 'Customer Feedback Notification Flow (Safe Sample)');
    assert.equal(body.workflow.nodeCount, 3);
    assert.equal(body.workflow.edgeCount, 2);
    assert.equal(body.graph.nodes.length, 3);
    assert.equal(body.graph.edges.length, 2);
    // Verify no raw parameter values or contents are leaked in response
    assert.equal(body.graph.nodes[0].parameters, undefined);
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/scans rejects non-JSON file extension', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const formData = new FormData();
    formData.append('workflow', new Blob(['console.log("hello")'], { type: 'text/javascript' }), 'malicious.js');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_FILE_TYPE');
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/scans rejects malformed JSON with 400 without leaking content', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const badContent = '{"name": "Bad", "nodes": [SECRET_HERE';
    const formData = new FormData();
    formData.append('workflow', new Blob([badContent], { type: 'application/json' }), 'bad.json');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'MALFORMED_JSON');
    // Ensure raw string 'SECRET_HERE' is NOT echoed
    assert.ok(!JSON.stringify(body).includes('SECRET_HERE'));
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/scans rejects oversized file (> 2 MB)', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Generate buffer larger than 2MB (2.2 MB)
    const largeBuffer = Buffer.alloc(2.2 * 1024 * 1024, 'a');
    const formData = new FormData();
    formData.append('workflow', new Blob([largeBuffer], { type: 'application/json' }), 'oversized.json');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FILE_TOO_LARGE');
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/scans rejects empty file (0 bytes)', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const formData = new FormData();
    formData.append('workflow', new Blob([''], { type: 'application/json' }), 'empty.json');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'EMPTY_FILE');
  } finally {
    server.close();
  }
});
