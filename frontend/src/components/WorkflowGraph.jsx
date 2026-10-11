import React, { useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './CustomNode.jsx';

const nodeTypes = {
  customNode: CustomNode
};

export default function WorkflowGraph({ graphNodes = [], graphEdges = [], highlightedNodeIds = [] }) {
  const highlightedSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  // Convert normalized backend graph nodes to @xyflow/react format
  const flowNodes = useMemo(() => {
    return graphNodes.map((node) => {
      const isHighlighted = highlightedSet.has(node.id);
      return {
        id: node.id,
        type: 'customNode',
        position: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0
        },
        data: {
          label: node.name,
          nodeType: node.type,
          typeVersion: node.typeVersion,
          parameterCount: node.parameterCount,
          credentialTypes: node.credentialTypes || [],
          isHighlighted
        }
      };
    });
  }, [graphNodes, highlightedSet]);

  // Convert normalized backend graph edges to @xyflow/react format
  const flowEdges = useMemo(() => {
    return graphEdges.map((edge) => {
      const isConnectedToHighlight = 
        highlightedSet.has(edge.source) && highlightedSet.has(edge.target);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: isConnectedToHighlight,
        style: {
          stroke: isConnectedToHighlight ? '#f43f5e' : '#475569',
          strokeWidth: isConnectedToHighlight ? 3 : 1.5
        }
      };
    });
  }, [graphEdges, highlightedSet]);

  return (
    <div className="graph-viewport">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls style={{ background: '#111827', borderColor: '#374151', fill: '#f3f4f6' }} />
        <MiniMap
          style={{ background: '#0b0f19', border: '1px solid #1e293b' }}
          nodeColor={(n) => (highlightedSet.has(n.id) ? '#f43f5e' : '#334155')}
        />
      </ReactFlow>
    </div>
  );
}
