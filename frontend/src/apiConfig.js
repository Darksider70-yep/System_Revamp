const browserProtocol = window.location.protocol === "https:" ? "https:" : "http:";
const browserWsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const browserHost = window.location.hostname || "127.0.0.1";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const cloudApiBase = trimTrailingSlash(
  process.env.REACT_APP_CLOUD_API_URL || `${browserProtocol}//${browserHost}:9000`
);
const cloudWsBase = trimTrailingSlash(
  process.env.REACT_APP_CLOUD_WS_URL || `${browserWsProtocol}//${browserHost}:9000`
);
const agentApiBase = trimTrailingSlash(
  process.env.REACT_APP_AGENT_API_URL || `${browserProtocol}//${browserHost}:8004`
);
const scannerApiBase = trimTrailingSlash(
  process.env.REACT_APP_SCANNER_API_URL || `${browserProtocol}//${browserHost}:8000`
);
const driverApiBase = trimTrailingSlash(
  process.env.REACT_APP_DRIVER_API_URL || `${browserProtocol}//${browserHost}:8001`
);
const versionApiBase = trimTrailingSlash(
  process.env.REACT_APP_VERSION_API_URL || `${browserProtocol}//${browserHost}:8002`
);
const monitorApiBase = trimTrailingSlash(
  process.env.REACT_APP_MONITOR_API_URL || `${browserProtocol}//${browserHost}:8003`
);
const monitorWsBase = trimTrailingSlash(
  process.env.REACT_APP_MONITOR_WS_URL || `${browserWsProtocol}//${browserHost}:8003`
);
const protectionApiBase = trimTrailingSlash(
  process.env.REACT_APP_PROTECTION_API_URL || `${browserProtocol}//${browserHost}:8005`
);

export const API_BASES = {
  cloudApiBase,
  cloudWsBase,
  agentApiBase,
  scannerApiBase,
  driverApiBase,
  versionApiBase,
  monitorApiBase,
  monitorWsBase,
  protectionApiBase,
};

export const CLOUD_API_ENDPOINTS = {
  login: `${cloudApiBase}/auth/login`,
  rotateToken: `${cloudApiBase}/auth/rotate-token`,
  overview: `${cloudApiBase}/dashboard/overview`,
  heatmap: `${cloudApiBase}/dashboard/heatmap`,
  machines: `${cloudApiBase}/dashboard/machines`,
  machineDetails: `${cloudApiBase}/dashboard/machines`,
  riskScore: `${cloudApiBase}/risk-score`,
  predictRisk: `${cloudApiBase}/predict-risk`,
  vulnerabilities: `${cloudApiBase}/machines`,
  events: `${cloudApiBase}/machines`,
  queueScan: `${cloudApiBase}/machines`,
  queuePatch: `${cloudApiBase}/machines`,
  patchStatus: `${cloudApiBase}/patch-status`,
  groups: `${cloudApiBase}/groups`,
};

export const AGENT_API_ENDPOINTS = {
  scan: `${agentApiBase}/scan`,
  health: `${agentApiBase}/health`,
  offlinePackages: `${agentApiBase}/offline-packages`,
  pendingPatches: `${agentApiBase}/pending-patches`,
  generateOfflinePackage: `${agentApiBase}/generate-offline-package`,
  applyOfflinePackage: `${agentApiBase}/apply-offline-package`,
  autoPatch: `${agentApiBase}/auto-patch`,
};

export const SCANNER_API_ENDPOINTS = {
  scan: `${scannerApiBase}/scan`,
  simulateAttack: `${scannerApiBase}/simulate-attack`,
  generateOfflinePackage: `${scannerApiBase}/generate-offline-package`,
};

export const DRIVER_API_ENDPOINTS = {
  drivers: `${driverApiBase}/drivers`,
  downloadDrivers: `${driverApiBase}/drivers/download`,
};

export const VERSION_API_ENDPOINTS = {
  checkVersions: `${versionApiBase}/check-versions`,
};

export const MONITOR_API_ENDPOINTS = {
  systemInfo: `${monitorApiBase}/system-info`,
  systemMetrics: `${monitorApiBase}/system-metrics`,
  securityEvents: `${monitorApiBase}/security-events`,
};

export const PROTECTION_API_ENDPOINTS = {
  scan: `${protectionApiBase}/protection/scan`,
};

export const CLOUD_WS_ENDPOINTS = {
  liveMachines: `${cloudWsBase}/live-machines`,
  alerts: `${cloudWsBase}/alerts`,
};

export const MONITOR_WS_ENDPOINTS = {
  liveMonitor: `${monitorWsBase}/live-monitor`,
};
