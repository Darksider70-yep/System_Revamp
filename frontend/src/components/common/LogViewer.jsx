import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Terminal, Search, Copy, Check, Filter, Trash2, ArrowDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

export const LogViewer = ({
  logs = [], // Array of strings or objects { timestamp, level, message }
  title = 'Console Output & Execution Logs',
  maxHeight = '420px',
  onClear = null,
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  // Parse lines if strings or normalize objects
  const parsedLogs = useMemo(() => {
    return logs.map((log, idx) => {
      if (typeof log === 'string') {
        let level = 'INFO';
        const upper = log.toUpperCase();
        if (upper.includes('ERR') || upper.includes('FAIL') || upper.includes('EXCEPTION')) {
          level = 'ERROR';
        } else if (upper.includes('WARN')) {
          level = 'WARN';
        } else if (upper.includes('DEBUG')) {
          level = 'DEBUG';
        }
        return { id: idx, timestamp: null, level, message: log };
      }
      return {
        id: idx,
        timestamp: log.timestamp || null,
        level: (log.level || 'INFO').toUpperCase(),
        message: log.message || log.text || JSON.stringify(log),
      };
    });
  }, [logs]);

  // Filtered lines
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((entry) => {
      if (selectedLevel !== 'ALL' && entry.level !== selectedLevel) {
        return false;
      }
      if (filterText) {
        const textToSearch = `${entry.timestamp || ''} ${entry.level} ${entry.message}`.toLowerCase();
        if (!textToSearch.includes(filterText.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [parsedLogs, selectedLevel, filterText]);

  // Auto-scroll on updates
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleCopy = () => {
    const textToCopy = filteredLogs
      .map((l) => (l.timestamp ? `[${l.timestamp}] [${l.level}] ${l.message}` : `[${l.level}] ${l.message}`))
      .join('\n');
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'ERROR':
        return 'var(--status-critical-text)';
      case 'WARN':
        return 'var(--status-high-text)';
      case 'DEBUG':
        return 'var(--text-muted)';
      case 'INFO':
      default:
        return 'var(--accent-text)';
    }
  };

  return (
    <div
      className="panel log-viewer"
      style={{
        borderRadius: 'var(--radius-container)',
        border: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-code)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          padding: '10px 16px',
          backgroundColor: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-chip)',
              backgroundColor: 'var(--accent-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <Terminal size={14} strokeWidth={2} />
          </div>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </span>
          <span
            className="tabular-nums font-mono"
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: 'var(--bg-base)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {filteredLogs.length} lines
          </span>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={12}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Filter logs..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="input"
              style={{
                height: '28px',
                paddingLeft: '26px',
                paddingRight: '8px',
                fontSize: '11px',
                width: '140px',
                borderRadius: 'var(--radius-input)',
              }}
            />
          </div>

          {/* Level Filter Dropdown */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="input"
            style={{
              height: '28px',
              padding: '0 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: 'var(--radius-input)',
            }}
          >
            <option value="ALL">All Levels</option>
            <option value="ERROR">Errors Only</option>
            <option value="WARN">Warnings Only</option>
            <option value="INFO">Info Only</option>
          </select>

          {/* Copy Button */}
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCopy}
            disabled={filteredLogs.length === 0}
            style={{ borderRadius: 'var(--radius-input)' }}
          >
            {copied ? (
              <>
                <Check size={12} strokeWidth={2.5} color="var(--status-ok-solid)" />
                <span style={{ color: 'var(--status-ok-text)' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Clear Button */}
          {onClear && (
            <button
              type="button"
              className="btn btn-sm btn-icon"
              onClick={onClear}
              title="Clear Console"
              style={{ borderRadius: 'var(--radius-input)' }}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Log Body */}
      <div
        ref={logContainerRef}
        className="font-mono tabular-nums"
        style={{
          padding: '12px 16px',
          overflowY: 'auto',
          maxHeight,
          minHeight: '160px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          fontSize: 'var(--text-xs)',
          lineHeight: 1.6,
          backgroundColor: 'var(--bg-code)',
          color: 'var(--text-primary)',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ margin: 'auto', padding: '24px 0' }}>
            <EmptyState
              icon={Terminal}
              title="No logs available"
              description={
                logs.length === 0
                  ? 'No execution or scanner logs have been recorded for this session.'
                  : 'No log lines match the current text or level filter.'
              }
            />
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                wordBreak: 'break-all',
              }}
            >
              {entry.timestamp && (
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  [{entry.timestamp}]
                </span>
              )}
              <span
                style={{
                  fontWeight: 600,
                  color: getLevelColor(entry.level),
                  flexShrink: 0,
                  minWidth: '45px',
                }}
              >
                [{entry.level}]
              </span>
              <span style={{ color: 'var(--text-primary)', flex: 1 }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
