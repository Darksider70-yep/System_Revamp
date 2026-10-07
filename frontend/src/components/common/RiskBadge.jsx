import React from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  ShieldAlert, 
  HelpCircle 
} from 'lucide-react';

/**
 * RiskBadge — Part 3 Strict Palette & Shape System
 * Low = Emerald
 * Medium = Cyan
 * High = Outlined desaturated coral/amber with AlertCircle
 * Critical = Filled desaturated coral/crimson with ShieldAlert
 * Shape: Full pill radius (var(--radius-pill)).
 */
export const RiskBadge = ({ level, score = null, size = 'md' }) => {
  const normLevel = (level || 'UNKNOWN').toUpperCase().trim();
  
  let bg = 'var(--status-offline-bg)';
  let border = 'var(--status-offline-border)';
  let text = 'var(--status-offline-text)';
  let icon = <HelpCircle size={12} strokeWidth={2} />;
  let isFilled = false;

  if (normLevel === 'CRITICAL') {
    // Critical: Filled soft warm coral/crimson badge
    bg = 'var(--status-critical-bg)';
    border = 'var(--status-critical-border)';
    text = 'var(--status-critical-text)';
    icon = <ShieldAlert size={12} strokeWidth={2.5} />;
    isFilled = true;
  } else if (normLevel === 'HIGH') {
    // High: Outlined soft warm amber badge
    bg = 'var(--status-high-bg)';
    border = 'var(--status-high-border)';
    text = 'var(--status-high-text)';
    icon = <AlertCircle size={12} strokeWidth={2} />;
  } else if (normLevel === 'MEDIUM') {
    // Medium: Cyan badge
    bg = 'var(--status-medium-bg)';
    border = 'var(--status-medium-border)';
    text = 'var(--status-medium-text)';
    icon = <AlertTriangle size={12} strokeWidth={2} />;
  } else if (normLevel === 'LOW' || normLevel === 'OK') {
    // Low: Emerald badge
    bg = 'var(--status-ok-bg)';
    border = 'var(--status-ok-border)';
    text = 'var(--status-ok-text)';
    icon = <CheckCircle2 size={12} strokeWidth={2} />;
  }

  const isSmall = size === 'sm';

  return (
    <span
      className={`risk-badge risk-${normLevel.toLowerCase()} ${isFilled ? 'risk-filled' : 'risk-outlined'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        padding: isSmall ? '2px 8px' : '3px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: isSmall ? 'var(--text-xs)' : 'var(--text-sm)',
        fontWeight: isFilled ? 700 : 600,
        letterSpacing: '0.03em',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.2,
      }}
    >
      {icon}
      <span>{normLevel}</span>
      {score !== null && (
        <span style={{ opacity: 0.85, fontSize: '0.9em', marginLeft: '2px', fontWeight: 500 }}>
          ({Number(score).toFixed(1)})
        </span>
      )}
    </span>
  );
};
