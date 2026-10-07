import React, { useState, useEffect, useMemo } from 'react';
import { DataTable } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { ShieldAlert, Info } from 'lucide-react';
import { api } from '../../api/client';

export const ThreatsView = () => {
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState(null);
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchThreats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getThreatsOverview();
      setOverview(data);
      setThreats(Array.isArray(data?.flagged_threats) ? data.flagged_threats : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch threat intelligence');
      setThreats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreats();
  }, []);

  const filteredThreats = useMemo(() => {
    const q = search.toLowerCase().trim();
    return threats.filter((th) => {
      if (q && !th.sha256.toLowerCase().includes(q) && !(th.apps || []).join(' ').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [threats, search]);

  const columns = [
    {
      id: 'apps',
      header: 'Associated Binary / Application',
      accessor: 'apps',
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} style={{ color: row.status === 'Malicious' ? 'var(--status-critical-solid)' : 'var(--status-high-solid)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {val && val.length > 0 ? val.join(', ') : 'Binary Hash'}
            </span>
          </div>
          <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            Detected in {row.affected_devices_count} workstation(s)
          </span>
        </div>
      ),
    },
    {
      id: 'sha256',
      header: 'SHA-256 Hash Digest',
      accessor: 'sha256',
      render: (val) => (
        <span className="tag-mono" style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={val}>
          {val.slice(0, 16)}...{val.slice(-8)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Reputation Status',
      accessor: 'status',
      render: (val) => (
        <span
          className="tag-mono"
          style={{
            color: val === 'Malicious' ? 'var(--status-critical-text)' : 'var(--status-high-text)',
            borderColor: val === 'Malicious' ? 'var(--status-critical-border)' : 'var(--status-high-border)',
          }}
        >
          {val}
        </span>
      ),
    },
    {
      id: 'score',
      header: 'VirusTotal Score',
      accessor: 'score',
      render: (val, row) => (
        <span className="font-mono tabular-nums" style={{ fontSize: '11px', fontWeight: 600 }}>
          {row.positives}/{row.total_engines} engines ({val}/100)
        </span>
      ),
    },
    {
      id: 'affected_devices_count',
      header: 'Affected Endpoints',
      accessor: 'affected_devices_count',
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
          Authenticode digital certificate signatures and centralized VirusTotal reputation feed
        </p>
      </div>

      {overview && !overview.vt_api_configured && (
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Info size={16} color="var(--accent-primary)" />
          <span>
            {overview.status_message}
          </span>
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <FilterBar search={search} onSearchChange={setSearch} totalCount={threats.length} filteredCount={filteredThreats.length} />

      <DataTable
        columns={columns}
        data={filteredThreats}
        loading={loading}
        emptyTitle="No Flagged Binary Threats"
        emptyDescription="Zero malicious or suspicious binary hashes detected across the enrolled fleet."
        pageSize={25}
      />
    </div>
  );
};

