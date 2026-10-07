import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const SimulatedBanner = () => {
  const { isSimulatedData, setIsSimulatedData } = useTheme();

  if (!isSimulatedData) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--status-high-bg)',
        borderBottom: '1px solid var(--status-high-border)',
        color: 'var(--status-high-text)',
        padding: '6px 16px',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        zIndex: 'var(--z-sticky)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={14} style={{ color: 'var(--status-high-solid)' }} />
        <span>
          <strong>SIMULATION MODE ACTIVE:</strong> Telemetry and risk metrics are being rendered from offline/simulated fixtures.
        </span>
      </div>

      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setIsSimulatedData(false)}
        style={{
          height: '22px',
          padding: '0 8px',
          fontSize: '11px',
          backgroundColor: 'transparent',
          border: '1px solid var(--status-high-border)',
          color: 'var(--status-high-text)',
        }}
      >
        Dismiss
      </button>
    </div>
  );
};
