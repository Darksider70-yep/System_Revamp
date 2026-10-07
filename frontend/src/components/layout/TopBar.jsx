import React, { useState } from 'react';
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
  } = useTheme();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        gap: '12px',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Left: Scope switcher & Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <ScopeSwitcher />

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)' }}>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
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
                      padding: 0,
                    }}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span
                    style={{
                      color: idx === breadcrumbs.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                    }}
                  >
                    {crumb.label}
                  </span>
                )}
                {idx < breadcrumbs.length - 1 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      {/* Middle: Global Search */}
      <div style={{ flex: '1 1 320px', maxWidth: '480px', position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          type="text"
          className="input"
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          placeholder="Global search (device name, app, SHA-256, CVE ID)..."
          style={{
            width: '100%',
            paddingLeft: '32px',
            height: '32px',
            fontSize: 'var(--text-base)',
          }}
        />
      </div>

      {/* Right: Controls & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Presentation mode toggle */}
        <button
          type="button"
          className={`btn btn-sm ${presentationMode ? 'btn-primary' : ''}`}
          onClick={togglePresentationMode}
          title="Toggle Presentation / Demo Mode (+10% font scaling)"
          style={{ height: '30px', padding: '0 8px', gap: '4px' }}
        >
          <Cast size={13} />
          <span className="sidebar-subtext" style={{ fontSize: '11px' }}>Demo Mode</span>
        </button>

        {/* Density toggle */}
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={toggleDensity}
          title={`Switch density (currently ${density})`}
          style={{ height: '30px', width: '30px' }}
        >
          {density === 'comfortable' ? <FoldVertical size={14} /> : <UnfoldVertical size={14} />}
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={toggleTheme}
          title={`Current theme: ${theme} (resolved: ${effectiveTheme})`}
          style={{ height: '30px', width: '30px' }}
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
              height: '30px',
              padding: '0 8px',
              gap: '6px',
              backgroundColor: 'var(--bg-surface-elevated)',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {(user?.name || user?.email || 'A')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  top: 'calc(100% + 4px)',
                  right: 0,
                  width: '220px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-md)',
                  zIndex: 'calc(var(--z-dropdown) + 1)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {user?.name || 'Administrator'}
                  </div>
                  {user?.email && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {user.email}
                    </div>
                  )}
                  <div style={{ marginTop: '4px' }}>
                    <span className="tag-mono" style={{ fontSize: '10px', color: 'var(--accent-text)' }}>
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
                    border: 'none',
                    color: 'var(--status-critical-text)',
                    gap: '8px',
                    padding: '6px 8px',
                  }}
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
