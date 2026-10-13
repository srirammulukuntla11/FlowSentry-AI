import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { validateWorkflow } from '../src/workflow/validator.js';
import app from '../src/server.js';

const SAMPLES_DIR = path.resolve(process.cwd(), '../frontend/public/samples');

test('VALIDATOR: Malformed JSON produces blocking error on json_syntax', () => {
  const result = validateWorkflow('{ "name": "Broken", "nodes": [ ');
  assert.equal(result.isValid, false);
  assert.equal(result.canProceed, false);
  assert.equal(result.summary.errors, 2); // json_syntax + workflow_structure cascade

  const jsonCheck = result.checks.find((c) => c.id === 'json_syntax');
  assert.equal(jsonCheck.status, 'error');
  assert.match(jsonCheck.message, /Malformed JSON/i);
});

test('VALIDATOR: Empty file produces blocking error', () => {
  const result = validateWorkflow('');
  assert.equal(result.isValid, false);
  assert.equal(result.canProceed, false);

  const jsonCheck = result.checks.find((c) => c.id === 'json_syntax');
  assert.equal(jsonCheck.status, 'error');
  assert.match(jsonCheck.message, /Empty file/i);
});

test('VALIDATOR: Non-object root produces blocking error on workflow_structure', () => {
  const result = validateWorkflow('[ { "id": "1", "name": "Node" } ]');
  assert.equal(result.isValid, false);
  assert.equal(result.canProceed, false);

  const structCheck = result.checks.find((c) => c.id === 'workflow_structure');
  assert.equal(structCheck.status, 'error');
  assert.match(structCheck.message, /Root must be a JSON object/i);
});

test('VALIDATOR: Missing nodes array produces blocking error', () => {
  const result = validateWorkflow(JSON.stringify({ name: 'Workflow Without Nodes' }));
  assert.equal(result.isValid, false);
  assert.equal(result.canProceed, false);

  const structCheck = result.checks.find((c) => c.id === 'workflow_structure');
  assert.equal(structCheck.status, 'error');
  assert.match(structCheck.message, /Missing required 'nodes' property/i);
});

test('VALIDATOR: Empty nodes array produces blocking error', () => {
  const result = validateWorkflow(JSON.stringify({ name: 'Empty Workflow', nodes: [] }));
  assert.equal(result.isValid, false);
  assert.equal(result.canProceed, false);

  const structCheck = result.checks.find((c) => c.id === 'workflow_structure');
  assert.equal(structCheck.status, 'error');
  assert.match(structCheck.message, /0 nodes/i);
});

test('VALIDATOR: Duplicate node IDs generate non-blocking warning and canProceed is true', () => {
  const workflow = {
    name: 'Duplicate Node IDs',
    nodes: [
      { id: 'node_dup', name: 'First Node', type: 'n8n-nodes-base.webhook', position: [100, 100] },
      { id: 'node_dup', name: 'Second Node', type: 'n8n-nodes-base.httpRequest', position: [300, 100] }
    ]
  };

  const result = validateWorkflow(JSON.stringify(workflow));
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true); // non-blocking!
  assert.equal(result.hasWarnings, true);

  const idCheck = result.checks.find((c) => c.id === 'node_identifiers');
  assert.equal(idCheck.status, 'warning');
  assert.match(idCheck.details[0], /Duplicate node ID 'node_dup'/i);
});

test('VALIDATOR: Missing node ID generates non-blocking warning', () => {
  const workflow = {
    name: 'Missing ID',
    nodes: [
      { name: 'Node Without ID', type: 'n8n-nodes-base.code', position: [100, 100] }
    ]
  };

  const result = validateWorkflow(JSON.stringify(workflow));
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true);

  const idCheck = result.checks.find((c) => c.id === 'node_identifiers');
  assert.equal(idCheck.status, 'warning');
  assert.match(idCheck.details[0], /missing an 'id'/i);
});

test('VALIDATOR: Connections referencing nonexistent target node generate non-blocking warning', () => {
  const workflow = {
    name: 'Invalid Connection',
    nodes: [
      { id: 'node_1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [100, 100] }
    ],
    connections: {
      node_1: {
        main: [
          [{ node: 'nonexistent_target_node', type: 'main', index: 0 }]
        ]
      }
    }
  };

  const result = validateWorkflow(JSON.stringify(workflow));
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true); // non-blocking!

  const connCheck = result.checks.find((c) => c.id === 'connection_integrity');
  assert.equal(connCheck.status, 'warning');
  assert.match(connCheck.details[0], /nonexistent_target_node/i);
});

test('VALIDATOR: Malformed connection socket structure generates non-blocking warning', () => {
  const workflow = {
    name: 'Malformed Connections',
    nodes: [
      { id: 'node_1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [100, 100] }
    ],
    connections: {
      node_1: 'invalid-non-object-outputs'
    }
  };

  const result = validateWorkflow(JSON.stringify(workflow));
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true);

  const connStructCheck = result.checks.find((c) => c.id === 'connection_structure');
  assert.equal(connStructCheck.status, 'warning');
});

test('VALIDATOR: Safe Sample fixture passes all 6 checks cleanly', () => {
  const safePath = path.join(SAMPLES_DIR, 'safe-sample.json');
  const safeContent = fs.readFileSync(safePath, 'utf8');

  const result = validateWorkflow(safeContent);
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.passed, 6);
  assert.equal(result.summary.warnings, 0);
});

test('VALIDATOR: Risky Sample fixture passes with canProceed === true and zero blocking errors', () => {
  const riskyPath = path.join(SAMPLES_DIR, 'risky-sample.json');
  const riskyContent = fs.readFileSync(riskyPath, 'utf8');

  const result = validateWorkflow(riskyContent);
  assert.equal(result.isValid, true);
  assert.equal(result.canProceed, true);
  assert.equal(result.summary.errors, 0);
});

test('HTTP: POST /api/validate returns 200 with structured validation payload', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const safeContent = fs.readFileSync(path.join(SAMPLES_DIR, 'safe-sample.json'), 'utf8');
    const formData = new FormData();
    formData.append('workflow', new Blob([safeContent], { type: 'application/json' }), 'safe-sample.json');

    const res = await fetch(`http://localhost:${port}/api/validate`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.isValid, true);
    assert.equal(body.canProceed, true);
    assert.equal(body.summary.totalChecks, 6);
    assert.equal(body.summary.errors, 0);
    assert.equal(Array.isArray(body.checks), true);
    assert.equal(body.checks.length, 6);
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/validate on broken file returns 200 with canProceed: false and blocking error details', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const brokenContent = '{ "malformed": [ ';
    const formData = new FormData();
    formData.append('workflow', new Blob([brokenContent], { type: 'application/json' }), 'broken.json');

    const res = await fetch(`http://localhost:${port}/api/validate`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.isValid, false);
    assert.equal(body.canProceed, false);
    assert.equal(body.summary.errors > 0, true);
    assert.equal(body.blockingErrors.length > 0, true);
  } finally {
    server.close();
  }
});
