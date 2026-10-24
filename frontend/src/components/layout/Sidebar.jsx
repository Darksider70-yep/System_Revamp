import React from 'react';
import {
  LayoutDashboard,
  Monitor,
  Package,
  Cpu,
  ShieldAlert,
  Wrench,
  FileText,
  KeyRound,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';

export const Sidebar = ({ currentTab, onSelectTab, collapsed, onToggleCollapse }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Monitor },
    { id: 'software', label: 'Software', icon: Package },
    { id: 'drivers', label: 'Drivers', icon: Cpu },
    { id: 'threats', label: 'Threats', icon: ShieldAlert },
    { id: 'remediation', label: 'Remediation', icon: Wrench },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'enrollment', label: 'Enrollment', icon: KeyRound },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className="floating-dock"
      style={{
        width: collapsed ? '68px' : '236px',
        minWidth: collapsed ? '68px' : '236px',
        height: 'calc(100vh - 24px)',
        margin: '12px 0 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal), transform var(--transition-normal)',
        userSelect: 'none',
        zIndex: 'var(--z-sticky)',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 18px',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-input)', /* 12px */
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-active) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-inverse)',
                  boxShadow: '0 4px 12px var(--accent-glow)',
                }}
              >
                <Shield size={17} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.15,
                  }}
                >
                  System Revamp
                </span>
                <span
                  className="font-mono sidebar-subtext"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  v2.0 Living Console
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-input)',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-active) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-inverse)',
                boxShadow: '0 4px 12px var(--accent-glow)',
              }}
            >
              <Shield size={17} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav
          style={{
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className="btn"
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: collapsed ? '0' : '0 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(14, 165, 233, 0.05) 100%)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(56, 189, 248, 0.32)'
                    : '1px solid transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 'var(--text-base)',
                  borderRadius: 'var(--radius-button)', /* 14px */
                  boxShadow: isActive ? '0 4px 16px -2px var(--accent-glow)' : 'none',
                  gap: '12px',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                    flexShrink: 0,
                    transition: 'color var(--transition-fast)',
                  }}
                />
                {!collapsed && (
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {item.label}
                  </span>
                )}
                {!collapsed && isActive && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-primary)',
                      boxShadow: '0 0 8px var(--accent-primary)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Living Telemetry & Collapse Toggle */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {!collapsed && (
          <div
            style={{
              padding: '9px 12px',
              backgroundColor: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-input)', /* 12px */
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="living-node living-node-ok" />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Fleet Engine
              </span>
            </div>
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: '10px',
                color: 'var(--status-ok-text)',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              LIVE
            </span>
          </div>
        )}

        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar dock' : 'Collapse sidebar dock'}
          style={{
            width: '100%',
            height: '32px',
            justifyContent: collapsed ? 'center' : 'space-between',
            border: '1px solid transparent',
            color: 'var(--text-muted)',
            padding: collapsed ? '0' : '0 10px',
            borderRadius: 'var(--radius-input)',
            backgroundColor: 'transparent',
            boxShadow: 'none',
          }}
        >
          {!collapsed && (
            <span style={{ fontSize: '11px', fontWeight: 500 }}>
              Collapse Dock
            </span>
          )}
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
};
