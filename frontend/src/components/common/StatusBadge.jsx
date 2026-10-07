import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  ShieldAlert, 
  HelpCircle,
  Radio
} from 'lucide-react';

export const StatusBadge = ({ status, label, size = 'md' }) => {
  const normalized = (status || '').toLowerCase();
  
  let icon = <HelpCircle size={12} />;
  let styleClass = 'status-unknown';
  let displayLabel = label || status || 'Unknown';

  if (normalized === 'online' || normalized === 'active' || normalized === 'success' || normalized === 'compliant') {
    icon = <Radio size={12} className="status-pulse-dot" />;
    styleClass = 'status-online';
  } else if (normalized === 'offline' || normalized === 'inactive' || normalized === 'disconnected') {
    icon = <XCircle size={12} />;
    styleClass = 'status-offline';
  } else if (normalized === 'pending' || normalized === 'queued' || normalized === 'running') {
    icon = <Clock size={12} />;
    styleClass = 'status-pending';
  } else if (normalized === 'failed' || normalized === 'error' || normalized === 'rejected') {
    icon = <AlertCircle size={12} />;
    styleClass = 'status-failed';
  } else if (normalized === 'warning' || normalized === 'needs_attention') {
    icon = <AlertTriangle size={12} />;
    styleClass = 'status-warning';
  }

  const isSmall = size === 'sm';

  return (
    <span 
      className={`status-badge ${styleClass} ${isSmall ? 'status-badge-sm' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: isSmall ? '1px 6px' : '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2
      }}
    >
      {icon}
      <span>{displayLabel}</span>
    </span>
  );
};

export const RiskBadge = ({ level, score = null, size = 'md' }) => {
  const normLevel = (level || 'Unknown').toUpperCase();
  
  let bg = 'var(--status-offline-bg)';
  let border = 'var(--status-offline-border)';
  let text = 'var(--status-offline-text)';
  let icon = <HelpCircle size={12} />;

  if (normLevel === 'CRITICAL') {
    bg = 'var(--status-critical-bg)';
    border = 'var(--status-critical-border)';
    text = 'var(--status-critical-text)';
    icon = <ShieldAlert size={12} />;
  } else if (normLevel === 'HIGH') {
    bg = 'var(--status-high-bg)';
    border = 'var(--status-high-border)';
    text = 'var(--status-high-text)';
    icon = <AlertCircle size={12} />;
  } else if (normLevel === 'MEDIUM') {
    bg = 'var(--status-medium-bg)';
    border = 'var(--status-medium-border)';
    text = 'var(--status-medium-text)';
    icon = <AlertTriangle size={12} />;
  } else if (normLevel === 'LOW' || normLevel === 'OK') {
    bg = 'var(--status-ok-bg)';
    border = 'var(--status-ok-border)';
    text = 'var(--status-ok-text)';
    icon = <CheckCircle2 size={12} />;
  }

  const isSmall = size === 'sm';

  return (
    <span
      className="risk-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        padding: isSmall ? '1px 6px' : '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {icon}
      <span>{normLevel}</span>
      {score !== null && (
        <span style={{ opacity: 0.8, fontSize: '0.9em', marginLeft: '2px' }}>
          ({Number(score).toFixed(1)})
        </span>
      )}
    </span>
  );
};
