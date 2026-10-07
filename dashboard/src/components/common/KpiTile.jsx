import React from 'react';
import { Sparkline } from './Sparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const KpiTile = ({
  title,
  value,
  subtitle,
  sparklineData = [],
  delta = null,
  deltaType = 'neutral', // 'positive' | 'negative' | 'neutral'
  status = 'default',   // 'default' | 'critical' | 'warning' | 'ok'
  onClick,
  active = false,
}) => {
  let sparkColor = 'var(--accent-primary)';
  let borderColor = 'var(--border-subtle)';

  if (status === 'critical') {
    sparkColor = 'var(--status-critical-solid)';
    borderColor = 'var(--status-critical-border)';
  } else if (status === 'warning') {
    sparkColor = 'var(--status-high-solid)';
    borderColor = 'var(--status-high-border)';
  } else if (status === 'ok') {
    sparkColor = 'var(--status-ok-solid)';
  }

  return (
    <div
      className={`kpi-tile panel ${active ? 'kpi-tile-active' : ''}`}
      onClick={onClick}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--accent-primary)' : borderColor}`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        minWidth: '160px',
        flex: 1,
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-secondary)',
          }}
        >
          {title}
        </span>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparkColor} width={48} height={16} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
        <span
          className="kpi-value tabular-nums"
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>

        {delta && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              color:
                deltaType === 'positive'
                  ? 'var(--status-ok-text)'
                  : deltaType === 'negative'
                  ? 'var(--status-critical-text)'
                  : 'var(--text-muted)',
            }}
          >
            {deltaType === 'positive' && <TrendingUp size={12} />}
            {deltaType === 'negative' && <TrendingDown size={12} />}
            {deltaType === 'neutral' && <Minus size={12} />}
            {delta}
          </span>
        )}
      </div>

      {subtitle && (
        <span
          className="sidebar-subtext"
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: '2px',
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
};
