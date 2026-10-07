import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { CodeBlock } from '../common/CodeBlock';
import { StatusBadge } from '../common/StatusBadge';
import { KeyRound, Plus, Trash2, Terminal } from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const EnrollmentView = () => {
  const { scope } = useTheme();
  const [tokens, setTokens] = useState([]);
  const [labs, setLabs] = useState([]);
  const [selectedLabId, setSelectedLabId] = useState('');
  const [tokenName, setTokenName] = useState('New Lab Batch');
  const [maxUses, setMaxUses] = useState(50);
  const [createdToken, setCreatedToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchTokensAndLabs = async () => {
    try {
      const [toks, labsData] = await Promise.all([
        api.getEnrollmentTokens().catch(() => []),
        api.getLabs().catch(() => []),
      ]);
      setTokens(Array.isArray(toks) ? toks : []);
      setLabs(Array.isArray(labsData) ? labsData : []);
      if (labsData.length > 0 && !selectedLabId) {
        setSelectedLabId(labsData[0].id);
      }
    } catch (err) {
      console.error('Failed to load enrollment tokens:', err);
    }
  };

  useEffect(() => {
    fetchTokensAndLabs();
  }, []);

  const handleCreateToken = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.createEnrollmentToken(
        scope.orgId || 'org-default',
        selectedLabId,
        tokenName,
        maxUses
      );
      setCreatedToken(res);
      fetchTokensAndLabs();
    } catch (err) {
      alert(`Token creation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to revoke this enrollment token?')) return;
    try {
      await api.revokeEnrollmentToken(tokenId);
      fetchTokensAndLabs();
    } catch (err) {
      alert(`Revoke error: ${err.message}`);
    }
  };

  const tokenValue = createdToken?.token || '';
  const serverUrl = window.location.origin.replace(':3000', ':8000');

  const psCommand = tokenValue
    ? `python -m agent.main enroll --server "${serverUrl}" --token "${tokenValue}"\npython -m agent.main run-daemon`
    : `# Generate or select a token above to produce the unattended installation command`;
  const msiCommand = tokenValue
    ? `msiexec /i SystemRevampAgent.msi /qn SERVER_URL="${serverUrl}" ENROLLMENT_TOKEN="${tokenValue}" /norestart`
    : `# Generate or select a token above to produce the unattended MSI installation command`;

  const columns = [
    {
      id: 'name',
      header: 'Token Identifier & Scope',
      accessor: 'name',
      sortable: true,
      render: (val, row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{val || 'Lab Enrollment Token'}</span>
          <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ID: {row.id}
          </span>
        </div>
      ),
    },
    {
      id: 'token_preview',
      header: 'Token Prefix',
      render: (_, row) => (
        <span className="tag-mono">{row.token ? `${row.token.slice(0, 14)}...` : 'sr_enroll_...'}</span>
      ),
    },
    {
      id: 'uses',
      header: 'Uses / Max Allotment',
      render: (_, row) => (
        <span className="tabular-nums font-mono" style={{ fontSize: '12px' }}>
          {row.current_uses || 0} / {row.max_uses || 50} devices
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      render: (_, row) => (
        <StatusBadge
          status={row.is_active !== false ? 'active' : 'inactive'}
          label={row.is_active !== false ? 'Active' : 'Revoked'}
          size="sm"
        />
      ),
    },
    {
      id: 'actions',
      header: 'Revoke',
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => handleRevokeToken(row.id)}
          disabled={row.is_active === false}
          style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
        >
          <Trash2 size={12} />
          <span>Revoke</span>
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Endpoint Agent Enrollment
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
          Generate scoped one-time enrollment tokens and unattended GPO/SCCM deployment scripts
        </p>
      </div>

      {/* Grid: Create Token Form (Left) & Deployment Snippets (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 'var(--space-4)' }}>
        {/* Token Form */}
        <form
          onSubmit={handleCreateToken}
          className="panel"
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
              Create Scoped Enrollment Token
            </h3>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Token Label / Reference
            </label>
            <input
              type="text"
              className="input"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g. Computer Lab 1 - Fall 2026"
              style={{ width: '100%', marginTop: '4px' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Target Lab Topology Scoping
            </label>
            <select
              className="input"
              value={selectedLabId}
              onChange={(e) => setSelectedLabId(e.target.value)}
              style={{ width: '100%', marginTop: '4px' }}
            >
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} {lab.network_subnet ? `(${lab.network_subnet})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Maximum Allowed Workstation Enrollments
            </label>
            <input
              type="number"
              className="input"
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              min={1}
              max={1000}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '8px', justifyContent: 'center' }}
          >
            <Plus size={14} />
            <span>{loading ? 'Generating Token...' : 'Generate Scoped Token'}</span>
          </button>
        </form>

        {/* Generated Snippets */}
        <div
          className="panel"
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
              Unattended Installation Commands
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                1. PowerShell Agent CLI Command:
              </span>
              <div style={{ marginTop: '6px' }}>
                <CodeBlock code={psCommand} language="powershell" title="PowerShell Enrollment" />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                2. Active Directory GPO / SCCM Silent MSI Execution:
              </span>
              <div style={{ marginTop: '6px' }}>
                <CodeBlock code={msiCommand} language="cmd" title="MSI Silent Install" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tokens Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, margin: 0 }}>
          Active Scoped Enrollment Tokens
        </h3>
        <DataTable columns={columns} data={tokens} pageSize={10} />
      </div>
    </div>
  );
};
