import React, { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import UploadDropzone from './components/UploadDropzone.jsx';
import SeveritySummary from './components/SeveritySummary.jsx';
import WorkflowGraph from './components/WorkflowGraph.jsx';
import FindingsList from './components/FindingsList.jsx';
import ExportDropdown from './components/ExportDropdown.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [scanResult, setScanResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Stage 5 & 6 interactive filters, view modes, and full screen graph state
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'graph' | 'findings'
  const [isFullScreenGraph, setIsFullScreenGraph] = useState(false);

  // Theme state persisted in localStorage
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('flowsentry-theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('flowsentry-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('flowsentry-theme', 'light');
    }
  }, [isDarkMode]);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Handle Escape key & body scroll lock for Full Screen Graph overlay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreenGraph) {
        setIsFullScreenGraph(false);
      }
    };

    if (isFullScreenGraph) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isFullScreenGraph]);

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

  // Filtered findings derived from in-memory search and severity filter
  const filteredFindings = useMemo(() => {
    if (!scanResult?.findings) return [];

    return scanResult.findings.filter((finding) => {
      // 1. Severity filter check
      if (severityFilter !== 'all') {
        const sev = (finding.severity || '').toLowerCase();
        if (sev !== severityFilter.toLowerCase()) {
          return false;
        }
      }

      // 2. Search query check (title, rule ID, evidence, and affected node names)
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const titleMatch = (finding.title || '').toLowerCase().includes(q);
        const ruleMatch = (finding.ruleId || '').toLowerCase().includes(q);
        const evidenceMatch = (finding.evidence || '').toLowerCase().includes(q);
        const nodeMatch = (finding.affectedNodeIds || []).some((nodeId) => {
          const nodeName = nodeLookup[nodeId]?.name || nodeId;
          return nodeName.toLowerCase().includes(q);
        });

        if (!titleMatch && !ruleMatch && !evidenceMatch && !nodeMatch) {
          return false;
        }
      }

      return true;
    });
  }, [scanResult, severityFilter, searchQuery, nodeLookup]);

  const handleUpload = async (file) => {
    setIsLoading(true);
    setLoadingStep('Uploading and safely parsing workflow...');
    setError(null);
    setSelectedFinding(null);
    setSeverityFilter('all');
    setSearchQuery('');
    setIsFullScreenGraph(false);

    const formData = new FormData();
    formData.append('workflow', file, file.name);

    try {
      // NOTE: Do not set 'Content-Type' header manually; let browser define multipart boundary
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
    setSeverityFilter('all');
    setSearchQuery('');
    setViewMode('split');
    setIsFullScreenGraph(false);
  };

  const handleClearFilters = () => {
    setSeverityFilter('all');
    setSearchQuery('');
  };

  const handleNodeSelect = (nodeId) => {
    if (!scanResult?.findings) return;
    const matchingFinding = scanResult.findings.find((f) =>
      f.affectedNodeIds?.includes(nodeId)
    );
    if (matchingFinding) {
      setSelectedFinding(matchingFinding);
    }
  };

  const renderAiBadge = (aiStatus) => {
    if (!aiStatus) return null;
    const status = aiStatus.status;
    if (status === 'available') {
      return (
        <span className="ai-badge available" title="AI Explanations active via Gemini">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span>AI Advisory: Active</span>
        </span>
      );
    }
    if (status === 'unavailable') {
      return (
        <span className="ai-badge unavailable" title={aiStatus.message || 'AI service unavailable'}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>AI Advisory: Unavailable</span>
        </span>
      );
    }
    return (
      <span className="ai-badge off" title="AI Explanations skipped or disabled">
        <span className="ai-dot-off" aria-hidden="true" />
        <span>AI Advisory: Off</span>
      </span>
    );
  };

  return (
    <div className="app-container">
      <Navbar
        onReset={handleReset}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
      />

      <main className="main-content">
        {/* Upload Dropzone (visible when not viewing results) */}
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
            <div className="state-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--severity-high)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div className="state-title">Scan Failed</div>
            <div className="state-desc" style={{ color: 'var(--severity-high)' }}>{error.message}</div>
            <button className="btn-primary" onClick={handleReset}>
              Try Again / Upload Another File
            </button>
          </div>
        )}

        {/* Scan Results Dashboard */}
        {scanResult && !isLoading && (
          <div className="results-dashboard-container">
            {/* 1. Compact Navigation & Workflow Summary Section */}
            <section className="workflow-summary-section" aria-label="Workflow Summary">
              <div className="workflow-summary-left">
                <button
                  type="button"
                  className="btn-scan-another"
                  onClick={handleReset}
                  aria-label="Scan Another Workflow"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Scan Another Workflow</span>
                </button>

                <div className="workflow-details-group">
                  <h1 className="workflow-title" title={scanResult.workflow?.name || 'Workflow Scan Report'}>
                    {scanResult.workflow?.name || 'Workflow Scan Report'}
                  </h1>
                  <div className="workflow-meta-chips">
                    <span className="meta-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                        <line x1="6" y1="6" x2="6.01" y2="6" />
                        <line x1="6" y1="18" x2="6.01" y2="18" />
                      </svg>
                      Nodes: <strong>{scanResult.workflow?.nodeCount ?? 0}</strong>
                    </span>
                    <span className="meta-chip-sep">•</span>
                    <span className="meta-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                      Edges: <strong>{scanResult.workflow?.edgeCount ?? 0}</strong>
                    </span>
                    <span className="meta-chip-sep">•</span>
                    <span className="meta-chip">
                      <span className={`status-indicator-dot ${scanResult.workflow?.active ? 'active' : 'inactive'}`} />
                      Status: <strong className={scanResult.workflow?.active ? 'status-text-active' : 'status-text-inactive'}>{scanResult.workflow?.active ? 'Active' : 'Draft / Inactive'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="workflow-summary-right">
                <div className="meta-info-badge scan-id" title={`Scan ID: ${scanResult.scanId}`}>
                  <span className="meta-info-label">Scan ID:</span>
                  <span className="meta-info-value">{scanResult.scanId}</span>
                </div>
                {renderAiBadge(scanResult.aiStatus)}
                <button
                  type="button"
                  className={`meta-info-badge total-findings ${severityFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setSeverityFilter('all')}
                  title="Click to reset filters and view all findings"
                  aria-label={`Total Findings: ${scanResult.summary?.total ?? 0}`}
                >
                  <span className="meta-info-label">Total Findings:</span>
                  <strong className="meta-info-value">{scanResult.summary?.total ?? 0}</strong>
                </button>
                <ExportDropdown
                  scanResult={scanResult}
                  nodeLookup={nodeLookup}
                />
              </div>
            </section>

            {/* 2. Risk Summary Cards in Single Row */}
            <SeveritySummary
              summary={scanResult.summary}
              activeFilter={severityFilter}
              onFilterChange={setSeverityFilter}
            />

            {/* Parser Warnings if any */}
            {scanResult.warnings && scanResult.warnings.length > 0 && (
              <div style={{ background: 'var(--severity-medium-bg)', border: '1px solid var(--severity-medium-border)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--severity-medium)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--severity-medium)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div>
                  <strong>Parser Notices:</strong> {scanResult.warnings.join(' ')}
                </div>
              </div>
            )}

            {/* 3. Organized Search, Severity Filter & View Mode Toolbar */}
            <div className="dashboard-toolbar">
              <div className="toolbar-left-group">
                {/* Search Bar */}
                <div className="search-box-wrapper">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="search-icon" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search findings, rule ID, node..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search security findings"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search query"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Severity Filter Pills */}
                <div className="filter-pills-bar" role="group" aria-label="Severity Filters">
                  <button
                    type="button"
                    className={`filter-pill ${severityFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setSeverityFilter('all')}
                  >
                    All ({scanResult.findings.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill high ${severityFilter === 'high' ? 'active' : ''}`}
                    onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
                  >
                    High ({scanResult.summary.high || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill medium ${severityFilter === 'medium' ? 'active' : ''}`}
                    onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
                  >
                    Medium ({scanResult.summary.medium || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill low ${severityFilter === 'low' ? 'active' : ''}`}
                    onClick={() => setSeverityFilter(severityFilter === 'low' ? 'all' : 'low')}
                  >
                    Low ({scanResult.summary.low || 0})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill info ${severityFilter === 'info' ? 'active' : ''}`}
                    onClick={() => setSeverityFilter(severityFilter === 'info' ? 'all' : 'info')}
                  >
                    Info ({scanResult.summary.info || 0})
                  </button>
                </div>
              </div>

              <div className="toolbar-right-group">
                {/* View Mode Segmented Controls */}
                <div className="view-mode-toggle" role="radiogroup" aria-label="Dashboard View Modes">
                  <button
                    type="button"
                    className={`btn-view-mode ${viewMode === 'split' ? 'active' : ''}`}
                    onClick={() => setViewMode('split')}
                    role="radio"
                    aria-checked={viewMode === 'split'}
                    title="Side-by-side Graph and Findings view"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="8" height="18" rx="1" />
                      <rect x="13" y="3" width="8" height="18" rx="1" />
                    </svg>
                    Split
                  </button>
                  <button
                    type="button"
                    className={`btn-view-mode ${viewMode === 'graph' ? 'active' : ''}`}
                    onClick={() => setViewMode('graph')}
                    role="radio"
                    aria-checked={viewMode === 'graph'}
                    title="Prioritize Topology Graph view"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Graph Focus
                  </button>
                  <button
                    type="button"
                    className={`btn-view-mode ${viewMode === 'findings' ? 'active' : ''}`}
                    onClick={() => setViewMode('findings')}
                    role="radio"
                    aria-checked={viewMode === 'findings'}
                    title="Prioritize Findings Report view"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    Findings Focus
                  </button>
                </div>

                {/* Full Screen Graph Action Button */}
                <button
                  type="button"
                  className="btn-fullscreen-trigger"
                  onClick={() => setIsFullScreenGraph(true)}
                  title="Expand workflow graph into full viewport (Escape to exit)"
                  aria-label="Full Screen Graph"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  <span>Full Screen Graph</span>
                </button>
              </div>
            </div>

            {/* 4. Main Interactive Two-Column Workspace */}
            <div className={`dashboard-grid view-${viewMode}`}>
              {/* Left Panel: Workflow Topology Graph */}
              <div className={`panel-card graph-panel ${viewMode === 'graph' ? 'featured' : ''}`}>
                <div className="panel-header">
                  <div className="panel-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-primary)' }}>
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                    <span>Workflow Topology Graph</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="panel-meta">
                      {highlightedNodeIds.length > 0
                        ? `${highlightedNodeIds.length} flagged`
                        : `${scanResult.graph.nodes.length} nodes`}
                    </div>
                    <button
                      type="button"
                      className="btn-panel-fullscreen"
                      onClick={() => setIsFullScreenGraph(true)}
                      title="Open graph in full screen"
                      aria-label="Open graph in full screen"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      <span>Expand</span>
                    </button>
                  </div>
                </div>

                <WorkflowGraph
                  graphNodes={scanResult.graph.nodes}
                  graphEdges={scanResult.graph.edges}
                  highlightedNodeIds={highlightedNodeIds}
                  onNodeSelect={handleNodeSelect}
                />
              </div>

              {/* Right Panel: Security Findings & Heuristics */}
              <div className={`panel-card findings-panel ${viewMode === 'findings' ? 'featured' : ''}`}>
                <div className="panel-header">
                  <div className="panel-title">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-teal)' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>Security Findings & Heuristics</span>
                  </div>
                  <div className="panel-meta">
                    {filteredFindings.length} of {scanResult.findings.length} item{scanResult.findings.length === 1 ? '' : 's'}
                  </div>
                </div>

                <FindingsList
                  findings={filteredFindings}
                  selectedFindingId={selectedFinding?.id}
                  onSelectFinding={setSelectedFinding}
                  nodeLookup={nodeLookup}
                  totalFindingsCount={scanResult.findings.length}
                  searchQuery={searchQuery}
                  severityFilter={severityFilter}
                  onClearFilters={handleClearFilters}
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

      {/* 5. Full Screen Graph Overlay Modal */}
      {isFullScreenGraph && scanResult && (
        <div
          className="fullscreen-graph-overlay"
          role="dialog"
          aria-label="Full Screen Workflow Graph"
          aria-modal="true"
        >
          <div className="fullscreen-graph-header">
            <div className="fullscreen-graph-title-group">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="fullscreen-header-icon" aria-hidden="true">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <div className="fullscreen-workflow-info">
                <span className="fullscreen-workflow-name">{scanResult.workflow?.name || 'Workflow Topology'}</span>
                <span className="fullscreen-workflow-meta">
                  {scanResult.graph?.nodes?.length ?? 0} Nodes • {scanResult.graph?.edges?.length ?? 0} Edges
                  {highlightedNodeIds.length > 0 ? ` • ${highlightedNodeIds.length} Flagged` : ''}
                </span>
              </div>
            </div>

            <div className="fullscreen-graph-actions">
              <button
                type="button"
                className="btn-close-fullscreen"
                onClick={() => setIsFullScreenGraph(false)}
                aria-label="Exit full screen graph"
                title="Exit full screen (Escape)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                <span>Exit Full Screen</span>
                <kbd className="kbd-shortcut">Esc</kbd>
              </button>
            </div>
          </div>

          <div className="fullscreen-graph-body">
            <WorkflowGraph
              graphNodes={scanResult.graph.nodes}
              graphEdges={scanResult.graph.edges}
              highlightedNodeIds={highlightedNodeIds}
              onNodeSelect={handleNodeSelect}
            />
          </div>
        </div>
      )}

      {/* Full-Width Homepage Footer (visible when not viewing results) */}
      {!scanResult && !isLoading && !error && (
        <footer className="homepage-footer" aria-label="Privacy and execution safety notice">
          <div className="homepage-footer-inner">
            <div className="privacy-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="privacy-content">
              <span className="privacy-title">Static analysis only. Uploaded workflows are never executed.</span>
              <span className="privacy-details">Parsed in memory to audit graph topology and heuristics, immediately redacting secret values. Raw workflows and secrets are never stored.</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
