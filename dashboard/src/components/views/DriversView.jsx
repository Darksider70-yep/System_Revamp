import React, { useState } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Cpu, AlertTriangle, Play, ShieldAlert } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const DriversView = () => {
  const { scope } = useTheme();
  const [search, setSearch] = useState('');
  const [codeFilter, setCodeFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const driverIssues = [
    {
      id: 'drv-1',
      device_name: 'Realtek High Definition Audio Device',
      hardware_id: 'HDAUDIO\\FUNC_01&VEN_10EC&DEV_0892',
      status_code: 28,
      code_label: 'Code 28 (Driver Missing)',
      impact: 'Audio input/output non-functional',
      device_count: 18,
      recommended_action: 'pnputil /add-driver RealtekAudio.inf /install',
    },
    {
      id: 'drv-2',
      device_name: 'Intel(R) Ethernet Connection I219-V',
      hardware_id: 'PCI\\VEN_8086&DEV_15BC',
      status_code: 10,
      code_label: 'Code 10 (Device Failed to Start)',
      impact: 'Gigabit LAN throughput degraded',
      device_count: 4,
      recommended_action: 'pnputil /restart-device "PCI\\VEN_8086&DEV_15BC"',
    },
    {
      id: 'drv-3',
      device_name: 'NVIDIA GeForce RTX 3060',
      hardware_id: 'PCI\\VEN_10DE&DEV_2504',
      status_code: 22,
      code_label: 'Code 22 (Device Disabled in OS)',
      impact: 'GPU CUDA acceleration disabled',
      device_count: 2,
      recommended_action: 'pnputil /enable-device "PCI\\VEN_10DE&DEV_2504"',
    },
  ];

  const columns = [
    {
      id: 'device_name',
      header: 'Hardware Device & Hardware ID',
      accessor: 'device_name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {row.hardware_id}
          </span>
        </div>
      ),
    },
    {
      id: 'status_code',
      header: 'CIM Problem Code',
      accessor: 'code_label',
      sortable: true,
      render: (val) => (
        <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
          {val}
        </span>
      ),
    },
    {
      id: 'impact',
      header: 'Operational Impact',
      accessor: 'impact',
      render: (val) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{val}</span>,
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
          CIM/WMI diagnostics filtering for PnP problem codes (Code 28 missing drivers, Code 10 failed start, Code 22 disabled)
        </p>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Filter hardware devices by name or hardware ID..."
        totalCount={driverIssues.length}
      />

      <DataTable columns={columns} data={driverIssues} pageSize={25} />

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          alert(`Dispatched Pnputil fix across ${selectedDriver?.device_count} endpoints.`);
        }}
        title={`Batch Driver Remediation: ${selectedDriver?.device_name}`}
        description={`Will dispatch unattended pnputil driver installation across ${selectedDriver?.device_count} endpoints in ${scope.name}.`}
        commandDetails={{
          target: `${selectedDriver?.device_count} endpoints`,
          type: 'PNPUTIL_DRIVER_INSTALL',
          dryRun: false,
          rawPayload: { hardware_id: selectedDriver?.hardware_id, action: selectedDriver?.recommended_action },
        }}
      />
    </div>
  );
};
