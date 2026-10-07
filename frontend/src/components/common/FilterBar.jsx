import React from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';

export const FilterBar = ({
  search,
  onSearchChange,
  placeholder = 'Filter table records...',
  filters = [], // [{ key, label, value, options: [{ label, value }], onChange }]
  onReset = null,
  totalCount = null,
  filteredCount = null,
  actions = null,
}) => {
  const hasActiveFilters = Boolean(
    search || (filters && filters.some((f) => f.value && f.value !== 'all'))
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        padding: 'var(--space-2) var(--space-3)',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Left: Search & Filter dropdowns */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', flex: 1 }}>
        {/* Search input */}
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              paddingLeft: '32px',
              height: '32px',
              fontSize: 'var(--text-base)',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dynamic Filters */}
        {filters.map((filter) => (
          <div key={filter.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select
              className="input"
              value={filter.value || 'all'}
              onChange={(e) => filter.onChange(e.target.value)}
              style={{
                height: '32px',
                padding: '0 8px',
                fontSize: 'var(--text-xs)',
                fontWeight: 500,
                color: filter.value && filter.value !== 'all' ? 'var(--accent-text)' : 'var(--text-secondary)',
                borderColor: filter.value && filter.value !== 'all' ? 'var(--accent-border)' : 'var(--border-default)',
                backgroundColor:
                  filter.value && filter.value !== 'all' ? 'var(--accent-subtle)' : 'var(--bg-surface)',
              }}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {/* Reset Filters button */}
        {hasActiveFilters && onReset && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onReset}
            style={{ color: 'var(--text-muted)', height: '32px', padding: '0 8px' }}
            title="Clear all filters"
          >
            <X size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Right: Record count & Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {totalCount !== null && (
          <span
            className="tabular-nums font-mono"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
          >
            {filteredCount !== null && filteredCount !== totalCount ? (
              <>
                <strong style={{ color: 'var(--text-primary)' }}>{filteredCount}</strong> of {totalCount} records
              </>
            ) : (
              <>{totalCount} records</>
            )}
          </span>
        )}

        {actions}
      </div>
    </div>
  );
};
