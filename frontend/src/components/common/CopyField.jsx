import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyField = ({ value, label = null, monospace = true, truncated = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      {label && (
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-code)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 8px',
          gap: '8px',
        }}
      >
        <span
          className={monospace ? 'font-mono' : ''}
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: truncated ? 'ellipsis' : 'clip',
            whiteSpace: 'nowrap',
            userSelect: 'all',
          }}
          title={value}
        >
          {value}
        </span>
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={handleCopy}
          title="Copy to clipboard"
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--status-ok-solid)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};
