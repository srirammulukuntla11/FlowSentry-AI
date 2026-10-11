import React, { useState, useMemo } from 'react';
import Navbar from './components/Navbar.jsx';
import UploadDropzone from './components/UploadDropzone.jsx';
import SeveritySummary from './components/SeveritySummary.jsx';
import WorkflowGraph from './components/WorkflowGraph.jsx';
import FindingsList from './components/FindingsList.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [scanResult, setScanResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Lookup map: nodeId -> node object
  const nodeLookup = useMemo(() => {
    if (!scanResult?.graph?.nodes) return {};
    const map = {};
    for (const node of scanResult.graph.nodes) {
      map[node.id] = node;
    }
    return map;
  }, [scanResult]);

  // Highlighted node IDs derived from currently selected finding
  const highlightedNodeIds = useMemo(() => {
    if (!selectedFinding) return [];
    return selectedFinding.affectedNodeIds || [];
  }, [selectedFinding]);

  const handleUpload = async (file) => {
    setIsLoading(true);
    setLoadingStep('Uploading and safely parsing workflow...');
    setError(null);
    setSelectedFinding(null);

    const formData = new FormData();
    formData.append('workflow', file, file.name);

    try {
      // NOTE: Do not set 'Content-Type' header manually; let the browser define multipart boundary
      const response = await fetch(`${API_BASE}/api/scans`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || `Server responded with status ${response.status}`);
      }

      setScanResult(data);
    } catch (err) {
      console.error('[Upload Error]', err);
      setError({
        code: 'SCAN_FAILED',
        message: err.message || 'An error occurred during workflow analysis.'
      });
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleSampleSelected = async (sampleType) => {
    const filename = sampleType === 'safe' ? 'safe-sample.json' : 'risky-sample.json';
    try {
      setIsLoading(true);
      setLoadingStep(`Loading synthetic ${sampleType} test fixture...`);
      const res = await fetch(`/samples/${filename}`);
      if (!res.ok) throw new Error(`Could not load sample fixture '${filename}'`);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: 'application/json' });
      await handleUpload(file);
    } catch (err) {
      setError({
        code: 'FIXTURE_LOAD_ERROR',
        message: err.message
      });
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setSelectedFinding(null);
  };

  return (
    <div className="app-container">
      <Navbar onReset={handleReset} />

      <main className="main-content">
        {/* Upload Dropzone (visible when not viewing results, or in collapsible reset state) */}
        {!scanResult && !isLoading && !error && (
          <UploadDropzone
            onFileSelected={handleUpload}
            isLoading={isLoading}
            onSampleSelected={handleSampleSelected}
          />
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="state-box">
            <div className="loading-spinner"></div>
            <div className="state-title">Analyzing Workflow</div>
            <div className="state-desc">{loadingStep || 'Evaluating deterministic security heuristics...'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Parsing graph structure • Redacting in-memory tokens • Zero execution
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="state-box">
            <div className="state-icon">❌</div>
            <div className="state-title">Scan Failed</div>
            <div className="state-desc" style={{ color: '#f87171' }}>{error.message}</div>
            <button className="btn-primary" onClick={handleReset}>
              Try Again / Upload Another File
            </button>
          </div>
        )}

        {/* Scan Results View */}
        {scanResult && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Bar with Re-scan button and Summary */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-sample"
                onClick={handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                ← Scan Another Workflow
              </button>

              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Scan ID: {scanResult.scanId}
              </div>
            </div>

            {/* Severity Cards */}
            <SeveritySummary
              summary={scanResult.summary}
              workflow={scanResult.workflow}
              aiStatus={scanResult.aiStatus}
            />

            {/* Parser Warnings if any */}
            {scanResult.warnings && scanResult.warnings.length > 0 && (
              <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#fde047' }}>
                ⚠️ <strong>Parser Notices:</strong> {scanResult.warnings.join(' ')}
              </div>
            )}

            {/* Main Interactive Grid: Left = Graph, Right = Findings */}
            <div className="dashboard-grid">
              {/* Left Panel: Workflow Interactive Graph */}
              <div className="panel-card">
                <div className="panel-header">
                  <div className="panel-title">
                    <span>🗺️</span>
                    <span>Workflow Topology Graph</span>
                  </div>
                  <div className="panel-meta">
                    {highlightedNodeIds.length > 0
                      ? `Highlighted: ${highlightedNodeIds.length} node(s)`
                      : 'Click a finding to highlight'}
                  </div>
                </div>

                <WorkflowGraph
                  graphNodes={scanResult.graph.nodes}
                  graphEdges={scanResult.graph.edges}
                  highlightedNodeIds={highlightedNodeIds}
                />
              </div>

              {/* Right Panel: Findings List */}
              <div className="panel-card">
                <div className="panel-header">
                  <div className="panel-title">
                    <span>📋</span>
                    <span>Security Findings & Heuristics</span>
                  </div>
                  <div className="panel-meta">
                    {scanResult.findings.length} item{scanResult.findings.length === 1 ? '' : 's'}
                  </div>
                </div>

                <FindingsList
                  findings={scanResult.findings}
                  selectedFindingId={selectedFinding?.id}
                  onSelectFinding={setSelectedFinding}
                  nodeLookup={nodeLookup}
                />
              </div>
            </div>

            {/* Disclaimer Footer Note */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              FlowSentry AI performs static heuristic inspection only. Workflows are never executed or imported into runtime environments. The absence of findings does not certify that a workflow is completely secure or free from vulnerabilities.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
