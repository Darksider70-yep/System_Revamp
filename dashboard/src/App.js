import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { SimulatedBanner } from './components/common/SimulatedBanner';

import { OverviewView } from './components/views/OverviewView';
import { DevicesView } from './components/views/DevicesView';
import { DeviceDetailView } from './components/views/DeviceDetailView';
import { SoftwareView } from './components/views/SoftwareView';
import { DriversView } from './components/views/DriversView';
import { ThreatsView } from './components/views/ThreatsView';
import { RemediationView } from './components/views/RemediationView';
import { ReportsView } from './components/views/ReportsView';
import { EnrollmentView } from './components/views/EnrollmentView';
import { SettingsView } from './components/views/SettingsView';
import { LoginView } from './components/views/LoginView';

import { api } from './api/client';

function MainConsole() {
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(api.user);
  const [currentTab, setCurrentTab] = useState('overview');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drilldownFilters, setDrilldownFilters] = useState({});
  const [remediationTargetApp, setRemediationTargetApp] = useState(null);

  // Check auth on mount
  useEffect(() => {
    if (api.isAuthenticated()) {
      setIsAuthenticated(true);
      setCurrentUser(api.user || { name: 'Fleet Administrator', email: 'admin@systemrevamp.local', role: 'SuperAdmin' });
    }
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    api.clearSession();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleNavigate = (tab, filters = {}) => {
    setSelectedDeviceId(null);
    setDrilldownFilters(filters);
    if (filters.targetApp) {
      setRemediationTargetApp(filters.targetApp);
    }
    setCurrentTab(tab);
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
  };

  // Breadcrumbs computation
  const getBreadcrumbs = () => {
    const tabLabels = {
      overview: 'Overview',
      devices: 'Devices',
      software: 'Software Inventory',
      drivers: 'Hardware Drivers',
      threats: 'Threat Intelligence',
      remediation: 'Staged Remediation',
      reports: 'Compliance Reports',
      enrollment: 'Agent Enrollment',
      settings: 'Settings & RBAC',
    };

    if (selectedDeviceId) {
      return [
        { label: 'Devices', onClick: () => setSelectedDeviceId(null) },
        { label: selectedDeviceId.slice(0, 16) + '...' },
      ];
    }

    return [{ label: tabLabels[currentTab] || 'Console' }];
  };

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={selectedDeviceId ? 'devices' : currentTab}
        onSelectTab={(tab) => {
          setSelectedDeviceId(null);
          setCurrentTab(tab);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Workspace Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Persistent Simulated Data Banner */}
        <SimulatedBanner />

        {/* Global Header & TopBar */}
        <TopBar
          breadcrumbs={getBreadcrumbs()}
          user={currentUser}
          onLogout={handleLogout}
        />

        {/* Main Scrollable Viewport */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-4) var(--space-5)',
            backgroundColor: 'var(--bg-base)',
          }}
        >
          {selectedDeviceId ? (
            <DeviceDetailView
              deviceId={selectedDeviceId}
              onBack={() => setSelectedDeviceId(null)}
            />
          ) : (
            <>
              {currentTab === 'overview' && (
                <OverviewView onNavigate={handleNavigate} />
              )}
              {currentTab === 'devices' && (
                <DevicesView
                  onSelectDevice={handleSelectDevice}
                  initialFilters={drilldownFilters}
                />
              )}
              {currentTab === 'software' && (
                <SoftwareView
                  onRemediateApp={(appName) => handleNavigate('remediation', { targetApp: appName })}
                />
              )}
              {currentTab === 'drivers' && <DriversView />}
              {currentTab === 'threats' && <ThreatsView />}
              {currentTab === 'remediation' && (
                <RemediationView initialApp={remediationTargetApp} />
              )}
              {currentTab === 'reports' && <ReportsView />}
              {currentTab === 'enrollment' && <EnrollmentView />}
              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainConsole />
    </ThemeProvider>
  );
}
