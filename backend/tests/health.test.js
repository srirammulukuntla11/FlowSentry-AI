import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/server.js';

test('GET /api/health returns 200 and expected payload', async (t) => {
  // Start server on an ephemeral port for testing
  const server = app.listen(0);
  const address = server.address();
  const port = address.port;

  try {
    const response = await fetch(`http://localhost:${port}/api/health`);
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.service, 'flowsentry-api');
    assert.equal(body.status, 'operational');
    assert.ok(body.timestamp);
  } finally {
    server.close();
  }
});
