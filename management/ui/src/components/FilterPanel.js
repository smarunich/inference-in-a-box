import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
  Tag,
  Calendar,
  Hash,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';

const FilterPanel = ({ 
  resourceGraph, 
  filters, 
  onFiltersChange, 
  onRefresh, 
  isRefreshing,
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState(new Set(['search', 'type', 'namespace', 'status']));

  // Extract unique values from resource data
  const filterOptions = useMemo(() => {
    if (!resourceGraph || !resourceGraph.nodes) {
      return {
        namespaces: [],
        resourceTypes: [],
        labels: [],
        statuses: []
      };
    }

    const namespaces = new Set();
    const resourceTypes = new Set();
    const labels = new Set();
    const statuses = new Set();

    resourceGraph.nodes.forEach(node => {
      if (node.namespace) namespaces.add(node.namespace);
      if (node.type) resourceTypes.add(node.type);
      if (node.status) statuses.add(node.status);
      
      // Extract labels from metadata
      if (node.metadata?.labels) {
        Object.keys(node.metadata.labels).forEach(label => labels.add(label));
      }
    });

    return {
      namespaces: Array.from(namespaces).sort(),
      resourceTypes: Array.from(resourceTypes).sort(),
      labels: Array.from(labels).sort(),
      statuses: Array.from(statuses).sort()
    };
  }, [resourceGraph]);

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const updateFilter = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const updateMultiSelectFilter = (key, value, checked) => {
    const currentValues = filters[key] || [];
    let newValues;
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter(v => v !== value);
    }
    
    updateFilter(key, newValues);
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      resourceTypes: [],
      namespaces: [],
      statuses: [],
      labels: [],
      dateRange: null
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.search && filters.search.length > 0) ||
      (filters.resourceTypes && filters.resourceTypes.length > 0) ||
      (filters.namespaces && filters.namespaces.length > 0) ||
      (filters.statuses && filters.statuses.length > 0) ||
      (filters.labels && filters.labels.length > 0) ||
      filters.dateRange
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search && filters.search.length > 0) count++;
    if (filters.resourceTypes && filters.resourceTypes.length > 0) count++;
    if (filters.namespaces && filters.namespaces.length > 0) count++;
    if (filters.statuses && filters.statuses.length > 0) count++;
    if (filters.labels && filters.labels.length > 0) count++;
    if (filters.dateRange) count++;
    return count;
  }, [filters]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={14} color="#059669" />;
      case 'warning':
        return <AlertCircle size={14} color="#d97706" />;
      case 'error':
        return <XCircle size={14} color="#dc2626" />;
      default:
        return <Clock size={14} color="#6b7280" />;
    }
  };

  return (
    <div className={`${className}`} style={{
      width: '300px',
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>Filters</h3>
            {activeFilterCount > 0 && (
              <span style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '12px',
                fontWeight: '500'
              }}>
                {activeFilterCount}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.25rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  color: '#6b7280'
                }}
                title="Clear all filters"
              >
                <X size={16} />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                padding: '0.25rem',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            {resourceGraph?.nodes?.length || 0} resources
          </span>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          {/* Search Filter */}
          <FilterSection
            title="Search"
            icon={<Search size={16} />}
            isExpanded={expandedSections.has('search')}
            onToggle={() => toggleSection('search')}
          >
            <div style={{ position: 'relative' }}>
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
                value={filters.search || ''}
                onChange={(e) => updateFilter('search', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </FilterSection>

          {/* Resource Type Filter */}
          <FilterSection
            title="Resource Type"
            icon={<Hash size={16} />}
            isExpanded={expandedSections.has('type')}
            onToggle={() => toggleSection('type')}
            count={filters.resourceTypes?.length}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflow: 'auto' }}>
              {filterOptions.resourceTypes.map(type => (
                <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.resourceTypes?.includes(type) || false}
                    onChange={(e) => updateMultiSelectFilter('resourceTypes', type, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{type}</span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {resourceGraph?.nodes?.filter(n => n.type === type).length || 0}
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Namespace Filter */}
          <FilterSection
            title="Namespace"
            icon={<Tag size={16} />}
            isExpanded={expandedSections.has('namespace')}
            onToggle={() => toggleSection('namespace')}
            count={filters.namespaces?.length}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflow: 'auto' }}>
              {filterOptions.namespaces.map(namespace => (
                <label key={namespace} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.namespaces?.includes(namespace) || false}
                    onChange={(e) => updateMultiSelectFilter('namespaces', namespace, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{namespace}</span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {resourceGraph?.nodes?.filter(n => n.namespace === namespace).length || 0}
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Status Filter */}
          <FilterSection
            title="Status"
            icon={<CheckCircle size={16} />}
            isExpanded={expandedSections.has('status')}
            onToggle={() => toggleSection('status')}
            count={filters.statuses?.length}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filterOptions.statuses.map(status => (
                <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={filters.statuses?.includes(status) || false}
                    onChange={(e) => updateMultiSelectFilter('statuses', status, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {getStatusIcon(status)}
                    <span style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>{status}</span>
                  </span>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {resourceGraph?.nodes?.filter(n => n.status === status).length || 0}
                  </span>
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Labels Filter */}
          {filterOptions.labels.length > 0 && (
            <FilterSection
              title="Labels"
              icon={<Tag size={16} />}
              isExpanded={expandedSections.has('labels')}
              onToggle={() => toggleSection('labels')}
              count={filters.labels?.length}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflow: 'auto' }}>
                {filterOptions.labels.slice(0, 20).map(label => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filters.labels?.includes(label) || false}
                      onChange={(e) => updateMultiSelectFilter('labels', label, e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{label}</span>
                  </label>
                ))}
                {filterOptions.labels.length > 20 && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', padding: '0.5rem' }}>
                    ... and {filterOptions.labels.length - 20} more
                  </div>
                )}
              </div>
            </FilterSection>
          )}
        </div>
      )}
    </div>
  );
};

// Filter Section Component
const FilterSection = ({ title, icon, children, isExpanded, onToggle, count }) => (
  <div style={{ borderBottom: '1px solid #f3f4f6' }}>
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        textAlign: 'left'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon}
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{title}</span>
        {count > 0 && (
          <span style={{
            fontSize: '0.75rem',
            padding: '0.125rem 0.375rem',
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            borderRadius: '10px',
            fontWeight: '500'
          }}>
            {count}
          </span>
        )}
      </div>
      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>
    
    {isExpanded && (
      <div style={{ padding: '0 1rem 0.75rem 1rem' }}>
        {children}
      </div>
    )}
  </div>
);

export default FilterPanel;