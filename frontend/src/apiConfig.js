const protocol = window.location.protocol === "https:" ? "https:" : "http:";
const host = window.location.hostname || "127.0.0.1";

const apiBase = (port) => `${protocol}//${host}:${port}`;

export const API_ENDPOINTS = {
  scanner: apiBase(8000),
  drivers: apiBase(8001),
  version: apiBase(8002),
};
