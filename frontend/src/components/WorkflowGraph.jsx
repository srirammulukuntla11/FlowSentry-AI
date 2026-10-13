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

/**
 * Precedence rank: High (4) -> Medium (3) -> Low (2) -> Info (1)
 */
const SEVERITY_PRECEDENCE = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export default function WorkflowGraph({
  graphNodes = [],
  graphEdges = [],
  findings = [],
  highlightedNodeIds = [],
  onNodeSelect
}) {
  const highlightedSet = useMemo(() => new Set(highlightedNodeIds), [highlightedNodeIds]);

  // Compute node risk map from findings using strict precedence: High -> Medium -> Low -> Info
  const nodeRiskMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(findings) || findings.length === 0) {
      return map;
    }

    // Node name-to-id mapping for resilient identifier resolution
    const nameToId = {};
    for (const node of graphNodes) {
      if (node.name && node.id) {
        nameToId[node.name] = node.id;
      }
    }

    for (const finding of findings) {
      const sev = (finding.severity || '').toLowerCase();
      const rank = SEVERITY_PRECEDENCE[sev] || 0;
      if (rank === 0) continue;

      const affected = finding.affectedNodeIds || [];
      for (const rawId of affected) {
        const targetId = nameToId[rawId] || rawId;

        if (!map[targetId]) {
          map[targetId] = {
            severity: sev,
            highestRank: rank,
            findingsCount: 1,
            ruleIds: finding.ruleId ? [finding.ruleId] : []
          };
        } else {
          map[targetId].findingsCount += 1;
          if (finding.ruleId && !map[targetId].ruleIds.includes(finding.ruleId)) {
            map[targetId].ruleIds.push(finding.ruleId);
          }
          if (rank > map[targetId].highestRank) {
            map[targetId].severity = sev;
            map[targetId].highestRank = rank;
          }
        }
      }
    }

    return map;
  }, [findings, graphNodes]);

  // Convert normalized backend graph nodes to @xyflow/react format with full risk data
  const flowNodes = useMemo(() => {
    return graphNodes.map((node) => {
      const isSelected = highlightedSet.has(node.id);
      const riskInfo = nodeRiskMap[node.id] || null;

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
          riskSeverity: riskInfo?.severity || null,
          findingsCount: riskInfo?.findingsCount || 0,
          ruleIds: riskInfo?.ruleIds || [],
          isSelected
        }
      };
    });
  }, [graphNodes, nodeRiskMap, highlightedSet]);

  // Convert normalized backend graph edges to @xyflow/react format
  const flowEdges = useMemo(() => {
    return graphEdges.map((edge) => {
      const isSourceSelected = highlightedSet.has(edge.source);
      const isTargetSelected = highlightedSet.has(edge.target);
      const isBothSelected = isSourceSelected && isTargetSelected;
      const isConnectedToSelected = isSourceSelected || isTargetSelected;

      // Color active edge according to source risk or active accent
      const sourceRisk = nodeRiskMap[edge.source]?.severity;
      const activeColor = sourceRisk === 'high' ? '#EF4444'
        : sourceRisk === 'medium' ? '#F59E0B'
        : sourceRisk === 'low' ? '#0284C7'
        : '#5145E5';

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated: isBothSelected,
        style: {
          stroke: isConnectedToSelected ? activeColor : '#94A3B8',
          strokeWidth: isBothSelected ? 2.5 : isConnectedToSelected ? 2 : 1.5,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease'
        }
      };
    });
  }, [graphEdges, nodeRiskMap, highlightedSet]);

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
        <Background color="var(--border-standard, #E2E8F0)" gap={18} size={1} />
        <Controls
          className="flow-controls-custom"
          showInteractive={false}
        />
        <MiniMap
          className="flow-minimap-custom"
          nodeColor={(n) => {
            const risk = nodeRiskMap[n.id]?.severity;
            if (risk === 'high') return '#EF4444';
            if (risk === 'medium') return '#F59E0B';
            if (risk === 'low') return '#0284C7';
            if (risk === 'info') return '#6366F1';
            return '#94A3B8';
          }}
          maskColor="var(--minimap-mask, rgba(241, 245, 249, 0.75))"
        />
      </ReactFlow>
    </div>
  );
}
