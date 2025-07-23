import React, { useState, useEffect, useMemo } from 'react';
import { useApi } from '../contexts/ApiContext';
import toast from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';
import ResourceGraph from './ResourceGraph';
import DetailsPanel from './DetailsPanel';
import FilterPanel from './FilterPanel';
import { 
  RefreshCw, 
  Box, 
  Globe, 
  Network, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  Shield,
  Server,
  Layers,
  Database,
  Cpu,
  GitBranch,
  Activity,
  Cloud,
  Eye,
  Settings,
  Filter,
  BarChart3,
  Search,
  Layout
} from 'lucide-react';

const AdminResources = () => {
  const [resources, setResources] = useState({
    pods: [],
    services: [],
    gateways: [],
    httpRoutes: [],
    virtualServices: [],
    istioGateways: [],
    destinationRules: [],
    serviceEntries: [],
    authorizationPolicies: [],
    peerAuthentications: [],
    inferenceServices: [],
    servingRuntimes: [],
    clusterServingRuntimes: []
  });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('overview');
  const [selectedResource, setSelectedResource] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    resourceTypes: [],
    namespaces: [],
    statuses: [],
    labels: []
  });
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState(null);
  const api = useApi();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const response = await api.getResources();
      setResources(response.data || {
        pods: [],
        services: [],
        gateways: [],
        httpRoutes: [],
        virtualServices: [],
        istioGateways: [],
        destinationRules: [],
        serviceEntries: [],
        authorizationPolicies: [],
        peerAuthentications: [],
        inferenceServices: [],
        servingRuntimes: [],
        clusterServingRuntimes: []
      });
      // Only update discovery time on successful fetch
      setLastDiscoveryTime(new Date().toISOString());
    } catch (error) {
      toast.error('Failed to fetch resources');
      console.error('Error fetching resources:', error);
      setResources({
        pods: [],
        services: [],
        gateways: [],
        httpRoutes: [],
        virtualServices: [],
        istioGateways: [],
        destinationRules: [],
        serviceEntries: [],
        authorizationPolicies: [],
        peerAuthentications: [],
        inferenceServices: [],
        servingRuntimes: [],
        clusterServingRuntimes: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Transform resources into resource graph format for enhanced visualization
  const resourceGraph = useMemo(() => {
    if (!resources) return { nodes: [], links: [], summary: { totalNodes: 0, totalLinks: 0, nodeTypes: {}, linkTypes: {} } };

    const nodes = [];
    const links = [];
    
    // Transform each resource type into nodes with enhanced categorization
    const addResourceNodes = (resourceList, type, category) => {
      resourceList.forEach((resource, index) => {
        let status = 'unknown';
        
        // Enhanced status determination based on resource type
        if (type === 'Pod') {
          status = resource.ready ? 'healthy' : (resource.status === 'Running' ? 'warning' : 'error');
        } else if (type === 'InferenceService') {
          status = resource.ready ? 'healthy' : 'warning';
        } else if (type === 'Service') {
          status = resource.clusterIP ? 'healthy' : 'warning';
        } else {
          status = 'healthy'; // Default for other resources
        }

        const nodeId = `${type}-${resource.namespace || 'default'}-${resource.name}-${resource.uid || resource.id || index}`;
        
        nodes.push({
          id: nodeId,
          type: type,
          name: resource.name,
          namespace: resource.namespace || 'default',
          status: status,
          connections: [], // Will be populated with actual relationships
          metadata: resource
        });

        // Create sample connections for demonstration (in real implementation, this would be based on actual relationships)
        if (type === 'HTTPRoute' && resourceList.length > index + 1) {
          const targetId = `Service-${resource.namespace || 'default'}-target-service-${index}`;
          links.push({
            source: nodeId,
            target: targetId,
            type: 'routes-to',
            label: 'Routes to'
          });
        }
      });
    };

    // Add nodes from all resource types
    addResourceNodes(resources.pods || [], 'Pod', 'kubernetes');
    addResourceNodes(resources.services || [], 'Service', 'kubernetes');
    addResourceNodes(resources.gateways || [], 'Gateway', 'gatewayApi');
    addResourceNodes(resources.httpRoutes || [], 'HTTPRoute', 'gatewayApi');
    addResourceNodes(resources.virtualServices || [], 'VirtualService', 'istio');
    addResourceNodes(resources.istioGateways || [], 'Gateway', 'istio');
    addResourceNodes(resources.destinationRules || [], 'DestinationRule', 'istio');
    addResourceNodes(resources.serviceEntries || [], 'ServiceEntry', 'istio');
    addResourceNodes(resources.authorizationPolicies || [], 'AuthorizationPolicy', 'istio');
    addResourceNodes(resources.peerAuthentications || [], 'PeerAuthentication', 'istio');
    addResourceNodes(resources.inferenceServices || [], 'InferenceService', 'kserve');
    addResourceNodes(resources.servingRuntimes || [], 'ServingRuntime', 'kserve');
    addResourceNodes(resources.clusterServingRuntimes || [], 'ClusterServingRuntime', 'kserve');

    return {
      nodes,
      links,
      summary: {
        totalNodes: nodes.length,
        totalLinks: links.length,
        nodeTypes: nodes.reduce((acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        }, {}),
        linkTypes: links.reduce((acc, link) => {
          acc[link.type] = (acc[link.type] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }, [resources]);

  // Apply filters to resource graph
  const filteredResourceGraph = useMemo(() => {
    if (!resourceGraph || !resourceGraph.nodes) return resourceGraph;

    const filteredNodes = resourceGraph.nodes.filter(node => {
      // Apply search filter
      if (filters.search && filters.search.length > 0) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch = 
          node.name.toLowerCase().includes(searchTerm) ||
          node.namespace.toLowerCase().includes(searchTerm) ||
          node.type.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;
      }

      // Apply resource type filter
      if (filters.resourceTypes && filters.resourceTypes.length > 0) {
        if (!filters.resourceTypes.includes(node.type)) return false;
      }

      // Apply namespace filter
      if (filters.namespaces && filters.namespaces.length > 0) {
        if (!filters.namespaces.includes(node.namespace)) return false;
      }

      // Apply status filter
      if (filters.statuses && filters.statuses.length > 0) {
        if (!filters.statuses.includes(node.status)) return false;
      }

      // Apply labels filter
      if (filters.labels && filters.labels.length > 0) {
        if (!node.metadata?.labels) return false;
        const nodeLabels = Object.keys(node.metadata.labels);
        const hasMatchingLabel = filters.labels.some(label => nodeLabels.includes(label));
        if (!hasMatchingLabel) return false;
      }

      return true;
    });

    // Filter links to only include those between visible nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = resourceGraph.links.filter(link => 
      nodeIds.has(link.source) && nodeIds.has(link.target)
    );

    return {
      nodes: filteredNodes,
      links: filteredLinks,
      summary: {
        totalNodes: filteredNodes.length,
        totalLinks: filteredLinks.length,
        nodeTypes: filteredNodes.reduce((acc, node) => {
          acc[node.type] = (acc[node.type] || 0) + 1;
          return acc;
        }, {}),
        linkTypes: filteredLinks.reduce((acc, link) => {
          acc[link.type] = (acc[link.type] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }, [resourceGraph, filters]);

  // Calculate overall stats for overview
  const overallStats = useMemo(() => {
    const stats = {
      total: 0,
      healthy: 0,
      warning: 0,
      error: 0,
      categories: 0
    };

    if (filteredResourceGraph && filteredResourceGraph.nodes) {
      stats.total = filteredResourceGraph.nodes.length;
      filteredResourceGraph.nodes.forEach(node => {
        if (node.status === 'healthy') stats.healthy++;
        else if (node.status === 'warning') stats.warning++;
        else if (node.status === 'error') stats.error++;
      });

      // Count unique categories
      const categories = new Set();
      filteredResourceGraph.nodes.forEach(node => {
        if (node.type.startsWith('AI')) categories.add('aiGateway');
        else if (node.type.includes('Envoy')) categories.add('envoyGateway');
        else if (['Gateway', 'HTTPRoute', 'GRPCRoute', 'GatewayClass'].includes(node.type)) categories.add('gatewayApi');
        else if (['VirtualService', 'DestinationRule', 'ServiceEntry', 'AuthorizationPolicy', 'PeerAuthentication'].includes(node.type)) categories.add('istio');
        else if (['InferenceService', 'ServingRuntime', 'ClusterServingRuntime'].includes(node.type)) categories.add('kserve');
        else categories.add('kubernetes');
      });
      stats.categories = categories.size;
    }

    return stats;
  }, [filteredResourceGraph]);

  const handleResourceAction = (action, resourceId) => {
    console.log(`Action: ${action} on resource: ${resourceId}`);
    // Implement resource actions (view, edit, delete, etc.)
    toast.success(`${action} action triggered for resource ${resourceId}`);
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
  };

  const handleSwitchToView = (view) => {
    setActiveView(view);
  };

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="card">
          <div className="loading" style={{ textAlign: 'center', padding: '3rem' }}>
            <Cloud size={48} color="#6b7280" style={{ marginBottom: '1rem' }} />
            <p>Loading Inference-in-a-Box resources...</p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onRetry={fetchResources}>
      <div className="card" style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column', margin: 0 }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.5rem',
          padding: '1rem 1rem 0 1rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '1.5rem', 
              fontWeight: '600',
              margin: 0
            }}>
              <Cloud size={24} />
              Platform Navigator
            </h2>
            <p style={{ color: '#6b7280', marginTop: '0.5rem', margin: 0 }}>
              Navigate and explore your AI/ML inference platform resources including Istio and KServe components
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-secondary btn-sm ${showFilters ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Filter size={16} />
              Filters
            </button>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={fetchResources}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem', 
          margin: '0 1rem 1.5rem 1rem' 
        }}>
          <StatsCard 
            title="Total Resources" 
            value={overallStats.total} 
            subtitle={`Across ${overallStats.categories} categories`}
            icon={<Database size={20} />}
            color="blue"
          />
          <StatsCard 
            title="Healthy" 
            value={overallStats.healthy} 
            subtitle={`${overallStats.total > 0 ? Math.round((overallStats.healthy / overallStats.total) * 100) : 0}% of total`}
            icon={<CheckCircle size={20} />}
            color="green"
          />
          <StatsCard 
            title="Warnings" 
            value={overallStats.warning} 
            subtitle="Need attention"
            icon={<AlertCircle size={20} />}
            color="yellow"
          />
          <StatsCard 
            title="Errors" 
            value={overallStats.error} 
            subtitle="Require immediate action"
            icon={<XCircle size={20} />}
            color="red"
          />
        </div>

        {/* Main View Tabs */}
        <nav className="nav-tabs" style={{ margin: '0 1rem 1rem 1rem' }}>
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'resources', label: 'Resources', icon: Database },
            { id: 'topology', label: 'Topology', icon: GitBranch },
            { id: 'configuration', label: 'Configuration', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-tab ${activeView === tab.id ? 'active' : ''}`}
                onClick={() => setActiveView(tab.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Filter Panel */}
          {showFilters && (
            <div style={{ flexShrink: 0, marginRight: '1rem', marginLeft: '1rem' }}>
              <FilterPanel
                resourceGraph={resourceGraph}
                filters={filters}
                onFiltersChange={setFilters}
                onRefresh={fetchResources}
                isRefreshing={loading}
              />
            </div>
          )}

          {/* Main View Content */}
          <div style={{ flex: 1, position: 'relative', marginRight: '1rem', marginBottom: '1rem' }}>
            {activeView === 'overview' && (
              <OverviewView 
                overallStats={overallStats}
                resourceGraph={filteredResourceGraph}
                lastDiscoveryTime={lastDiscoveryTime}
                onRefresh={fetchResources}
                isRefreshing={loading}
                onSwitchToResources={() => handleSwitchToView('resources')}
                onSwitchToTopology={() => handleSwitchToView('topology')}
              />
            )}

            {activeView === 'resources' && (
              <ResourcesView 
                resourceGraph={filteredResourceGraph}
                onResourceSelect={handleResourceSelect}
                onResourceAction={handleResourceAction}
                selectedResource={selectedResource}
              />
            )}

            {activeView === 'topology' && (
              <TopologyView 
                resourceGraph={filteredResourceGraph}
                onRefresh={fetchResources}
                isRefreshing={loading}
                onResourceSelect={handleResourceSelect}
              />
            )}

            {activeView === 'configuration' && (
              <ConfigurationView 
                overallStats={overallStats}
                lastDiscoveryTime={lastDiscoveryTime}
                onRefresh={fetchResources}
                isRefreshing={loading}
              />
            )}

            {/* Details Panel Overlay */}
            {selectedResource && (
              <DetailsPanel
                selectedResource={selectedResource}
                onClose={() => setSelectedResource(null)}
                onResourceAction={handleResourceAction}
              />
            )}
          </div>
        </div>

        {/* Empty State */}
        {overallStats.total === 0 && !loading && (
          <div style={{ 
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            padding: '3rem',
            border: '2px dashed #d1d5db',
            borderRadius: '8px',
            backgroundColor: 'white'
          }}>
            <Database size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              No Resources Found
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              No Inference-in-a-Box resources were discovered in your cluster.
            </p>
            <button 
              className="btn btn-primary"
              onClick={fetchResources}
            >
              Discover Resources
            </button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    blue: { bg: '#f0f9ff', border: '#0369a1', text: '#0369a1' },
    green: { bg: '#f0fdf4', border: '#15803d', text: '#15803d' },
    yellow: { bg: '#fefce8', border: '#ca8a04', text: '#ca8a04' },
    red: { bg: '#fef2f2', border: '#ef4444', text: '#ef4444' }
  };
  
  const colors = colorClasses[color] || colorClasses.blue;
  
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: '1rem', 
      backgroundColor: colors.bg, 
      borderRadius: '8px', 
      border: `1px solid ${colors.border}` 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ color: colors.text }}>{icon}</span>
        <span style={{ fontSize: '0.875rem', fontWeight: '500', color: colors.text }}>{title}</span>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: '600', color: colors.text }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: colors.text, marginTop: '0.25rem' }}>
        {subtitle}
      </div>
    </div>
  );
};

// Overview View Component
const OverviewView = ({ overallStats, resourceGraph, lastDiscoveryTime, onRefresh, isRefreshing, onSwitchToResources, onSwitchToTopology }) => {
  const getResourceTypeIcon = (type) => {
    switch (type.toLowerCase()) {
      case 'pod': return '☸️';
      case 'service': return '⚙️';
      case 'gateway': return '🌐';
      case 'httproute': return '🛣️';
      case 'virtualservice': return '🕸️';
      case 'destinationrule': return '📍';
      case 'serviceentry': return '🚪';
      case 'authorizationpolicy': return '🛡️';
      case 'peerauthentication': return '🔐';
      case 'inferenceservice': return '🧠';
      case 'servingruntime': return '🏃';
      case 'clusterservingruntime': return '🏃‍♂️';
      default: return '📦';
    }
  };

  return (
    <div style={{ 
      height: '100%', 
      overflow: 'auto', 
      padding: '1rem',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '1.5rem' 
    }}>
      {/* Resource Types Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          backgroundColor: '#ffffff'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={20} />
            Resource Types
          </h3>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Server size={14} />
            Breakdown of platform resources by type
            {lastDiscoveryTime && (
              <span style={{ marginLeft: '0.5rem' }}>
                • Last updated: {new Date(lastDiscoveryTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          {resourceGraph && resourceGraph.summary && Object.keys(resourceGraph.summary.nodeTypes).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(resourceGraph.summary.nodeTypes).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.125rem' }}>{getResourceTypeIcon(type)}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{type}</span>
                  </div>
                  <span style={{ 
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500'
                  }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              <Network size={32} color="#9ca3af" style={{ marginBottom: '0.5rem' }} />
              <p>No resource data available</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <RefreshCw size={14} />
                Discover Resources
              </button>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '1.5rem', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px',
          backgroundColor: '#ffffff'
        }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Quick Actions</h3>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            Common tasks for platform management
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={onSwitchToResources}
              disabled={overallStats.total === 0}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={16} />
                Browse Resources
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary"
              onClick={onSwitchToTopology}
              disabled={overallStats.total === 0}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitBranch size={16} />
                View Topology
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              className="btn btn-secondary"
              onClick={onRefresh}
              disabled={isRefreshing}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh Resources
            </button>
          </div>
        </div>
      </div>

      {/* Health Alert */}
      {overallStats.error > 0 && (
        <div style={{ 
          padding: '1rem', 
          border: '1px solid #fca5a5', 
          borderRadius: '8px',
          backgroundColor: '#fef2f2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <XCircle size={20} color="#dc2626" />
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626', margin: 0 }}>Attention Required</h3>
          </div>
          <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }}>
            {overallStats.error} resource{overallStats.error !== 1 ? 's' : ''} {overallStats.error === 1 ? 'is' : 'are'} reporting errors.
            <button
              className="btn btn-link"
              onClick={onSwitchToResources}
              style={{ color: '#dc2626', textDecoration: 'underline', padding: 0, marginLeft: '0.25rem' }}
            >
              View details in Resources →
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

// Resources View Component
const ResourcesView = ({ resourceGraph, onResourceSelect, onResourceAction, selectedResource }) => {
  const [expandedCategories, setExpandedCategories] = useState(new Set(['gateways', 'routes', 'policies']));
  const [searchTerm, setSearchTerm] = useState('');

  const resourceCategories = useMemo(() => {
    const categories = {
      'gateways': {
        title: 'Gateway Infrastructure',
        icon: Globe,
        types: ['GatewayClass', 'Gateway', 'EnvoyGateway'],
        resources: []
      },
      'routes': {
        title: 'Routes & Traffic',
        icon: GitBranch,
        types: ['AIGatewayRoute', 'HTTPRoute', 'GRPCRoute'],
        resources: []
      },
      'backends': {
        title: 'Service Backends',
        icon: Server,
        types: ['AIServiceBackend', 'Backend'],
        resources: []
      },
      'policies': {
        title: 'Security & Policies',
        icon: Shield,
        types: ['BackendSecurityPolicy', 'SecurityPolicy', 'BackendTLSPolicy', 'BackendTrafficPolicy', 'ClientTrafficPolicy', 'AuthorizationPolicy', 'PeerAuthentication'],
        resources: []
      },
      'services': {
        title: 'Services & Infrastructure',
        icon: Database,
        types: ['Service', 'Pod', 'InferenceService', 'ServingRuntime', 'ClusterServingRuntime'],
        resources: []
      },
      'other': {
        title: 'Other Resources',
        icon: Layers,
        types: [],
        resources: []
      }
    };

    // Distribute resources into categories
    if (resourceGraph && resourceGraph.nodes) {
      resourceGraph.nodes.forEach(resource => {
        let categorized = false;
        for (const [categoryKey, category] of Object.entries(categories)) {
          if (categoryKey !== 'other' && category.types.includes(resource.type)) {
            categories[categoryKey].resources.push(resource);
            categorized = true;
            break;
          }
        }
        // If not categorized, add to 'other'
        if (!categorized) {
          categories['other'].resources.push(resource);
          if (!categories['other'].types.includes(resource.type)) {
            categories['other'].types.push(resource.type);
          }
        }
      });
    }

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].resources.length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }, [resourceGraph]);

  const toggleCategory = (categoryKey) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryKey)) {
      newExpanded.delete(categoryKey);
    } else {
      newExpanded.add(categoryKey);
    }
    setExpandedCategories(newExpanded);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '1rem' }}>
      {/* Search */}
      <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <Search size={16} style={{ 
          position: 'absolute', 
          left: '0.75rem', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: '#6b7280' 
        }} />
        <input
          type="text"
          placeholder="Search resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem 0.5rem 2.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem'
          }}
        />
      </div>

      {/* Resource Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Object.entries(resourceCategories).map(([categoryKey, category]) => {
          const isExpanded = expandedCategories.has(categoryKey);
          const IconComponent = category.icon;

          if (category.resources.length === 0) return null;

          // Filter resources by search term
          const filteredResources = category.resources.filter(resource => {
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
              resource.name.toLowerCase().includes(search) ||
              resource.type.toLowerCase().includes(search) ||
              resource.namespace.toLowerCase().includes(search)
            );
          });

          if (filteredResources.length === 0 && searchTerm) return null;

          return (
            <div key={categoryKey} style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              overflow: 'hidden',
              backgroundColor: '#ffffff'
            }}>
              <div 
                style={{ 
                  padding: '1rem', 
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                  backgroundColor: '#f9fafb'
                }}
                onClick={() => toggleCategory(categoryKey)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <IconComponent size={20} style={{ color: '#3b82f6' }} />
                    <div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                        {category.title}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {filteredResources.length} resources
                      </div>
                    </div>
                  </div>
                  <button 
                    style={{ 
                      padding: '0.5rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.875rem',
                      cursor: 'pointer'
                    }}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {filteredResources.map((resource, index) => (
                      <div 
                        key={`${resource.id || index}`}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: `1px solid ${selectedResource?.id === resource.id ? '#3b82f6' : '#e5e7eb'}`,
                          backgroundColor: selectedResource?.id === resource.id ? '#f0f9ff' : '#f9fafb',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => onResourceSelect(resource)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 
                              resource.status === 'healthy' ? '#10b981' :
                              resource.status === 'warning' ? '#f59e0b' :
                              resource.status === 'error' ? '#ef4444' : '#6b7280'
                          }} />
                          <div>
                            <div style={{ fontWeight: '500' }}>{resource.name}</div>
                            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                              {resource.type} • {resource.namespace}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 
                              resource.status === 'healthy' ? '#dcfce7' :
                              resource.status === 'warning' ? '#fef3c7' :
                              resource.status === 'error' ? '#fee2e2' : '#f3f4f6',
                            color:
                              resource.status === 'healthy' ? '#166534' :
                              resource.status === 'warning' ? '#92400e' :
                              resource.status === 'error' ? '#991b1b' : '#374151',
                            textTransform: 'capitalize'
                          }}>
                            {resource.status || 'unknown'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResourceAction('view', resource.id);
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              backgroundColor: '#ffffff',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            <Eye size={12} />
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Topology View Component
const TopologyView = ({ resourceGraph, onRefresh, isRefreshing, onResourceSelect }) => {
  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <ResourceGraph
        resourceGraph={resourceGraph}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onResourceSelect={onResourceSelect}
      />
    </div>
  );
};

// Configuration View Component
const ConfigurationView = ({ overallStats, lastDiscoveryTime, onRefresh, isRefreshing }) => {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        backgroundColor: '#ffffff'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} />
          Platform Status
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: overallStats.total > 0 ? '#f0fdf4' : '#fef2f2', 
            borderRadius: '6px',
            border: `1px solid ${overallStats.total > 0 ? '#16a34a' : '#dc2626'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {overallStats.total > 0 ? 
                <CheckCircle size={16} color="#16a34a" /> : 
                <XCircle size={16} color="#dc2626" />}
              <span style={{ fontWeight: '500' }}>Platform Discovery</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {overallStats.total > 0 ? 
                `${overallStats.total} resources discovered` : 
                'No resources found'}
            </div>
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f8fafc', 
            borderRadius: '6px',
            border: '1px solid #64748b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Server size={16} color="#64748b" />
              <span style={{ fontWeight: '500' }}>Last Discovery</span>
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {lastDiscoveryTime ? 
                new Date(lastDiscoveryTime).toLocaleString() : 
                'Never'}
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.75rem' }}>Management Actions</h4>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={onRefresh}
              disabled={isRefreshing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} />
              {isRefreshing ? 'Discovering...' : 'Discover Resources'}
            </button>
            
            <button className="btn btn-secondary" disabled>
              <Shield size={16} />
              Configure Policies
            </button>
            
            <button className="btn btn-secondary" disabled>
              <Activity size={16} />
              Health Checks
            </button>
          </div>
        </div>
      </div>

      <div style={{ 
        padding: '1.5rem', 
        border: '1px solid #e5e7eb', 
        borderRadius: '8px',
        backgroundColor: '#ffffff'
      }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Platform Components</h3>
        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Status of core Inference-in-a-Box components
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Box size={16} />
              <span>Kubernetes Cluster</span>
            </div>
            <span style={{ 
              padding: '0.25rem 0.5rem',
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              Connected
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Network size={16} />
              <span>Gateway API</span>
            </div>
            <span style={{ 
              padding: '0.25rem 0.5rem',
              backgroundColor: overallStats.total > 0 ? '#f0fdf4' : '#fef2f2',
              color: overallStats.total > 0 ? '#15803d' : '#dc2626',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              {overallStats.total > 0 ? 'Active' : 'Not Found'}
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} />
              <span>AI/ML Platform</span>
            </div>
            <span style={{ 
              padding: '0.25rem 0.5rem',
              backgroundColor: '#fef3c7',
              color: '#ca8a04',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: '500'
            }}>
              Detecting
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminResources;