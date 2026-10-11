import React from 'react';
import { Handle, Position } from '@xyflow/react';

export default function CustomNode({ data }) {
  const isHighlighted = Boolean(data.isHighlighted);

  // Derive a friendly node category icon
  const getNodeIcon = (type = '') => {
    const t = type.toLowerCase();
    if (t.includes('webhook')) return '⚡';
    if (t.includes('code')) return '💻';
    if (t.includes('http')) return '🌐';
    if (t.includes('postgres') || t.includes('mysql') || t.includes('mongo') || t.includes('db')) return '🗄️';
    if (t.includes('slack') || t.includes('discord') || t.includes('email')) return '💬';
    if (t.includes('cron') || t.includes('schedule') || t.includes('interval')) return '⏱️';
    return '📦';
  };

  const shortType = (data.nodeType || '')
    .replace('n8n-nodes-base.', '')
    .replace('@n8n/n8n-nodes-langchain.', 'langchain:');

  return (
    <div className={`custom-flow-node ${isHighlighted ? 'highlighted' : ''}`}>
      {/* Target input handle on left */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#3b82f6', width: 8, height: 8 }}
      />

      <div className="node-header">
        <span style={{ fontSize: '1rem' }}>{getNodeIcon(data.nodeType)}</span>
        <span className="node-badge">v{data.typeVersion || 1}</span>
      </div>

      <div className="node-title" title={data.label}>
        {data.label || 'Unnamed Node'}
      </div>

      <div className="node-type-label" title={data.nodeType}>
        {shortType || 'generic.node'}
      </div>

      {data.credentialTypes && data.credentialTypes.length > 0 && (
        <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {data.credentialTypes.map((c, i) => (
            <span key={i} style={{ fontSize: '0.6rem', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>
              🔑 {c}
            </span>
          ))}
        </div>
      )}

      {/* Source output handle on right */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#3b82f6', width: 8, height: 8 }}
      />
    </div>
  );
}
