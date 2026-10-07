import React from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  HelpCircle,
  Radio
} from 'lucide-react';
import { RiskBadge } from './RiskBadge';

export { RiskBadge };

export const StatusBadge = ({ status, label, size = 'md' }) => {
  const normalized = (status || '').toLowerCase().trim();
  
  let icon = <HelpCircle size={12} strokeWidth={2} />;
  let bg = 'var(--status-offline-bg)';
  let border = 'var(--status-offline-border)';
  let text = 'var(--status-offline-text)';
  let displayLabel = label || status || 'Unknown';

  if (
    normalized === 'online' || 
    normalized === 'active' || 
    normalized === 'healthy' || 
    normalized === 'success' || 
    normalized === 'compliant' ||
    normalized === 'ok'
  ) {
    icon = <Radio size={12} strokeWidth={2.5} style={{ color: 'var(--status-ok-solid)' }} />;
    bg = 'var(--status-ok-bg)';
    border = 'var(--status-ok-border)';
    text = 'var(--status-ok-text)';
  } else if (
    normalized === 'offline' || 
    normalized === 'inactive' || 
    normalized === 'disconnected' ||
    normalized === 'stale'
  ) {
    icon = <XCircle size={12} strokeWidth={2} />;
    bg = 'var(--status-offline-bg)';
    border = 'var(--status-offline-border)';
    text = 'var(--status-offline-text)';
  } else if (
    normalized === 'pending' || 
    normalized === 'queued' || 
    normalized === 'running' ||
    normalized === 'scanning' ||
    normalized === 'in_progress'
  ) {
    icon = <Clock size={12} strokeWidth={2} />;
    bg = 'var(--status-info-bg)';
    border = 'var(--status-info-border)';
    text = 'var(--status-info-text)';
  } else if (
    normalized === 'failed' || 
    normalized === 'error' || 
    normalized === 'rejected' ||
    normalized === 'compromised'
  ) {
    icon = <AlertCircle size={12} strokeWidth={2} />;
    bg = 'var(--status-critical-bg)';
    border = 'var(--status-critical-border)';
    text = 'var(--status-critical-text)';
  } else if (
    normalized === 'warning' || 
    normalized === 'needs_attention' || 
    normalized === 'degraded' ||
    normalized === 'outdated'
  ) {
    icon = <AlertTriangle size={12} strokeWidth={2} />;
    bg = 'var(--status-high-bg)';
    border = 'var(--status-high-border)';
    text = 'var(--status-high-text)';
  }

  const isSmall = size === 'sm';

  return (
    <span 
      className="status-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: 500,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2,
      }}
    >
      {icon}
      <span>{displayLabel}</span>
    </span>
  );
};
