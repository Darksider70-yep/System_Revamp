const browserProtocol = window.location.protocol === "https:" ? "https:" : "http:";
const browserWsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const browserHost = window.location.hostname || "127.0.0.1";

const trimTrailingSlash = (value) => value.replace(/\/$/, "");

const cloudApiBase = trimTrailingSlash(
  process.env.REACT_APP_CLOUD_API_URL || `${browserProtocol}//${browserHost}:9000`
);
const cloudWsBase = trimTrailingSlash(
  process.env.REACT_APP_CLOUD_WS_URL || `${browserWsProtocol}//${browserHost}:9000`
);
const agentApiBase = trimTrailingSlash(
  process.env.REACT_APP_AGENT_API_URL || `${browserProtocol}//${browserHost}:8004`
);

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

export const CLOUD_WS_ENDPOINTS = {
  liveMachines: `${cloudWsBase}/live-machines`,
  alerts: `${cloudWsBase}/alerts`,
};
