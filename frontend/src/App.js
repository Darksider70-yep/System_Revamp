import React, { useState, useEffect, useMemo } from "react";
import InstalledAppsTable from "./components/InstalledAppsTable";
import MissingDrivers from "./components/MissingDrivers";
import LiveSystemMonitor from "./components/LiveSystemMonitor";
import {
  Box,
  Typography,
  CircularProgress,
  Fade,
  Card,
  Button,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { CloudDownload, Refresh, Computer, Dashboard, Storage, Build } from "@mui/icons-material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { API_ENDPOINTS, WS_ENDPOINTS } from "./apiConfig";

const panelHover = {
  transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
  "&:hover": {
    boxShadow: "0 22px 44px rgba(5, 10, 28, 0.52)",
    transform: "translateY(-2px)",
    borderColor: "rgba(56, 189, 248, 0.52)",
  },
};

const glassCard = {
  background: "linear-gradient(140deg, rgba(12, 20, 45, 0.86), rgba(15, 30, 66, 0.76))",
  border: "1px solid rgba(99, 102, 241, 0.34)",
  borderRadius: 3,
  backdropFilter: "blur(8px)",
};

function App() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("ZIP package");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [scriptDownloading, setScriptDownloading] = useState(false);
  const [driversDownloading, setDriversDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [missingDrivers, setMissingDrivers] = useState([]);
  const [installedDrivers, setInstalledDrivers] = useState([]);
  const [driverRiskSummary, setDriverRiskSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [selectedMenu, setSelectedMenu] = useState("overview");
  const [lastScanTime, setLastScanTime] = useState(null);
  const [liveMetrics, setLiveMetrics] = useState({
    cpu_usage: 0,
    ram_usage: 0,
    disk_usage: 0,
    network_activity: "low",
  });
  const [liveRiskScore, setLiveRiskScore] = useState(0);
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [systemInfo, setSystemInfo] = useState({});

  const toFriendlyFetchError = (err, serviceName, endpoint) => {
    const msg = err?.message || "";
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      return `${serviceName} is unreachable at ${endpoint}. Start the service and try again.`;
    }
    return msg || `Request to ${serviceName} failed.`;
  };

  const fetchApps = async () => {
    setRefreshing(true);
    setLoading(true);

    try {
      const scanRes = await fetch(`${API_ENDPOINTS.scanner}/scan`);
      if (!scanRes.ok) {
        throw new Error(`Scanner API failed (${scanRes.status})`);
      }
      const scanData = await scanRes.json();

      if (!Array.isArray(scanData.apps)) {
        throw new Error("Scan response is malformed");
      }

      const installedDict = {};
      scanData.apps.forEach((app) => {
        if (app?.name && app?.version) {
          installedDict[app.name] = app.version;
        }
      });

      const versionRes = await fetch(`${API_ENDPOINTS.version}/check-versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installedDict),
      });
      if (!versionRes.ok) {
        throw new Error(`Version API failed (${versionRes.status})`);
      }

      const versionData = await versionRes.json();
      if (!Array.isArray(versionData.apps)) {
        throw new Error("Version response is malformed");
      }

      setApps(versionData.apps);
      setLastScanTime(new Date().toLocaleString());
    } catch (err) {
      console.error(err);
      setApps([]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const normalizedApps = useMemo(
    () =>
      apps.map((app) => ({
        ...app,
        updateRequired: app.status?.includes("Update Available"),
      })),
    [apps]
  );

  const riskData = useMemo(
    () => [
      { name: "High", risk: normalizedApps.filter((app) => app.riskLevel === "High").length + (driverRiskSummary.critical || 0) },
      { name: "Medium", risk: normalizedApps.filter((app) => app.riskLevel === "Medium").length + (driverRiskSummary.high || 0) },
      { name: "Low", risk: normalizedApps.filter((app) => app.riskLevel === "Low").length },
    ],
    [normalizedApps, driverRiskSummary]
  );

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.drivers}/drivers`);
      if (!res.ok) {
        throw new Error(`Drivers API failed (${res.status})`);
      }
      const data = await res.json();
      setMissingDrivers(Array.isArray(data.missingDrivers) ? data.missingDrivers : []);
      setInstalledDrivers(Array.isArray(data.installedDrivers) ? data.installedDrivers : []);

      const summary = { critical: 0, high: 0, medium: 0, low: 0 };
      (Array.isArray(data.missingDrivers) ? data.missingDrivers : []).forEach((driver) => {
        const impact = String(driver?.Impact || "").toLowerCase();
        if (impact in summary) {
          summary[impact] += 1;
        }
      });
      setDriverRiskSummary(data.riskSummary || summary);
    } catch {
      setMissingDrivers([]);
      setInstalledDrivers([]);
      setDriverRiskSummary({ critical: 0, high: 0, medium: 0, low: 0 });
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const res = await fetch(`${API_ENDPOINTS.monitor}/system-info`);
      if (!res.ok) {
        throw new Error(`System monitor info failed (${res.status})`);
      }
      const data = await res.json();
      setSystemInfo(data || {});
    } catch {
      setSystemInfo({});
    }
  };

  const fetchMonitorSnapshot = async () => {
    try {
      const [metricsRes, eventsRes] = await Promise.all([
        fetch(`${API_ENDPOINTS.monitor}/system-metrics`),
        fetch(`${API_ENDPOINTS.monitor}/security-events?limit=5`),
      ]);
      if (metricsRes.ok) {
        const metrics = await metricsRes.json();
        setLiveMetrics({
          cpu_usage: Number(metrics?.cpu_usage || 0),
          ram_usage: Number(metrics?.ram_usage || 0),
          disk_usage: Number(metrics?.disk_usage || 0),
          network_activity: metrics?.network_activity || "low",
        });
      }
      if (eventsRes.ok) {
        const payload = await eventsRes.json();
        setSecurityAlerts(Array.isArray(payload?.events) ? payload.events : []);
        setLiveRiskScore(Number(payload?.riskScore || 0));
      }
    } catch {
      setSecurityAlerts([]);
      setLiveRiskScore(0);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchDrivers();
    fetchSystemInfo();
    fetchMonitorSnapshot();
  }, []);

  useEffect(() => {
    let socket;
    let reconnectTimer;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(WS_ENDPOINTS.liveMonitor);

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setLiveMetrics({
            cpu_usage: Number(payload?.cpu || 0),
            ram_usage: Number(payload?.ram || 0),
            disk_usage: Number(payload?.disk || 0),
            network_activity: payload?.networkActivity || "low",
          });
          setLiveRiskScore(Number(payload?.riskScore || 0));
          setSecurityAlerts(Array.isArray(payload?.securityAlerts) ? payload.securityAlerts : []);
        } catch {
          // Ignore malformed websocket payloads.
        }
      };

      socket.onclose = () => {
        if (!disposed) {
          reconnectTimer = setTimeout(connect, 4000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, []);

  const handleRefresh = () => {
    fetchApps();
    fetchDrivers();
    fetchSystemInfo();
    fetchMonitorSnapshot();
  };

  const handleDownloadZip = (mode = "full") => {
    setDownloading(true);
    setDownloadLabel(mode === "delta" ? "delta package" : "ZIP package");
    setDownloadProgress(0);
    let targetProgress = 0;
    let interval = setInterval(() => {
      setDownloadProgress((prev) => (prev < targetProgress ? prev + Math.min(1.5, targetProgress - prev) : prev));
    }, 50);

    fetch(`${API_ENDPOINTS.scanner}/generate-offline-package?mode=${mode}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Offline package request failed with status ${response.status}`);
        }

        const contentLength = response.headers.get("Content-Length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;
        if (!response.body) {
          throw new Error("Response body is empty");
        }
        const reader = response.body.getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          if (total) targetProgress = Math.round((loaded / total) * 100);
        }
        targetProgress = 100;
        clearInterval(interval);
        setDownloadProgress(100);
        const blob = new Blob(chunks);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", mode === "delta" ? "offline_delta_package.zip" : "offline_update_package.zip");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => alert(err?.message || "Failed to download ZIP package"))
      .finally(() => {
        clearInterval(interval);
        setTimeout(() => {
          setDownloading(false);
          setDownloadLabel("ZIP package");
          setDownloadProgress(0);
        }, 500);
      });
  };

  const handleExportRemediationScript = async () => {
    try {
      setScriptDownloading(true);
      const targetApps = normalizedApps.filter((app) => app.status === "Update Available");
      const payload = {
        apps: targetApps.map((app) => app.name),
        drivers: missingDrivers.map((driver) => driver["Driver Name"]),
      };

      const res = await fetch(`${API_ENDPOINTS.scanner}/generate-remediation-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Script export failed with status ${res.status}`);
      }

      const scriptText = await res.text();
      const blob = new Blob([scriptText], { type: "text/plain;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "system_revamp_remediation.ps1");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.message || "Failed to export remediation script");
    } finally {
      setScriptDownloading(false);
    }
  };

  const handleDownloadDrivers = async () => {
    try {
      setDriversDownloading(true);
      const res = await fetch(`${API_ENDPOINTS.drivers}/drivers/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drivers: missingDrivers.map((driver) => driver["Driver Name"]),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Driver download failed with status ${res.status}`);
      }

      const failed = Array.isArray(data.steps) ? data.steps.filter((step) => step.returnCode !== 0) : [];

      if (failed.length === 0) {
        alert("Driver download/install triggered successfully. Windows may continue in background.");
      } else {
        alert("Driver update started, but some steps reported issues. Try running app as Administrator.");
      }

      fetchDrivers();
    } catch (err) {
      alert(toFriendlyFetchError(err, "Drivers service", `${API_ENDPOINTS.drivers}`));
    } finally {
      setDriversDownloading(false);
    }
  };

  const totalUpdates = normalizedApps.filter((app) => app.updateRequired).length;

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 10% 0%, rgba(30, 64, 175, 0.42), rgba(2, 6, 23, 1) 35%), radial-gradient(circle at 90% 20%, rgba(14, 116, 144, 0.24), rgba(2, 6, 23, 0.8) 45%), linear-gradient(140deg, #020617 0%, #020b2a 55%, #03143a 100%)",
        color: "#e2e8f0",
      }}
    >
      <Box
        sx={{
          width: 260,
          borderRight: "1px solid rgba(59, 130, 246, 0.28)",
          background: "linear-gradient(180deg, rgba(4, 9, 30, 0.9), rgba(4, 12, 34, 0.92))",
          py: 4,
          px: 2,
          backdropFilter: "blur(10px)",
          boxShadow: "14px 0 30px rgba(2, 6, 23, 0.5)",
        }}
      >
        <Typography variant="h5" sx={{ color: "#dbeafe", fontWeight: 800, mb: 3, textAlign: "center", letterSpacing: 0.6 }}>
          Dashboard
        </Typography>
        <Divider sx={{ borderColor: "rgba(56, 189, 248, 0.28)", mb: 2 }} />
        <List>
          {[
            { id: "overview", label: "Overview", icon: <Dashboard /> },
            { id: "installed", label: "Installed Apps", icon: <Storage /> },
            { id: "drivers", label: "Missing Drivers", icon: <Build /> },
          ].map((item) => (
            <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => setSelectedMenu(item.id)}
                sx={{
                  borderRadius: 2.5,
                  px: 2,
                  py: 1,
                  background:
                    selectedMenu === item.id
                      ? "linear-gradient(120deg, rgba(67, 56, 202, 0.38), rgba(14, 165, 233, 0.25))"
                      : "transparent",
                  border: "1px solid",
                  borderColor: selectedMenu === item.id ? "rgba(56, 189, 248, 0.48)" : "transparent",
                  "&:hover": {
                    backgroundColor: "rgba(30, 64, 175, 0.3)",
                    borderColor: "rgba(56, 189, 248, 0.3)",
                  },
                }}
              >
                {React.cloneElement(item.icon, { sx: { color: "#7dd3fc", mr: 2 } })}
                <ListItemText
                  primary={item.label}
                  sx={{ color: "#cbd5e1", "& .MuiTypography-root": { fontWeight: selectedMenu === item.id ? 700 : 500 } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 4 }}>
          <Card sx={{ ...glassCard, p: 2, mb: 2, ...panelHover }}>
            <Typography sx={{ color: "#7dd3fc", fontWeight: 700 }}>Total Apps</Typography>
            <Typography sx={{ color: "#f8fafc", fontSize: 24, fontWeight: 700 }}>{apps.length}</Typography>
          </Card>
          <Card sx={{ ...glassCard, p: 2, mb: 2, ...panelHover }}>
            <Typography sx={{ color: "#7dd3fc", fontWeight: 700 }}>Updates Needed</Typography>
            <Typography sx={{ color: "#f8fafc", fontSize: 24, fontWeight: 700 }}>{totalUpdates}</Typography>
          </Card>
          <Card sx={{ ...glassCard, p: 2, mb: 2, ...panelHover }}>
            <Typography sx={{ color: "#7dd3fc", fontWeight: 700 }}>Missing Drivers</Typography>
            <Typography sx={{ color: "#f8fafc", fontSize: 24, fontWeight: 700 }}>{missingDrivers.length}</Typography>
          </Card>
          <Card sx={{ ...glassCard, p: 2, ...panelHover }}>
            <Typography sx={{ color: "#7dd3fc", fontWeight: 700 }}>Last Scan</Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: 13, fontWeight: 500 }}>{lastScanTime || "N/A"}</Typography>
          </Card>
        </Box>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            sx={{
              color: "#bfdbfe",
              borderColor: "rgba(56, 189, 248, 0.55)",
              borderRadius: 20,
              px: 3,
              fontWeight: 700,
              "&:hover": {
                borderColor: "#67e8f9",
                backgroundColor: "rgba(8, 47, 73, 0.5)",
              },
            }}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, p: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
          <Computer sx={{ fontSize: 48, color: "#7dd3fc", mr: 1.2, filter: "drop-shadow(0 4px 12px rgba(56, 189, 248, 0.38))" }} />
          <Typography variant="h3" sx={{ color: "#e2e8f0", fontWeight: 800, letterSpacing: 0.5 }}>
            System Revamp
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: "#bae6fd" }}>
            <CircularProgress sx={{ color: "#38bdf8", mb: 2 }} />
            <Typography sx={{ animation: "pulse 1.5s infinite", "@keyframes pulse": { "0%": { opacity: 0.5 }, "50%": { opacity: 1 }, "100%": { opacity: 0.5 } }, fontWeight: 600 }}>
              Scanning system for installed apps...
            </Typography>
          </Box>
        ) : (
          <Fade in timeout={500}>
            <Box className="space-y-6">
              {selectedMenu === "overview" && (
                <>
                  <LiveSystemMonitor
                    metrics={liveMetrics}
                    riskScore={liveRiskScore}
                    alerts={securityAlerts}
                    systemInfo={systemInfo}
                  />
                  <Card sx={{ ...glassCard, p: 3, mb: 4, ...panelHover }}>
                    <Typography variant="h5" sx={{ color: "#e0e7ff", mb: 1, fontWeight: 800 }}>
                      Security Risk Overview
                    </Typography>
                    <Typography sx={{ color: "#94a3b8", mb: 3, fontWeight: 500 }}>
                      Risk distribution from software versions and critical drivers.
                    </Typography>
                    <Box sx={{ width: "100%", height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskData}>
                          <XAxis dataKey="name" stroke="#93c5fd" />
                          <YAxis stroke="#93c5fd" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              border: "1px solid rgba(56, 189, 248, 0.36)",
                              borderRadius: 8,
                              color: "#dbeafe",
                            }}
                          />
                          <Bar dataKey="risk" fill="#38bdf8" barSize={40} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Card>

                  <Card sx={{ ...glassCard, p: 3, ...panelHover }}>
                    <Typography variant="h5" sx={{ color: "#e0e7ff", mb: 1.2, fontWeight: 800 }}>
                      Offline Patch Package
                    </Typography>
                    <Typography sx={{ color: "#94a3b8", mb: 2.2, fontWeight: 500 }}>
                      Export security update metadata for air-gapped environments.
                    </Typography>
                    {downloading ? (
                      <Box>
                        <Typography sx={{ color: "#bae6fd", mb: 1, fontWeight: 600 }}>
                          Downloading {downloadLabel}... {Math.round(downloadProgress)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={downloadProgress}
                          sx={{
                            height: 10,
                            borderRadius: 6,
                            backgroundColor: "rgba(15, 23, 42, 0.85)",
                            "& .MuiLinearProgress-bar": {
                              background: "linear-gradient(90deg, #4f46e5, #22d3ee)",
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                        <Button
                          variant="contained"
                          startIcon={<CloudDownload />}
                          onClick={() => handleDownloadZip("full")}
                          sx={{
                            background: "linear-gradient(120deg, #4f46e5, #0284c7)",
                            px: 3.2,
                            py: 1.1,
                            fontWeight: 700,
                            borderRadius: 6,
                            boxShadow: "0 12px 26px rgba(37, 99, 235, 0.4)",
                            "&:hover": {
                              background: "linear-gradient(120deg, #4338ca, #0369a1)",
                              boxShadow: "0 16px 30px rgba(30, 64, 175, 0.5)",
                            },
                          }}
                        >
                          Download Full Package
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<CloudDownload />}
                          onClick={() => handleDownloadZip("delta")}
                          sx={{
                            color: "#bae6fd",
                            borderColor: "rgba(56, 189, 248, 0.55)",
                            px: 3.2,
                            py: 1.1,
                            fontWeight: 700,
                            borderRadius: 6,
                            "&:hover": {
                              borderColor: "#67e8f9",
                              backgroundColor: "rgba(8, 47, 73, 0.5)",
                            },
                          }}
                        >
                          Download Delta Pack
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={handleExportRemediationScript}
                          disabled={scriptDownloading}
                          sx={{
                            color: "#bfdbfe",
                            borderColor: "rgba(148, 163, 184, 0.5)",
                            px: 3.2,
                            py: 1.1,
                            fontWeight: 700,
                            borderRadius: 6,
                            "&:hover": {
                              borderColor: "#cbd5e1",
                              backgroundColor: "rgba(30, 41, 59, 0.45)",
                            },
                          }}
                        >
                          {scriptDownloading ? "Exporting Script..." : "Export Remediation Script"}
                        </Button>
                      </Box>
                    )}
                  </Card>
                </>
              )}

              {selectedMenu === "installed" && <InstalledAppsTable data={normalizedApps} />}

              {selectedMenu === "drivers" && (
                <MissingDrivers
                  missing={missingDrivers}
                  installed={installedDrivers}
                  riskSummary={driverRiskSummary}
                  onDownloadDrivers={handleDownloadDrivers}
                  downloadingDrivers={driversDownloading}
                />
              )}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
}

export default App;
