import { deepRedact } from '../security/redaction.js';

// Predefined, trusted rule catalog for AI payloads.
// ZERO user-controlled or uploaded strings are passed to n8n/Gemini.
export const TRUSTED_RULE_METADATA = {
  SECRET_LIKE_VALUE: {
    ruleId: 'SECRET_LIKE_VALUE',
    severity: 'high',
    category: 'Hardcoded Secret Detection',
    trustedSummary: 'Exported parameters match known API key, token, or credential formatting patterns.'
  },
  EXTERNAL_HTTP_DESTINATION: {
    ruleId: 'EXTERNAL_HTTP_DESTINATION',
    severity: 'medium',
    category: 'External HTTP Request Review',
    trustedSummary: 'An outbound HTTP Request node transmits data to an external service endpoint.'
  },
  SENSITIVE_TO_EXTERNAL_FLOW: {
    ruleId: 'SENSITIVE_TO_EXTERNAL_FLOW',
    severity: 'medium',
    category: 'Ingestion to External Request Path',
    trustedSummary: 'A directed graph connection exists connecting an unauthenticated entry point (webhook or form) to an outbound HTTP request node.'
  },
  CREDENTIAL_REFERENCE_REVIEW: {
    ruleId: 'CREDENTIAL_REFERENCE_REVIEW',
    severity: 'low',
    category: 'Credential Reference Governance',
    trustedSummary: 'A node references an n8n managed credential identifier for authentication permissions.'
  },
  DESTRUCTIVE_ACTION_REVIEW: {
    ruleId: 'DESTRUCTIVE_ACTION_REVIEW',
    severity: 'medium',
    category: 'Destructive Operation Audit',
    trustedSummary: 'A node executes an explicit data purge, deletion, or permanent filesystem command.'
  },
  UNKNOWN_NODE_COVERAGE: {
    ruleId: 'UNKNOWN_NODE_COVERAGE',
    severity: 'info',
    category: 'Custom Node Coverage Limitation',
    trustedSummary: 'A custom, community-contributed, or third-party node type was detected where static coverage is limited.'
  }
};

/**
 * Builds a strictly allow-listed AI payload from trusted predefined rule metadata.
 * ZERO raw workflow JSON, node names, parameter blobs, or user strings are included.
 *
 * @param {Array<object>} findings - Deterministic findings from scanner
 * @returns {{ findings: Array<object> }}
 */
export function buildSanitizedAiPayload(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return { findings: [] };
  }

  // Deduplicate by ruleId to minimize token usage and prevent repetitive AI queries
  const seenRuleIds = new Set();
  const allowListedItems = [];

  for (const finding of findings) {
    const ruleId = finding?.ruleId;
    if (!ruleId || seenRuleIds.has(ruleId)) continue;

    const trustedMeta = TRUSTED_RULE_METADATA[ruleId];
    if (trustedMeta) {
      seenRuleIds.add(ruleId);
      allowListedItems.push({
        ruleId: trustedMeta.ruleId,
        severity: trustedMeta.severity,
        category: trustedMeta.category,
        summary: trustedMeta.trustedSummary
      });
    }

    // Limit to maximum 6 rule categories
    if (allowListedItems.length >= 6) break;
  }

  const payload = {
    findings: allowListedItems
  };

  // Secondary defense-in-depth safety pass
  return deepRedact(payload);
}

/**
 * Validates the explanation response returned from n8n / Gemini.
 * Rejects unexpected structures, unknown rule IDs, or excessive lengths.
 *
 * @param {*} data - Raw response from n8n webhook
 * @param {Set<string>} submittedRuleIds - The rule IDs that were submitted
 * @returns {Record<string, { summary: string, whyItMatters: string, recommendedActions: string }>}
 */
export function validateAiResponse(data, submittedRuleIds = new Set()) {
  if (!data || typeof data !== 'object') {
    throw new Error('AI response is not a valid JSON object');
  }

  // 1. Unwrap n8n standard array and/or { json: ... } wrapper
  let root = data;
  if (Array.isArray(root)) {
    if (root.length === 0) {
      throw new Error('AI response array is empty');
    }
    // Check if it is directly an array of explanation items
    if (root[0] && typeof root[0] === 'object' && 'ruleId' in root[0]) {
      // Direct array of explanations
    } else {
      // n8n item wrapper: [ { json: { ... } } ] or [ { explanations: ... } ]
      root = root[0]?.json || root[0];
    }
  } else if (root.json && typeof root.json === 'object') {
    root = root.json;
  }

  // 2. Unwrap stringified LLM output if present ({ output: "..." } or { text: "..." })
  if (root && typeof root === 'object') {
    if (typeof root.output === 'string') {
      try {
        root = JSON.parse(root.output);
      } catch (err) {
        throw new Error('AI output property contains invalid JSON: ' + err.message);
      }
    } else if (typeof root.text === 'string' && !('explanations' in root)) {
      try {
        root = JSON.parse(root.text);
      } catch (err) {
        throw new Error('AI text property contains invalid JSON: ' + err.message);
      }
    }
  }

  if (!root || typeof root !== 'object') {
    throw new Error('AI response unwrap did not produce a valid JSON object');
  }

  // Support either { success: true, explanations: [...] } or { explanations: [...] } or array directly
  const rawList = Array.isArray(root.explanations)
    ? root.explanations
    : Array.isArray(root)
      ? root
      : null;

  if (!rawList) {
    throw new Error("AI response missing 'explanations' array");
  }

  const validatedMap = {};
  const MAX_STR_LEN = 1000;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;

    const ruleId = typeof item.ruleId === 'string' ? item.ruleId.trim() : null;
    if (!ruleId || !submittedRuleIds.has(ruleId)) {
      // Ignore explanations for unsubmitted or unknown rules
      continue;
    }

    const summary = typeof item.summary === 'string' ? item.summary.trim().slice(0, MAX_STR_LEN) : '';
    const whyItMatters = typeof item.whyItMatters === 'string' ? item.whyItMatters.trim().slice(0, MAX_STR_LEN) : '';
    const recommendedActions = typeof item.recommendedActions === 'string' ? item.recommendedActions.trim().slice(0, MAX_STR_LEN) : '';

    if (!summary && !whyItMatters && !recommendedActions) {
      continue;
    }

    validatedMap[ruleId] = {
      summary: summary || 'No explanation provided.',
      whyItMatters: whyItMatters || 'Review in accordance with organizational security policies.',
      recommendedActions: recommendedActions || 'Consult n8n security best practices.'
    };
  }

  return validatedMap;
}

/**
 * Communicates with the configured n8n webhook with an explicit timeout.
 * Never throws unhandled errors — returns structured status and explanations.
 *
 * @param {Array<object>} findings - Deterministic findings
 * @param {object} options - Configuration overrides (for testing)
 * @returns {Promise<{
 *   aiStatus: { enabled: boolean, status: 'available'|'unavailable'|'disabled'|'skipped', message: string },
 *   explanations: Record<string, object>
 * }>}
 */
export async function fetchAiExplanations(findings = [], options = {}) {
  const webhookUrl = options.webhookUrl ?? process.env.N8N_WEBHOOK_URL;
  const timeoutMs = parseInt(options.timeoutMs ?? process.env.N8N_REQUEST_TIMEOUT_MS ?? '8000', 10);
  const fetchClient = options.fetchClient ?? globalThis.fetch;

  // 1. Skip if no findings
  if (!Array.isArray(findings) || findings.length === 0) {
    return {
      aiStatus: {
        enabled: Boolean(webhookUrl && webhookUrl.trim()),
        status: 'skipped',
        message: 'No security findings require AI explanation.'
      },
      explanations: {}
    };
  }

  // 2. Disabled if N8N_WEBHOOK_URL is not configured
  if (!webhookUrl || typeof webhookUrl !== 'string' || webhookUrl.trim().length === 0) {
    return {
      aiStatus: {
        enabled: false,
        status: 'disabled',
        message: 'AI explanation disabled — N8N_WEBHOOK_URL is not configured.'
      },
      explanations: {}
    };
  }

  // 3. Build sanitized allow-listed payload
  const payload = buildSanitizedAiPayload(findings);
  const submittedRuleIds = new Set(payload.findings.map((f) => f.ruleId));

  if (submittedRuleIds.size === 0) {
    return {
      aiStatus: {
        enabled: true,
        status: 'skipped',
        message: 'No rule categories matched allow-list for AI explanation.'
      },
      explanations: {}
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchClient(webhookUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[n8n Client] Webhook responded with HTTP status ${response.status}`);
      return {
        aiStatus: {
          enabled: true,
          status: 'unavailable',
          message: 'AI explanations unavailable — showing rule-based findings.'
        },
        explanations: {}
      };
    }

    const data = await response.json();
    const validatedExplanations = validateAiResponse(data, submittedRuleIds);

    const hasExplanations = Object.keys(validatedExplanations).length > 0;

    return {
      aiStatus: {
        enabled: true,
        status: hasExplanations ? 'available' : 'unavailable',
        message: hasExplanations
          ? 'AI explanations generated via n8n + Gemini.'
          : 'AI explanations unavailable — showing rule-based findings.'
      },
      explanations: validatedExplanations
    };
  } catch (err) {
    clearTimeout(timer);

    const isTimeout = err.name === 'AbortError';
    console.warn(`[n8n Client] Webhook call failed: ${isTimeout ? 'Request timed out' : err.message}`);

    return {
      aiStatus: {
        enabled: true,
        status: 'unavailable',
        message: 'AI explanations unavailable — showing rule-based findings.'
      },
      explanations: {}
    };
  }
}
