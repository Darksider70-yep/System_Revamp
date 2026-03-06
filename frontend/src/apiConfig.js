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

export const CLOUD_API_ENDPOINTS = {
  login: `${cloudApiBase}/auth/login`,
  registerMachine: `${cloudApiBase}/register-machine`,
  uploadScan: `${cloudApiBase}/upload-scan`,
  overview: `${cloudApiBase}/dashboard/overview`,
  machines: `${cloudApiBase}/dashboard/machines`,
  machineDetails: `${cloudApiBase}/dashboard/machines`,
  riskScore: `${cloudApiBase}/risk-score`,
  events: `${cloudApiBase}/events`,
  installPatch: `${cloudApiBase}/install-patch`,
  patchStatus: `${cloudApiBase}/patch-status`,
};

export const CLOUD_WS_ENDPOINTS = {
  liveMachines: `${cloudWsBase}/live-machines`,
  alerts: `${cloudWsBase}/alerts`,
};
