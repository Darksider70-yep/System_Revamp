import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Drawer = ({ isOpen, onClose, title, subtitle, children, width = '520px', footer = null }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-drawer)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* Drawer Panel */}
      <div
        style={{
          position: 'relative',
          width,
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-drawer)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
          animation: 'drawer-slide 200ms cubic-bezier(0.16, 1, 0.3, 1)',
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
          <div>
            <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            {subtitle && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close drawer"
            style={{ border: 'none', background: 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div
            style={{
              padding: 'var(--space-4) var(--space-5)',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-3)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
