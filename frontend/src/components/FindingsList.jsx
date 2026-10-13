import React from 'react';

export default function FindingsList({
  findings = [],
  selectedFindingId,
  onSelectFinding,
  nodeLookup = {},
  totalFindingsCount = 0,
  searchQuery = '',
  severityFilter = 'all',
  onClearFilters
}) {
  // Case 1: Workflow itself has 0 findings (e.g. Safe Sample)
  if (totalFindingsCount === 0 && findings.length === 0) {
    const verifiedChecks = [
      { id: 'secrets', label: 'Hardcoded Secrets & API Tokens', desc: 'No plaintext credentials or high-entropy tokens' },
      { id: 'http', label: 'External HTTP Destinations', desc: 'No unverified outbound requests detected' },
      { id: 'egress', label: 'Sensitive Data Egress Paths', desc: 'No pipeline flows from sensitive data to external sinks' },
      { id: 'db', label: 'Database Mutation & Queries', desc: 'No destructive SQL queries or unescaped commands' },
      { id: 'creds', label: 'Credential References', desc: 'Managed credential bindings checked against policy' },
      { id: 'nodes', label: 'Third-Party Node Registry', desc: 'All nodes match certified ecosystem packages' }
    ];

    return (
      <div className="zero-findings-container" role="region" aria-label="Clean Security Audit Status">
        <div className="zero-findings-card">
          <div className="zero-findings-status-pill">
            <span className="status-indicator-dot active" aria-hidden="true" />
            <span>Clean Security Audit • Zero Policy Violations</span>
          </div>

          <div className="zero-findings-icon-box" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="var(--severity-safe-bg)" stroke="var(--severity-safe)" />
              <path d="m9 12 2 2 4-4" stroke="var(--severity-safe)" strokeWidth="2.5" />
            </svg>
          </div>

          <h3 className="zero-findings-title">No Deterministic Risks Identified</h3>

          <p className="zero-findings-desc">
            Static heuristic inspection audited this workflow against all standard security heuristics. No hardcoded secrets, unauthorized external destinations, sensitive data exfiltration paths, dangerous database queries, or unverified custom nodes were detected.
          </p>

          <div className="zero-findings-grid" aria-label="Evaluated heuristic rules">
            {verifiedChecks.map((check) => (
              <div key={check.id} className="heuristic-check-card">
                <div className="check-card-icon" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--severity-safe)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="check-card-content">
                  <span className="check-card-title">{check.label}</span>
                  <span className="check-card-desc">{check.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="zero-findings-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Static inspection covers defined pattern heuristics without executing code. Re-scan if workflow nodes or credentials change.</span>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Workflow has findings, but active search or severity filter matched 0 items
  if (findings.length === 0 && totalFindingsCount > 0) {
    return (
      <div className="state-box filter-empty-state">
        <div className="filter-empty-icon" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <div className="state-title">No Matching Findings</div>
        <div className="state-desc">
          No security findings match your current criteria
          {severityFilter !== 'all' && <span> with severity <strong>"{severityFilter}"</strong></span>}
          {searchQuery && <span> containing <strong>"{searchQuery}"</strong></span>}.
        </div>
        {onClearFilters && (
          <button
            type="button"
            className="btn-primary"
            onClick={onClearFilters}
          >
            Reset Filters & Show All ({totalFindingsCount})
          </button>
        )}
      </div>
    );
  }

  // Case 3: Display filtered findings list with redesigned finding cards
  return (
    <div className="findings-container" role="feed" aria-label="Security Findings List">
      {findings.map((finding) => {
        const isSelected = selectedFindingId === finding.id;
        const sevClass = (finding.severity || 'info').toLowerCase();

        return (
          <article
            key={finding.id}
            className={`finding-card ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectFinding(isSelected ? null : finding)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectFinding(isSelected ? null : finding);
              }
            }}
            tabIndex={0}
            role="button"
            aria-pressed={isSelected}
            aria-label={`${finding.severity} finding: ${finding.title}`}
          >
            {/* 1. Header Bar: Severity, Rule ID, Affected Node & Selection */}
            <header className="finding-header">
              <div className="finding-meta-row">
                <span className={`severity-badge ${sevClass}`}>
                  <span className="severity-dot" aria-hidden="true" />
                  <span>{finding.severity}</span>
                </span>

                <span className="rule-id-badge" title={`Rule: ${finding.ruleId}`}>
                  {finding.ruleId}
                </span>

                {finding.affectedNodeIds && finding.affectedNodeIds.length > 0 && (
                  <div className="finding-affected-inline">
                    {finding.affectedNodeIds.map((nodeId) => {
                      const nodeName = nodeLookup[nodeId]?.name || nodeId;
                      return (
                        <span key={nodeId} className="affected-node-chip" title={`Affected Node: ${nodeName} (${nodeId})`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                          </svg>
                          <span>{nodeName}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {isSelected && (
                  <span className="selected-indicator">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Selected in Graph</span>
                  </span>
                )}
              </div>

              <h3 className="finding-title">{finding.title}</h3>
            </header>

            {/* 2. Guidance & Risk Context: Why it matters & Suggested Action */}
            <div className="finding-guidance-grid">
              {finding.explanation && (
                <div className="guidance-block risk-context">
                  <div className="guidance-header">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="guidance-title">Why It Matters</span>
                  </div>
                  <p className="guidance-text">{finding.explanation}</p>
                </div>
              )}

              {finding.recommendation && (
                <div className="guidance-block mitigation">
                  <div className="guidance-header">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <span className="guidance-title">Suggested Action</span>
                  </div>
                  <p className="guidance-text">{finding.recommendation}</p>
                </div>
              )}
            </div>

            {/* 3. Technical Evidence Section */}
            {finding.evidence && (
              <section className="finding-evidence-section" aria-label="Technical Evidence">
                <div className="evidence-header">
                  <div className="evidence-label-group">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                    <span className="evidence-label">Evidence</span>
                  </div>
                  <span className="evidence-redaction-notice">In-Memory Audit • Redacted</span>
                </div>
                <div className="evidence-code-block" tabIndex={0}>
                  <code>{finding.evidence}</code>
                </div>
              </section>
            )}

            {/* 4. AI Advisory Analysis Section (Gemini via n8n) */}
            {finding.aiExplanation && (
              <section className="ai-advisory-card" aria-label="AI Advisory Analysis">
                <div className="ai-advisory-header">
                  <div className="ai-advisory-title-group">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
                    </svg>
                    <span className="ai-advisory-heading">AI Advisory Analysis</span>
                    <span className="ai-advisory-provider">Gemini via n8n</span>
                  </div>
                  <span className="ai-non-authoritative-badge">Advisory • Non-Authoritative</span>
                </div>

                <div className="ai-advisory-summary">
                  {finding.aiExplanation.summary}
                </div>

                {finding.aiExplanation.whyItMatters && (
                  <div className="ai-advisory-row">
                    <span className="ai-row-label">Why it matters:</span>
                    <span className="ai-row-value">{finding.aiExplanation.whyItMatters}</span>
                  </div>
                )}

                {finding.aiExplanation.recommendedActions && (
                  <div className="ai-advisory-row">
                    <span className="ai-row-label">Suggested Action:</span>
                    <span className="ai-row-value">{finding.aiExplanation.recommendedActions}</span>
                  </div>
                )}
              </section>
            )}

            {/* 5. Heuristic Scope & Limitations */}
            {finding.limitations && finding.limitations.length > 0 && (
              <footer className="finding-limitations-section">
                <span className="limitations-label">Scope & Limitations:</span>
                <span className="limitations-text">{finding.limitations.join(' ')}</span>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

