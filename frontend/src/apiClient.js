import {
  AGENT_API_ENDPOINTS,
  CLOUD_API_ENDPOINTS,
  DRIVER_API_ENDPOINTS,
  MONITOR_API_ENDPOINTS,
  PROTECTION_API_ENDPOINTS,
  SCANNER_API_ENDPOINTS,
  VERSION_API_ENDPOINTS,
} from "./apiConfig";

const AUTH_TOKEN_KEY = "cloud_access_token";
const AUTH_ROLE_KEY = "cloud_role";
const AUTH_KEY_ID = "cloud_key_id";
const AUTH_EXPIRES_AT_KEY = "cloud_token_expires_at";
const AUTH_FLAG_KEY = "auth";

const parseJson = (raw) => {
  if (!raw || !String(raw).trim()) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export class ApiError extends Error {
  constructor(message, status, payload = null, url = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.url = url;
  }
}

const normalizeErrorMessage = (payload, fallback = "Request failed") => {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  if (payload.error?.message) {
    return String(payload.error.message);
  }
  if (typeof payload.detail === "string") {
    return payload.detail;
  }
  if (typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
};

const serviceApiKey = (process.env.REACT_APP_SERVICE_API_KEY || "").trim();

export const authSession = {
  getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  },
  getRole() {
    return localStorage.getItem(AUTH_ROLE_KEY) || "";
  },
  getExpiry() {
    const raw = localStorage.getItem(AUTH_EXPIRES_AT_KEY);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  },
  isAuthenticated() {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    const expiry = this.getExpiry();
    if (!expiry) {
      return true;
    }
    return Date.now() < expiry;
  },
  save({ accessToken, role, keyId, expiresInSeconds }) {
    if (!accessToken) {
      return;
    }
    const expiresAt =
      Number.isFinite(Number(expiresInSeconds)) && Number(expiresInSeconds) > 0
        ? Date.now() + Number(expiresInSeconds) * 1000
        : 0;
    localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    localStorage.setItem(AUTH_FLAG_KEY, "true");
    if (role) {
      localStorage.setItem(AUTH_ROLE_KEY, role);
    }
    if (keyId) {
      localStorage.setItem(AUTH_KEY_ID, keyId);
    }
    if (expiresAt) {
      localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(expiresAt));
    }
  },
  clear() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_ROLE_KEY);
    localStorage.removeItem(AUTH_KEY_ID);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
    localStorage.removeItem(AUTH_FLAG_KEY);
  },
};

export const extractData = (payload) => {
  if (payload && typeof payload === "object" && payload.status === "success") {
    return payload.data || {};
  }
  return payload || {};
};

export async function requestJson(url, options = {}) {
  const {
    method = "GET",
    body,
    headers = {},
    signal,
    token,
    auth = false,
    includeServiceApiKey = true,
  } = options;

  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  requestHeaders.set("Accept", "application/json");
  if (!isFormData && body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (includeServiceApiKey && serviceApiKey) {
    requestHeaders.set("X-Service-Api-Key", serviceApiKey);
  }

  const resolvedToken = token || (auth ? authSession.getToken() : "");
  if (resolvedToken) {
    requestHeaders.set("Authorization", `Bearer ${resolvedToken}`);
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });

  const raw = await response.text();
  const payload = parseJson(raw);

  if (!response.ok) {
    const message = normalizeErrorMessage(payload, `${response.status} ${response.statusText}`.trim());
    throw new ApiError(message, response.status, payload, url);
  }
  return payload;
}

export const cloudApi = {
  async login(username, password) {
    return requestJson(CLOUD_API_ENDPOINTS.login, {
      method: "POST",
      body: { username, password },
      includeServiceApiKey: false,
    });
  },
  async rotateToken() {
    return requestJson(CLOUD_API_ENDPOINTS.rotateToken, { method: "POST", auth: true });
  },
  async getOverview() {
    return requestJson(CLOUD_API_ENDPOINTS.overview, { auth: true });
  },
  async getMachines() {
    return requestJson(CLOUD_API_ENDPOINTS.machines, { auth: true });
  },
  async getHeatmap() {
    return requestJson(CLOUD_API_ENDPOINTS.heatmap, { auth: true });
  },
  async getMachineDetails(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.machineDetails}/${machineId}`, { auth: true });
  },
  async getRiskScore(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.riskScore}/${machineId}`, { auth: true });
  },
  async getRiskPrediction(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.predictRisk}/${machineId}`, { auth: true });
  },
  async getVulnerabilities(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.vulnerabilities}/${machineId}/vulnerabilities`, { auth: true });
  },
  async getEvents(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.events}/${machineId}/events`, { auth: true });
  },
  async getPatchStatus(machineId) {
    return requestJson(`${CLOUD_API_ENDPOINTS.patchStatus}/${machineId}`, { auth: true });
  },
  async getGroups() {
    return requestJson(CLOUD_API_ENDPOINTS.groups, { auth: true });
  },
  async queueMachineScan(machineId, forceFull = true) {
    return requestJson(`${CLOUD_API_ENDPOINTS.queueScan}/${machineId}/scan`, {
      method: "POST",
      body: { force_full: Boolean(forceFull) },
      auth: true,
    });
  },
  async queueMachinePatch(machineId, payload = {}) {
    return requestJson(`${CLOUD_API_ENDPOINTS.queuePatch}/${machineId}/patch`, {
      method: "POST",
      body: payload,
      auth: true,
    });
  },
};

export const scannerApi = {
  async scan() {
    const payload = await requestJson(SCANNER_API_ENDPOINTS.scan);
    const data = extractData(payload);
    return Array.isArray(data.apps) ? data.apps : Array.isArray(payload?.apps) ? payload.apps : [];
  },
  async simulateAttack({ software, current, latest, riskLevel }) {
    const payload = await requestJson(SCANNER_API_ENDPOINTS.simulateAttack, {
      method: "POST",
      body: { software, current, latest, riskLevel },
    });
    return extractData(payload);
  },
};

export const versionApi = {
  async checkVersions(installedAppsMap) {
    const payload = await requestJson(VERSION_API_ENDPOINTS.checkVersions, {
      method: "POST",
      body: installedAppsMap,
    });
    const data = extractData(payload);
    return Array.isArray(data.apps) ? data.apps : Array.isArray(payload?.apps) ? payload.apps : [];
  },
};

export const driverApi = {
  async getDrivers() {
    const payload = await requestJson(DRIVER_API_ENDPOINTS.drivers);
    const data = extractData(payload);
    return {
      missingDrivers: data.missingDrivers || payload?.missingDrivers || [],
      installedDrivers: data.installedDrivers || payload?.installedDrivers || [],
      riskSummary: data.riskSummary || payload?.riskSummary || { critical: 0, high: 0, medium: 0, low: 0 },
    };
  },
  async downloadDrivers() {
    const payload = await requestJson(DRIVER_API_ENDPOINTS.downloadDrivers, { method: "POST", body: {} });
    return extractData(payload);
  },
};

export const monitorApi = {
  async getSystemInfo() {
    return extractData(await requestJson(MONITOR_API_ENDPOINTS.systemInfo));
  },
  async getSystemMetrics() {
    return extractData(await requestJson(MONITOR_API_ENDPOINTS.systemMetrics));
  },
  async getSecurityEvents() {
    return extractData(await requestJson(MONITOR_API_ENDPOINTS.securityEvents));
  },
};

export const agentApi = {
  async getScan() {
    return extractData(await requestJson(AGENT_API_ENDPOINTS.scan));
  },
};

export const protectionApi = {
  async scan(payload = {}) {
    return requestJson(PROTECTION_API_ENDPOINTS.scan, {
      method: "POST",
      body: payload,
      includeServiceApiKey: false,
    });
  },
};
