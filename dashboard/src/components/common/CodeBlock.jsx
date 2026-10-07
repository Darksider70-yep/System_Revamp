import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export const CodeBlock = ({ code, language = 'bash', title = null, maxHeight = '300px' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-code)',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {(title || language) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            backgroundColor: 'var(--bg-surface-hover)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Terminal size={13} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {title || language.toUpperCase()}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCopy}
            style={{
              padding: '2px 8px',
              height: '22px',
              fontSize: '11px',
              gap: '4px',
            }}
          >
            {copied ? <Check size={12} color="var(--status-ok-solid)" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      <pre
        className="font-mono tabular-nums"
        style={{
          padding: '12px',
          margin: 0,
          fontSize: 'var(--text-xs)',
          color: 'var(--text-primary)',
          overflowX: 'auto',
          maxHeight,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {code}
      </pre>
    </div>
  );
};
