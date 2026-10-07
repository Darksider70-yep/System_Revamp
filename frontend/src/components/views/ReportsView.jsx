import React, { useState, useEffect } from 'react';
import { Download, FileCheck, Shield, Printer } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../api/client';
import { RiskBadge } from '../common/StatusBadge';

export const ReportsView = () => {
  const { scope } = useTheme();
  const [reportType, setReportType] = useState('compliance');
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getComplianceReport();
      setReportData(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch compliance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      await api.downloadReportCsv(reportType);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Compliance & Audit Reports Builder
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
          Live compliance documentation, vulnerability posture summaries, and cryptographic fleet exports for {scope.name}
        </p>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderRadius: 'var(--radius-container)', fontSize: '12px', border: '1px solid var(--status-critical-border)' }}>
          {error}
        </div>
      )}

      {/* Report Controls Panel */}
      <div
        className="panel"
        style={{
          padding: 'var(--space-4) var(--space-5)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 'var(--space-4)',
          alignItems: 'flex-end',
          borderRadius: 'var(--radius-container)',
        }}
      >
        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Report Specification
          </label>
          <select
            className="input"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            style={{ width: '100%', marginTop: '4px' }}
          >
            <option value="compliance">Fleet Compliance & Workstation Audit</option>
            <option value="software">Fleet-Wide Software Inventory & Drift</option>
            <option value="drivers">Hardware Drivers & PnP Error Catalog</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Audit Time Horizon
          </label>
          <select
            className="input"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{ width: '100%', marginTop: '4px' }}
          >
            <option value="latest">Live Fleet Snapshot</option>
            <option value="30d">Last 30 Days (Standard Audit Period)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-sm" onClick={handleExportCSV} disabled={exporting} style={{ height: '36px', gap: '6px' }}>
            <Download size={14} />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleExportPDF} style={{ height: '36px', gap: '6px' }}>
            <Printer size={14} />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Formal Report Preview Paper */}
      <div
        className="panel"
        style={{
          padding: 'var(--space-6)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-card)', // 20px
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-chip)',
                  backgroundColor: 'var(--accent-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <Shield size={18} strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                System Revamp Enterprise Audit Report
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', margin: 0 }}>
              Scope: <strong>{scope.name}</strong> • Timeframe: {dateRange} • Generated: {reportData?.generated_at ? new Date(reportData.generated_at).toLocaleString() : new Date().toLocaleString()}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="tag-mono" style={{ color: 'var(--status-ok-text)' }}>
              <FileCheck size={12} /> Live Provenance
            </span>
            <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              SOURCE: DATABASE TELEMETRY
            </div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Compliance Posture</div>
            <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-ok-text)', marginTop: '2px' }}>
              {reportData?.compliance_percent !== null && reportData?.compliance_percent !== undefined ? `${reportData.compliance_percent}%` : 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Clean across fleet</div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Critical Risk Devices</div>
            <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-critical-text)', marginTop: '2px' }}>
              {reportData?.breakdown?.critical || 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Severe vulnerabilities</div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>High Risk Devices</div>
            <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--status-high-text)', marginTop: '2px' }}>
              {reportData?.breakdown?.high || 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Version drift or CVEs</div>
          </div>

          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Audited Endpoints</div>
            <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {reportData?.total_devices || 0}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Enrolled in scope</div>
          </div>
        </div>

        {/* Breakdown Content */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>Audited Endpoints Summary</h4>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Lab Assignment</th>
                  <th>Operating System</th>
                  <th>Overall Risk</th>
                  <th>Top Findings</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.devices && reportData.devices.length > 0 ? (
                  reportData.devices.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.hostname}</td>
                      <td>{d.lab}</td>
                      <td>{d.os || 'Windows'}</td>
                      <td>
                        <RiskBadge level={d.overall_risk} size="sm" />
                      </td>
                      <td style={{ fontSize: '11px' }}>
                        {d.outdated_apps?.length > 0
                          ? d.outdated_apps.join(', ')
                          : d.driver_issues?.length > 0
                          ? d.driver_issues.join(', ')
                          : 'No issues detected'}
                      </td>
                      <td>
                        <span className="tag-mono" style={{ color: d.is_online ? 'var(--status-ok-text)' : 'var(--text-muted)' }}>
                          {d.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      {loading ? 'Compiling fleet compliance data...' : 'No enrolled endpoints available for audit report.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
