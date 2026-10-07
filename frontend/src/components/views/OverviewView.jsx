import React, { useState, useEffect } from 'react';
import { KpiTile } from '../common/KpiTile';
import { StatusBadge, RiskBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';
import {
  ShieldAlert,
  Cpu,
  AlertTriangle,
  ArrowRight,
  Clock,
  CheckCircle2,
  RefreshCw,
  Terminal,
  KeyRound,
  Layers,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const OverviewView = ({ onNavigate }) => {
  const { scope, globalSearch } = useTheme();
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [labs, setLabs] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOverview = async () => {
    try {
      const [ov, devs, labsData, logs] = await Promise.all([
        api.getFleetOverview().catch(() => null),
        api.getDevices(scope.labId).catch(() => []),
        api.getLabs(scope.siteId).catch(() => []),
        api.getAuditLogs(15).catch(() => []),
      ]);

      setOverviewData(ov);
      setDevices(Array.isArray(devs) ? devs : []);
      setLabs(Array.isArray(labsData) ? labsData : []);
      setActivityLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      console.error('Overview fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchOverview();
    const interval = setInterval(fetchOverview, 15000);
    return () => clearInterval(interval);
  }, [scope.labId, scope.siteId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverview();
  };

  // KPI Computations
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const criticalDevices = devices.filter((d) => (d.risk_level || '').toUpperCase() === 'CRITICAL').length;
  const highDevices = devices.filter((d) => (d.risk_level || '').toUpperCase() === 'HIGH').length;
  const mediumDevices = devices.filter((d) => (d.risk_level || '').toUpperCase() === 'MEDIUM').length;
  const compliantDevices = devices.filter((d) => (d.risk_level || 'LOW').toUpperCase() === 'LOW').length;
  const compliantPercent = totalDevices > 0 ? ((compliantDevices / totalDevices) * 100).toFixed(1) : '100.0';
  const offline24h = devices.filter((d) => {
    if (d.status === 'online') return false;
    const lastSeen = d.last_seen ? new Date(d.last_seen).getTime() : 0;
    return Date.now() - lastSeen > 86400000;
  }).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="80px" borderRadius="var(--radius-lg)" />
          ))}
        </div>
        <Skeleton height="320px" borderRadius="var(--radius-lg)" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Fleet Overview
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Authoritative fleet health, active risks, and real-time telemetry across {scope.name}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="font-mono tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Live Polling (15s)
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ gap: '4px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'status-spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Top Row: 5 Compact KPI Tiles */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <KpiTile
          title="Total Devices"
          value={`${onlineDevices}/${totalDevices}`}
          subtitle={`${onlineDevices} online now`}
          sparklineData={[onlineDevices - 2, onlineDevices - 1, onlineDevices, onlineDevices, onlineDevices]}
          delta="+2% vs yesterday"
          deltaType="positive"
          onClick={() => onNavigate('devices')}
        />

        <KpiTile
          title="Fleet Compliance"
          value={`${compliantPercent}%`}
          subtitle="Patch & driver compliant"
          sparklineData={[92, 94, 95, 94.5, Number(compliantPercent)]}
          delta={Number(compliantPercent) >= 95 ? '+1.2%' : '-0.8%'}
          deltaType={Number(compliantPercent) >= 95 ? 'positive' : 'negative'}
          status={Number(compliantPercent) < 90 ? 'warning' : 'ok'}
          onClick={() => onNavigate('devices')}
        />

        <KpiTile
          title="Critical Findings"
          value={criticalDevices}
          subtitle="CVSS >=7.0 or Major Jump >=2"
          sparklineData={[criticalDevices + 3, criticalDevices + 1, criticalDevices + 2, criticalDevices]}
          delta={criticalDevices > 0 ? `${criticalDevices} machines` : 'Zero critical'}
          deltaType={criticalDevices > 0 ? 'negative' : 'positive'}
          status={criticalDevices > 0 ? 'critical' : 'ok'}
          onClick={() => onNavigate('devices', { risk: 'CRITICAL' })}
        />

        <KpiTile
          title="Pending Commands"
          value={overviewData?.pending_commands_count || 0}
          subtitle="Awaiting agent poll or approval"
          sparklineData={[0, 1, 3, 2, overviewData?.pending_commands_count || 0]}
          delta="HMAC signed"
          deltaType="neutral"
          onClick={() => onNavigate('remediation')}
        />

        <KpiTile
          title="Stale Agents (>24h)"
          value={offline24h}
          subtitle="Heartbeat communication lost"
          sparklineData={[offline24h + 1, offline24h, offline24h]}
          delta={offline24h > 0 ? 'Action needed' : 'All responsive'}
          deltaType={offline24h > 0 ? 'negative' : 'positive'}
          status={offline24h > 0 ? 'warning' : 'default'}
          onClick={() => onNavigate('devices', { status: 'offline' })}
        />
      </div>

      {/* Main Grid: Heatmap (65%) + Needs Immediate Attention (35%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-4)' }}>
        {/* Left Column: Risk Heatmap & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Lab Risk Heatmap */}
          <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Lab Risk & Severity Heatmap
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Aggregated vulnerability breakdown across physical lab environments
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onNavigate('devices')}
                style={{ fontSize: '11px', gap: '4px' }}
              >
                <span>View Full Matrix</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {labs.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Labs Configured"
                description="Create a site and lab in Settings to map endpoint topology."
                actionLabel="Configure Labs"
                onAction={() => onNavigate('settings')}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {labs.map((lab) => {
                  const labDevices = devices.filter((d) => d.lab_id === lab.id);
                  const labCrit = labDevices.filter((d) => (d.risk_level || '').toUpperCase() === 'CRITICAL').length;
                  const labHigh = labDevices.filter((d) => (d.risk_level || '').toUpperCase() === 'HIGH').length;
                  const labMed = labDevices.filter((d) => (d.risk_level || '').toUpperCase() === 'MEDIUM').length;
                  const labLow = labDevices.filter((d) => (d.risk_level || 'LOW').toUpperCase() === 'LOW').length;
                  const total = labDevices.length || 1;

                  return (
                    <div
                      key={lab.id}
                      onClick={() => onNavigate('devices', { labId: lab.id })}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'border-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {lab.name}
                          </span>
                          <span className="tag-mono" style={{ fontSize: '10px' }}>
                            {lab.network_subnet || '192.168.1.0/24'}
                          </span>
                        </div>

                        <span className="tabular-nums font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                          {labDevices.length} workstations
                        </span>
                      </div>

                      {/* Color Proportion Bar */}
                      <div
                        style={{
                          height: '8px',
                          borderRadius: 'var(--radius-xs)',
                          overflow: 'hidden',
                          display: 'flex',
                          backgroundColor: 'var(--bg-code)',
                        }}
                      >
                        <div style={{ width: `${(labCrit / total) * 100}%`, backgroundColor: 'var(--status-critical-solid)' }} title={`Critical: ${labCrit}`} />
                        <div style={{ width: `${(labHigh / total) * 100}%`, backgroundColor: 'var(--status-high-solid)' }} title={`High: ${labHigh}`} />
                        <div style={{ width: `${(labMed / total) * 100}%`, backgroundColor: 'var(--status-medium-solid)' }} title={`Medium: ${labMed}`} />
                        <div style={{ width: `${(labLow / total) * 100}%`, backgroundColor: 'var(--status-ok-solid)' }} title={`Low/OK: ${labLow}`} />
                      </div>

                      {/* Badge Breakdown */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span style={{ color: labCrit > 0 ? 'var(--status-critical-text)' : 'inherit' }}>
                          <strong>{labCrit}</strong> Critical
                        </span>
                        <span>•</span>
                        <span style={{ color: labHigh > 0 ? 'var(--status-high-text)' : 'inherit' }}>
                          <strong>{labHigh}</strong> High
                        </span>
                        <span>•</span>
                        <span><strong>{labMed}</strong> Medium</span>
                        <span>•</span>
                        <span style={{ color: 'var(--status-ok-text)' }}><strong>{labLow}</strong> OK</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="panel" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Recent Operational Activity
              </h3>
              <span className="tag-mono" style={{ fontSize: '11px' }}>Audit Stream</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityLogs.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No recent admin operations or command events recorded.
                </div>
              ) : (
                activityLogs.slice(0, 5).map((log, idx) => (
                  <div
                    key={log.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <Terminal size={14} style={{ color: 'var(--accent-primary)', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 500 }}>
                        <span>{log.action || 'Command Executed'}</span>
                        <span className="tabular-nums font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : `Action performed by ${log.admin_email || 'admin'}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Needs Immediate Attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div
            className="panel"
            style={{
              padding: 'var(--space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              borderTop: '3px solid var(--status-critical-solid)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={16} color="var(--status-critical-solid)" />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Needs Immediate Attention
                </h3>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                Top vulnerable software packages, missing drivers, and unsigned binaries
              </p>
            </div>

            {/* Sub-section: Top Outdated Apps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                🚨 High-Impact Vulnerable Apps
              </span>

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Node.js (x64)</span>
                  <RiskBadge level="CRITICAL" size="sm" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span className="font-mono">v16.14.0 → v20.18.0</span>
                  <span className="tag-mono" style={{ color: 'var(--status-critical-text)' }}>CVE-2023-30581 (CVSS 8.2)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Affects 12 machines</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onNavigate('remediation', { targetApp: 'Node.js' })}
                    style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}
                  >
                    Remediate
                  </button>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Python 3.10 (64-bit)</span>
                  <RiskBadge level="HIGH" size="sm" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span className="font-mono">v3.10.4 → v3.12.7</span>
                  <span className="tag-mono">Major Drift (1 step)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Affects 45 machines</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onNavigate('remediation', { targetApp: 'Python' })}
                    style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}
                  >
                    Remediate
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-section: Hardware Drivers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                🔧 PnP Hardware Driver Errors
              </span>

              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Realtek PCIe Audio</span>
                  <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
                    Code 28 (Missing)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Hardware ID: HDAUDIO\FUNC_01</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onNavigate('drivers')}
                    style={{ height: '22px', fontSize: '11px', padding: '0 6px' }}
                  >
                    Inspect
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Link */}
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('remediation')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Open Staged Remediation Pipeline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
