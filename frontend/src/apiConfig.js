const protocol = window.location.protocol === "https:" ? "https:" : "http:";
const host = window.location.hostname || "127.0.0.1";
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

const apiBase = (port) => `${protocol}//${host}:${port}`;
const wsBase = (port, path) => `${wsProtocol}//${host}:${port}${path}`;

export const API_ENDPOINTS = {
  scanner: apiBase(8000),
  drivers: apiBase(8001),
  version: apiBase(8002),
  monitor: apiBase(8003),
};

export const WS_ENDPOINTS = {
  liveMonitor: wsBase(8003, "/live-monitor"),
};
