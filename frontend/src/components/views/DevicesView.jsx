import React, { useState, useEffect, useMemo } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { StatusBadge, RiskBadge } from '../common/StatusBadge';
import { Drawer } from '../common/Drawer';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { CopyField } from '../common/CopyField';
import {
  Monitor,
  RefreshCw,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const DevicesView = ({ onSelectDevice, initialFilters = {} }) => {
  const { scope, globalSearch } = useTheme();
  const [devices, setDevices] = useState([]);
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [activeDrawerDevice, setActiveDrawerDevice] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || 'all');
  const [riskFilter, setRiskFilter] = useState(initialFilters.risk || 'all');
  const [labFilter, setLabFilter] = useState(initialFilters.labId || 'all');

  // Confirmation Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const [devs, labsData] = await Promise.all([
        api.getDevices(scope.labId).catch(() => []),
        api.getLabs(scope.siteId).catch(() => []),
      ]);
      setDevices(Array.isArray(devs) ? devs : []);
      setLabs(Array.isArray(labsData) ? labsData : []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [scope.labId, scope.siteId]);

  // Combined Filtering
  const filteredDevices = useMemo(() => {
    const q = (search || globalSearch).toLowerCase().trim();
    return devices.filter((d) => {
      if (q) {
        const matchesName = (d.hostname || '').toLowerCase().includes(q);
        const matchesIp = (d.ip_address || '').toLowerCase().includes(q);
        const matchesOs = (d.os_info || '').toLowerCase().includes(q);
        const matchesId = (d.id || d.device_id || '').toLowerCase().includes(q);
        if (!matchesName && !matchesIp && !matchesOs && !matchesId) return false;
      }

      if (statusFilter !== 'all' && (d.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (riskFilter !== 'all' && (d.risk_level || 'LOW').toUpperCase() !== riskFilter.toUpperCase()) {
        return false;
      }

      if (labFilter !== 'all' && String(d.lab_id) !== String(labFilter)) {
        return false;
      }

      return true;
    });
  }, [devices, search, globalSearch, statusFilter, riskFilter, labFilter]);

  // Bulk Actions
  const handleBulkRescan = () => {
    setConfirmAction({
      type: 'RESCAN_BASELINE',
      title: `Trigger Telemetry Rescan on ${selectedDeviceIds.length} Endpoints`,
      description: 'Dispatches an immediate outbound hardware/software inventory scan command to the selected agents.',
      target: `${selectedDeviceIds.length} endpoints`,
      rawPayload: { action: 'scan', target_ids: selectedDeviceIds },
      dryRun: false,
    });
    setConfirmOpen(true);
  };

  const handleBulkRemediate = () => {
    setConfirmAction({
      type: 'WINGET_UPGRADE_ALL',
      title: `Queue Remediation on ${selectedDeviceIds.length} Endpoints`,
      description: 'Will execute unattended winget/driver upgrades on selected machines with dry-run safety validation.',
      target: `${selectedDeviceIds.length} endpoints`,
      rawPayload: { command: 'winget-upgrade', devices: selectedDeviceIds },
      dryRun: true,
    });
    setConfirmOpen(true);
  };

  const handleExecuteConfirm = async () => {
    try {
      for (const id of selectedDeviceIds) {
        await api.queueCommand('device', id, confirmAction.type, confirmAction.rawPayload, confirmAction.dryRun);
      }
      setConfirmOpen(false);
      setSelectedDeviceIds([]);
      fetchDevices();
    } catch (err) {
      alert(`Error queueing command: ${err.message}`);
    }
  };

  // Table Columns Definition
  const columns = [
    {
      id: 'hostname',
      header: 'Device Name & IP',
      accessor: 'hostname',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val || row.name || 'Workstation'}</span>
          </div>
          <span className="font-mono tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '23px' }}>
            {row.ip_address || '127.0.0.1'}
          </span>
        </div>
      ),
    },
    {
      id: 'lab_name',
      header: 'Lab / Location',
      accessor: 'lab_name',
      sortable: true,
      render: (val, row) => {
        const lab = labs.find((l) => l.id === row.lab_id);
        return (
          <span className="tag-mono" style={{ fontSize: '11px' }}>
            {lab?.name || val || 'Lab 1'}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Agent Status',
      accessor: 'status',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <StatusBadge status={val || 'online'} size="sm" />
          <span className="tabular-nums font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {row.last_seen ? new Date(row.last_seen).toLocaleTimeString() : 'Just now'}
          </span>
        </div>
      ),
    },
    {
      id: 'os_info',
      header: 'Operating System',
      accessor: 'os_info',
      sortable: true,
      render: (val) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {val || 'Windows 11 Pro (23H2)'}
        </span>
      ),
    },
    {
      id: 'risk_level',
      header: 'Risk Level',
      accessor: 'risk_level',
      sortable: true,
      render: (val, row) => <RiskBadge level={val || 'LOW'} score={row.risk_score} size="sm" />,
    },
    {
      id: 'outdated_count',
      header: 'Outdated Apps',
      accessor: 'outdated_count',
      sortable: true,
      align: 'center',
      render: (val) => {
        const count = val || 0;
        return (
          <span
            className="tabular-nums font-mono"
            style={{
              fontWeight: count > 0 ? 600 : 400,
              color: count > 3 ? 'var(--status-critical-text)' : count > 0 ? 'var(--status-high-text)' : 'var(--text-muted)',
            }}
          >
            {count} pkgs
          </span>
        );
      },
    },
    {
      id: 'driver_issues_count',
      header: 'Driver Errors',
      accessor: 'driver_issues_count',
      sortable: true,
      align: 'center',
      render: (val) => {
        const count = val || 0;
        return (
          <span
            className="tabular-nums font-mono"
            style={{
              fontWeight: count > 0 ? 600 : 400,
              color: count > 0 ? 'var(--status-critical-text)' : 'var(--text-muted)',
            }}
          >
            {count}
          </span>
        );
      },
    },
    {
      id: 'agent_version',
      header: 'Agent Ver',
      accessor: 'agent_version',
      sortable: true,
      render: (val) => <span className="tag-mono">{val || 'v2.0.0'}</span>,
    },
    {
      id: 'actions',
      header: 'Inspect',
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onSelectDevice(row.id || row.device_id);
          }}
          style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
        >
          <span>Detail</span>
          <ExternalLink size={11} />
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* View Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Managed Devices
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
            Showing {filteredDevices.length} endpoints registered under {scope.name}
          </p>
        </div>

        {/* Bulk Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedDeviceIds.length > 0 && (
            <>
              <button type="button" className="btn btn-sm" onClick={handleBulkRescan}>
                <RefreshCw size={12} />
                <span>Rescan Selected ({selectedDeviceIds.length})</span>
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleBulkRemediate}>
                <Wrench size={12} />
                <span>Queue Remediation ({selectedDeviceIds.length})</span>
              </button>
            </>
          )}

          <button type="button" className="btn btn-sm" onClick={fetchDevices}>
            <RefreshCw size={12} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Filter devices by hostname, IP, OS, or GUID..."
        totalCount={devices.length}
        filteredCount={filteredDevices.length}
        filters={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: 'all' },
              { label: 'Online', value: 'online' },
              { label: 'Offline', value: 'offline' },
            ],
          },
          {
            key: 'risk',
            label: 'Risk',
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
          {
            key: 'lab',
            label: 'Lab',
            value: labFilter,
            onChange: setLabFilter,
            options: [
              { label: 'All Labs', value: 'all' },
              ...labs.map((l) => ({ label: l.name, value: l.id })),
            ],
          },
        ]}
        onReset={() => {
          setSearch('');
          setStatusFilter('all');
          setRiskFilter('all');
          setLabFilter('all');
        }}
      />

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredDevices}
        loading={loading}
        selectable={true}
        selectedRowIds={selectedDeviceIds}
        onSelectionChange={setSelectedDeviceIds}
        onRowClick={(row) => setActiveDrawerDevice(row)}
        pageSize={25}
        emptyTitle="No Devices Match Filters"
        emptyDescription="Try clearing filters or check that your endpoint agent is enrolled and sending telemetry."
      />

      {/* Side Quick-Inspection Drawer */}
      <Drawer
        isOpen={Boolean(activeDrawerDevice)}
        onClose={() => setActiveDrawerDevice(null)}
        title={activeDrawerDevice?.hostname || 'Endpoint Quick Inspection'}
        subtitle={`Device GUID: ${activeDrawerDevice?.id || activeDrawerDevice?.device_id || 'N/A'}`}
        footer={
          <>
            <button type="button" className="btn btn-sm" onClick={() => setActiveDrawerDevice(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                const id = activeDrawerDevice?.id || activeDrawerDevice?.device_id;
                setActiveDrawerDevice(null);
                onSelectDevice(id);
              }}
            >
              <span>Open Full Inspection Page</span>
              <ExternalLink size={12} />
            </button>
          </>
        }
      >
        {activeDrawerDevice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Quick Badges Row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={activeDrawerDevice.status || 'online'} />
              <RiskBadge level={activeDrawerDevice.risk_level || 'LOW'} score={activeDrawerDevice.risk_score} />
              <span className="tag-mono">Agent {activeDrawerDevice.agent_version || 'v2.0.0'}</span>
            </div>

            {/* Quick Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                backgroundColor: 'var(--bg-surface-elevated)',
                padding: '14px',
                borderRadius: 'var(--radius-container)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>IP Address:</span>
                <div className="font-mono" style={{ fontWeight: 600, marginTop: '2px' }}>{activeDrawerDevice.ip_address || '127.0.0.1'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MAC Address:</span>
                <div className="font-mono" style={{ fontWeight: 600, marginTop: '2px' }}>{activeDrawerDevice.mac_address || '00:00:00:00:00:00'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Operating System:</span>
                <div style={{ fontWeight: 500, fontSize: '12px', marginTop: '2px' }}>{activeDrawerDevice.os_info || 'Windows'}</div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Last Seen Heartbeat:</span>
                <div style={{ fontWeight: 500, fontSize: '12px', marginTop: '2px' }}>
                  {activeDrawerDevice.last_seen ? new Date(activeDrawerDevice.last_seen).toLocaleString() : 'Just now'}
                </div>
              </div>
            </div>

            {/* Copyable GUID */}
            <CopyField
              label="Unique Endpoint Identifier (GUID)"
              value={activeDrawerDevice.id || activeDrawerDevice.device_id || ''}
            />

            {/* Vulnerability & Driver Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Findings Overview
              </span>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-container)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Outdated Software Packages:</span>
                  <strong style={{ color: activeDrawerDevice.outdated_count > 0 ? 'var(--status-critical-text)' : 'inherit' }}>
                    {activeDrawerDevice.outdated_count || 0} items
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>PnP Driver Error Codes:</span>
                  <strong style={{ color: activeDrawerDevice.driver_issues_count > 0 ? 'var(--status-critical-text)' : 'inherit' }}>
                    {activeDrawerDevice.driver_issues_count || 0} issues
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecuteConfirm}
        title={confirmAction?.title}
        description={confirmAction?.description}
        commandDetails={confirmAction}
      />
    </div>
  );
};
