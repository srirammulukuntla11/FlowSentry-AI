/**
 * FlowSentry AI - JSON Security Report Generator
 *
 * Assembles a structured, schema-versioned security audit document
 * and triggers a client-side download.
 */

import { sanitizeScanData, getSafeExportFilename } from './sanitizer.js';

export const REPORT_SCHEMA_VERSION = '1.0.0';

/**
 * Builds the canonical JSON report data object.
 *
 * @param {object} scanResult - Active scan result
 * @param {Record<string, object>} [nodeLookup={}] - Map of nodeId to node details
 * @returns {object} Well-structured report object
 */
export function buildJsonReport(scanResult, nodeLookup = {}) {
  const sanitized = sanitizeScanData(scanResult, nodeLookup);
  const generatedAt = new Date().toISOString();

  const reportId = `report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Determine high-level posture statement without inventing unverified scores
  let overallRiskStatement = 'No deterministic risks identified across evaluated heuristic rule sets.';
  if (sanitized.totalFindings > 0) {
    if (sanitized.severityCounts.high > 0) {
      overallRiskStatement = 'High risk findings detected requiring immediate remediation.';
    } else if (sanitized.severityCounts.medium > 0) {
      overallRiskStatement = 'Medium risk findings detected requiring architectural review.';
    } else {
      overallRiskStatement = 'Informational and low-severity findings noted for audit visibility.';
    }
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    reportMetadata: {
      reportId,
      generator: 'FlowSentry AI — Static Security Inspector for n8n Workflows',
      generatedAt,
      scanId: sanitized.scanId,
      scanTimestamp: sanitized.scanTimestamp,
      exportFormat: 'JSON'
    },
    workflow: sanitized.workflow,
    scanSummary: {
      totalFindings: sanitized.totalFindings,
      overallAssessment: overallRiskStatement,
      highSeverityCount: sanitized.severityCounts.high,
      mediumSeverityCount: sanitized.severityCounts.medium,
      lowSeverityCount: sanitized.severityCounts.low,
      infoSeverityCount: sanitized.severityCounts.info,
      cleanStatus: sanitized.totalFindings === 0
    },
    severityCounts: sanitized.severityCounts,
    findings: sanitized.findings.map((f) => ({
      id: f.id,
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      affectedNodes: f.affectedNodes,
      evidence: f.evidence,
      riskContext: f.explanation,
      recommendedMitigation: f.recommendation,
      confidence: f.confidence,
      limitations: f.limitations,
      aiExplanation: f.aiExplanation
        ? {
            provider: 'Gemini via n8n',
            nonAuthoritative: true,
            summary: f.aiExplanation.summary,
            whyItMatters: f.aiExplanation.whyItMatters,
            recommendedActions: f.aiExplanation.recommendedActions
          }
        : null
    })),
    aiAdvisory: {
      status: sanitized.aiStatus.status,
      provider: 'Gemini (orchestrated via n8n webhook)',
      disclaimer: 'AI-generated advisories are supplementary, automated heuristic interpretations. They are non-authoritative and require verification by security professionals.',
      active: sanitized.aiStatus.status === 'available'
    },
    methodology: {
      inspectionMode: 'Static Deterministic Heuristic Analysis',
      executionSafety: 'Zero Runtime Execution (workflows are parsed in memory with secrets redacted immediately)',
      evaluatedRuleCatalog: [
        'Hardcoded Secret & Credential Detection (SECRET_LIKE_VALUE)',
        'External HTTP Destination Review (EXTERNAL_HTTP_DESTINATION)',
        'Sensitive Data Ingestion to External Path Flow (SENSITIVE_TO_EXTERNAL_FLOW)',
        'Credential Reference Governance (CREDENTIAL_REFERENCE_REVIEW)',
        'Destructive Operation Audit (DESTRUCTIVE_ACTION_REVIEW)',
        'Custom & Third-Party Node Coverage Check (UNKNOWN_NODE_COVERAGE)'
      ]
    },
    limitations: [
      'Static heuristic inspection analyzes declared workflow syntax only; runtime behavior and environmental variables are not evaluated.',
      'Workflows are never executed or validated against live production environment credentials.',
      'The absence of findings does not guarantee that a workflow is completely secure or free from vulnerabilities.',
      'AI advisory guidance is supplementary and does not replace dedicated application security review.'
    ]
  };
}

/**
 * Generates and downloads the structured JSON security report.
 *
 * @param {object} scanResult - Active scan result
 * @param {Record<string, object>} [nodeLookup={}] - Map of nodeId to node details
 * @returns {string} Downloaded filename
 */
export function downloadJsonReport(scanResult, nodeLookup = {}) {
  const reportObj = buildJsonReport(scanResult, nodeLookup);
  const jsonString = JSON.stringify(reportObj, null, 2);

  const filename = getSafeExportFilename(reportObj.workflow.name, 'json');

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
