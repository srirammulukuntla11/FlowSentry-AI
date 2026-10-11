import React from 'react';

export default function SeveritySummary({ summary, workflow, aiStatus }) {
  if (!summary) return null;

  const renderAiBadge = () => {
    if (!aiStatus) return null;
    const status = aiStatus.status;
    if (status === 'available') {
      return (
        <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: '#34d399', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)' }}>
          🤖 AI Explanations: Active
        </span>
      );
    }
    if (status === 'unavailable') {
      return (
        <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)' }} title={aiStatus.message}>
          ⚠️ AI Explanations: Unavailable (Rule-based report)
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)' }}>
        ⚪ AI Explanations: Off
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
            {workflow?.name || 'Workflow Scan Report'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Nodes: {workflow?.nodeCount || 0} • Edges: {workflow?.edgeCount || 0} • Status: {workflow?.active ? 'Active' : 'Draft/Inactive'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {renderAiBadge()}
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)' }}>
            Findings Total: <strong>{summary.total || 0}</strong>
          </span>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-card high">
          <div className="summary-card-header">
            <span className="summary-card-title">High Risk</span>
            <span style={{ fontSize: '1rem' }}>🚨</span>
          </div>
          <div className="summary-card-count" style={{ color: 'var(--severity-high)' }}>
            {summary.high || 0}
          </div>
        </div>

        <div className="summary-card medium">
          <div className="summary-card-header">
            <span className="summary-card-title">Medium Risk</span>
            <span style={{ fontSize: '1rem' }}>⚠️</span>
          </div>
          <div className="summary-card-count" style={{ color: 'var(--severity-medium)' }}>
            {summary.medium || 0}
          </div>
        </div>

        <div className="summary-card low">
          <div className="summary-card-header">
            <span className="summary-card-title">Low / Audit</span>
            <span style={{ fontSize: '1rem' }}>🔍</span>
          </div>
          <div className="summary-card-count" style={{ color: 'var(--severity-low)' }}>
            {summary.low || 0}
          </div>
        </div>

        <div className="summary-card info">
          <div className="summary-card-header">
            <span className="summary-card-title">Info / Coverage</span>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
          </div>
          <div className="summary-card-count" style={{ color: 'var(--severity-info)' }}>
            {summary.info || 0}
          </div>
        </div>
      </div>
    </div>
  );
}
