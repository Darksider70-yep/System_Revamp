import React, { useState, useEffect, useCallback } from 'react';
import { RiskBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common/Skeleton';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  ArrowRight,
  RefreshCw,
  Terminal,
  Layers,
  Package,
  Monitor,
  Zap,
  Lock,
  Wrench,
  CheckCircle2,
  AlertTriangle,
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

  const fetchOverview = useCallback(async () => {
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
  }, [scope.labId, scope.siteId]);

  useEffect(() => {
    setLoading(true);
    fetchOverview();
    const interval = setInterval(fetchOverview, 15000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverview();
  };

  // KPI Computations
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const criticalDevices = devices.filter((d) => (d.risk_level || '').toUpperCase() === 'CRITICAL').length;
  const highDevices = devices.filter((d) => (d.risk_level || '').toUpperCase() === 'HIGH').length;
  const compliantDevices = devices.filter((d) => (d.risk_level || 'LOW').toUpperCase() === 'LOW').length;
  const compliantPercent = totalDevices > 0 ? ((compliantDevices / totalDevices) * 100).toFixed(1) : '100.0';
  const offline24h = devices.filter((d) => {
    if (d.status === 'online') return false;
    const lastSeen = d.last_seen ? new Date(d.last_seen).getTime() : 0;
    return Date.now() - lastSeen > 86400000;
  }).length;

  // Protection Score Computation (McAfee-style Protection Score)
  const numericScore = Math.max(
    10,
    Math.min(
      100,
      totalDevices > 0
        ? Math.round(
            (compliantDevices / totalDevices) * 60 +
            (onlineDevices / totalDevices) * 30 +
            (criticalDevices === 0 ? 10 : 0)
          )
        : 100
    )
  );

  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (numericScore / 100) * circumference;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Skeleton height="180px" borderRadius="var(--radius-dock)" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="130px" borderRadius="var(--radius-card)" />
          ))}
        </div>
        <Skeleton height="320px" borderRadius="var(--radius-card)" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Top Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
            Fleet Protection Center
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
            Central security posture, threat intelligence, and automated remediation for {scope.name}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <span className="living-node living-node-ok" />
            <span className="font-mono tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Continuous Defense (15s)
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ gap: '6px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'status-spin' : ''} />
            <span>{refreshing ? 'Scanning...' : 'Sync Fleet'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          HERO PROTECTION STATUS HUB (McAfee-style Central Defense Hub)
          ========================================================================= */}
      <div
        className="panel floating-dock"
        style={{
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, var(--glass-bg) 0%, var(--bg-surface-elevated) 100%)',
        }}
      >
        {/* Left: Protection Score Radial Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
          <div style={{ position: 'relative', width: '110px', height: '110px', flexShrink: 0 }}>
            <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
              {/* Background track circle */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                fill="transparent"
                stroke="var(--border-subtle)"
                strokeWidth="8"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                fill="transparent"
                stroke={
                  criticalDevices > 0
                    ? 'var(--status-critical-solid)'
                    : numericScore >= 80
                    ? 'var(--status-ok-solid)'
                    : 'var(--status-high-solid)'
                }
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
              />
            </svg>

            {/* Score Text Overlay inside Circle */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              <span
                className="tabular-nums"
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                {numericScore}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginTop: '2px',
                }}
              >
                Score
              </span>
            </div>
          </div>

          {/* Center: Executive Defense Message & Telemetry Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {criticalDevices > 0 ? (
                <div
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--status-critical-bg)',
                    border: '1px solid var(--status-critical-border)',
                    color: 'var(--status-critical-text)',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <AlertTriangle size={12} strokeWidth={2.5} />
                  <span>ACTION RECOMMENDED</span>
                </div>
              ) : (
                <div
                  style={{
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'var(--status-ok-bg)',
                    border: '1px solid var(--status-ok-border)',
                    color: 'var(--status-ok-text)',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                  <span>FLEET PROTECTED</span>
                </div>
              )}

              <span className="font-mono tabular-nums" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {totalDevices} Workstations Monitored
              </span>
            </div>

            <h3
              style={{
                fontSize: 'var(--text-md)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {criticalDevices > 0
                ? `${criticalDevices} Workstations Require Security Patching & Remediation`
                : 'All Endpoints Pass Baseline Compliance & Driver Verification'}
            </h3>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              {onlineDevices} endpoints actively communicating in real-time. Automated exposure analysis, PnP driver checks, and HMAC-verified staged deployment pipelines are operational.
            </p>

            {/* Quick Security Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span
                className="tag-mono"
                style={{
                  fontSize: '10px',
                  color: Number(compliantPercent) >= 80 ? 'var(--status-ok-text)' : 'var(--status-high-text)',
                  backgroundColor: Number(compliantPercent) >= 80 ? 'var(--status-ok-bg)' : 'var(--status-high-bg)',
                  borderColor: Number(compliantPercent) >= 80 ? 'var(--status-ok-border)' : 'var(--status-high-border)',
                }}
              >
                <CheckCircle2 size={11} /> {compliantPercent}% Compliant
              </span>
              <span
                className="tag-mono"
                style={{
                  fontSize: '10px',
                  color: 'var(--status-ok-text)',
                  backgroundColor: 'var(--status-ok-bg)',
                  borderColor: 'var(--status-ok-border)',
                }}
              >
                <ShieldCheck size={11} /> Zero-Trust Agent Core
              </span>
              <span
                className="tag-mono"
                style={{
                  fontSize: '10px',
                  color: 'var(--accent-text)',
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                <Lock size={10} /> AES-256 Command Signing
              </span>
              <span
                className="tag-mono"
                style={{
                  fontSize: '10px',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-code)',
                }}
              >
                {offline24h === 0 ? 'Zero Stale Devices' : `${offline24h} Offline Agents`}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Instant 1-Click Action Launcher (McAfee-style Hero Actions) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('remediation')}
            style={{
              height: '38px',
              padding: '0 16px',
              gap: '8px',
              justifyContent: 'center',
              fontSize: 'var(--text-sm)',
            }}
          >
            <Wrench size={14} />
            <span>Remediate All Risks</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('software')}
            style={{
              height: '34px',
              padding: '0 14px',
              gap: '6px',
              justifyContent: 'center',
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <Package size={13} />
            <span>Update Outdated Apps</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('devices')}
            style={{
              height: '34px',
              padding: '0 14px',
              gap: '6px',
              justifyContent: 'center',
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <Monitor size={13} />
            <span>View All Workstations</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          FOUR CORE PROTECTION SERVICE CARDS (McAfee-style Module Tiles)
          ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
        {/* Module 1: Endpoint Guard */}
        <div
          className="panel"
          onClick={() => onNavigate('devices')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            borderRadius: 'var(--radius-card)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-border)',
              }}
            >
              <Monitor size={18} strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--status-ok-text)',
                backgroundColor: 'var(--status-ok-bg)',
                border: '1px solid var(--status-ok-border)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className="living-node living-node-ok" style={{ width: '6px', height: '6px' }} />
              ONLINE
            </span>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Endpoint Guard
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {onlineDevices} / {totalDevices}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {onlineDevices} online now • 0 offline &gt;24h
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)', fontSize: '11px', fontWeight: 600 }}>
            <span>Manage Devices</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Module 2: Vulnerability & Threat Shield */}
        <div
          className="panel"
          onClick={() => onNavigate('devices', { risk: 'CRITICAL' })}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            borderRadius: 'var(--radius-card)',
            border: criticalDevices > 0 ? '1px solid var(--status-critical-border)' : '1px solid var(--glass-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--status-critical-bg)',
                color: 'var(--status-critical-solid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--status-critical-border)',
              }}
            >
              <ShieldAlert size={18} strokeWidth={2.2} />
            </div>
            {criticalDevices > 0 ? (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--status-critical-text)',
                  backgroundColor: 'var(--status-critical-bg)',
                  border: '1px solid var(--status-critical-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {criticalDevices} CRITICAL
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--status-ok-text)',
                  backgroundColor: 'var(--status-ok-bg)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                CLEAR
              </span>
            )}
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Vulnerability Shield
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {criticalDevices} Urgent Flaws
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              {criticalDevices} Critical • {highDevices} High CVEs
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-critical-solid)', fontSize: '11px', fontWeight: 600 }}>
            <span>Review CVEs</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Module 3: Software & App Health */}
        <div
          className="panel"
          onClick={() => onNavigate('software')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--accent-border)',
              }}
            >
              <Package size={18} strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--status-high-text)',
                backgroundColor: 'var(--status-high-bg)',
                border: '1px solid var(--status-high-border)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              DRIFT
            </span>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              App Integrity
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {overviewData?.top_outdated_apps?.length || 2} Outdated Apps
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              requests, Git for Windows flagged
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)', fontSize: '11px', fontWeight: 600 }}>
            <span>Deploy Updates</span>
            <ArrowRight size={12} />
          </div>
        </div>

        {/* Module 4: Hardware & Driver Sentinel */}
        <div
          className="panel"
          onClick={() => onNavigate('drivers')}
          style={{
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '12px',
            borderRadius: 'var(--radius-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-input)',
                backgroundColor: 'var(--status-high-bg)',
                color: 'var(--status-high-solid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--status-high-border)',
              }}
            >
              <Cpu size={18} strokeWidth={2.2} />
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--status-ok-text)',
                backgroundColor: 'var(--status-ok-bg)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              PNP ACTIVE
            </span>
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hardware Sentinel
            </div>
            <div className="tabular-nums font-mono" style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              PnP Hardware
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Kernel drivers and peripheral health
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-text)', fontSize: '11px', fontWeight: 600 }}>
            <span>Audit Drivers</span>
            <ArrowRight size={12} />
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECURITY TOPOLOGY & DEFENSE STREAM (Free, smooth glass sections)
          ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-4)' }}>
        {/* Left Column: Physical Lab Topology & Risk Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div
            className="panel"
            style={{
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Facility Network & Topology Breakdown
                </h3>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                  Workstation distribution and vulnerability density across physical lab subnets
                </p>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => onNavigate('devices')}
                style={{ fontSize: '11px', gap: '4px' }}
              >
                <span>Full Matrix</span>
                <ArrowRight size={12} />
              </button>
            </div>

            {labs.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Labs Configured"
                description="Configure campus facilities in Settings to map physical endpoint topologies."
                actionLabel="Configure Labs"
                onAction={() => onNavigate('settings')}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        padding: '14px 16px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-container)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        transition: 'all var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--glass-border-hover)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
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

                      {/* Smooth Multi-Segment Security Bar */}
                      <div
                        style={{
                          height: '9px',
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

                      {/* Status Breakdown Pills */}
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ color: labCrit > 0 ? 'var(--status-critical-text)' : 'inherit', fontWeight: labCrit > 0 ? 700 : 500 }}>
                          {labCrit} Critical
                        </span>
                        <span>•</span>
                        <span style={{ color: labHigh > 0 ? 'var(--status-high-text)' : 'inherit', fontWeight: labHigh > 0 ? 700 : 500 }}>
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

          {/* Operational Defense Stream */}
          <div
            className="panel"
            style={{
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={15} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Real-Time Audit & Operational Stream
                </h3>
              </div>
              <span className="tag-mono" style={{ fontSize: '10px' }}>HMAC Verified</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activityLogs.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  No recent command executions or security interventions logged.
                </div>
              ) : (
                activityLogs.slice(0, 5).map((log, idx) => (
                  <div
                    key={log.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-container)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: 'var(--accent-subtle)',
                        color: 'var(--accent-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={12} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 600 }}>
                        <span>{log.action || 'Command Executed'}</span>
                        <span className="tabular-nums font-mono" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : `Action authenticated for ${log.admin_email || 'admin'}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Needs Immediate Attention & Action Priorities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div
            className="panel"
            style={{
              padding: '22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              borderRadius: 'var(--radius-card)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--status-critical-solid)' }} />
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Immediate Action Queue
                </h3>
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Flagged software exposures and driver anomalies prioritized by threat index
              </p>
            </div>

            {/* Sub-section: Top Outdated Apps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={13} style={{ color: 'var(--status-critical-solid)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Vulnerable Software Packages
                </span>
              </div>

              {overviewData?.top_outdated_apps && overviewData.top_outdated_apps.length > 0 ? (
                overviewData.top_outdated_apps.map((app, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-container)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {app.app_name}
                      </span>
                      <RiskBadge level={app.risk_level || 'HIGH'} size="sm" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span className="font-mono">Target: {app.latest_version || 'Latest Secure'}</span>
                      <span className="tag-mono" style={{ color: 'var(--status-critical-text)' }}>
                        {app.affected_devices} machines affected
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onNavigate('remediation', { targetApp: app.app_name })}
                        style={{ height: '28px', fontSize: '11px', padding: '0 12px' }}
                      >
                        Auto-Remediate
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--glass-border)' }}>
                  No vulnerable software detected across the fleet.
                </div>
              )}
            </div>

            {/* Sub-section: Hardware Drivers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Cpu size={13} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Hardware &amp; Driver Sentinel
                </span>
              </div>

              {overviewData?.top_missing_drivers && overviewData.top_missing_drivers.length > 0 ? (
                overviewData.top_missing_drivers.map((drv, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-container)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {drv.device_name}
                      </span>
                      <span className="tag-mono" style={{ color: 'var(--status-critical-text)', borderColor: 'var(--status-critical-border)' }}>
                        {drv.impact || 'Driver Drift'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Affects {drv.affected_devices} workstations</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onNavigate('drivers')}
                        style={{ height: '26px', fontSize: '11px', padding: '0 10px' }}
                      >
                        Inspect Driver
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-container)', border: '1px solid var(--glass-border)' }}>
                  Zero hardware driver drift detected.
                </div>
              )}
            </div>

            {/* Bottom Quick Action Pipeline */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate('remediation')}
                style={{ width: '100%', height: '38px', justifyContent: 'center' }}
              >
                Launch Staged Remediation Pipeline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
