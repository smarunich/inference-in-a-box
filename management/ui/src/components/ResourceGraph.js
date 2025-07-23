import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  Position,
  Handle,
  useNodesState,
  useEdgesState,
  MiniMap,
  Panel,
  ReactFlowProvider,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Network, 
  Shield, 
  Server,
  Database,
  Key,
  GitBranch,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Settings
} from 'lucide-react';

// Tier definitions for clean layout
const TIERS = {
  'Gateway Infrastructure': ['GatewayClass'],
  'Gateway Layer': ['Gateway'],
  'Routing Layer': ['HTTPRoute', 'AIGatewayRoute'],
  'Backend Layer': ['AIServiceBackend', 'Backend'],
  'Service Layer': ['Service'],
  'Security Layer': ['BackendSecurityPolicy', 'SecurityPolicy', 'AuthorizationPolicy', 'PeerAuthentication']
};

// Colors for each tier
const TIER_COLORS = {
  'Gateway Infrastructure': { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  'Gateway Layer': { bg: '#dcfce7', border: '#22c55e', text: '#16a34a' },
  'Routing Layer': { bg: '#f3e8ff', border: '#a855f7', text: '#7c3aed' },
  'Backend Layer': { bg: '#fed7aa', border: '#f97316', text: '#ea580c' },
  'Service Layer': { bg: '#cffafe', border: '#06b6d4', text: '#0891b2' },
  'Security Layer': { bg: '#fecaca', border: '#ef4444', text: '#dc2626' }
};

// Custom node component with tier-based styling
const TierNode = ({ data }) => {
  const getNodeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'gateway':
        return <Network size={20} />;
      case 'gatewayclass':
        return <Layers size={20} />;
      case 'httproute':
      case 'aigatewayroute':
        return <GitBranch size={20} />;
      case 'aiservicebackend':
      case 'backend':
        return <Server size={20} />;
      case 'service':
        return <Database size={20} />;
      case 'securitypolicy':
      case 'backendsecuritypolicy':
      case 'authorizationpolicy':
      case 'peerauthentication':
        return <Shield size={20} />;
      default:
        return <Settings size={20} />;
    }
  };

  const getStatusIndicator = (status) => {
    const statusStyle = {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      position: 'absolute',
      top: '-6px',
      right: '-6px'
    };

    switch (status) {
      case 'healthy':
        return <div style={{...statusStyle, backgroundColor: '#22c55e'}} />;
      case 'warning':
        return <div style={{...statusStyle, backgroundColor: '#f59e0b'}} />;
      case 'error':
        return <div style={{...statusStyle, backgroundColor: '#ef4444'}} />;
      default:
        return <div style={{...statusStyle, backgroundColor: '#6b7280'}} />;
    }
  };

  const tierColors = TIER_COLORS[data.tier] || TIER_COLORS['Service Layer'];

  return (
    <div style={{
      position: 'relative',
      padding: '12px 16px',
      borderRadius: '12px',
      border: `2px solid ${tierColors.border}`,
      backgroundColor: tierColors.bg,
      minWidth: '200px',
      maxWidth: '250px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s ease'
    }}>
      <Handle type="target" position={Position.Top} style={{ width: '12px', height: '12px', backgroundColor: '#6b7280', border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} style={{ width: '12px', height: '12px', backgroundColor: '#6b7280', border: '2px solid white' }} />
      
      {/* Status indicator */}
      {getStatusIndicator(data.status)}
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ 
          padding: '8px', 
          borderRadius: '8px', 
          backgroundColor: tierColors.bg, 
          color: tierColors.text,
          border: `1px solid ${tierColors.border}`
        }}>
          {getNodeIcon(data.type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            fontWeight: '600', 
            fontSize: '14px', 
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#111827'
          }}>
            {data.label}
          </h3>
          <p style={{ 
            fontSize: '12px', 
            margin: 0,
            color: '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {data.type}
          </p>
        </div>
      </div>
      
      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          fontSize: '12px',
          padding: '2px 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '4px',
          color: tierColors.text,
          fontWeight: '500'
        }}>
          {data.namespace || 'default'}
        </span>
      </div>
      
      {data.description && (
        <p style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          margin: '8px 0 0 0',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {data.description}
        </p>
      )}
    </div>
  );
};

const nodeTypes = {
  tier: TierNode
};

const ResourceGraph = ({ resourceGraph, onRefresh, isRefreshing }) => {
  const [selectedTiers, setSelectedTiers] = useState(Object.keys(TIERS));
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [showHealthyOnly, setShowHealthyOnly] = useState(false);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Filter resources to focus on Gateway API, Envoy Gateway, and related services
  const isRelevantResource = (node) => {
    const type = node.type.toLowerCase();
    
    // Include all resource types for comprehensive view
    return true;
  };

  // Get tier for a resource type
  const getTierForType = (type) => {
    for (const [tier, types] of Object.entries(TIERS)) {
      if (types.some(t => type.toLowerCase().includes(t.toLowerCase()))) {
        return tier;
      }
    }
    return 'Service Layer'; // default
  };

  // Create filtered and positioned nodes
  const createTierBasedLayout = useCallback(() => {
    if (!resourceGraph || !resourceGraph.nodes) return { nodes: [], edges: [] };

    const filteredNodes = resourceGraph.nodes.filter(node => {
      if (!isRelevantResource(node)) return false;
      
      const tier = getTierForType(node.type);
      if (!selectedTiers.includes(tier)) return false;
      
      if (selectedNamespace !== 'all' && node.namespace !== selectedNamespace) return false;
      if (showHealthyOnly && node.status !== 'healthy') return false;
      
      return true;
    });

    const flowNodes = [];
    const flowEdges = [];

    // Group nodes by tier
    const tierGroups = {};
    Object.keys(TIERS).forEach(tier => { tierGroups[tier] = []; });
    
    filteredNodes.forEach(node => {
      const tier = getTierForType(node.type);
      tierGroups[tier].push(node);
    });

    // Layout nodes in tiers
    let currentY = 100;
    const tierSpacing = 200;
    const nodeSpacing = 280;

    Object.entries(tierGroups).forEach(([tier, nodes]) => {
      if (nodes.length === 0) return;

      const tierWidth = Math.max(3, nodes.length) * nodeSpacing;
      const startX = -tierWidth / 2;

      nodes.forEach((node, index) => {
        const x = startX + (index * nodeSpacing) + (nodeSpacing / 2);
        
        flowNodes.push({
          id: node.id,
          type: 'tier',
          position: { x, y: currentY },
          data: {
            label: node.name,
            type: node.type,
            tier,
            status: node.status,
            namespace: node.namespace,
            description: `${tier} component in ${node.namespace || 'default'} namespace`
          },
          draggable: true
        });
      });

      currentY += tierSpacing;
    });

    // Create edges from filtered links
    if (resourceGraph.links) {
      resourceGraph.links.forEach((link, index) => {
        const sourceExists = flowNodes.find(n => n.id === link.source);
        const targetExists = flowNodes.find(n => n.id === link.target);
        
        if (sourceExists && targetExists) {
          flowEdges.push({
            id: `edge-${index}`,
            source: link.source,
            target: link.target,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            label: link.label || link.type?.replace(/-/g, ' ') || '',
            style: { 
              stroke: '#6366f1', 
              strokeWidth: 2,
              strokeDasharray: link.type?.includes('security') ? '5,5' : undefined
            },
            labelStyle: { 
              fill: '#4f46e5', 
              fontWeight: 500, 
              fontSize: 11,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '4px',
              padding: '2px 4px'
            }
          });
        }
      });
    }

    return { nodes: flowNodes, edges: flowEdges };
  }, [resourceGraph, selectedTiers, selectedNamespace, showHealthyOnly]);

  const { nodes: initialNodes, edges: initialEdges } = createTierBasedLayout();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when filters change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = createTierBasedLayout();
    setNodes(newNodes);
    setEdges(newEdges);
  }, [createTierBasedLayout, setNodes, setEdges]);

  // Handle connection
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Get unique namespaces from relevant resources
  const namespaces = useMemo(() => {
    if (!resourceGraph || !resourceGraph.nodes) return [];
    const relevantNodes = resourceGraph.nodes.filter(isRelevantResource);
    return [...new Set(relevantNodes.map(n => n.namespace).filter(Boolean))];
  }, [resourceGraph]);

  // Reset layout
  const resetLayout = useCallback(() => {
    const { nodes: newNodes, edges: newEdges } = createTierBasedLayout();
    setNodes(newNodes);
    setEdges(newEdges);
    reactFlowInstance?.fitView({ padding: 50, duration: 800 });
  }, [createTierBasedLayout, setNodes, setEdges, reactFlowInstance]);

  // Fit view
  const fitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 50, duration: 800 });
  }, [reactFlowInstance]);

  if (!resourceGraph || !resourceGraph.nodes || resourceGraph.nodes.length === 0) {
    return (
      <div style={{ 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem'
      }}>
        <Network size={64} color="#9ca3af" />
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>No Resources Found</h3>
        <p style={{ color: '#6b7280', textAlign: 'center', margin: 0 }}>
          Discover Inference-in-a-Box resources first to view their relationships
        </p>
        <button 
          className="btn btn-primary"
          onClick={onRefresh} 
          disabled={isRefreshing}
        >
          {isRefreshing ? 'Discovering...' : 'Discover Resources'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* Filters Panel */}
      <div style={{ 
        width: '300px', 
        borderRight: '1px solid #e5e7eb', 
        backgroundColor: '#ffffff', 
        padding: '1rem', 
        overflowY: 'auto',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header */}
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>Platform Topology</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
              Visualize Inference-in-a-Box resource relationships
            </p>
          </div>

          {/* Tier Filters */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.75rem', display: 'block' }}>
              Resource Tiers
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(TIERS).map(([tier, types]) => {
                const tierColors = TIER_COLORS[tier];
                const count = resourceGraph.nodes.filter(node => 
                  getTierForType(node.type) === tier && isRelevantResource(node)
                ).length;
                
                return (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input
                      type="checkbox"
                      id={tier}
                      checked={selectedTiers.includes(tier)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTiers([...selectedTiers, tier]);
                        } else {
                          setSelectedTiers(selectedTiers.filter(t => t !== tier));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor={tier} style={{ flex: 1, fontSize: '0.875rem', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ color: tierColors.text }}>{tier}</span>
                        <span style={{ 
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px'
                        }}>
                          {count}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {types.join(', ')}
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Namespace Filter */}
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>
              Namespace
            </label>
            <select 
              value={selectedNamespace} 
              onChange={(e) => setSelectedNamespace(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Namespaces</option>
              {namespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>

          {/* Health Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="healthy-only"
              checked={showHealthyOnly}
              onChange={(e) => setShowHealthyOnly(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="healthy-only" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
              Show healthy resources only
            </label>
          </div>

          {/* Controls */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary btn-sm"
                onClick={fitView} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Maximize2 size={16} />
                Fit to View
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={resetLayout} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <RotateCcw size={16} />
                Reset Layout
              </button>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={onRefresh} 
                disabled={isRefreshing} 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Server size={16} />
                {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Topology Statistics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Nodes:</span>
                <span>{nodes.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Connections:</span>
                <span>{edges.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Active Tiers:</span>
                <span>{selectedTiers.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Topology View */}
      <div style={{ flex: 1 }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 100 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              style: { stroke: '#6366f1', strokeWidth: 2 }
            }}
            style={{ backgroundColor: '#f9fafb' }}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap 
              nodeColor="#6366f1" 
              maskColor="rgba(0, 0, 0, 0.2)"
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            
            {/* Panel with tier legend */}
            <Panel position="top-right" style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '8px' }}>Tier Legend</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(TIER_COLORS).map(([tier, colors]) => (
                  <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '2px', 
                      backgroundColor: colors.bg, 
                      border: `1px solid ${colors.border}` 
                    }} />
                    <span style={{ color: colors.text }}>{tier}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
};

export default ResourceGraph;