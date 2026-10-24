import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Sun,
  Moon,
  Laptop,
  FoldVertical,
  UnfoldVertical,
  LogOut,
  Shield,
  Cast,
  RefreshCw,
  Check,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ScopeSwitcher } from '../common/ScopeSwitcher';

export const TopBar = ({ breadcrumbs = [], onLogout, user = null }) => {
  const {
    theme,
    effectiveTheme,
    toggleTheme,
    density,
    toggleDensity,
    presentationMode,
    togglePresentationMode,
    globalSearch,
    setGlobalSearch,
    autoRefreshInterval,
    setAutoRefreshInterval,
    triggerRefresh,
    isRefreshing,
    lastRefreshedAt,
  } = useTheme();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [refreshMenuOpen, setRefreshMenuOpen] = useState(false);
  const refreshMenuRef = useRef(null);

  // Close refresh dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (refreshMenuRef.current && !refreshMenuRef.current.contains(e.target)) {
        setRefreshMenuOpen(false);
      }
    };
    if (refreshMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [refreshMenuOpen]);

  return (
    <header
      style={{
        height: '54px',
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-container)', /* 16px */
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: '14px',
        zIndex: 'var(--z-sticky)',
        boxShadow: 'var(--glass-specular), var(--shadow-sm)',
        marginBottom: '12px',
        flexShrink: 0,
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Left: Scope switcher & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <ScopeSwitcher />

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-sm)',
            }}
          >
            <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>/</span>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {crumb.onClick ? (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-text)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 'var(--radius-xs)',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    style={{
                      color:
                        idx === breadcrumbs.length - 1
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                      fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                    }}
                  >
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && (
                  <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>/</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* Middle: Cyber Command Search */}
      <div style={{ flex: '1 1 320px', maxWidth: '460px', position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          className="input"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Search fleet (hostname, IP, SHA-256, CVE ID)..."
          style={{
            width: '100%',
            paddingLeft: '34px',
            paddingRight: '62px',
            height: '34px',
            fontSize: 'var(--text-base)',
            borderRadius: 'var(--radius-button)', /* 14px */
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            pointerEvents: 'none',
          }}
        >
          <span className="kbd-shortcut">Ctrl+K</span>
        </div>
      </div>

      {/* Right: Controls & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Auto-Refresh Control */}
        <div ref={refreshMenuRef} style={{ position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-button)',
              padding: '2px',
              gap: '2px',
              height: '32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Live Indicator Pill / Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setRefreshMenuOpen(!refreshMenuOpen)}
              title={`Auto-refresh is ${autoRefreshInterval > 0 ? `every ${autoRefreshInterval}s` : 'paused'}. Click to configure rate.`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                padding: '0 8px',
                height: '100%',
                borderRadius: 'var(--radius-button)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: autoRefreshInterval > 0 ? 'var(--status-ok-solid)' : 'var(--text-muted)',
                  boxShadow: autoRefreshInterval > 0 ? '0 0 6px var(--status-ok-solid)' : 'none',
                  display: 'inline-block',
                }}
              />
              <span>{autoRefreshInterval > 0 ? `${autoRefreshInterval}s` : 'Off'}</span>
            </button>

            {/* Manual Sync / Trigger Button */}
            <button
              type="button"
              onClick={triggerRefresh}
              title={`Last synced: ${lastRefreshedAt ? new Date(lastRefreshedAt).toLocaleTimeString() : 'now'}. Click to sync now.`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: isRefreshing ? 'var(--bg-surface-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <RefreshCw size={12} className={isRefreshing ? 'status-spin' : ''} />
            </button>
          </div>

          {/* Refresh Interval Dropdown Menu */}
          {refreshMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-container)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                zIndex: 'var(--z-popover)',
                minWidth: '170px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                animation: 'modalPop 0.15s ease-out',
              }}
            >
              <div style={{ padding: '6px 8px 4px 8px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Auto-Refresh Rate
              </div>
              {[
                { label: 'Real-Time (3s)', val: 3 },
                { label: 'Fast (5s) (Default)', val: 5 },
                { label: 'Standard (10s)', val: 10 },
                { label: 'Relaxed (30s)', val: 30 },
                { label: 'Paused (Manual only)', val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    setAutoRefreshInterval(opt.val);
                    setRefreshMenuOpen(false);
                    if (opt.val > 0) triggerRefresh();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    background: autoRefreshInterval === opt.val ? 'var(--bg-surface-active)' : 'transparent',
                    color: autoRefreshInterval === opt.val ? 'var(--accent-text)' : 'var(--text-primary)',
                    fontWeight: autoRefreshInterval === opt.val ? 600 : 400,
                    fontSize: '11px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span>{opt.label}</span>
                  {autoRefreshInterval === opt.val && <Check size={12} style={{ color: 'var(--accent-primary)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Presentation mode toggle */}
        <button
          type="button"
          className={`btn btn-sm ${presentationMode ? 'btn-primary' : ''}`}
          onClick={togglePresentationMode}
          title="Toggle Presentation / Demo Mode (+10% font scaling)"
          style={{ height: '32px', padding: '0 10px', gap: '6px' }}
        >
          <Cast size={13} />
          <span className="sidebar-subtext" style={{ fontSize: '11px', fontWeight: 500 }}>
            Demo
          </span>
        </button>

        {/* Density toggle */}
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={toggleDensity}
          title={`Switch density (currently ${density})`}
          style={{ height: '32px', width: '32px' }}
        >
          {density === 'comfortable' ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={toggleTheme}
          title={`Theme: ${theme} (resolved: ${effectiveTheme})`}
          style={{ height: '32px', width: '32px' }}
        >
          {theme === 'system' ? (
            <Laptop size={14} />
          ) : effectiveTheme === 'dark' ? (
            <Moon size={14} />
          ) : (
            <Sun size={14} />
          )}
        </button>

        {/* User Profile dropdown */}
        <div style={{ position: 'relative', marginLeft: '4px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{
              height: '32px',
              padding: '0 10px',
              gap: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: 'var(--radius-full)',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-active) 100%)',
                color: 'var(--text-inverse)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: '0 2px 6px var(--accent-glow)',
              }}
            >
              {(user?.name || user?.email || 'A')[0].toUpperCase()}
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || user?.email?.split('@')[0] || 'Administrator'}
            </span>
          </button>

          {userMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }}
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                className="panel"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '230px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  backdropFilter: 'var(--glass-blur)',
                  WebkitBackdropFilter: 'var(--glass-blur)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: 'var(--shadow-modal)',
                  zIndex: 'calc(var(--z-dropdown) + 1)',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  borderRadius: 'var(--radius-container)',
                  animation: 'modalPop 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {user?.name || 'Administrator'}
                  </div>
                  {user?.email && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {user.email}
                    </div>
                  )}
                  <div style={{ marginTop: '6px' }}>
                    <span
                      className="tag-mono"
                      style={{
                        fontSize: '10px',
                        color: 'var(--accent-text)',
                        backgroundColor: 'var(--accent-subtle)',
                        borderColor: 'var(--accent-border)',
                      }}
                    >
                      <Shield size={10} /> {user?.role || 'Admin'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setUserMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    border: '1px solid transparent',
                    color: 'var(--status-critical-text)',
                    backgroundColor: 'transparent',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-input)',
                  }}
                >
                  <LogOut size={14} />
                  <span style={{ fontWeight: 500 }}>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
