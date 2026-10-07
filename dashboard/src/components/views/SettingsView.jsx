import React, { useState, useEffect } from 'react';
import { DataTable } from '../common/DataTable';
import { CopyField } from '../common/CopyField';
import { StatusBadge } from '../common/StatusBadge';
import {
  Settings,
  Users,
  Shield,
  Layers,
  FileText,
  UploadCloud,
  CheckCircle2,
  Lock,
  Plus,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const SettingsView = () => {
  const { scope } = useTheme();
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' | 'topology' | 'audit' | 'offline'
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (activeTab === 'audit') {
      setLoadingAudit(true);
      api
        .getAuditLogs(50)
        .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab]);

  const rolesList = [
    {
      role: 'SuperAdmin',
      name: 'System Fleet Administrator',
      scope: 'Global Organization & All Campuses',
      permissions:
        'Full administrative authority. Can create sites/labs, configure offline intelligence bundles, queue live unattended command rollouts, approve destructive actions, and manage user credentials.',
      color: 'var(--status-critical-text)',
    },
    {
      role: 'OrgAdmin',
      name: 'Campus / Organization Admin',
      scope: 'Designated University Campus',
      permissions:
        'Can manage all labs within assigned campus, issue enrollment tokens, queue dry-runs and remediation upgrades, and view telemetry.',
      color: 'var(--accent-text)',
    },
    {
      role: 'SiteAdmin',
      name: 'Department / Lab Manager',
      scope: 'Specific Computer Labs & Buildings',
      permissions:
        'Can trigger on-demand telemetry rescans, monitor workstation health, and request driver/software patches.',
      color: 'var(--status-high-text)',
    },
    {
      role: 'Viewer',
      name: 'Auditor & Read-Only Observer',
      scope: 'Read-Only across Assigned Scope',
      permissions:
        'Can inspect fleet dashboards, export compliance CSV/PDF reports, and review CVE exposures without command execution rights.',
      color: 'var(--text-muted)',
    },
  ];

  const auditColumns = [
    {
      id: 'created_at',
      header: 'Timestamp',
      accessor: 'created_at',
      sortable: true,
      render: (val) => (
        <span className="font-mono tabular-nums" style={{ fontSize: '11px' }}>
          {val ? new Date(val).toLocaleString() : 'Just now'}
        </span>
      ),
    },
    {
      id: 'admin_email',
      header: 'Admin User',
      accessor: 'admin_email',
      sortable: true,
      render: (val) => <span style={{ fontWeight: 600 }}>{val || 'admin@systemrevamp.local'}</span>,
    },
    {
      id: 'action',
      header: 'Operation / Action',
      accessor: 'action',
      sortable: true,
      render: (val) => <span className="tag-mono">{val}</span>,
    },
    {
      id: 'details',
      header: 'Context & Target Information',
      accessor: 'details',
      render: (val) => (
        <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          {typeof val === 'string' ? val : JSON.stringify(val)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          System Configuration & Settings
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          RBAC user roles, campus lab hierarchy, central immutable audit trail, and offline air-gapped intelligence sync
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', gap: '4px' }}>
        {[
          { id: 'roles', label: 'Users & RBAC Roles', icon: Users },
          { id: 'topology', label: 'Org, Sites & Labs', icon: Layers },
          { id: 'audit', label: 'Audit Trail', icon: FileText },
          { id: 'offline', label: 'Air-Gapped Sync & Offline Mode', icon: UploadCloud },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="btn btn-sm"
              onClick={() => setActiveTab(tab.id)}
              style={{
                height: '34px',
                borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                borderBottom: isActive ? '1px solid var(--bg-surface)' : '1px solid transparent',
                backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                marginBottom: '-1px',
                gap: '6px',
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Role-Based Access Control (RBAC) Matrix</h3>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => alert('Add Administrator user modal')}>
              <Plus size={12} />
              <span>Add Administrator</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rolesList.map((r) => (
              <div
                key={r.role}
                className="panel"
                style={{
                  padding: 'var(--space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} style={{ color: r.color }} />
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {r.role} — {r.name}
                    </span>
                  </div>
                  <span className="tag-mono">{r.scope}</span>
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {r.permissions}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topology Tab */}
      {activeTab === 'topology' && (
        <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>University Campuses & Lab Hierarchies</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Endpoints automatically map to these labs during enrollment token assignment.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '14px' }}>🏛️ System Revamp University Lab (Primary Org)</div>
              <div style={{ marginTop: '6px', marginLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>📍 Main Campus (Block A)</div>
                <div style={{ fontSize: '12px', marginLeft: '16px', color: 'var(--text-secondary)' }}>
                  • 💻 Computer Lab 1 (Subnet: 192.168.1.0/24) — 45 Workstations
                </div>
                <div style={{ fontSize: '12px', marginLeft: '16px', color: 'var(--text-secondary)' }}>
                  • 💻 Computer Lab 2 (Subnet: 192.168.2.0/24) — 32 Workstations
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Central Administrative Audit Trail</h3>
          <DataTable
            columns={auditColumns}
            data={auditLogs}
            loading={loadingAudit}
            pageSize={25}
            emptyTitle="No Audit Logs"
            emptyDescription="Audit operations will be timestamped here as actions occur."
          />
        </div>
      )}

      {/* Offline Air-Gapped Sync Tab */}
      {activeTab === 'offline' && (
        <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>Offline & Air-Gapped Intelligence Bundles</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Import cryptographically signed offline vulnerability definitions (NVD, OSV.dev, VirusTotal hashes) for air-gapped lab deployments.
          </p>

          <div
            style={{
              padding: '24px',
              border: '2px dashed var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-code)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <UploadCloud size={32} style={{ color: 'var(--accent-primary)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag and drop signed bundle file (.tar.gz / .zip)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Must be signed with System Revamp ECDSA Master Release Key
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => alert('Offline bundle imported')}>
              Select File to Import
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
