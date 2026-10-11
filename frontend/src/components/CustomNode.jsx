import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function CustomNode({ data }) {
  const isHighlighted = Boolean(data.isHighlighted);

  // Return a sleek, lightweight SVG icon tailored to the node category
  const renderNodeIcon = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('webhook')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#344766" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    }
    if (t.includes('code')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4F8277" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    }
    if (t.includes('http')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#344766" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    }
    if (t.includes('postgres') || t.includes('mysql') || t.includes('mongo') || t.includes('db')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6D61A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    }
    if (t.includes('slack') || t.includes('discord') || t.includes('email') || t.includes('chat')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#367A53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    }
    if (t.includes('cron') || t.includes('schedule') || t.includes('interval')) {
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B77924" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    }
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#778191" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  };

  const shortType = (data.nodeType || '')
    .replace('n8n-nodes-base.', '')
    .replace('@n8n/n8n-nodes-langchain.', 'langchain:');

  return (
    <div
      className={`custom-flow-node ${isHighlighted ? 'highlighted' : ''}`}
      tabIndex={0}
      role="group"
      aria-label={`Node: ${data.label || 'Unnamed'}, Type: ${shortType}`}
    >
      {/* Target input handle on left */}
      <Handle
        type="target"
        position={Position.Left}
        className="flow-handle input-handle"
        style={{
          background: isHighlighted ? 'var(--severity-high)' : 'var(--brand-primary)',
          width: 8,
          height: 8,
          border: '2px solid #FFFFFF',
          boxShadow: 'none'
        }}
      />

      <div className="node-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="node-icon-wrapper">
            {renderNodeIcon(data.nodeType)}
          </span>
          <span className="node-badge">v{data.typeVersion || 1}</span>
        </div>
        {isHighlighted && (
          <span className="node-risk-indicator" title="Connected to active security finding">
            FLAGGED
          </span>
        )}
      </div>

      <div className="node-title" title={data.label}>
        {data.label || 'Unnamed Node'}
      </div>

      <div className="node-type-label" title={data.nodeType}>
        {shortType || 'generic.node'}
      </div>

      {data.credentialTypes && data.credentialTypes.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
          {data.credentialTypes.map((c, i) => (
            <span
              key={i}
              className="node-cred-chip"
              title={`Credential Reference: ${c}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m21 2-9.6 9.6" />
                <path d="m15.5 7.5 3 3L22 7l-3-3" />
              </svg>
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Source output handle on right */}
      <Handle
        type="source"
        position={Position.Right}
        className="flow-handle output-handle"
        style={{
          background: isHighlighted ? 'var(--severity-high)' : 'var(--brand-primary)',
          width: 8,
          height: 8,
          border: '2px solid #FFFFFF',
          boxShadow: 'none'
        }}
      />
    </div>
  );
}
