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

export default function WorkflowGraph({
  graphNodes = [],
  graphEdges = [],
  highlightedNodeIds = [],
  onNodeSelect
}) {
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
          stroke: isConnectedToHighlight ? '#C74747' : '#4F8277',
          strokeWidth: isConnectedToHighlight ? 2 : 1.5,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease'
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
        onNodeClick={onNodeSelect ? (_event, node) => onNodeSelect(node.id) : undefined}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#D9DEE5" gap={18} size={1} />
        <Controls
          className="flow-controls-custom"
          showInteractive={false}
        />
        <MiniMap
          className="flow-minimap-custom"
          nodeColor={(n) => (highlightedSet.has(n.id) ? '#C74747' : '#9AAEBD')}
          maskColor="rgba(236, 234, 228, 0.75)"
        />
      </ReactFlow>
    </div>
  );
}
