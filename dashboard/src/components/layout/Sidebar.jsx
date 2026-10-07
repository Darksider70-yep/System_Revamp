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
        width: collapsed ? '56px' : '220px',
        minWidth: collapsed ? '56px' : '220px',
        height: '100vh',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-fast)',
        userSelect: 'none',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Brand Header */}
      <div>
        <div
          style={{
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {!collapsed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '13px',
                }}
              >
                ⚡
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  System Revamp
                </span>
                <span className="font-mono sidebar-subtext" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  v2.0 Console
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '13px',
              }}
            >
              ⚡
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                  height: '36px',
                  padding: collapsed ? '0' : '0 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 'var(--text-base)',
                  gap: '10px',
                }}
              >
                <Icon size={16} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Server Status & Collapse Toggle */}
      <div style={{ padding: '8px 6px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {!collapsed && (
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'var(--bg-surface-hover)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Radio size={12} color="var(--status-ok-solid)" />
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Fleet Server: <strong>Online</strong>
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
            height: '28px',
            justifyContent: collapsed ? 'center' : 'space-between',
            border: 'none',
            color: 'var(--text-muted)',
            padding: collapsed ? '0' : '0 8px',
          }}
        >
          {!collapsed && <span style={{ fontSize: '11px' }}>Collapse Menu</span>}
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
};
