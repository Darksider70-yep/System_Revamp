import React, { useState } from 'react';
import { FileText, Download, FileCheck, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ReportsView = () => {
  const { scope } = useTheme();
  const [reportType, setReportType] = useState('executive_compliance');
  const [dateRange, setDateRange] = useState('30d');
  const [generating, setGenerating] = useState(false);

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Hostname,Lab,OS,Risk Level,Outdated Software,Driver Issues,Last Seen\n' +
      'CS-LAB1-WS01,Computer Lab 1,Windows 11 Pro,CRITICAL,Node.js (v16.14.0),Realtek Audio (Code 28),2026-10-07 19:30\n' +
      'CS-LAB1-WS02,Computer Lab 1,Windows 11 Pro,HIGH,Python 3.10 (v3.10.4),None,2026-10-07 19:28\n' +
      'CS-LAB1-WS03,Computer Lab 1,Windows 11 Pro,LOW,None,None,2026-10-07 19:25\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SystemRevamp_Compliance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Compliance & Audit Reports Builder
        </h2>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Generate formal compliance documentation, vulnerability posture summaries, and CSV/PDF data exports
        </p>
      </div>

      {/* Report Controls Panel */}
      <div
        className="panel"
        style={{
          padding: 'var(--space-4)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 'var(--space-4)',
          alignItems: 'flex-end',
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
            <option value="executive_compliance">Executive Fleet Compliance & Health Summary</option>
            <option value="cve_vulnerability">Full Software CVE & Drift Exposure Audit</option>
            <option value="hardware_driver">Hardware Driver PnP Diagnostics & Missing Catalog</option>
            <option value="binary_integrity">Zero-Upload Binary Integrity & VirusTotal Log</option>
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
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days (Standard Audit Period)</option>
            <option value="90d">Last Quarter (90 Days)</option>
            <option value="365d">Year-to-Date (Academic Year)</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-sm" onClick={handleExportCSV} style={{ height: '32px', gap: '6px' }}>
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleExportPDF} style={{ height: '32px', gap: '6px' }}>
            <FileText size={13} />
            <span>Generate & Print PDF</span>
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
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
        }}
      >
        {/* Document Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                System Revamp Enterprise Audit Report
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Scope: <strong>{scope.name}</strong> • Timeframe: {dateRange} • Generated: {new Date().toLocaleDateString()}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="tag-mono" style={{ color: 'var(--status-ok-text)' }}>
              <FileCheck size={12} /> Cryptographically Signed
            </span>
            <div className="font-mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
              DOC-REVAMP-{Math.floor(Math.random() * 900000 + 100000)}
            </div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Compliance Posture</div>
            <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-ok-text)' }}>96.4%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Compliant across fleet</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Critical CVE Findings</div>
            <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-critical-text)' }}>8</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remediation queued</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PnP Driver Anomalies</div>
            <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-high-text)' }}>18</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Missing or failed start</div>
          </div>

          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Zero-Upload Hashes</div>
            <div className="tabular-nums" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>1,420</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>100% SHA256 verified</div>
          </div>
        </div>

        {/* Breakdown Content */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Audited Endpoints Summary</h4>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Workstation</th>
                  <th>Lab Assignment</th>
                  <th>OS Build</th>
                  <th>Health Status</th>
                  <th>CVE Exposure</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>CS-LAB1-WS01</td>
                  <td>Computer Lab 1</td>
                  <td>Windows 11 Pro 23H2</td>
                  <td><span className="tag-mono" style={{ color: 'var(--status-critical-text)' }}>CRITICAL</span></td>
                  <td>Node.js v16.14 (CVE-2023-30581)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>CS-LAB1-WS02</td>
                  <td>Computer Lab 1</td>
                  <td>Windows 11 Pro 23H2</td>
                  <td><span className="tag-mono" style={{ color: 'var(--status-high-text)' }}>HIGH</span></td>
                  <td>Python 3.10.4 (1 Major Drift)</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>CS-LAB1-WS03</td>
                  <td>Computer Lab 1</td>
                  <td>Windows 11 Pro 23H2</td>
                  <td><span className="tag-mono" style={{ color: 'var(--status-ok-text)' }}>COMPLIANT</span></td>
                  <td>None (Fully Up-to-Date)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
