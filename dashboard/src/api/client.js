const API_BASE_URL = process.env.REACT_APP_SERVER_URL || "http://127.0.0.1:8000";

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem("sr_access_token") || null;
    this.refreshToken = localStorage.getItem("sr_refresh_token") || null;
    this.user = JSON.parse(localStorage.getItem("sr_user") || "null");
  }

  setSession(accessToken, refreshToken, user) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;
    localStorage.setItem("sr_access_token", accessToken);
    localStorage.setItem("sr_refresh_token", refreshToken);
    localStorage.setItem("sr_user", JSON.stringify(user));
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    localStorage.removeItem("sr_access_token");
    localStorage.removeItem("sr_refresh_token");
    localStorage.removeItem("sr_user");
  }

  isAuthenticated() {
    return Boolean(this.accessToken);
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401 && this.refreshToken && !endpoint.includes("/auth/")) {
        // Attempt token refresh
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          headers["Authorization"] = `Bearer ${this.accessToken}`;
          return await (await fetch(url, { ...options, headers })).json();
        } else {
          this.clearSession();
          window.location.reload();
        }
      }
      return await response.json();
    } catch (error) {
      console.error(`API Request error [${endpoint}]:`, error);
      throw error;
    }
  }

  async tryRefresh() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        this.setSession(data.access_token, data.refresh_token, data.user);
        return true;
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }
    return false;
  }

  // Auth
  login(email, password, totp_code = null) {
    return this.request("/api/v2/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, totp_code }),
    });
  }

  // Fleet & Admin
  getFleetOverview() {
    return this.request("/api/v2/admin/fleet/overview");
  }

  getSites() {
    return this.request("/api/v2/admin/sites");
  }

  getLabs(siteId = null) {
    const q = siteId ? `?site_id=${siteId}` : "";
    return this.request(`/api/v2/admin/labs${q}`);
  }

  getDevices(labId = null) {
    const q = labId ? `?lab_id=${labId}` : "";
    return this.request(`/api/v2/admin/devices${q}`);
  }

  getDeviceDetail(deviceId) {
    return this.request(`/api/v2/admin/devices/${deviceId}`);
  }

  createEnrollmentToken(orgId, labId, name, maxUses = 50) {
    return this.request("/api/v2/admin/enrollment-tokens", {
      method: "POST",
      body: JSON.stringify({ org_id: orgId, lab_id: labId, name, max_uses: maxUses }),
    });
  }

  getEnrollmentTokens() {
    return this.request("/api/v2/admin/enrollment-tokens");
  }

  revokeEnrollmentToken(tokenId) {
    return this.request(`/api/v2/admin/enrollment-tokens/${tokenId}`, {
      method: "DELETE",
    });
  }

  queueCommand(targetType, targetId, commandType, params = {}, dryRun = false) {
    return this.request("/api/v2/commands/queue", {
      method: "POST",
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        command_type: commandType,
        params,
        dry_run: dryRun,
      }),
    });
  }

  approveCommand(commandId, approved = true) {
    return this.request("/api/v2/commands/approve", {
      method: "POST",
      body: JSON.stringify({ command_id: commandId, approved }),
    });
  }

  getAuditLogs(limit = 50) {
    return this.request(`/api/v2/admin/audit-logs?limit=${limit}`);
  }
}

export const api = new ApiClient();
