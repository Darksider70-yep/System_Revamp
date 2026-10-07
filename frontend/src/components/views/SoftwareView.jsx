import React, { useState, useMemo } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { RiskBadge } from '../common/StatusBadge';
import { Drawer } from '../common/Drawer';
import { Package, ShieldAlert, Play, ExternalLink, Layers } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const SoftwareView = ({ onRemediateApp }) => {
  const { scope, globalSearch } = useTheme();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState(null);

  // Fleet-wide Software Aggregation Mock/Fixture Data
  const fleetApps = [
    {
      id: 'sw-1',
      name: 'Node.js (x64)',
      publisher: 'OpenJS Foundation',
      installed_version: '16.14.0',
      latest_version: '20.18.0 LTS',
      risk_level: 'CRITICAL',
      cve_count: 3,
      cve_badge: 'CVE-2023-30581 (CVSS 8.2)',
      device_count: 12,
      affected_devices: ['CS-LAB1-WS01', 'CS-LAB1-WS02', 'CS-LAB1-WS05', 'CS-LAB2-WS11'],
    },
    {
      id: 'sw-2',
      name: 'Python 3.10 (64-bit)',
      publisher: 'Python Software Foundation',
      installed_version: '3.10.4',
      latest_version: '3.12.7',
      risk_level: 'HIGH',
      cve_count: 1,
      cve_badge: 'CVE-2023-27043 (CVSS 7.5)',
      device_count: 45,
      affected_devices: ['CS-LAB1-WS01', 'CS-LAB1-WS02', 'CS-LAB1-WS03', 'CS-LAB1-WS04'],
    },
    {
      id: 'sw-3',
      name: 'Git for Windows',
      publisher: 'The Git Development Community',
      installed_version: '2.41.0',
      latest_version: '2.47.0',
      risk_level: 'MEDIUM',
      cve_count: 0,
      cve_badge: null,
      device_count: 60,
      affected_devices: ['All Lab 1 & Lab 2 Machines'],
    },
    {
      id: 'sw-4',
      name: 'Google Chrome',
      publisher: 'Google LLC',
      installed_version: '129.0.6668.70',
      latest_version: '129.0.6668.90',
      risk_level: 'LOW',
      cve_count: 0,
      cve_badge: null,
      device_count: 82,
      affected_devices: ['All Fleet'],
    },
    {
      id: 'sw-5',
      name: 'Visual Studio Code',
      publisher: 'Microsoft Corporation',
      installed_version: '1.93.1',
      latest_version: '1.94.0',
      risk_level: 'LOW',
      cve_count: 0,
      cve_badge: null,
      device_count: 80,
      affected_devices: ['All Fleet'],
    },
  ];

  const filteredApps = useMemo(() => {
    const q = (search || globalSearch).toLowerCase().trim();
    return fleetApps.filter((app) => {
      if (q && !app.name.toLowerCase().includes(q) && !app.publisher.toLowerCase().includes(q)) {
        return false;
      }
      if (riskFilter !== 'all' && app.risk_level.toUpperCase() !== riskFilter.toUpperCase()) {
        return false;
      }
      return true;
    });
  }, [search, globalSearch, riskFilter]);

  const columns = [
    {
      id: 'name',
      header: 'Application & Publisher',
      accessor: 'name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.publisher}</span>
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
      render: (val) => <span className="font-mono tabular-nums" style={{ fontWeight: 600 }}>{val}</span>,
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
          style={{ height: '24px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
        >
          <Play size={10} />
          <span>Remediate All ({row.device_count})</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Fleet Software Inventory
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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
              { label: '🚨 Critical', value: 'CRITICAL' },
              { label: '⚠️ High', value: 'HIGH' },
              { label: '🟡 Medium', value: 'MEDIUM' },
              { label: '✅ Low / OK', value: 'LOW' },
            ],
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredApps}
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
            </div>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Installed Version:</span>
                <div className="font-mono" style={{ fontWeight: 600 }}>{selectedApp.installed_version}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Version:</span>
                <div className="font-mono" style={{ fontWeight: 600, color: 'var(--status-ok-text)' }}>
                  {selectedApp.latest_version}
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Affected Endpoints:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedApp.affected_devices.map((dev, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '6px 10px',
                      backgroundColor: 'var(--bg-code)',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    💻 {dev}
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
