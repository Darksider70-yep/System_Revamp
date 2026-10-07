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
  Radio,
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
      style={{
        width: collapsed ? '60px' : '230px',
        minWidth: collapsed ? '60px' : '230px',
        height: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal)',
        userSelect: 'none',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-chip)', // 10px
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-inverse)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Shield size={16} strokeWidth={2.5} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  System Revamp
                </span>
                <span className="font-mono sidebar-subtext" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  v2.0 Fleet Console
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-chip)',
                backgroundColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-inverse)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Shield size={16} strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                  height: '38px',
                  padding: collapsed ? '0' : '0 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 'var(--text-base)',
                  borderRadius: 'var(--radius-input)', // 10px
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  gap: '12px',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Server Status & Collapse Toggle */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!collapsed && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-input)', // 10px
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Radio size={13} strokeWidth={2.5} style={{ color: 'var(--status-ok-solid)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Fleet Server: <strong style={{ color: 'var(--status-ok-text)' }}>Connected</strong>
            </span>
          </div>
        )}

        <button
          type="button"
          className="btn btn-sm"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            height: '30px',
            justifyContent: collapsed ? 'center' : 'space-between',
            border: 'none',
            color: 'var(--text-muted)',
            padding: collapsed ? '0' : '0 10px',
            borderRadius: 'var(--radius-input)',
            boxShadow: 'none',
          }}
        >
          {!collapsed && <span style={{ fontSize: '11px' }}>Collapse Menu</span>}
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
};
