import React, { useState } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { ShieldAlert, FileCheck, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';

export const ThreatsView = () => {
  const [search, setSearch] = useState('');

  const threatsData = [
    {
      id: 'th-1',
      file_name: 'updater_helper.exe',
      install_path: 'C:\\Program Files\\ThirdPartyApp\\updater_helper.exe',
      sha256: '4f8a92b3c1d4e5f67890123456789abcdef0123456789abcdef0123456789abc',
      signature_status: 'Unsigned / No Signature',
      signer: 'None',
      vt_detections: '4/72 Engines (Suspicious)',
      device_count: 6,
      threat_level: 'HIGH',
    },
    {
      id: 'th-2',
      file_name: 'node.exe',
      install_path: 'C:\\Program Files\\nodejs\\node.exe',
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      signature_status: 'Valid Authenticode',
      signer: 'OpenJS Foundation',
      vt_detections: '0/72 Clean',
      device_count: 77,
      threat_level: 'LOW',
    },
    {
      id: 'th-3',
      file_name: 'python.exe',
      install_path: 'C:\\Python310\\python.exe',
      sha256: '9876543210abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      signature_status: 'Valid Authenticode',
      signer: 'Python Software Foundation',
      vt_detections: '0/72 Clean',
      device_count: 45,
      threat_level: 'LOW',
    },
  ];

  const columns = [
    {
      id: 'file_name',
      header: 'Binary Name & Path',
      accessor: 'file_name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} style={{ color: row.threat_level === 'HIGH' ? 'var(--status-critical-solid)' : 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val}</span>
          </div>
          <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {row.install_path}
          </span>
        </div>
      ),
    },
    {
      id: 'sha256',
      header: 'SHA-256 Hash Digest',
      accessor: 'sha256',
      render: (val) => (
        <span className="tag-mono" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={val}>
          {val.slice(0, 16)}...{val.slice(-8)}
        </span>
      ),
    },
    {
      id: 'signature_status',
      header: 'Microsoft Authenticode',
      accessor: 'signature_status',
      render: (val, row) => {
        const isSigned = val.includes('Valid');
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
            {isSigned ? <FileCheck size={12} color="var(--status-ok-solid)" /> : <AlertTriangle size={12} color="var(--status-high-solid)" />}
            <span style={{ color: isSigned ? 'var(--status-ok-text)' : 'var(--status-high-text)', fontWeight: 500 }}>
              {val}
            </span>
          </div>
        );
      },
    },
    {
      id: 'vt_detections',
      header: 'Fleet VirusTotal Intel',
      accessor: 'vt_detections',
      render: (val, row) => (
        <span
          className="tag-mono"
          style={{
            color: row.threat_level === 'HIGH' ? 'var(--status-critical-text)' : 'var(--status-ok-text)',
            borderColor: row.threat_level === 'HIGH' ? 'var(--status-critical-border)' : 'var(--border-subtle)',
          }}
        >
          {val}
        </span>
      ),
    },
    {
      id: 'device_count',
      header: 'Host Count',
      accessor: 'device_count',
      align: 'center',
      render: (val) => <span className="tag-mono" style={{ fontWeight: 600 }}>{val} hosts</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Binary Integrity & Zero-Upload Threat Intel
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Authenticode digital certificate signatures and centralized VirusTotal queue cache (4 req/min shared fleet-wide)
        </p>
      </div>

      <FilterBar search={search} onSearchChange={setSearch} totalCount={threatsData.length} />

      <DataTable columns={columns} data={threatsData} pageSize={25} />
    </div>
  );
};
