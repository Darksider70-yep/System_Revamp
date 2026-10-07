import React from 'react';
import { Sparkline } from './Sparkline';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

export const KpiTile = ({
  title,
  value,
  subtitle,
  sparklineData = [],
  delta = null,
  deltaType = 'neutral', // 'positive' | 'negative' | 'neutral'
  status = 'default',   // 'default' | 'critical' | 'warning' | 'ok'
  lineageSource = null,  // Provenance tooltip
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
        padding: 'var(--space-4) var(--space-5)',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--accent-primary)' : borderColor}`,
        borderRadius: 'var(--radius-card)', // 20px card radius
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 'var(--space-2)',
        minWidth: '180px',
        flex: 1,
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-fast)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
            }}
          >
            {title}
          </span>
          {lineageSource && (
            <span
              title={`Source: ${lineageSource}`}
              style={{ cursor: 'help', color: 'var(--text-muted)', display: 'inline-flex' }}
            >
              <Info size={11} />
            </span>
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparkColor} width={52} height={18} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: '2px' }}>
        <span
          className="kpi-value tabular-nums"
          style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>

        {delta && (
          <span
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 6px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor:
                deltaType === 'positive'
                  ? 'var(--status-ok-bg)'
                  : deltaType === 'negative'
                  ? 'var(--status-critical-bg)'
                  : 'var(--status-offline-bg)',
              color:
                deltaType === 'positive'
                  ? 'var(--status-ok-text)'
                  : deltaType === 'negative'
                  ? 'var(--status-critical-text)'
                  : 'var(--text-muted)',
            }}
          >
            {deltaType === 'positive' && <TrendingUp size={11} strokeWidth={2.5} />}
            {deltaType === 'negative' && <TrendingDown size={11} strokeWidth={2.5} />}
            {deltaType === 'neutral' && <Minus size={11} strokeWidth={2.5} />}
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
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
};
