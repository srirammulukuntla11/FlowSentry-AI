import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  redactString,
  deepRedact,
  sanitizeScanData,
  getSafeExportFilename
} from '../src/utils/sanitizer.js';
import { buildJsonReport, REPORT_SCHEMA_VERSION } from '../src/utils/jsonReportGenerator.js';
import { sanitizePdfText } from '../src/utils/pdfGenerator.js';

describe('Security Report Sanitizer & Redaction Module', () => {
  it('should redact high-confidence vendor API keys and secrets', () => {
    const raw = 'Bearer sk_live_abcdef1234567890 and stripe secret sk_test_9876543210abcdef';
    const cleaned = redactString(raw);

    assert.ok(!cleaned.includes('sk_live_abcdef1234567890'), 'Should mask sk_live key');
    assert.ok(!cleaned.includes('sk_test_9876543210abcdef'), 'Should mask sk_test key');
    assert.ok(cleaned.includes('[REDACTED_SECRET_VALUE]'), 'Should contain redaction placeholder');
  });

  it('should redact GitHub, Slack, and AWS credential tokens', () => {
    const raw = 'GitHub token ghp_123456789012345678901234567890123456 and Slack xoxb-1234567890-abcdefgh and AWS AKIAIOSFODNN7EXAMPLE';
    const cleaned = redactString(raw);

    assert.ok(!cleaned.includes('ghp_123456789012345678901234567890123456'));
    assert.ok(!cleaned.includes('xoxb-1234567890-abcdefgh'));
    assert.ok(!cleaned.includes('AKIAIOSFODNN7EXAMPLE'));
  });

  it('should redact multiline PEM-style private keys', () => {
    const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y8vB...
dGVzdC1wcml2YXRlLWtleS1kYXRhCg==
-----END RSA PRIVATE KEY-----`;

    const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEI...
ZW5jcnlwdGVkLWRhdGEK
-----END EC PRIVATE KEY-----`;

    const opensshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAA...
-----END OPENSSH PRIVATE KEY-----`;

    const textWithKeys = `Embedded key:\n${rsaKey}\nand also:\n${ecKey}\nand:\n${opensshKey}`;
    const cleaned = redactString(textWithKeys);

    assert.ok(!cleaned.includes('MIIEowIBAAKCAQEA0Y8vB'), 'RSA private key body must be redacted');
    assert.ok(!cleaned.includes('MHcCAQEEI'), 'EC private key body must be redacted');
    assert.ok(!cleaned.includes('b3BlbnNzaC1rZXktdjEAAAA'), 'OpenSSH private key body must be redacted');
    assert.ok(!cleaned.includes('-----BEGIN RSA PRIVATE KEY-----'), 'PEM header must be redacted');
    assert.ok(!cleaned.includes('-----END RSA PRIVATE KEY-----'), 'PEM footer must be redacted');
    assert.ok(cleaned.includes('[REDACTED_SECRET_VALUE]'), 'Must replace with redaction placeholder');
  });

  it('should redact URI credentials in database strings', () => {
    const raw = 'postgres://admin:SuperSecretPass123!@db.internal:5432/production';
    const cleaned = redactString(raw);

    assert.ok(!cleaned.includes('SuperSecretPass123!'), 'Password in URI must be masked');
    assert.ok(cleaned.includes('postgres://admin:'), 'Protocol and username preserved');
    assert.ok(cleaned.includes('@db.internal:5432/production'), 'Host preserved');
  });

  it('should deeply redact nested objects and arrays', () => {
    const nestedData = {
      workflowName: 'Test Flow',
      headers: [
        { key: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' },
        { key: 'X-API-KEY', value: 'sk_live_9999999999999999' }
      ],
      config: {
        dbUrl: 'postgres://user:Secret1234@localhost:5432/db',
        credentials: {
          key: 'AKIA1111222233334444'
        }
      }
    };

    const cleaned = deepRedact(nestedData);

    assert.ok(!JSON.stringify(cleaned).includes('sk_live_9999999999999999'));
    assert.ok(!JSON.stringify(cleaned).includes('Secret1234'));
    assert.ok(!JSON.stringify(cleaned).includes('AKIA1111222233334444'));
  });

  it('should safely sanitize raw scan results into a canonical report data model', () => {
    const mockScan = {
      scanId: 'scan_123_abc',
      timestamp: '2026-10-12T12:00:00.000Z',
      workflow: {
        id: 'wf-1',
        name: 'Sync Flow with sk_live_secret1234567890',
        active: true,
        nodeCount: 4,
        edgeCount: 3
      },
      summary: {
        total: 2,
        high: 1,
        medium: 1,
        low: 0,
        info: 0
      },
      findings: [
        {
          id: 'f-1',
          ruleId: 'SECRET_LIKE_VALUE',
          title: 'Hardcoded key in parameters: sk_live_titleKey12345',
          severity: 'high',
          affectedNodeIds: ['node-1'],
          evidence: {
            authHeader: 'Bearer sk_live_evidenceSecret9999',
            nested: ['ghp_111122223333444455556666777788889999']
          },
          explanation: { details: 'Exposes private key sk_live_explSecret8888' },
          recommendation: 'Rotate key sk_live_recSecret7777 immediately',
          limitations: ['Static heuristic with sk_live_limitSecret6666'],
          aiExplanation: {
            summary: 'Token sk_live_secret1234567890 should be revoked.',
            whyItMatters: 'Gives attacker access sk_live_mattersSecret5555',
            recommendedActions: 'Rotate key sk_live_actionsSecret4444 in dashboard'
          }
        }
      ],
      aiStatus: { status: 'available', message: 'Ready with sk_live_aiMsgSecret3333' },
      warnings: ['Warning with sk_live_warnSecret2222']
    };

    const sanitized = sanitizeScanData(mockScan, {
      'node-1': { id: 'node-1', name: 'HTTP Node with sk_live_nodeSecret1111' }
    });

    assert.equal(sanitized.scanId, 'scan_123_abc');
    assert.equal(sanitized.totalFindings, 2);
    assert.equal(sanitized.severityCounts.high, 1);

    // Verify all exported fields are scrubbed
    const serialized = JSON.stringify(sanitized);
    assert.ok(!serialized.includes('sk_live_secret1234567890'), 'Workflow name secret redacted');
    assert.ok(!serialized.includes('sk_live_titleKey12345'), 'Finding title secret redacted');
    assert.ok(!serialized.includes('sk_live_nodeSecret1111'), 'Node name secret redacted');
    assert.ok(!serialized.includes('sk_live_evidenceSecret9999'), 'Object evidence secret redacted');
    assert.ok(!serialized.includes('ghp_111122223333444455556666777788889999'), 'Nested array token redacted');
    assert.ok(!serialized.includes('sk_live_explSecret8888'), 'Explanation secret redacted');
    assert.ok(!serialized.includes('sk_live_recSecret7777'), 'Recommendation secret redacted');
    assert.ok(!serialized.includes('sk_live_limitSecret6666'), 'Limitations secret redacted');
    assert.ok(!serialized.includes('sk_live_mattersSecret5555'), 'AI whyItMatters secret redacted');
    assert.ok(!serialized.includes('sk_live_actionsSecret4444'), 'AI recommendedActions secret redacted');
    assert.ok(!serialized.includes('sk_live_aiMsgSecret3333'), 'AI status message secret redacted');
    assert.ok(!serialized.includes('sk_live_warnSecret2222'), 'Warning secret redacted');
  });
});

describe('Filename Sanitization & Hardening', () => {
  it('should neutralize path traversal-like workflow names in export filenames', () => {
    const fixedTs = 1728739200000;

    // Unix style path traversal
    const unixFilename = getSafeExportFilename('../../etc/passwd', 'json', fixedTs);
    assert.equal(unixFilename, `flowsentry-security-report-etc-passwd-${fixedTs}.json`);
    assert.ok(!unixFilename.includes('/'), 'Must not contain forward slashes');
    assert.ok(!unixFilename.includes('..'), 'Must not contain double dots');

    // Windows style path traversal
    const winFilename = getSafeExportFilename('..\\..\\windows\\system32\\cmd.exe', 'pdf', fixedTs);
    assert.equal(winFilename, `flowsentry-security-report-windows-system32-cmd-exe-${fixedTs}.pdf`);
    assert.ok(!winFilename.includes('\\'), 'Must not contain backslashes');
    assert.ok(!winFilename.includes('..'), 'Must not contain double dots');
  });

  it('should sanitize control characters and cap workflow name slug at 50 characters', () => {
    const fixedTs = 1728739200000;

    // Control characters and punctuation
    const controlName = '\x00\x08\x1b\n\r!@#$%^&*()_+';
    const fallbackFilename = getSafeExportFilename(controlName, 'json', fixedTs);
    assert.equal(fallbackFilename, `flowsentry-security-report-workflow-${fixedTs}.json`);

    // Empty and null inputs
    assert.equal(getSafeExportFilename('', 'json', fixedTs), `flowsentry-security-report-workflow-${fixedTs}.json`);
    assert.equal(getSafeExportFilename(null, 'pdf', fixedTs), `flowsentry-security-report-workflow-${fixedTs}.pdf`);
    assert.equal(getSafeExportFilename(undefined, 'pdf', fixedTs), `flowsentry-security-report-workflow-${fixedTs}.pdf`);

    // Very long workflow name (100 characters)
    const longName = 'a'.repeat(100);
    const longFilename = getSafeExportFilename(longName, 'json', fixedTs);
    const expectedSlug = 'a'.repeat(50);
    assert.equal(longFilename, `flowsentry-security-report-${expectedSlug}-${fixedTs}.json`);

    // Verify workflow-name portion strictly does not exceed 50 characters
    const match = longFilename.match(/^flowsentry-security-report-(.+)-\d+\.json$/);
    assert.ok(match, 'Filename should match expected pattern');
    assert.ok(match[1].length <= 50, `Slug length ${match[1].length} must be <= 50`);
  });

  it('should keep PDF and JSON filename behavior consistent', () => {
    const fixedTs = 1728739200000;
    const wfName = 'Customer Billing & Invoicing Pipeline v2.0!';

    const jsonFile = getSafeExportFilename(wfName, 'json', fixedTs);
    const pdfFile = getSafeExportFilename(wfName, 'pdf', fixedTs);

    const jsonBase = jsonFile.replace(/\.json$/, '');
    const pdfBase = pdfFile.replace(/\.pdf$/, '');

    assert.equal(jsonBase, pdfBase, 'Base filename without extension must be identical');
    assert.equal(jsonFile, `flowsentry-security-report-customer-billing-invoicing-pipeline-v2-0-${fixedTs}.json`);
    assert.equal(pdfFile, `flowsentry-security-report-customer-billing-invoicing-pipeline-v2-0-${fixedTs}.pdf`);
  });
});

describe('PDF Unicode & Special Symbol Sanitization', () => {
  it('should replace bullets, smart quotes, dashes, and arrows with safe ASCII equivalents', () => {
    const input = '“Security Audit” — Check • First item → Next step ‘done’';
    const sanitized = sanitizePdfText(input);

    assert.equal(sanitized, '"Security Audit" -- Check - First item -> Next step \'done\'');
    assert.ok(!sanitized.includes('“'), 'Smart quotes replaced');
    assert.ok(!sanitized.includes('•'), 'Bullet replaced');
    assert.ok(!sanitized.includes('—'), 'Em dash replaced');
    assert.ok(!sanitized.includes('→'), 'Arrow replaced');
  });

  it('should strip emojis and normalize accents without corrupting surrounding text', () => {
    const input = '🚨 High Risk: Node café & résumé processing 🔥 completed! 🛡️';
    const sanitized = sanitizePdfText(input);

    assert.equal(sanitized.trim(), 'High Risk: Node cafe & resume processing  completed!');
    assert.ok(!sanitized.includes('🚨'), 'Shield/warning emoji stripped');
    assert.ok(!sanitized.includes('🔥'), 'Fire emoji stripped');
    assert.ok(sanitized.includes('cafe'), 'Accented e normalized to ASCII');
    assert.ok(sanitized.includes('resume'), 'Accented e normalized to ASCII');
  });

  it('should preserve full Unicode in JSON exports while normalizing for PDF', () => {
    const mockScan = {
      scanId: 'scan_unicode_1',
      timestamp: '2026-10-12T10:00:00.000Z',
      workflow: {
        id: 'wf-unicode',
        name: '🚀 Automated Café Orders • Flow',
        active: true,
        nodeCount: 2,
        edgeCount: 1
      },
      summary: { total: 1, high: 0, medium: 1, low: 0, info: 0 },
      findings: [
        {
          id: 'f-1',
          ruleId: 'EXTERNAL_HTTP_DESTINATION',
          title: 'External endpoint in “Café” webhook → target',
          severity: 'medium',
          affectedNodeIds: [],
          evidence: 'URL: https://api.cafe.com/orders • Status: 200',
          explanation: 'Sends data to external server.',
          recommendation: 'Verify endpoint whitelist.',
          confidence: 'high',
          limitations: []
        }
      ],
      aiStatus: { status: 'off' }
    };

    // 1. JSON Report must preserve original Unicode (without stripping emojis/accents)
    const jsonReport = buildJsonReport(mockScan, {});
    assert.equal(jsonReport.workflow.name, '🚀 Automated Café Orders • Flow', 'JSON export preserves Unicode');
    assert.equal(jsonReport.findings[0].title, 'External endpoint in “Café” webhook → target', 'JSON preserves quotes/arrows');

    // 2. PDF sanitizer converts them cleanly to ASCII
    const pdfWorkflowName = sanitizePdfText(jsonReport.workflow.name);
    assert.equal(pdfWorkflowName.trim(), 'Automated Cafe Orders - Flow', 'PDF version safe ASCII');
    const pdfFindingTitle = sanitizePdfText(jsonReport.findings[0].title);
    assert.equal(pdfFindingTitle, 'External endpoint in "Cafe" webhook -> target', 'PDF version safe ASCII');
  });
});

describe('JSON Security Report Generator', () => {
  it('should build a valid, schema-versioned JSON report object', () => {
    const mockScan = {
      scanId: 'scan_777_test',
      timestamp: '2026-10-12T10:00:00.000Z',
      workflow: {
        id: 'wf-777',
        name: 'Lead Sync Pipeline',
        active: true,
        nodeCount: 5,
        edgeCount: 4
      },
      summary: { total: 1, high: 1, medium: 0, low: 0, info: 0 },
      findings: [
        {
          id: 'f-101',
          ruleId: 'SECRET_LIKE_VALUE',
          title: 'Hardcoded OpenAI Secret Key',
          severity: 'high',
          affectedNodeIds: ['n-1'],
          evidence: 'header.apiKey = [REDACTED_SECRET_VALUE]',
          explanation: 'Secret detected in node parameter.',
          recommendation: 'Use environment variables.',
          confidence: 'high',
          limitations: ['Static heuristic only']
        }
      ],
      aiStatus: { status: 'available' }
    };

    const report = buildJsonReport(mockScan, { 'n-1': { id: 'n-1', name: 'HTTP Webhook' } });

    assert.equal(report.schemaVersion, REPORT_SCHEMA_VERSION);
    assert.ok(report.reportMetadata.reportId.startsWith('report_'));
    assert.equal(report.workflow.name, 'Lead Sync Pipeline');
    assert.equal(report.scanSummary.totalFindings, 1);
    assert.equal(report.scanSummary.highSeverityCount, 1);
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].affectedNodes[0].name, 'HTTP Webhook');
    assert.ok(Array.isArray(report.methodology.evaluatedRuleCatalog));
    assert.ok(Array.isArray(report.limitations));

    // Verify it serializes and deserializes cleanly
    const jsonString = JSON.stringify(report, null, 2);
    const parsed = JSON.parse(jsonString);
    assert.deepEqual(parsed, report);
  });

  it('should handle zero-finding workflows (Safe Sample) cleanly', () => {
    const cleanScan = {
      scanId: 'scan_safe_001',
      timestamp: '2026-10-12T10:00:00.000Z',
      workflow: {
        id: 'wf-safe',
        name: 'Clean Customer Feedback Flow',
        active: false,
        nodeCount: 3,
        edgeCount: 2
      },
      summary: { total: 0, high: 0, medium: 0, low: 0, info: 0 },
      findings: [],
      aiStatus: { status: 'off' }
    };

    const report = buildJsonReport(cleanScan, {});

    assert.equal(report.scanSummary.totalFindings, 0);
    assert.equal(report.scanSummary.cleanStatus, true);
    assert.equal(report.findings.length, 0);
    assert.ok(report.scanSummary.overallAssessment.includes('No deterministic risks'));
  });
});
