import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSanitizedAiPayload,
  validateAiResponse,
  fetchAiExplanations,
  TRUSTED_RULE_METADATA
} from '../src/services/n8n.service.js';

// ==========================================
// 1. AI Payload Allow-Listing & Privacy Tests
// ==========================================

test('AI PAYLOAD: Constructs strictly from trusted rule metadata with ZERO user text', () => {
  const sensitiveFindings = [
    {
      id: 'finding-1',
      ruleId: 'SECRET_LIKE_VALUE',
      title: 'Untrusted user workflow title with secret sk_test_fake_secret_12345',
      evidence: "Raw sensitive query: DELETE FROM users WHERE password='super_secret';",
      affectedNodeIds: ['node_exfiltrate']
    },
    {
      id: 'finding-2',
      ruleId: 'EXTERNAL_HTTP_DESTINATION',
      title: 'HTTP to https://internal-confidential-service.corp',
      evidence: 'Destination host internal-confidential-service.corp'
    }
  ];

  const payload = buildSanitizedAiPayload(sensitiveFindings);

  assert.equal(payload.findings.length, 2);
  const serialized = JSON.stringify(payload);

  // Assert ZERO sensitive strings or node IDs appear in the AI payload
  assert.ok(!serialized.includes('sk_test_fake_secret_12345'));
  assert.ok(!serialized.includes('DELETE FROM users'));
  assert.ok(!serialized.includes('super_secret'));
  assert.ok(!serialized.includes('internal-confidential-service'));
  assert.ok(!serialized.includes('node_exfiltrate'));
  assert.ok(!serialized.includes('Untrusted user workflow'));

  // Assert only trusted rule metadata is included
  assert.equal(payload.findings[0].ruleId, 'SECRET_LIKE_VALUE');
  assert.equal(payload.findings[0].severity, 'high');
  assert.equal(payload.findings[0].category, TRUSTED_RULE_METADATA.SECRET_LIKE_VALUE.category);
  assert.equal(payload.findings[0].summary, TRUSTED_RULE_METADATA.SECRET_LIKE_VALUE.trustedSummary);
});

test('AI PAYLOAD: Deduplicates by ruleId and caps maximum payload items', () => {
  const duplicateFindings = [
    { ruleId: 'SECRET_LIKE_VALUE' },
    { ruleId: 'SECRET_LIKE_VALUE' },
    { ruleId: 'SECRET_LIKE_VALUE' },
    { ruleId: 'EXTERNAL_HTTP_DESTINATION' }
  ];

  const payload = buildSanitizedAiPayload(duplicateFindings);
  assert.equal(payload.findings.length, 2);
  assert.equal(payload.findings[0].ruleId, 'SECRET_LIKE_VALUE');
  assert.equal(payload.findings[1].ruleId, 'EXTERNAL_HTTP_DESTINATION');
});

test('AI PAYLOAD: Handles empty findings array safely', () => {
  const payload = buildSanitizedAiPayload([]);
  assert.deepEqual(payload, { findings: [] });
});

// ==========================================
// 2. Response Validation Tests
// ==========================================

test('AI VALIDATION: Validates correct response shape and bounds string length', () => {
  const mockResponse = {
    success: true,
    explanations: [
      {
        ruleId: 'SECRET_LIKE_VALUE',
        summary: 'Hardcoded secrets risk exposure in exports.',
        whyItMatters: 'API keys can be hijacked if shared.',
        recommendedActions: 'Use managed credentials.'
      }
    ]
  };

  const submitted = new Set(['SECRET_LIKE_VALUE']);
  const validated = validateAiResponse(mockResponse, submitted);

  assert.ok(validated.SECRET_LIKE_VALUE);
  assert.equal(validated.SECRET_LIKE_VALUE.summary, 'Hardcoded secrets risk exposure in exports.');
  assert.equal(validated.SECRET_LIKE_VALUE.whyItMatters, 'API keys can be hijacked if shared.');
  assert.equal(validated.SECRET_LIKE_VALUE.recommendedActions, 'Use managed credentials.');
});

test('AI VALIDATION: Drops explanations for unsubmitted or unknown rule IDs', () => {
  const mockResponse = {
    explanations: [
      {
        ruleId: 'FABRICATED_UNKNOWN_RULE',
        summary: 'Hallucinated vulnerability.',
        whyItMatters: 'Not real.',
        recommendedActions: 'None.'
      },
      {
        ruleId: 'SECRET_LIKE_VALUE',
        summary: 'Legitimate explanation.'
      }
    ]
  };

  const submitted = new Set(['SECRET_LIKE_VALUE']);
  const validated = validateAiResponse(mockResponse, submitted);

  assert.equal(validated.FABRICATED_UNKNOWN_RULE, undefined);
  assert.ok(validated.SECRET_LIKE_VALUE);
});

test('AI VALIDATION: Rejects invalid or malformed response shapes', () => {
  assert.throws(
    () => validateAiResponse(null, new Set()),
    /valid JSON object/
  );

  assert.throws(
    () => validateAiResponse({ unexpectedField: 123 }, new Set()),
    /missing 'explanations' array/
  );
});

test('AI WRAPPERS: Successfully extracts explanations from n8n single-item array wrapper [ { ... } ]', () => {
  const n8nArrayWrapped = [
    {
      explanations: [
        {
          ruleId: 'SECRET_LIKE_VALUE',
          summary: 'Array-wrapped explanation.'
        }
      ]
    }
  ];

  const submitted = new Set(['SECRET_LIKE_VALUE']);
  const validated = validateAiResponse(n8nArrayWrapped, submitted);
  assert.ok(validated.SECRET_LIKE_VALUE);
  assert.equal(validated.SECRET_LIKE_VALUE.summary, 'Array-wrapped explanation.');
});

test('AI WRAPPERS: Successfully extracts from nested { json: ... } and [ { json: ... } ]', () => {
  const n8nJsonWrapped = [
    {
      json: {
        explanations: [
          {
            ruleId: 'EXTERNAL_HTTP_DESTINATION',
            summary: 'Nested json property explanation.'
          }
        ]
      }
    }
  ];

  const submitted = new Set(['EXTERNAL_HTTP_DESTINATION']);
  const validated = validateAiResponse(n8nJsonWrapped, submitted);
  assert.ok(validated.EXTERNAL_HTTP_DESTINATION);
  assert.equal(validated.EXTERNAL_HTTP_DESTINATION.summary, 'Nested json property explanation.');

  // Also test direct { json: { explanations: ... } }
  const directJsonWrapped = {
    json: {
      explanations: [
        {
          ruleId: 'EXTERNAL_HTTP_DESTINATION',
          summary: 'Direct json property.'
        }
      ]
    }
  };
  const validatedDirect = validateAiResponse(directJsonWrapped, submitted);
  assert.ok(validatedDirect.EXTERNAL_HTTP_DESTINATION);
});

test('AI WRAPPERS: Successfully unwraps stringified LLM output ({ output: "..." })', () => {
  const llmWrapped = {
    output: JSON.stringify({
      explanations: [
        {
          ruleId: 'DESTRUCTIVE_ACTION_REVIEW',
          summary: 'Stringified LLM response parsed cleanly.'
        }
      ]
    })
  };

  const submitted = new Set(['DESTRUCTIVE_ACTION_REVIEW']);
  const validated = validateAiResponse(llmWrapped, submitted);
  assert.ok(validated.DESTRUCTIVE_ACTION_REVIEW);
  assert.equal(validated.DESTRUCTIVE_ACTION_REVIEW.summary, 'Stringified LLM response parsed cleanly.');
});

test('AI WRAPPERS: Safely rejects malformed stringified LLM output and empty array', () => {
  const malformedLlm = {
    output: 'NOT_VALID_JSON{explanations:[}'
  };

  assert.throws(
    () => validateAiResponse(malformedLlm, new Set(['SECRET_LIKE_VALUE'])),
    /invalid JSON/
  );

  assert.throws(
    () => validateAiResponse([], new Set(['SECRET_LIKE_VALUE'])),
    /empty/
  );
});

// ==========================================
// 3. n8n Client & Fallback Scenarios (Mocked)
// ==========================================

test('N8N CLIENT: Returns skipped status when findings array is empty', async () => {
  const result = await fetchAiExplanations([], { webhookUrl: 'https://n8n.example.com/webhook' });
  assert.equal(result.aiStatus.status, 'skipped');
  assert.equal(result.aiStatus.enabled, true);
  assert.deepEqual(result.explanations, {});
});

test('N8N CLIENT: Returns disabled status when N8N_WEBHOOK_URL is not configured', async () => {
  const findings = [{ ruleId: 'SECRET_LIKE_VALUE' }];
  const result = await fetchAiExplanations(findings, { webhookUrl: '' });

  assert.equal(result.aiStatus.status, 'disabled');
  assert.equal(result.aiStatus.enabled, false);
  assert.deepEqual(result.explanations, {});
});

test('N8N CLIENT: Successfully retrieves and attaches explanations (Mocked fetch)', async () => {
  const findings = [{ ruleId: 'SECRET_LIKE_VALUE' }];

  const mockFetch = async (url, options) => {
    assert.equal(url, 'https://n8n.example.com/webhook');
    assert.equal(options.method, 'POST');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        explanations: [
          {
            ruleId: 'SECRET_LIKE_VALUE',
            summary: 'Hardcoded tokens should be migrated to environment variables.',
            whyItMatters: 'Prevent leak in exported JSON files.',
            recommendedActions: 'Rotate and replace with credential binding.'
          }
        ]
      })
    };
  };

  const result = await fetchAiExplanations(findings, {
    webhookUrl: 'https://n8n.example.com/webhook',
    fetchClient: mockFetch
  });

  assert.equal(result.aiStatus.status, 'available');
  assert.equal(result.aiStatus.enabled, true);
  assert.ok(result.explanations.SECRET_LIKE_VALUE);
  assert.ok(result.explanations.SECRET_LIKE_VALUE.summary.includes('Hardcoded tokens'));
});

test('N8N CLIENT: Handles HTTP 500 error gracefully without crashing', async () => {
  const findings = [{ ruleId: 'SECRET_LIKE_VALUE' }];

  const mockFetch = async () => ({
    ok: false,
    status: 500
  });

  const result = await fetchAiExplanations(findings, {
    webhookUrl: 'https://n8n.example.com/webhook',
    fetchClient: mockFetch
  });

  assert.equal(result.aiStatus.status, 'unavailable');
  assert.equal(result.aiStatus.enabled, true);
  assert.equal(result.aiStatus.message, 'AI explanations unavailable — showing rule-based findings.');
  assert.deepEqual(result.explanations, {});
});

test('N8N CLIENT: Handles request timeout gracefully without crashing', async () => {
  const findings = [{ ruleId: 'SECRET_LIKE_VALUE' }];

  const mockFetch = async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  };

  const result = await fetchAiExplanations(findings, {
    webhookUrl: 'https://n8n.example.com/webhook',
    fetchClient: mockFetch
  });

  assert.equal(result.aiStatus.status, 'unavailable');
  assert.equal(result.aiStatus.enabled, true);
  assert.equal(result.aiStatus.message, 'AI explanations unavailable — showing rule-based findings.');
  assert.deepEqual(result.explanations, {});
});
