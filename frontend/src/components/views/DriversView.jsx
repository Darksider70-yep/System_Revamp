import React, { useState, useEffect, useMemo } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Cpu, Play, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';

export const DriversView = () => {
  const { scope } = useTheme();
  const [search, setSearch] = useState('');
  const [driverIssues, setDriverIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchDrivers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFleetDrivers(true);
      setDriverIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch driver diagnostics');
      setDriverIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return driverIssues.filter((d) => {
      if (q && !d.device_name.toLowerCase().includes(q) && !(d.manufacturer || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [driverIssues, search]);

  const handleRemediateDriver = async () => {
    if (!selectedDriver) return;
    setConfirmOpen(false);
    try {
      // Queue command to enable or scan drivers on affected devices
      const cmdType = selectedDriver.error_code === 22 ? 'enable-device' : 'scan-drivers';
      for (const devId of selectedDriver.device_ids || []) {
        await api.queueCommand('device', devId, cmdType, {
          device_name: selectedDriver.device_name,
          error_code: selectedDriver.error_code,
        });
      }
      setActionSuccess(`Dispatched ${cmdType} command to ${selectedDriver.device_count} affected endpoints.`);
      setTimeout(() => setActionSuccess(null), 5000);
      fetchDrivers();
    } catch (err) {
      alert(`Failed to queue remediation command: ${err.message}`);
    }
  };

  const columns = [
    {
      id: 'device_name',
      header: 'Hardware Device & Manufacturer',
      accessor: 'device_name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.manufacturer} {row.device_class_guid ? `• Class: ${row.device_class_guid.slice(0, 13)}...` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'error_code',
      header: 'CIM Problem Code',
      accessor: 'error_code',
      sortable: true,
      render: (val, row) => (
        <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
          Code {val} ({row.status || 'Error'})
        </span>
      ),
    },
    {
      id: 'impact',
      header: 'Operational Impact',
      accessor: 'impact',
      render: (val) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{val || 'Unclassified'}</span>,
    },
    {
      id: 'device_count',
      header: 'Affected Machines',
      accessor: 'device_count',
      align: 'center',
      render: (val) => <span className="tag-mono" style={{ fontWeight: 600 }}>{val} endpoints</span>,
    },
    {
      id: 'actions',
      header: 'Remediate',
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            setSelectedDriver(row);
            setConfirmOpen(true);
          }}
          style={{ height: '24px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
        >
          <Play size={10} />
          <span>Batch Fix ({row.device_count})</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Hardware & Driver Diagnostics
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Live CIM/WMI diagnostics filtering for PnP problem codes (Code 28 missing drivers, Code 10 failed start, Code 22 disabled) across {scope.name}
        </p>
      </div>

      {actionSuccess && (
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--status-ok-bg)', color: 'var(--status-ok-text)', borderRadius: 'var(--radius-sm)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Filter hardware devices by name or manufacturer..."
        totalCount={driverIssues.length}
        filteredCount={filteredDrivers.length}
      />

      <DataTable
        columns={columns}
        data={filteredDrivers}
        loading={loading}
        emptyTitle="No Driver Hardware Errors"
        emptyDescription="No PnP device hardware errors (Code 28, Code 10, Code 22) were reported across the fleet."
        pageSize={25}
      />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRemediateDriver}
        title={`Batch Driver Remediation: ${selectedDriver?.device_name}`}
        description={`Will queue unattended driver repair commands across ${selectedDriver?.device_count} endpoints in ${scope.name}.`}
        commandDetails={{
          target: `${selectedDriver?.device_count} endpoints`,
          type: selectedDriver?.error_code === 22 ? 'ENABLE_DEVICE' : 'SCAN_AND_FIX_DRIVERS',
          dryRun: false,
          rawPayload: { device_name: selectedDriver?.device_name, error_code: selectedDriver?.error_code },
        }}
      />
    </div>
  );
};
