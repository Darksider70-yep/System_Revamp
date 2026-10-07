import React, { useState, useEffect, useMemo } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { RiskBadge } from '../common/StatusBadge';
import { Drawer } from '../common/Drawer';
import { Package, Play, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';

export const SoftwareView = ({ onRemediateApp }) => {
  const { scope, globalSearch } = useTheme();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);
  const [fleetApps, setFleetApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSoftware = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFleetSoftware(riskFilter);
      setFleetApps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch software inventory');
      setFleetApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSoftware();
  }, [riskFilter]);

  const filteredApps = useMemo(() => {
    const q = (search || globalSearch).toLowerCase().trim();
    return fleetApps.filter((app) => {
      if (q && !app.name.toLowerCase().includes(q) && !(app.publisher || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [fleetApps, search, globalSearch]);

  const columns = [
    {
      id: 'name',
      header: 'Application & Publisher',
      accessor: 'name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '23px' }}>{row.publisher || 'Unknown Publisher'}</span>
        </div>
      ),
    },
    {
      id: 'installed_version',
      header: 'Installed Ver',
      accessor: 'installed_version',
      sortable: true,
      render: (val) => <span className="font-mono tabular-nums">{val}</span>,
    },
    {
      id: 'latest_version',
      header: 'Target / Latest',
      accessor: 'latest_version',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="font-mono tabular-nums" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {val || 'Unknown'}
          </span>
          {row.version_source && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              via {row.version_source}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'risk_level',
      header: 'Risk Score',
      accessor: 'risk_level',
      sortable: true,
      render: (val) => <RiskBadge level={val} size="sm" />,
    },
    {
      id: 'cve_badge',
      header: 'Top Matched CVE',
      accessor: 'cve_badge',
      render: (val) =>
        val ? (
          <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
            {val}
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>None</span>
        ),
    },
    {
      id: 'device_count',
      header: 'Fleet Workstations',
      accessor: 'device_count',
      sortable: true,
      align: 'center',
      render: (val) => (
        <span className="tag-mono" style={{ fontWeight: 600 }}>
          {val} machines
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Remediate',
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            onRemediateApp(row.name);
          }}
          style={{ height: '26px', padding: '0 10px', fontSize: '11px', gap: '4px' }}
        >
          <Play size={11} />
          <span>Remediate ({row.device_count})</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Fleet Software Inventory
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
          Aggregated application versions, SemVer drift analysis, and NVD/OSV CVE exposure matching across {scope.name}
        </p>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Filter software by name or publisher..."
        totalCount={fleetApps.length}
        filteredCount={filteredApps.length}
        filters={[
          {
            key: 'risk',
            label: 'Risk Level',
            value: riskFilter,
            onChange: setRiskFilter,
            options: [
              { label: 'All Risks', value: 'all' },
              { label: 'Critical Risk', value: 'CRITICAL' },
              { label: 'High Risk', value: 'HIGH' },
              { label: 'Medium Risk', value: 'MEDIUM' },
              { label: 'Low / OK', value: 'LOW' },
            ],
          },
        ]}
      />

      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderRadius: 'var(--radius-container)', fontSize: '12px', border: '1px solid var(--status-critical-border)' }}>
          {error}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredApps}
        loading={loading}
        emptyTitle="No Software Discovered"
        emptyDescription="No software packages have been reported by enrolled agents yet."
        onRowClick={(row) => setSelectedApp(row)}
        pageSize={25}
      />

      {/* App Detail Drawer */}
      <Drawer
        isOpen={Boolean(selectedApp)}
        onClose={() => setSelectedApp(null)}
        title={selectedApp?.name || 'Software Details'}
        subtitle={`Publisher: ${selectedApp?.publisher || 'Unknown'}`}
        footer={
          <>
            <button type="button" className="btn btn-sm" onClick={() => setSelectedApp(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                const appName = selectedApp?.name;
                setSelectedApp(null);
                onRemediateApp(appName);
              }}
            >
              <span>Remediate on {selectedApp?.device_count} Endpoints</span>
              <Play size={12} />
            </button>
          </>
        }
      >
        {selectedApp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <RiskBadge level={selectedApp.risk_level} />
              <span className="tag-mono">{selectedApp.device_count} Affected Devices</span>
              {selectedApp.version_source && (
                <span className="tag-mono" style={{ color: 'var(--accent-text)' }}>
                  Source: {selectedApp.version_source}
                </span>
              )}
            </div>

            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-container)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Installed Version:</span>
                <div className="font-mono" style={{ fontWeight: 600, marginTop: '2px' }}>{selectedApp.installed_version}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Version:</span>
                <div className="font-mono" style={{ fontWeight: 600, color: 'var(--status-ok-text)', marginTop: '2px' }}>
                  {selectedApp.latest_version || 'N/A'}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                Affected Endpoints:
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Array.isArray(selectedApp.affected_devices) && selectedApp.affected_devices.map((dev, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-code)',
                      borderRadius: 'var(--radius-input)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Monitor size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span>{dev}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
