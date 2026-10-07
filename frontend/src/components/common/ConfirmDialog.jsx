import React from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  commandDetails = null, // { type, target, allowlistCheck, dryRun }
  confirmLabel = 'Confirm & Queue',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={!isLoading ? onClose : undefined}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(7, 20, 38, 0.55)',
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 150ms ease-out',
        }}
      />

      {/* Modal Card (20px rounded card with diffuse shadow) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-modal)', // 20px
          boxShadow: 'var(--shadow-modal)',
          overflow: 'hidden',
          zIndex: 1,
          animation: 'modalPop 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDestructive ? (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-chip)',
                  backgroundColor: 'var(--status-critical-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--status-critical-text)',
                }}
              >
                <AlertTriangle size={18} strokeWidth={2} />
              </div>
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-chip)',
                  backgroundColor: 'var(--accent-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <ShieldCheck size={18} strokeWidth={2} />
              </div>
            )}
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {title}
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            disabled={isLoading}
            style={{ border: 'none', background: 'transparent', borderRadius: 'var(--radius-input)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {description && (
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {description}
            </p>
          )}

          {commandDetails && (
            <div
              style={{
                backgroundColor: 'var(--bg-base)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-container)',
                border: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Command Type:</span>
                <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {commandDetails.type}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {commandDetails.target}
                </span>
              </div>
              {commandDetails.dryRun !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Execution Mode:</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color: commandDetails.dryRun ? 'var(--status-info-text)' : 'var(--status-high-text)',
                    }}
                  >
                    {commandDetails.dryRun ? 'Dry-Run Preview (Safe)' : 'Production Apply'}
                  </span>
                </div>
              )}
            </div>
          )}

          {isDestructive && (
            <div
              style={{
                backgroundColor: 'var(--status-critical-bg)',
                border: '1px solid var(--status-critical-border)',
                borderRadius: 'var(--radius-container)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-xs)',
                color: 'var(--status-critical-text)',
                lineHeight: 1.4,
              }}
            >
              <strong>Caution:</strong> This operation will dispatch commands immediately to targeted managed devices.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={isLoading}
            style={{ borderRadius: 'var(--radius-button)' }}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
            style={{ borderRadius: 'var(--radius-button)' }}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
