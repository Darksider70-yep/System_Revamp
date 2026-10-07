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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          zIndex: 1,
          animation: 'modal-pop 150ms ease-out',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isDestructive ? (
              <AlertTriangle size={18} color="var(--status-critical-solid)" />
            ) : (
              <ShieldCheck size={18} color="var(--accent-primary)" />
            )}
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            disabled={isLoading}
            style={{ border: 'none', background: 'transparent' }}
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
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {description}
            </p>
          )}

          {commandDetails && (
            <div
              style={{
                backgroundColor: 'var(--bg-code)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {commandDetails.target}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Command Type:</span>
                <span className="tag-mono">{commandDetails.type}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Execution Mode:</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: commandDetails.dryRun ? 'var(--status-medium-text)' : 'var(--status-ok-text)',
                  }}
                >
                  {commandDetails.dryRun ? '🧪 Dry Run (Preview Only)' : '⚡ Live Execution'}
                </span>
              </div>

              {commandDetails.rawPayload && (
                <div style={{ marginTop: '4px' }}>
                  <CodeBlock
                    code={JSON.stringify(commandDetails.rawPayload, null, 2)}
                    language="json"
                    title="Allowlist Verified Payload"
                    maxHeight="120px"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-5)',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--space-2)',
          }}
        >
          <button type="button" className="btn" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
