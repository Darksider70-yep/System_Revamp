import React, { useState, useEffect } from 'react';
import { KpiTile } from '../common/KpiTile';
import { RiskBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';
import {
  ShieldAlert,
  Cpu,
  ArrowRight,
  RefreshCw,
  Terminal,
  Layers,
  Package,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const OverviewView = ({ onNavigate }) => {
  const { scope } = useTheme();
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
            <Skeleton key={i} height="88px" borderRadius="var(--radius-card)" />
          ))}
        </div>
        <Skeleton height="340px" borderRadius="var(--radius-card)" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Fleet Overview
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
            Authoritative fleet health, active risks, and real-time telemetry across {scope.name}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="font-mono tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Live Polling (15s)
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ gap: '6px' }}
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
          sparklineData={null}
          delta={totalDevices > 0 ? `${Math.round((onlineDevices / totalDevices) * 100)}% connected` : 'No devices enrolled'}
          deltaType="positive"
          lineageSource="devices (status=online)"
          onClick={() => onNavigate('devices')}
        />

        <KpiTile
          title="Fleet Compliance"
          value={compliantPercent !== null ? `${compliantPercent}%` : 'N/A'}
          subtitle="Patch & driver compliant"
          sparklineData={null}
          delta={compliantPercent !== null ? (Number(compliantPercent) >= 90 ? 'Healthy' : 'Below target') : 'Awaiting scans'}
          deltaType={compliantPercent !== null && Number(compliantPercent) >= 90 ? 'positive' : 'negative'}
          status={compliantPercent !== null && Number(compliantPercent) < 90 ? 'warning' : 'ok'}
          lineageSource="devices (risk_level=LOW / total)"
          onClick={() => onNavigate('devices')}
        />

        <KpiTile
          title="Critical Findings"
          value={criticalDevices}
          subtitle="CVSS >=7.0 or major version drift"
          sparklineData={null}
          delta={criticalDevices > 0 ? `${criticalDevices} machines affected` : 'Zero critical'}
          deltaType={criticalDevices > 0 ? 'negative' : 'positive'}
          status={criticalDevices > 0 ? 'critical' : 'ok'}
          lineageSource="devices (risk_level=CRITICAL)"
          onClick={() => onNavigate('devices', { risk: 'CRITICAL' })}
        />

        <KpiTile
          title="Pending Commands"
          value={overviewData?.pending_commands_count || 0}
          subtitle="Awaiting agent poll or approval"
          sparklineData={null}
          delta="HMAC signed"
          deltaType="neutral"
          lineageSource="commands (status=pending)"
          onClick={() => onNavigate('remediation')}
        />

        <KpiTile
          title="Stale Agents (>24h)"
          value={offline24h}
          subtitle="Heartbeat communication lost"
          sparklineData={null}
          delta={offline24h > 0 ? `${offline24h} unresponsive` : 'All responsive'}
          deltaType={offline24h > 0 ? 'negative' : 'positive'}
          status={offline24h > 0 ? 'warning' : 'default'}
          lineageSource="devices (last_seen < 24h)"
          onClick={() => onNavigate('devices', { status: 'offline' })}
        />
      </div>

      {/* Main Grid: Heatmap (65%) + Needs Immediate Attention (35%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-4)' }}>
        {/* Left Column: Risk Heatmap & Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Lab Risk Heatmap */}
          <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Lab Risk & Severity Heatmap
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-container)', // 14px
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-strong)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                            {lab.name}
                          </span>
                          <span className="tag-mono" style={{ fontSize: '10px' }}>
                            {lab.network_subnet || 'No subnet configured'}
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
                          borderRadius: 'var(--radius-pill)',
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
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                        <span style={{ color: labCrit > 0 ? 'var(--status-critical-text)' : 'inherit', fontWeight: labCrit > 0 ? 600 : 400 }}>
                          {labCrit} Critical
                        </span>
                        <span>•</span>
                        <span style={{ color: labHigh > 0 ? 'var(--status-high-text)' : 'inherit', fontWeight: labHigh > 0 ? 600 : 400 }}>
                          {labHigh} High
                        </span>
                        <span>•</span>
                        <span>{labMed} Medium</span>
                        <span>•</span>
                        <span style={{ color: 'var(--status-ok-text)' }}>{labLow} OK</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity Timeline */}
          <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Recent Operational Activity
              </h3>
              <span className="tag-mono" style={{ fontSize: '11px' }}>Audit Stream</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityLogs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No recent admin operations or command events recorded.
                </div>
              ) : (
                activityLogs.slice(0, 5).map((log, idx) => (
                  <div
                    key={log.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-container)',
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
              padding: 'var(--space-5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--status-critical-solid)' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Needs Immediate Attention
                </h3>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Top vulnerable software packages, missing drivers, and unsigned binaries
              </p>
            </div>

            {/* Sub-section: Top Outdated Apps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={13} style={{ color: 'var(--status-critical-solid)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  High-Impact Vulnerable Apps
                </span>
              </div>

              {overviewData?.top_outdated_apps && overviewData.top_outdated_apps.length > 0 ? (
                overviewData.top_outdated_apps.map((app, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-container)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {app.app_name}
                      </span>
                      <RiskBadge level={app.risk_level || 'MEDIUM'} size="sm" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span className="font-mono">Target: {app.latest_version || 'Latest'}</span>
                      <span className="tag-mono" style={{ color: app.risk_level === 'Critical' ? 'var(--status-critical-text)' : 'inherit' }}>
                        {app.affected_devices} machines affected
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onNavigate('remediation', { targetApp: app.app_name })}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        Remediate
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '14px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
                  No vulnerable or outdated packages identified across the fleet.
                </div>
              )}
            </div>

            {/* Sub-section: Hardware Drivers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={13} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  PnP Hardware Driver Errors
                </span>
              </div>

              {overviewData?.top_missing_drivers && overviewData.top_missing_drivers.length > 0 ? (
                overviewData.top_missing_drivers.map((drv, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-container)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {drv.device_name}
                      </span>
                      <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
                        {drv.impact || 'Impact Flagged'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Affects {drv.affected_devices} machines</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onNavigate('drivers')}
                        style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '14px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--border-subtle)' }}>
                  No driver errors detected across the fleet.
                </div>
              )}
            </div>

            {/* Quick Action Link */}
            <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
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
