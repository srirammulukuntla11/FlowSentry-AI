/**
 * FlowSentry AI - Professional PDF Security Audit Report Generator
 *
 * Generates an executive-ready, multi-page security report using jsPDF.
 * Implements strict typography hierarchy, severity palettes, safe ASCII replacements,
 * robust Unicode/emoji filtering, long-content truncation with clear notices,
 * running headers/footers, and clean page breaking.
 */

import { jsPDF } from 'jspdf';
import { sanitizeScanData, getSafeExportFilename } from './sanitizer.js';

// Color definitions matching the FlowSentry AI Design System
const COLORS = {
  brandIndigo: [32, 44, 70],        // #202C46 Primary deep indigo
  brandTeal: [79, 130, 119],        // #4F8277 Brand teal accent
  textPrimary: [34, 43, 58],        // #222B3A Primary dark body
  textSecondary: [83, 96, 113],     // #536071 Muted text
  textMuted: [119, 129, 145],       // #778191 Metadata
  borderStandard: [217, 222, 229],  // #D9DEE5 Card border
  borderSubtle: [232, 233, 230],    // #E8E9E6 Division lines
  bgCanvas: [245, 243, 238],        // #F5F3EE Warm ivory
  bgInset: [247, 246, 242],         // #F7F6F2 Inset background
  bgEvidence: [236, 234, 228],      // #ECEAE4 Technical evidence inset

  // Severity colors
  severity: {
    high: {
      text: [199, 71, 71],          // #C74747
      bg: [251, 234, 234],          // #FBEAEA
      border: [243, 199, 199]
    },
    medium: {
      text: [183, 121, 36],         // #B77924
      bg: [253, 244, 231],          // #FDF4E7
      border: [246, 223, 186]
    },
    low: {
      text: [50, 125, 117],         // #327D75
      bg: [230, 244, 242],          // #E6F4F2
      border: [189, 223, 218]
    },
    info: {
      text: [109, 97, 168],         // #6D61A8
      bg: [241, 239, 249],          // #F1EFF9
      border: [216, 210, 238]
    },
    safe: {
      text: [54, 122, 83],          // #367A53
      bg: [235, 245, 239],          // #EBF5EF
      border: [197, 227, 208]
    }
  }
};

/**
 * Checks if adding `requiredHeight` exceeds the page printable limit.
 * If so, adds a new page and returns the reset Y coordinate.
 */
function ensureSpace(doc, currentY, requiredHeight = 25, bottomLimit = 265) {
  if (currentY + requiredHeight > bottomLimit) {
    doc.addPage();
    return 22; // Start position on new page (leaves room for running header)
  }
  return currentY;
}

/**
 * Normalizes and sanitizes text for safe rendering in standard jsPDF WinAnsi / Latin-1 fonts.
 * - Replaces typographic characters (bullets, smart quotes, dashes, arrows) with safe ASCII equivalents.
 * - Strips emojis and unsupported multi-byte symbols to prevent visual corruption or encoding errors.
 * - Preserves meaningful text and normalizes Latin diacritics.
 *
 * @param {*} text - Input text
 * @returns {string} Safe ASCII text for jsPDF
 */
export function sanitizePdfText(text) {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') text = String(text);

  return text
    // Replace smart/curly quotes and apostrophes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    // Replace em/en dashes and horizontal bars
    .replace(/[\u2013\u2014\u2015]/g, '--')
    // Replace typographic bullets and list markers with standard ASCII hyphen
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB]/g, '-')
    // Replace arrows with safe ASCII equivalents
    .replace(/[\u2192\u2794\u279C\u27A1]/g, '->')
    .replace(/[\u2190\u2B05]/g, '<-')
    .replace(/[\u2194]/g, '<->')
    // Mathematical & comparison symbols
    .replace(/\u2260/g, '!=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Normalize special whitespace to regular space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F]/g, ' ')
    // Strip zero-width spaces / format characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Strip emojis and miscellaneous pictographs
    .replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Decompose accented characters to base ASCII letters (e.g., é -> e)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Strip any remaining non-ASCII characters outside standard printable ASCII range and newlines
    .replace(/[^\x20-\x7E\r\n\t]/g, '');
}

/**
 * Truncates a string for PDF presentation and appends a clear truncation notice if truncated.
 * Keeps JSON export untouched.
 */
function truncatePdfText(text, maxChars, notice = ' [... Truncated for PDF layout; see complete JSON export]') {
  const safe = sanitizePdfText(text);
  if (!safe || safe.length <= maxChars) return safe;
  return `${safe.substring(0, maxChars).trimEnd()}${notice}`;
}

/**
 * Truncates an array of wrapped lines for PDF presentation and appends a notice line if truncated.
 */
function truncatePdfLines(lines, maxLines, notice = '[... Evidence truncated for PDF report layout; see complete JSON export]') {
  if (!Array.isArray(lines) || lines.length <= maxLines) return lines;
  const sliced = lines.slice(0, maxLines);
  sliced.push(notice);
  return sliced;
}

/**
 * Generates and downloads a multi-page PDF audit report for the given scan result.
 *
 * @param {object} scanResult - Active scan result
 * @param {Record<string, object>} [nodeLookup={}] - Map of nodeId to node details
 * @returns {string} Downloaded filename
 */
export function generatePdfReport(scanResult, nodeLookup = {}) {
  const sanitized = sanitizeScanData(scanResult, nodeLookup);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2); // 182 mm
  let y = 16;

  // Format dates safely
  const scanDate = sanitized.scanTimestamp
    ? new Date(sanitized.scanTimestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Unknown Date';
  const reportDate = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  // Safe sanitized workflow name for display
  const cleanWorkflowName = sanitizePdfText(sanitized.workflow.name);

  // ========================================================
  // 1. Report Header & Branding
  // ========================================================

  // FlowSentry AI Logo Emblem (Shield SVG approximation in vector)
  doc.setFillColor(...COLORS.severity.safe.bg);
  doc.setDrawColor(...COLORS.brandTeal);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, 9, 9, 1.8, 1.8, 'FD');

  doc.setTextColor(...COLORS.brandTeal);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('FS', margin + 2.2, y + 6.2);

  // Brand Name & Product Title
  doc.setTextColor(...COLORS.brandIndigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FlowSentry', margin + 12, y + 6.5);
  doc.setTextColor(...COLORS.brandTeal);
  doc.text('AI', margin + 37, y + 6.5);

  // Eyebrow Label on Top Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.brandIndigo);
  const eyebrowText = 'WORKFLOW SECURITY AUDIT REPORT';
  doc.text(eyebrowText, pageWidth - margin - doc.getTextWidth(eyebrowText), y + 6);

  y += 13;

  // Document Title Bar with Teal Border Accent
  doc.setFillColor(...COLORS.bgInset);
  doc.setDrawColor(...COLORS.borderStandard);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  // Colored Left Accent Border
  doc.setFillColor(...COLORS.brandTeal);
  doc.rect(margin, y, 2.5, 24, 'F');

  // Main Workflow Name
  doc.setTextColor(...COLORS.brandIndigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const titleDisplay = cleanWorkflowName.length > 55
    ? `${cleanWorkflowName.substring(0, 52)}...`
    : cleanWorkflowName;
  doc.text(titleDisplay, margin + 6, y + 7.5);

  // Metadata Grid inside Header Bar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textSecondary);

  // Column 1: Scan ID & Workflow Status
  doc.text(`Scan ID: ${sanitizePdfText(sanitized.scanId)}`, margin + 6, y + 14);
  const statusStr = sanitized.workflow.active ? 'Status: Active Workflow' : 'Status: Draft / Inactive';
  doc.text(statusStr, margin + 6, y + 19.5);

  // Column 2: Graph Architecture
  doc.text(`Nodes: ${sanitized.workflow.nodeCount}   -   Edges: ${sanitized.workflow.edgeCount}`, margin + 80, y + 14);
  doc.text(`Scan Date: ${scanDate}`, margin + 80, y + 19.5);

  // Column 3: Generated Timestamp
  const generatedLabel = `Report Generated: ${reportDate}`;
  doc.text(generatedLabel, pageWidth - margin - doc.getTextWidth(generatedLabel) - 4, y + 14);

  const formatLabel = 'Inspection: Zero Runtime Execution';
  doc.text(formatLabel, pageWidth - margin - doc.getTextWidth(formatLabel) - 4, y + 19.5);

  y += 30;

  // ========================================================
  // 2. Executive Summary Section
  // ========================================================
  doc.setTextColor(...COLORS.brandIndigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Executive Risk Summary', margin, y);

  if (sanitized.riskScore) {
    const scoreText = `Overall Risk Score: ${sanitized.riskScore.score}/100 (${sanitized.riskScore.level})`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const scoreColor = sanitized.riskScore.category === 'high' ? COLORS.severity.high.text
      : sanitized.riskScore.category === 'medium' ? COLORS.severity.medium.text
      : sanitized.riskScore.category === 'low' ? COLORS.severity.low.text
      : COLORS.severity.safe.text;
    doc.setTextColor(...scoreColor);
    doc.text(scoreText, margin + contentWidth, y, { align: 'right' });
  }

  y += 5;

  // 4 Single-Row Severity Summary Cards
  const cardGap = 3.5;
  const cardWidth = (contentWidth - (cardGap * 3)) / 4;
  const cardHeight = 17;

  const summaryCards = [
    { label: 'HIGH RISK', count: sanitized.severityCounts.high, colorKey: 'high' },
    { label: 'MEDIUM RISK', count: sanitized.severityCounts.medium, colorKey: 'medium' },
    { label: 'LOW / AUDIT', count: sanitized.severityCounts.low, colorKey: 'low' },
    { label: 'INFO / COVERAGE', count: sanitized.severityCounts.info, colorKey: 'info' }
  ];

  summaryCards.forEach((card, idx) => {
    const cardX = margin + (idx * (cardWidth + cardGap));
    const pal = COLORS.severity[card.colorKey];

    // Card background
    doc.setFillColor(...COLORS.bgInset);
    doc.setDrawColor(...COLORS.borderStandard);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Colored left accent bar
    doc.setFillColor(...pal.text);
    doc.rect(cardX, y, 1.8, cardHeight, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textSecondary);
    doc.text(card.label, cardX + 4.5, y + 5.5);

    // Number count
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...pal.text);
    doc.text(String(card.count), cardX + 4.5, y + 13.5);
  });

  y += cardHeight + 6;

  // Executive Assessment Narrative Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.borderStandard);
  doc.setLineWidth(0.3);

  let narrativeText = '';
  if (sanitized.totalFindings === 0) {
    narrativeText = `No deterministic security risks were identified in "${cleanWorkflowName}". The scanner evaluated all standard heuristic rules across ${sanitized.workflow.nodeCount} workflow node(s) and ${sanitized.workflow.edgeCount} edge(s). No hardcoded secrets, external HTTP calls, unauthenticated data egress, risky credentials, destructive database operations, or unverified custom nodes were detected.`;
  } else if (sanitized.severityCounts.high > 0) {
    narrativeText = `The security inspection detected ${sanitized.totalFindings} deterministic finding(s) across "${cleanWorkflowName}" (${sanitized.severityCounts.high} High, ${sanitized.severityCounts.medium} Medium, ${sanitized.severityCounts.low} Low, and ${sanitized.severityCounts.info} Informational). High-severity items require immediate credential revocation or architectural review before deployment to production environments.`;
  } else if (sanitized.severityCounts.medium > 0) {
    narrativeText = `The security inspection detected ${sanitized.totalFindings} deterministic finding(s) across "${cleanWorkflowName}" (${sanitized.severityCounts.high} High, ${sanitized.severityCounts.medium} Medium, ${sanitized.severityCounts.low} Low, and ${sanitized.severityCounts.info} Informational). No high-severity vulnerabilities were identified; medium-severity items should be audited to verify access controls and external endpoint destinations.`;
  } else {
    narrativeText = `The security inspection detected ${sanitized.totalFindings} deterministic finding(s) across "${cleanWorkflowName}" (${sanitized.severityCounts.high} High, ${sanitized.severityCounts.medium} Medium, ${sanitized.severityCounts.low} Low, and ${sanitized.severityCounts.info} Informational). Findings are limited to informational audit items and low-risk operational patterns.`;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const narrativeLines = doc.splitTextToSize(narrativeText, contentWidth - 10);
  const narrativeBoxHeight = (narrativeLines.length * 4.2) + 7;

  y = ensureSpace(doc, y, narrativeBoxHeight + 8, 260);

  doc.roundedRect(margin, y, contentWidth, narrativeBoxHeight, 1.5, 1.5, 'FD');
  doc.setTextColor(...COLORS.textPrimary);
  doc.text(narrativeLines, margin + 5, y + 5.5);

  y += narrativeBoxHeight + 8;

  // ========================================================
  // 3. Detailed Security Findings
  // ========================================================
  y = ensureSpace(doc, y, 18, 260);
  doc.setTextColor(...COLORS.brandIndigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Detailed Security Findings & Evidence', margin, y);
  y += 5.5;

  if (sanitized.totalFindings === 0) {
    // Zero Findings Clean State Display in PDF
    y = ensureSpace(doc, y, 40, 260);
    doc.setFillColor(...COLORS.severity.safe.bg);
    doc.setDrawColor(...COLORS.severity.safe.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 36, 2, 2, 'FD');

    doc.setTextColor(...COLORS.severity.safe.text);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Clean Audit Verification - Zero Deterministic Risks Detected', margin + 6, y + 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textPrimary);
    const checks = [
      '- Hardcoded Secrets & Vendor API Keys: Checked (No secrets or tokens detected)',
      '- Outbound HTTP Endpoints: Audited (No unmonitored external destinations)',
      '- Sensitive-to-External Paths: Evaluated (No unauthorized egress paths)',
      '- Database Operations & Destructive Queries: Inspected (No raw drop/purge commands)',
      '- Credential Identifier References: Reviewed (No misconfigured credentials)'
    ];
    let checkY = y + 13.5;
    checks.forEach((c) => {
      doc.text(c, margin + 6, checkY);
      checkY += 4.5;
    });

    y += 42;
  } else {
    // Render Each Detailed Finding Card
    sanitized.findings.forEach((finding, idx) => {
      // 1. Finding Number & Title (Sanitized & capped for single card line)
      const rawTitle = `${idx + 1}. ${sanitizePdfText(finding.title)}`;
      const titleStr = rawTitle.length > 95 ? `${rawTitle.substring(0, 92)}...` : rawTitle;

      // 2. Affected Nodes (Sanitized & limited to 5 nodes to prevent card overflow)
      const allNodeNames = (finding.affectedNodes || []).map((n) => sanitizePdfText(n.name));
      let displayedNodeNames = allNodeNames;
      if (allNodeNames.length > 5) {
        displayedNodeNames = [...allNodeNames.slice(0, 5), `(+${allNodeNames.length - 5} more)`];
      }
      const nodeNamesStr = displayedNodeNames.join(', ');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const nodeLines = nodeNamesStr ? doc.splitTextToSize(nodeNamesStr, contentWidth - 36) : [];

      // 3. Technical Evidence Block
      // CRITICAL: Set font to Courier 7.5 before splitTextToSize so character width calculations
      // match the monospace font accurately, preventing text from overflowing the grey box.
      const rawEvidence = sanitizePdfText(finding.evidence || 'N/A');
      const truncatedEvidenceText = rawEvidence.length > 600
        ? `${rawEvidence.substring(0, 600).trimEnd()}\n[... Evidence truncated for PDF report layout; see complete JSON export]`
        : rawEvidence;

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      const evidenceAvailableWidth = contentWidth - 16;
      let evidenceLines = doc.splitTextToSize(truncatedEvidenceText, evidenceAvailableWidth);
      if (evidenceLines.length > 9) {
        evidenceLines = truncatePdfLines(evidenceLines, 8, '[... Evidence truncated for PDF report layout; see complete JSON export]');
      }

      // 4. Risk Context (Sanitized & capped to 450 chars and max 5 lines)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const explanationText = finding.explanation
        ? truncatePdfText(finding.explanation, 450, ' [... Truncated for PDF layout; see complete JSON export]')
        : null;
      let explanationLines = explanationText ? doc.splitTextToSize(explanationText, contentWidth - 30) : [];
      if (explanationLines.length > 5) {
        explanationLines = truncatePdfLines(explanationLines, 4, '[... Truncated for PDF layout; see complete JSON export]');
      }

      // 5. Recommended Mitigation (Sanitized & capped to 450 chars and max 5 lines)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const recommendationText = finding.recommendation
        ? truncatePdfText(finding.recommendation, 450, ' [... Truncated for PDF layout; see complete JSON export]')
        : null;
      let recommendationLines = recommendationText ? doc.splitTextToSize(recommendationText, contentWidth - 30) : [];
      if (recommendationLines.length > 5) {
        recommendationLines = truncatePdfLines(recommendationLines, 4, '[... Truncated for PDF layout; see complete JSON export]');
      }

      // 6. AI Advisory (if attached to finding - Sanitized & capped to 450 chars and max 5 lines)
      let aiLines = [];
      let aiBoxH = 0;
      if (finding.aiExplanation?.summary) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        const aiText = truncatePdfText(finding.aiExplanation.summary, 450, ' [... Truncated for PDF layout; see complete JSON export]');
        aiLines = doc.splitTextToSize(aiText, contentWidth - 18);
        if (aiLines.length > 5) {
          aiLines = truncatePdfLines(aiLines, 4, '[... Truncated for PDF layout; see complete JSON export]');
        }
        aiBoxH = (aiLines.length * 3.6) + 8.5;
      }

      // Calculate exact dynamic height required for this card from wrapped lines
      const evLineHeight = 3.6;
      const evidenceBoxH = (evidenceLines.length * evLineHeight) + 6.5;

      let approxHeight = 14;
      if (nodeLines.length) approxHeight += (nodeLines.length * 4) + 2;
      approxHeight += evidenceBoxH + 4;
      if (explanationLines.length) approxHeight += (explanationLines.length * 3.8) + 3;
      if (recommendationLines.length) approxHeight += (recommendationLines.length * 3.8) + 3;
      if (aiLines.length) approxHeight += aiBoxH + 4;
      approxHeight += 6; // Padding and bottom spacing

      // Clean page boundary check: move to new page if card would exceed printable area (260mm)
      y = ensureSpace(doc, y, approxHeight, 260);

      const pal = COLORS.severity[finding.severity] || COLORS.severity.info;

      // Finding Card Outer Container
      const cardStartY = y;
      let innerY = cardStartY + 5;

      // 1. Severity Badge Pill
      const badgeText = ` ${finding.severity.toUpperCase()} `;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      const badgeWidth = doc.getTextWidth(badgeText) + 3;

      doc.setFillColor(...pal.bg);
      doc.setDrawColor(...pal.border);
      doc.setLineWidth(0.2);
      doc.roundedRect(margin + 4, innerY - 3.8, badgeWidth, 5, 1, 1, 'FD');

      doc.setTextColor(...pal.text);
      doc.text(badgeText, margin + 5.5, innerY);

      // 2. Rule ID Badge
      const ruleText = ` Rule: ${sanitizePdfText(finding.ruleId)} `;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      const ruleWidth = doc.getTextWidth(ruleText) + 3;
      const ruleX = margin + 4 + badgeWidth + 2.5;

      doc.setFillColor(...COLORS.bgInset);
      doc.setDrawColor(...COLORS.borderStandard);
      doc.roundedRect(ruleX, innerY - 3.8, ruleWidth, 5, 1, 1, 'FD');

      doc.setTextColor(...COLORS.textSecondary);
      doc.text(ruleText, ruleX + 1.5, innerY);

      // 3. Finding Number & Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.brandIndigo);
      const titleLines = doc.splitTextToSize(titleStr, contentWidth - ruleX - ruleWidth - 4);
      doc.text(titleLines[0], ruleX + ruleWidth + 3.5, innerY);

      innerY += 6.5;

      // 4. Affected Nodes
      if (nodeLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.textSecondary);
        doc.text('Affected Node(s): ', margin + 4, innerY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.brandTeal);
        doc.text(nodeLines, margin + 30, innerY);

        innerY += (nodeLines.length * 4) + 2;
      }

      // 5. Technical Evidence Block
      doc.setFillColor(...COLORS.bgEvidence);
      doc.setDrawColor(...COLORS.borderStandard);
      doc.setLineWidth(0.2);

      doc.roundedRect(margin + 4, innerY, contentWidth - 8, evidenceBoxH, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.brandIndigo);
      doc.text('TECHNICAL EVIDENCE (REDACTED IN-MEMORY)', margin + 7, innerY + 4);

      // Render each wrapped line separately for deterministic vertical positioning
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.textPrimary);
      let evLineY = innerY + 8;
      evidenceLines.forEach((line) => {
        doc.text(line, margin + 7, evLineY);
        evLineY += evLineHeight;
      });

      innerY += evidenceBoxH + 4;

      // 6. Risk Context
      if (explanationLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.severity.medium.text);
        doc.text('Risk Context:', margin + 4, innerY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textPrimary);
        let expLineY = innerY;
        explanationLines.forEach((line) => {
          doc.text(line, margin + 25, expLineY);
          expLineY += 3.8;
        });

        innerY += (explanationLines.length * 3.8) + 3;
      }

      // 7. Recommended Mitigation
      if (recommendationLines.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.severity.safe.text);
        doc.text('Mitigation:', margin + 4, innerY);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...COLORS.textPrimary);
        let recLineY = innerY;
        recommendationLines.forEach((line) => {
          doc.text(line, margin + 25, recLineY);
          recLineY += 3.8;
        });

        innerY += (recommendationLines.length * 3.8) + 3;
      }

      // 8. AI Advisory (if attached to finding)
      if (aiLines.length > 0) {
        doc.setFillColor(...COLORS.severity.info.bg);
        doc.setDrawColor(...COLORS.severity.info.border);
        doc.setLineWidth(0.2);
        doc.roundedRect(margin + 4, innerY, contentWidth - 8, aiBoxH, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.severity.info.text);
        doc.text('AI Advisory Analysis (Gemini via n8n) | Non-Authoritative', margin + 7, innerY + 4);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.brandIndigo);
        let aiLineY = innerY + 8.5;
        aiLines.forEach((line) => {
          doc.text(line, margin + 7, aiLineY);
          aiLineY += 3.6;
        });

        innerY += aiBoxH + 4;
      }

      // Finalize Finding Card Border and Severity Left Edge
      const totalCardHeight = innerY - cardStartY + 1;
      doc.setDrawColor(...COLORS.borderStandard);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, cardStartY, contentWidth, totalCardHeight, 1.5, 1.5, 'S');

      // Colored Left Accent Border
      doc.setFillColor(...pal.text);
      doc.rect(margin, cardStartY, 2, totalCardHeight, 'F');

      y = innerY + 6;
    });
  }

  // ========================================================
  // 4. AI Advisory System Disclaimer & Transparency
  // ========================================================
  if (sanitized.aiStatus.status === 'available') {
    const aiNoticeText = 'AI Advisory explanations in this audit report are generated automatically by Google Gemini (orchestrated through an enterprise n8n workflow). Only allow-listed, predefined security rule definitions and generic metadata are transmitted to the AI service. AI summaries are supplementary and non-authoritative; they do not constitute a formal cybersecurity warranty or penetration testing certification.';
    const aiNoticeLines = doc.splitTextToSize(aiNoticeText, contentWidth - 8);
    const aiBoxH = (aiNoticeLines.length * 4) + 6;

    y = ensureSpace(doc, y, aiBoxH + 16, 265);
    doc.setTextColor(...COLORS.brandIndigo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('3. AI Advisory Governance & Non-Authoritative Notice', margin, y);
    y += 5;

    doc.setFillColor(...COLORS.severity.info.bg);
    doc.setDrawColor(...COLORS.severity.info.border);
    doc.setLineWidth(0.3);

    doc.roundedRect(margin, y, contentWidth, aiBoxH, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.brandIndigo);
    doc.text(aiNoticeLines, margin + 4, y + 5);

    y += aiBoxH + 7;
  }

  // ========================================================
  // 5. Methodology & Inspection Limitations
  // ========================================================
  const limitations = [
    '- Static Heuristics Only: Workflows are audited via in-memory abstract syntax tree and graph parsing without runtime execution.',
    '- Zero Execution Guarantee: No nodes, webhooks, database triggers, or credentials were active or executed during this audit.',
    '- Immediate In-Memory Redaction: Secret strings matching vendor key formats, private keys, and passwords were redacted prior to analysis.',
    '- Scope Limitation: Static audits inspect declared workflow JSON topology. Runtime network traffic and external host permissions remain outside this scope.'
  ];

  let limitLinesTotal = 0;
  const renderedLimits = limitations.map((l) => {
    const lines = doc.splitTextToSize(l, contentWidth - 10);
    limitLinesTotal += lines.length;
    return lines;
  });

  const limitBoxH = (limitLinesTotal * 4.2) + 6;

  y = ensureSpace(doc, y, limitBoxH + 16, 265);
  doc.setTextColor(...COLORS.brandIndigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${sanitized.aiStatus.status === 'available' ? '4' : '3'}. Methodology & Inspection Limitations`, margin, y);
  y += 5;

  doc.setFillColor(...COLORS.bgInset);
  doc.setDrawColor(...COLORS.borderStandard);
  doc.setLineWidth(0.3);

  doc.roundedRect(margin, y, contentWidth, limitBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.textSecondary);

  let limitY = y + 5;
  renderedLimits.forEach((lines) => {
    doc.text(lines, margin + 5, limitY);
    limitY += (lines.length * 4.2);
  });

  // ========================================================
  // 6. Running Page Headers and Footers
  // ========================================================
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Running Header (Pages 2+)
    if (pageNum > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.brandIndigo);
      doc.text('FLOWSENTRY AI', margin, 11);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.textMuted);
      doc.text('|  Workflow Security Audit Report', margin + 26, 11);

      const workflowTruncated = cleanWorkflowName.length > 35
        ? `${cleanWorkflowName.substring(0, 32)}...`
        : cleanWorkflowName;
      doc.text(workflowTruncated, pageWidth - margin - doc.getTextWidth(workflowTruncated), 11);

      doc.setDrawColor(...COLORS.borderStandard);
      doc.setLineWidth(0.2);
      doc.line(margin, 13.5, pageWidth - margin, 13.5);
    }

    // Running Footer (All Pages)
    doc.setDrawColor(...COLORS.borderStandard);
    doc.setLineWidth(0.2);
    doc.line(margin, 287, pageWidth - margin, 287);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMuted);
    doc.text('Confidential Security Audit  |  FlowSentry AI  |  Static Inspection Only', margin, 291.5);

    const pageStr = `Page ${pageNum} of ${totalPages}`;
    doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), 291.5);
  }

  // ========================================================
  // 7. Trigger Browser Download
  // ========================================================
  const filename = getSafeExportFilename(sanitized.workflow.name, 'pdf');
  doc.save(filename);

  return filename;
}
