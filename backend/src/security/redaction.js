/**
 * FlowSentry AI - Security Redaction Module
 * Detects secret-like patterns in arbitrary values and redacts them immediately in-memory.
 * Original secrets are NEVER retained in findings, logs, or API payloads.
 */

// Regex patterns for secret-like values
export const SECRET_PATTERNS = [
  // High-confidence vendor tokens
  { name: 'OpenAI/Stripe Secret Key', regex: /\b(sk_(?:live|test)_[a-zA-Z0-9_-]{12,})\b/gi },
  { name: 'GitHub Personal Access Token', regex: /\b(gh[pousr]_[a-zA-Z0-9]{36,})\b/g },
  { name: 'Slack Token', regex: /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/gi },
  { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/g },
  { name: 'Generic Private Key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi },

  // Bearer tokens and Authorization headers
  { name: 'Bearer Token', regex: /(?:bearer\s+)([a-zA-Z0-9_.\-]{12,})/gi },

  // Key-value pairs for API keys, passwords, tokens, secrets
  { 
    name: 'Key/Password Assignment', 
    regex: /(?:api[_-]?key|client[_-]?secret|auth[_-]?token|password|passwd|pwd|private[_-]?key)[\s"':=]+([a-zA-Z0-9_\-.~!@#$%^&*()_+]{8,})/gi 
  },

  // JWT Tokens (3 base64url segments separated by dots)
  { name: 'JSON Web Token (JWT)', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g }
];

/**
 * Replaces any detected secret substrings within a string with a secure redaction placeholder.
 *
 * @param {string} text - Input text that may contain secrets
 * @returns {string} Sanitized string with secrets masked
 */
export function redactString(text) {
  if (typeof text !== 'string') return text;

  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, (match, captured) => {
      // If there is a captured group (e.g., key value in Bearer <token>), redact the group or whole match
      if (captured) {
        return match.replace(captured, '[REDACTED_SECRET_VALUE]');
      }
      return '[REDACTED_SECRET_VALUE]';
    });
  }

  return redacted;
}

/**
 * Scans a value (string, object, array) and returns whether secrets were found,
 * along with a list of sanitized locations and pattern types without the raw secret.
 *
 * @param {*} value - Value to inspect
 * @param {string} path - Current property path
 * @returns {Array<{ path: string, patternType: string }>}
 */
export function findSecrets(value, path = 'root') {
  const matches = [];

  const inspect = (val, currentPath) => {
    if (val === null || val === undefined) return;

    if (typeof val === 'string') {
      for (const pattern of SECRET_PATTERNS) {
        // Reset lastIndex for regexes with global flag
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(val)) {
          matches.push({
            path: currentPath,
            patternType: pattern.name
          });
          break; // Avoid duplicate matches for same string
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, index) => inspect(item, `${currentPath}[${index}]`));
    } else if (typeof val === 'object') {
      for (const [key, propVal] of Object.entries(val)) {
        inspect(propVal, `${currentPath}.${key}`);
      }
    }
  };

  inspect(value, path);
  return matches;
}

/**
 * Deep-clones an object or array while applying redaction to all string properties.
 *
 * @param {*} data
 * @returns {*} Fully redacted copy
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
