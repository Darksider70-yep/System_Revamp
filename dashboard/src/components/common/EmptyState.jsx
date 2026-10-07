import React from 'react';
import { Inbox, Plus } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There is currently no data to display for this scope or filter.',
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        textAlign: 'center',
        gap: 'var(--space-3)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-surface-hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <Icon size={24} />
      </div>

      <div style={{ maxWidth: '380px' }}>
        <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {title}
        </h4>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction} style={{ marginTop: 'var(--space-2)' }}>
          <Plus size={14} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
