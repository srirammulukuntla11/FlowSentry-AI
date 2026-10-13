import { Router } from 'express';
import crypto from 'crypto';
import { handleWorkflowUpload } from '../middleware/upload.middleware.js';
import { parseWorkflowJson } from '../workflow/parser.js';
import { normalizeWorkflowGraph } from '../workflow/graph.js';
import { runSecurityScan } from '../security/scanner.js';
import { fetchAiExplanations } from '../services/n8n.service.js';
import { validateWorkflow } from '../workflow/validator.js';

const router = Router();

/**
 * POST /api/validate
 * Pre-check validation step before security analysis.
 * Evaluates JSON syntax, schema, node identifiers, connection references,
 * and returns a structured summary of passed checks, non-blocking warnings, and blocking errors.
 */
router.post('/validate', handleWorkflowUpload, (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: 'No workflow file was provided in the upload request.'
        }
      });
    }

    const validationResult = validateWorkflow(fileBuffer);

    return res.status(200).json({
      success: true,
      ...validationResult
    });
  } catch (err) {
    console.error(`[Validate Handler Error] ${err.name}: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'An internal error occurred during workflow validation.'
      }
    });
  }
});

/**
 * POST /api/scans
 * Accepts an exported n8n workflow JSON file.
 * Validates, parses, normalizes into graph representation,
 * and runs deterministic security rules with immediate redaction.
 * Attaches validated AI explanations from n8n if available.
 * Never executes the workflow or saves file to disk.
 */
router.post('/scans', handleWorkflowUpload, async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;

    // 0. Pre-check Validation Audit
    const validationResult = validateWorkflow(fileBuffer);

    // 1. Safe Parse & Validation
    const parsed = parseWorkflowJson(fileBuffer);

    // 2. Graph Normalization
    const graphData = normalizeWorkflowGraph(parsed.nodes, parsed.connections);

    // 3. Deterministic Security Rules Execution (includes riskScore)
    const scanResult = runSecurityScan(parsed.nodes, graphData);

    // 4. n8n + Gemini AI Explanations Orchestration
    const { aiStatus, explanations } = await fetchAiExplanations(scanResult.findings);

    // Attach explanations while preserving deterministic findings intact
    const augmentedFindings = scanResult.findings.map((finding) => ({
      ...finding,
      aiExplanation: explanations[finding.ruleId] || null
    }));

    const scanId = `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Combine any parser or graph resolution warnings
    const combinedWarnings = [
      ...parsed.warnings,
      ...graphData.graphWarnings
    ];

    res.status(200).json({
      success: true,
      scanId,
      workflow: {
        id: parsed.metadata.id,
        name: parsed.metadata.name,
        active: parsed.metadata.active,
        nodeCount: parsed.nodes.length,
        edgeCount: graphData.graphEdges.length
      },
      graph: {
        nodes: graphData.graphNodes,
        edges: graphData.graphEdges
      },
      summary: scanResult.summary,
      riskScore: scanResult.riskScore,
      validation: validationResult,
      findings: augmentedFindings,
      warnings: combinedWarnings,
      aiStatus,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (
      err.code === 'MALFORMED_JSON' ||
      err.code === 'INVALID_WORKFLOW_STRUCTURE' ||
      err.code === 'EMPTY_WORKFLOW'
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }

    // Unexpected internal errors: log safely without leaking file content
    console.error(`[Scan Handler Error] ${err.name}: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: {
        code: 'PARSE_FAILED',
        message: 'An error occurred while parsing the workflow.'
      }
    });
  }
});

export default router;
