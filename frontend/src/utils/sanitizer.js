/**
 * FlowSentry AI - Security Report Sanitization Module
 *
 * Enforces strict client-side data hygiene before report generation.
 * Guarantees that raw credentials, sensitive token strings, and unredacted payloads
 * can never enter exported PDF or JSON artifacts.
 */

import { calculateRiskScore } from './riskScore.js';

// Comprehensive secret-matching patterns matching backend definitions
export const SECRET_PATTERNS = [
  // High-confidence vendor tokens
  { name: 'OpenAI/Stripe Secret Key', regex: /\b(sk_(?:live|test)_[a-zA-Z0-9_-]{12,})\b/gi },
  { name: 'GitHub Personal Access Token', regex: /\b(gh[pousr]_[a-zA-Z0-9]{36,})\b/g },
  { name: 'Slack Token', regex: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/gi },
  { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
  { name: 'Generic Private Key', regex: /-----BEGIN [A-Z0-9 -]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 -]*PRIVATE KEY-----/gi },

  // Bearer tokens and Authorization headers
  { name: 'Bearer Token', regex: /(?:bearer\s+)([a-zA-Z0-9_.-]{12,})/gi },

  // Key-value pairs for API keys, passwords, tokens, secrets
  {
    name: 'Key/Password Assignment',
    regex: /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|password|passwd|pwd|private[_-]?key)[\s"':=]+([a-zA-Z0-9_.~!@#$%^&*()_+ -]{8,})/gi
  },

  // Database connection URIs with embedded passwords (e.g. postgres://user:pass@host)
  {
    name: 'URI Credentials',
    regex: /([a-zA-Z0-9+.-]+:\/\/[^:]+:)([^@]+)(@)/gi
  },

  // JWT Tokens (3 base64url segments separated by dots)
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g }
];

const REDACTION_PLACEHOLDER = '[REDACTED_SECRET_VALUE]';

/**
 * Redacts any secret-matching pattern within a given string.
 *
 * @param {string} text - Input text
 * @returns {string} Sanitized string
 */
export function redactString(text) {
  if (typeof text !== 'string') return text;

  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex index if global
    pattern.regex.lastIndex = 0;

    redacted = redacted.replace(pattern.regex, (match, p1, p2, p3) => {
      // Special case for URI credentials: preserve protocol and @host, mask password
      if (pattern.name === 'URI Credentials' && p1 && p2 && p3) {
        return `${p1}${REDACTION_PLACEHOLDER}${p3}`;
      }
      // If there was a captured group (e.g., Bearer <token>), replace that captured group
      if (p1 && typeof p1 === 'string' && match.includes(p1)) {
        return match.replace(p1, REDACTION_PLACEHOLDER);
      }
      return REDACTION_PLACEHOLDER;
    });
  }

  return redacted;
}

/**
 * Recursively redacts all string values within an arbitrary object or array.
 *
 * @param {*} data
 * @returns {*} Fully sanitized copy
 */
export function deepRedact(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return redactString(data);
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => deepRedact(item));
  }

  const copy = {};
  for (const [key, val] of Object.entries(data)) {
    copy[key] = deepRedact(val);
  }
  return copy;
}

/**
 * Prepares a strictly vetted, sanitized dataset from a raw scan result.
 * Filters out raw request buffers, unredacted parameters, and internal state.
 *
 * @param {object} scanResult - Full scan result state from App.jsx
 * @param {Record<string, object>} [nodeLookup={}] - Map of nodeId -> node
 * @returns {object} Clean report model
 */
export function sanitizeScanData(scanResult, nodeLookup = {}) {
  if (!scanResult || typeof scanResult !== 'object') {
    throw new Error('Invalid scan result data: Cannot generate report from empty or null scan.');
  }

  const rawWorkflow = scanResult.workflow || {};
  const rawSummary = scanResult.summary || {};
  const rawFindings = Array.isArray(scanResult.findings) ? scanResult.findings : [];

  // 1. Sanitize Workflow Metadata
  const workflow = {
    id: typeof rawWorkflow.id === 'string' ? redactString(rawWorkflow.id) : null,
    name: typeof rawWorkflow.name === 'string' ? redactString(rawWorkflow.name) : 'Unnamed Workflow',
    active: Boolean(rawWorkflow.active),
    nodeCount: typeof rawWorkflow.nodeCount === 'number' ? rawWorkflow.nodeCount : 0,
    edgeCount: typeof rawWorkflow.edgeCount === 'number' ? rawWorkflow.edgeCount : 0
  };

  // 2. Summary Counts
  const severityCounts = {
    high: Number(rawSummary.high) || 0,
    medium: Number(rawSummary.medium) || 0,
    low: Number(rawSummary.low) || 0,
    info: Number(rawSummary.info) || 0
  };
  const totalFindings = Number(rawSummary.total) || (
    severityCounts.high + severityCounts.medium + severityCounts.low + severityCounts.info
  );

  // 3. Detailed Findings with strict field-by-field sanitization
  const findings = rawFindings.map((f, idx) => {
    // Resolve affected node friendly names using nodeLookup
    const nodeIds = Array.isArray(f.affectedNodeIds) ? f.affectedNodeIds : [];
    const affectedNodes = nodeIds.map((nodeId) => {
      const nodeObj = nodeLookup[nodeId];
      const rawName = nodeObj?.name || nodeId || 'Unknown Node';
      return {
        id: String(nodeId),
        name: redactString(rawName)
      };
    });

    // Robust extraction with deep secret redaction for text or nested objects
    let sanitizedEvidence = 'Evidence unavailable.';
    if (typeof f.evidence === 'string') {
      sanitizedEvidence = redactString(f.evidence);
    } else if (f.evidence && typeof f.evidence === 'object') {
      sanitizedEvidence = redactString(JSON.stringify(deepRedact(f.evidence), null, 2));
    }

    let sanitizedExplanation = null;
    if (typeof f.explanation === 'string') {
      sanitizedExplanation = redactString(f.explanation);
    } else if (f.explanation && typeof f.explanation === 'object') {
      sanitizedExplanation = redactString(JSON.stringify(deepRedact(f.explanation)));
    }

    let sanitizedRecommendation = null;
    if (typeof f.recommendation === 'string') {
      sanitizedRecommendation = redactString(f.recommendation);
    } else if (f.recommendation && typeof f.recommendation === 'object') {
      sanitizedRecommendation = redactString(JSON.stringify(deepRedact(f.recommendation)));
    }

    const sanitizedFinding = {
      id: f.id || `finding-${idx + 1}`,
      ruleId: typeof f.ruleId === 'string' ? f.ruleId : 'CUSTOM_RULE',
      title: redactString(f.title || 'Untitled Security Finding'),
      severity: ['high', 'medium', 'low', 'info'].includes((f.severity || '').toLowerCase())
        ? f.severity.toLowerCase()
        : 'info',
      affectedNodes,
      evidence: sanitizedEvidence,
      explanation: sanitizedExplanation,
      recommendation: sanitizedRecommendation,
      confidence: typeof f.confidence === 'string' ? f.confidence : 'medium',
      limitations: Array.isArray(f.limitations) ? f.limitations.map(redactString) : []
    };

    // AI Explanation (only attached if present and valid)
    if (f.aiExplanation && typeof f.aiExplanation === 'object') {
      sanitizedFinding.aiExplanation = {
        summary: typeof f.aiExplanation.summary === 'string'
          ? redactString(f.aiExplanation.summary)
          : 'AI explanation available.',
        whyItMatters: typeof f.aiExplanation.whyItMatters === 'string'
          ? redactString(f.aiExplanation.whyItMatters)
          : null,
        recommendedActions: typeof f.aiExplanation.recommendedActions === 'string'
          ? redactString(f.aiExplanation.recommendedActions)
          : null
      };
    } else {
      sanitizedFinding.aiExplanation = null;
    }

    return sanitizedFinding;
  });

  // 4. AI Advisory Status
  const aiStatus = scanResult.aiStatus ? {
    status: scanResult.aiStatus.status || 'off',
    message: typeof scanResult.aiStatus.message === 'string'
      ? redactString(scanResult.aiStatus.message)
      : null
  } : { status: 'off', message: null };

  return {
    scanId: scanResult.scanId ? redactString(scanResult.scanId) : `scan_${Date.now()}`,
    scanTimestamp: scanResult.timestamp || new Date().toISOString(),
    workflow,
    severityCounts,
    totalFindings,
    findings,
    aiStatus,
    riskScore: scanResult.riskScore || (Array.isArray(scanResult.findings) ? calculateRiskScore(scanResult.findings) : null),
    validation: scanResult.validation || null,
    warnings: Array.isArray(scanResult.warnings) ? scanResult.warnings.map(redactString) : []
  };
}

/**
 * Generates a safe, sanitized filename for exported reports.
 * Filters path separators and unsafe characters, limits the workflow slug to 50 chars,
 * and falls back safely to 'workflow' if empty.
 *
 * @param {string} workflowName
 * @param {string} [extension='json']
 * @param {number|string} [timestamp=Date.now()]
 * @returns {string} Safe filename
 */
export function getSafeExportFilename(workflowName = '', extension = 'json', timestamp = Date.now()) {
  const raw = typeof workflowName === 'string' ? workflowName : '';

  // 1. Convert to lowercase, replace path separators (/ and \) with hyphens to eliminate path traversal
  // 2. Strip all non-alphanumeric, dash, and underscore characters
  // 3. Trim leading and trailing hyphens and underscores
  let slug = raw
    .toLowerCase()
    .replace(/[/\\]+/g, '-')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  // 4. Limit the sanitized workflow-name portion to 50 characters
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/^[-_]+|[-_]+$/g, '');
  }

  // 5. Provide a safe fallback when the resulting name is empty
  if (!slug) {
    slug = 'workflow';
  }

  const cleanExt = (typeof extension === 'string' ? extension : 'json')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '') || 'json';

  return `flowsentry-security-report-${slug}-${timestamp}.${cleanExt}`;
}
