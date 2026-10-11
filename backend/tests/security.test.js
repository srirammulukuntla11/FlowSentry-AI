import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../src/server.js';
import { redactString, findSecrets, deepRedact } from '../src/security/redaction.js';
import { secretLikeValueRule } from '../src/security/rules/secretLikeValue.rule.js';
import { externalHttpDestinationRule } from '../src/security/rules/externalHttpDestination.rule.js';
import { sensitiveToExternalFlowRule } from '../src/security/rules/sensitiveToExternalFlow.rule.js';
import { credentialReferenceReviewRule } from '../src/security/rules/credentialReferenceReview.rule.js';
import { destructiveActionReviewRule } from '../src/security/rules/destructiveActionReview.rule.js';
import { unknownNodeCoverageRule } from '../src/security/rules/unknownNodeCoverage.rule.js';
import { runSecurityScan } from '../src/security/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../samples');

// ==========================================
// 1. Redaction Engine Unit Tests
// ==========================================

test('REDACTION: Masks Bearer tokens, API keys, and passwords', () => {
  const sampleSecret = 'Bearer sk_live_ABC1234567890abcdef123';
  const redacted = redactString(sampleSecret);

  assert.ok(!redacted.includes('sk_live_ABC1234567890abcdef123'));
  assert.ok(redacted.includes('[REDACTED_SECRET_VALUE]'));

  const textWithPassword = 'const db_password = "SuperSecretPassword123!";';
  const redactedPw = redactString(textWithPassword);
  assert.ok(!redactedPw.includes('SuperSecretPassword123!'));
  assert.ok(redactedPw.includes('[REDACTED_SECRET_VALUE]'));
});

test('REDACTION: findSecrets identifies path without returning raw secret', () => {
  const rawObj = {
    auth: {
      header: 'Bearer sk_test_abcdef1234567890'
    },
    cleanField: 'Hello world'
  };

  const matches = findSecrets(rawObj);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].path, 'root.auth.header');
  assert.ok(matches[0].patternType);
  // Ensure the match metadata does not contain the raw secret
  assert.ok(!JSON.stringify(matches).includes('sk_test_abcdef1234567890'));
});

test('REDACTION: deepRedact scrubs all nested string fields', () => {
  const secret = 'sk_test_mysecrettokentoerase12345';
  const nested = {
    a: {
      b: [
        { key: `Authorization: ${secret}` },
        { safe: 'Normal text' }
      ]
    }
  };

  const clean = deepRedact(nested);
  const serialized = JSON.stringify(clean);
  assert.ok(!serialized.includes(secret));
  assert.ok(serialized.includes('[REDACTED_SECRET_VALUE]'));
  assert.ok(serialized.includes('Normal text'));
});

// ==========================================
// 2. Rule 1: SECRET_LIKE_VALUE
// ==========================================

test('RULE 1: SECRET_LIKE_VALUE flags hardcoded secret and redacts it', () => {
  const fakeSecret = 'sk_test_mock_synthetic_placeholder_token_9999';
  const nodes = [
    {
      id: 'node_1',
      name: 'Auth Node',
      type: 'n8n-nodes-base.httpRequest',
      parameters: {
        headers: `Bearer ${fakeSecret}`
      }
    }
  ];

  const findings = secretLikeValueRule.run(nodes, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'SECRET_LIKE_VALUE');
  assert.equal(findings[0].severity, 'high');
  assert.deepEqual(findings[0].affectedNodeIds, ['node_1']);

  // Assert secret is NEVER present in finding
  assert.ok(!JSON.stringify(findings[0]).includes(fakeSecret));
});

test('RULE 1: SECRET_LIKE_VALUE negative case & false-positive resistance', () => {
  const nodes = [
    {
      id: 'clean_node',
      name: 'Benign Node',
      type: 'n8n-nodes-base.code',
      parameters: {
        text: 'The keyboard typing speed of the secretariat was fast.',
        count: 42,
        active: true
      }
    }
  ];

  const findings = secretLikeValueRule.run(nodes, {});
  assert.equal(findings.length, 0);
});

// ==========================================
// 3. Rule 2: EXTERNAL_HTTP_DESTINATION
// ==========================================

test('RULE 2: EXTERNAL_HTTP_DESTINATION flags HTTP node with parsed host', () => {
  const nodes = [
    {
      id: 'http_1',
      name: 'Send to Stripe',
      type: 'n8n-nodes-base.httpRequest',
      parameters: {
        url: 'https://api.stripe.com/v1/charges?customer=cus_123'
      }
    }
  ];

  const findings = externalHttpDestinationRule.run(nodes, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'EXTERNAL_HTTP_DESTINATION');
  assert.equal(findings[0].severity, 'medium');
  assert.ok(findings[0].evidence.includes('api.stripe.com'));
});

test('RULE 2: EXTERNAL_HTTP_DESTINATION negative case (non-HTTP nodes)', () => {
  const nodes = [
    {
      id: 'code_1',
      name: 'Data Cleanse',
      type: 'n8n-nodes-base.code',
      parameters: { jsCode: 'return $input.all();' }
    }
  ];

  const findings = externalHttpDestinationRule.run(nodes, {});
  assert.equal(findings.length, 0);
});

// ==========================================
// 4. Rule 3: SENSITIVE_TO_EXTERNAL_FLOW
// ==========================================

test('RULE 3: SENSITIVE_TO_EXTERNAL_FLOW flags path from Webhook to HTTP Request', () => {
  const nodes = [
    { id: 'inbound_hook', name: 'Form Webhook', type: 'n8n-nodes-base.webhook' },
    { id: 'transform', name: 'Transform Code', type: 'n8n-nodes-base.code' },
    { id: 'outbound_http', name: 'External API', type: 'n8n-nodes-base.httpRequest' }
  ];

  const graphData = {
    adjacencyList: {
      inbound_hook: ['transform'],
      transform: ['outbound_http'],
      outbound_http: []
    }
  };

  const findings = sensitiveToExternalFlowRule.run(nodes, graphData);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'SENSITIVE_TO_EXTERNAL_FLOW');
  assert.equal(findings[0].severity, 'medium');
  assert.deepEqual(findings[0].affectedNodeIds, ['inbound_hook', 'transform', 'outbound_http']);
});

test('RULE 3: SENSITIVE_TO_EXTERNAL_FLOW negative case when no path exists', () => {
  const nodes = [
    { id: 'inbound_hook', name: 'Form Webhook', type: 'n8n-nodes-base.webhook' },
    { id: 'internal_slack', name: 'Slack Alert', type: 'n8n-nodes-base.slack' },
    { id: 'isolated_http', name: 'Isolated Http', type: 'n8n-nodes-base.httpRequest' }
  ];

  // Inbound webhook only leads to Slack, isolated_http is not reachable
  const graphData = {
    adjacencyList: {
      inbound_hook: ['internal_slack'],
      internal_slack: [],
      isolated_http: []
    }
  };

  const findings = sensitiveToExternalFlowRule.run(nodes, graphData);
  assert.equal(findings.length, 0);
});

// ==========================================
// 5. Rule 4: CREDENTIAL_REFERENCE_REVIEW
// ==========================================

test('RULE 4: CREDENTIAL_REFERENCE_REVIEW audits credential references safely', () => {
  const nodes = [
    {
      id: 'pg_node',
      name: 'Postgres DB',
      type: 'n8n-nodes-base.postgres',
      credentials: {
        postgres: {
          id: 'cred_pg_123',
          name: 'Production Primary DB'
        }
      }
    }
  ];

  const findings = credentialReferenceReviewRule.run(nodes, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'CREDENTIAL_REFERENCE_REVIEW');
  assert.equal(findings[0].severity, 'low');
  assert.ok(findings[0].evidence.includes('Production Primary DB'));
  // Verifies finding emphasizes it is an export reference, not confirmed leaked key
  assert.ok(findings[0].limitations[0].includes('do not contain the underlying secret'));
});

test('RULE 4: CREDENTIAL_REFERENCE_REVIEW negative case (no credentials configured)', () => {
  const nodes = [
    {
      id: 'node_1',
      name: 'No Creds Node',
      type: 'n8n-nodes-base.code',
      credentials: {}
    }
  ];

  const findings = credentialReferenceReviewRule.run(nodes, {});
  assert.equal(findings.length, 0);
});

// ==========================================
// 6. Rule 5: DESTRUCTIVE_ACTION_REVIEW
// ==========================================

test('RULE 5: DESTRUCTIVE_ACTION_REVIEW flags DELETE FROM and DROP statements', () => {
  const nodes = [
    {
      id: 'db_cleanse',
      name: 'Purge Leads',
      type: 'n8n-nodes-base.postgres',
      parameters: {
        query: 'DELETE FROM temp_leads WHERE age > 30;'
      }
    }
  ];

  const findings = destructiveActionReviewRule.run(nodes, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'DESTRUCTIVE_ACTION_REVIEW');
  assert.equal(findings[0].severity, 'medium');
  assert.ok(findings[0].evidence.includes('DELETE FROM'));
});

test('SECURITY: DESTRUCTIVE_ACTION_REVIEW never echoes raw SQL WHERE clauses or column secrets', () => {
  const sensitiveWhereClause = "WHERE customer_ssn = '000-12-3456' AND internal_key = 'shhh_super_secret';";
  const nodes = [
    {
      id: 'db_sensitive_delete',
      name: 'Purge Customer Records',
      type: 'n8n-nodes-base.postgres',
      parameters: {
        query: `DELETE FROM customer_pii ${sensitiveWhereClause}`
      }
    }
  ];

  const findings = destructiveActionReviewRule.run(nodes, {});
  assert.equal(findings.length, 1);
  const findingStr = JSON.stringify(findings[0]);

  // The operation pattern is identified
  assert.ok(findingStr.includes('DELETE FROM'));
  // But sensitive column names, PII, and where clauses are strictly excluded
  assert.ok(!findingStr.includes('000-12-3456'));
  assert.ok(!findingStr.includes('shhh_super_secret'));
  assert.ok(!findingStr.includes('customer_ssn'));
  assert.ok(findingStr.includes('full statement omitted for data safety'));
});

test('SECURITY: SENSITIVE_TO_EXTERNAL_FLOW explicitly clarifies reachability vs transmission', () => {
  const nodes = [
    { id: 'inbound_hook', name: 'Form Webhook', type: 'n8n-nodes-base.webhook' },
    { id: 'outbound_http', name: 'External API', type: 'n8n-nodes-base.httpRequest' }
  ];

  const graphData = {
    adjacencyList: {
      inbound_hook: ['outbound_http'],
      outbound_http: []
    }
  };

  const findings = sensitiveToExternalFlowRule.run(nodes, graphData);
  assert.equal(findings.length, 1);
  assert.ok(findings[0].evidence.includes('topological reachability only; it does not prove that sensitive payload fields are transmitted'));
  assert.ok(findings[0].limitations[0].includes('NOT confirmed sensitive data transmission or exfiltration'));
});

test('RULE 5: DESTRUCTIVE_ACTION_REVIEW negative case (benign SELECT queries)', () => {
  const nodes = [
    {
      id: 'db_read',
      name: 'Read User Profile',
      type: 'n8n-nodes-base.postgres',
      parameters: {
        query: 'SELECT id, email, created_at FROM users WHERE id = 1;'
      }
    }
  ];

  const findings = destructiveActionReviewRule.run(nodes, {});
  assert.equal(findings.length, 0);
});

// ==========================================
// 7. Rule 6: UNKNOWN_NODE_COVERAGE
// ==========================================

test('RULE 6: UNKNOWN_NODE_COVERAGE flags custom third-party node types with info severity', () => {
  const nodes = [
    {
      id: 'custom_node',
      name: 'Enterprise Sync',
      type: 'n8n-nodes-enterprise.customSync'
    }
  ];

  const findings = unknownNodeCoverageRule.run(nodes, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, 'UNKNOWN_NODE_COVERAGE');
  assert.equal(findings[0].severity, 'info');
});

test('RULE 6: UNKNOWN_NODE_COVERAGE negative case (standard n8n-nodes-base)', () => {
  const nodes = [
    {
      id: 'std_webhook',
      name: 'Webhook',
      type: 'n8n-nodes-base.webhook'
    },
    {
      id: 'std_code',
      name: 'Code Node',
      type: 'n8n-nodes-base.code'
    }
  ];

  const findings = unknownNodeCoverageRule.run(nodes, {});
  assert.equal(findings.length, 0);
});

// ==========================================
// 8. Resilient Parameter Handling (Numbers, Booleans, Nulls, Circular)
// ==========================================

test('SCANNER: Robust handling of unusual parameter values without crashing', () => {
  const unusualNodes = [
    {
      id: 'weird_params',
      name: 'Weird Node',
      type: 'n8n-nodes-base.code',
      parameters: {
        nullVal: null,
        numVal: 12345,
        boolVal: false,
        emptyArr: [],
        nestedEmptyObj: {},
        arrOfNumbers: [1, 2, 3]
      }
    }
  ];

  const result = runSecurityScan(unusualNodes, { adjacencyList: {} });
  assert.equal(result.findings.length, 0);
  assert.equal(result.summary.total, 0);
});

// ==========================================
// 9. Full HTTP Integration Tests on Sample Workflows
// ==========================================

test('HTTP: POST /api/scans on safe-sample.json produces clean zero-risk summary', async () => {
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
    assert.equal(body.summary.high, 0);
    assert.equal(body.summary.medium, 0);
    assert.equal(body.findings.length, 0);
  } finally {
    server.close();
  }
});

test('HTTP: POST /api/scans on risky-sample.json produces expected findings with full secret redaction', async () => {
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const riskyContent = fs.readFileSync(path.join(SAMPLES_DIR, 'risky-sample.json'), 'utf8');
    const formData = new FormData();
    formData.append('workflow', new Blob([riskyContent], { type: 'application/json' }), 'risky-sample.json');

    const res = await fetch(`http://localhost:${port}/api/scans`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // Verify all 5 expected risk categories trigger on risky-sample.json
    assert.ok(body.summary.high >= 1); // SECRET_LIKE_VALUE
    assert.ok(body.summary.medium >= 2); // EXTERNAL_HTTP_DESTINATION, SENSITIVE_TO_EXTERNAL_FLOW, DESTRUCTIVE_ACTION_REVIEW
    assert.ok(body.summary.low >= 1); // CREDENTIAL_REFERENCE_REVIEW
    assert.ok(body.summary.info >= 1); // UNKNOWN_NODE_COVERAGE

    const findingRuleIds = body.findings.map((f) => f.ruleId);
    assert.ok(findingRuleIds.includes('SECRET_LIKE_VALUE'));
    assert.ok(findingRuleIds.includes('EXTERNAL_HTTP_DESTINATION'));
    assert.ok(findingRuleIds.includes('SENSITIVE_TO_EXTERNAL_FLOW'));
    assert.ok(findingRuleIds.includes('CREDENTIAL_REFERENCE_REVIEW'));
    assert.ok(findingRuleIds.includes('DESTRUCTIVE_ACTION_REVIEW'));
    assert.ok(findingRuleIds.includes('UNKNOWN_NODE_COVERAGE'));

    // Critical assertion: raw fake token MUST NEVER exist in any part of the response
    const rawResponseBody = JSON.stringify(body);
    assert.ok(!rawResponseBody.includes('sk_test_mock_fake_token_example_only_12345'));
  } finally {
    server.close();
  }
});
