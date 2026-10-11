import React from 'react';

export default function FindingsList({
  findings = [],
  selectedFindingId,
  onSelectFinding,
  nodeLookup = {}
}) {
  if (findings.length === 0) {
    return (
      <div className="state-box" style={{ padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem' }}>✅</div>
        <div className="state-title">No Deterministic Risks Identified</div>
        <div className="state-desc">
          The scanner evaluated all standard heuristic rules (hardcoded secrets, external HTTP destinations, sensitive-to-external flows, credential configs, destructive actions, and unknown nodes) and detected 0 high/medium warnings.
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>
          Note: Static analysis covers defined pattern sets and does not guarantee complete security.
        </div>
      </div>
    );
  }

  return (
    <div className="findings-container">
      {findings.map((finding) => {
        const isSelected = selectedFindingId === finding.id;
        const sevClass = (finding.severity || 'info').toLowerCase();

        return (
          <div
            key={finding.id}
            className={`finding-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectFinding(isSelected ? null : finding)}
          >
            <div className="finding-header">
              <div className="finding-title-group">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`severity-pill ${sevClass}`}>
                    {finding.severity}
                  </span>
                  <span className="rule-id-tag">{finding.ruleId}</span>
                </div>
                <div className="finding-title">{finding.title}</div>
              </div>
            </div>

            <div className="finding-evidence">
              <strong>Evidence:</strong> {finding.evidence}
            </div>

            {/* Affected Nodes Pills */}
            {finding.affectedNodeIds && finding.affectedNodeIds.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Affected Node{finding.affectedNodeIds.length > 1 ? 's' : ''}:
                </span>
                <div className="affected-nodes-list">
                  {finding.affectedNodeIds.map((nodeId) => {
                    const nodeName = nodeLookup[nodeId]?.name || nodeId;
                    return (
                      <span key={nodeId} className="affected-node-chip" title={`ID: ${nodeId}`}>
                        📍 {nodeName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expanded Detailed Breakdown */}
            <div className="finding-details">
              {finding.explanation && (
                <div className="detail-row">
                  <strong>Risk Context:</strong> {finding.explanation}
                </div>
              )}

              {finding.recommendation && (
                <div className="detail-row">
                  <strong>Recommended Mitigation:</strong> {finding.recommendation}
                </div>
              )}

              {/* AI Explanation Card (when available) */}
              {finding.aiExplanation && (
                <div style={{ marginTop: '0.65rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      🤖 AI Analysis (Gemini via n8n)
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      Advisory
                    </span>
                  </div>

                  <div style={{ fontSize: '0.775rem', color: '#e0e7ff', lineHeight: 1.45, marginBottom: '0.35rem' }}>
                    {finding.aiExplanation.summary}
                  </div>

                  {finding.aiExplanation.whyItMatters && (
                    <div style={{ fontSize: '0.75rem', color: '#c7d2fe', marginTop: '0.3rem' }}>
                      <strong style={{ color: '#fff' }}>Why it matters:</strong> {finding.aiExplanation.whyItMatters}
                    </div>
                  )}

                  {finding.aiExplanation.recommendedActions && (
                    <div style={{ fontSize: '0.75rem', color: '#c7d2fe', marginTop: '0.3rem' }}>
                      <strong style={{ color: '#fff' }}>Suggested Action:</strong> {finding.aiExplanation.recommendedActions}
                    </div>
                  )}
                </div>
              )}

              {finding.limitations && finding.limitations.length > 0 && (
                <div className="detail-row" style={{ color: 'var(--text-muted)' }}>
                  <strong>Limitations & Disclosure:</strong>{' '}
                  {finding.limitations.join(' ')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
