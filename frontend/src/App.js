import React, { useState, useEffect } from "react";
import InstalledAppsTable from "./components/InstalledAppsTable";
import MissingDrivers from "./components/MissingDrivers";
import ProtectionCenter from "./components/ProtectionCenter";
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
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  CloudDownload,
  Refresh,
  Computer,
  Dashboard,
  Storage,
  Build,
  Security,
  ShieldOutlined,
  Code,
  CheckCircle,
  WarningAmber,
  FolderZip,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

const panelHover = {
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    borderColor: "rgba(16, 185, 129, 0.35)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
  },
};

const glassCard = {
  backgroundColor: "#121824",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: "#161f2e",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          padding: "8px 12px",
          borderRadius: "8px",
          color: "#f8fafc",
          boxShadow: "0 8px 20px rgba(0, 0, 0, 0.5)",
        }}
      >
        <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8", mb: 0.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: payload[0].payload.fill || "#10b981" }}>
          {payload[0].value} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#94a3b8" }}>risk units</span>
        </Typography>
      </Box>
    );
  }
  return null;
};

function App() {
  const PROTECTION_SCAN_ENDPOINTS = [
    "http://127.0.0.1:8003/protection/scan",
    "http://127.0.0.1:8013/protection/scan",
  ];
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("ZIP package");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [scriptDownloading, setScriptDownloading] = useState(false);
  const [driversDownloading, setDriversDownloading] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const showToast = (message, severity = "info") => {
    setToast({ open: true, message, severity });
  };

  const handleCloseToast = (event, reason) => {
    if (reason === "clickaway") return;
    setToast((prev) => ({ ...prev, open: false }));
  };
  const [refreshing, setRefreshing] = useState(false);

  const [missingDrivers, setMissingDrivers] = useState([]);
  const [installedDrivers, setInstalledDrivers] = useState([]);
  const [driverRiskSummary, setDriverRiskSummary] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [protectionResults, setProtectionResults] = useState([]);
  const [protectionSummary, setProtectionSummary] = useState({ malicious: 0, suspicious: 0, clean: 0, unknown: 0, error: 0 });
  const [protectionScanning, setProtectionScanning] = useState(false);
  const [lastProtectionScan, setLastProtectionScan] = useState(null);
  const [selectedMenu, setSelectedMenu] = useState("overview");
  const [lastScanTime, setLastScanTime] = useState(null);

  const toFriendlyFetchError = (err, serviceName, endpoint) => {
    const msg = err?.message || "";
    if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
      return `${serviceName} is unreachable at ${endpoint}. Start the service and try again.`;
    }
    return msg || `Request to ${serviceName} failed.`;
  };

  // Fetch installed apps
  const fetchApps = async () => {
    setRefreshing(true);
    setLoading(true);

    try {
      const scanRes = await fetch("http://127.0.0.1:8000/scan");
      const scanData = await scanRes.json();

      if (!scanData.apps) throw new Error("Scan failed");

      const installedDict = {};
      scanData.apps.forEach((app) => {
        installedDict[app.name] = app.version;
      });

      const versionRes = await fetch("http://127.0.0.1:8002/check-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installedDict),
      });

      const versionData = await versionRes.json();
      if (!versionData.apps) throw new Error("Version check failed");

      setApps(versionData.apps);
      setLastScanTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error(err);
      setApps([]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const normalizedApps = apps.map((app) => ({
    ...app,
    updateRequired: app.status?.includes("Update Available"),
  }));

  const outdatedAppsCount = normalizedApps.filter((app) => app.updateRequired).length;

  const riskData = [
    { name: "Critical Drivers", risk: missingDrivers.length * 3, fill: "#ef4444" },
    { name: "Outdated Apps", risk: outdatedAppsCount * 2, fill: "#f59e0b" },
    { name: "Threat Flags", risk: (protectionSummary.malicious * 4) + (protectionSummary.suspicious * 2), fill: "#10b981" },
  ];

  // Fetch drivers (missing + installed)
  const fetchDrivers = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8001/drivers");
      const data = await res.json();
      setMissingDrivers(Array.isArray(data.missingDrivers) ? data.missingDrivers : []);
      setInstalledDrivers(Array.isArray(data.installedDrivers) ? data.installedDrivers : []);
      setDriverRiskSummary(data.riskSummary || { critical: 0, high: 0, medium: 0, low: 0 });
    } catch {
      setMissingDrivers([]);
      setInstalledDrivers([]);
      setDriverRiskSummary({ critical: 0, high: 0, medium: 0, low: 0 });
    }
  };

  useEffect(() => {
    fetchApps();
    fetchDrivers();
  }, []);

  const handleRefresh = () => {
    fetchApps();
    fetchDrivers();
  };

  const handleDownloadZip = (mode = "full") => {
    setDownloading(true);
    setDownloadLabel(mode === "delta" ? "delta package" : "ZIP package");
    setDownloadProgress(0);
    let targetProgress = 0;
    let interval = setInterval(() => {
      setDownloadProgress((prev) =>
        prev < targetProgress ? prev + Math.min(1.5, targetProgress - prev) : prev
      );
    }, 50);

    fetch(`http://127.0.0.1:8000/generate-offline-package?mode=${mode}`)
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
      .catch((err) => showToast(err?.message || "Failed to download ZIP package", "error"))
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

      const res = await fetch("http://127.0.0.1:8000/generate-remediation-script", {
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
      showToast("Remediation script exported successfully.", "success");
    } catch (err) {
      showToast(err?.message || "Failed to export remediation script", "error");
    } finally {
      setScriptDownloading(false);
    }
  };

  const handleDownloadDrivers = async () => {
    try {
      setDriversDownloading(true);
      const res = await fetch("http://127.0.0.1:8001/drivers/download", {
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

      const failed = Array.isArray(data.steps)
        ? data.steps.filter((step) => step.returnCode !== 0)
        : [];

      if (failed.length === 0) {
        showToast("Driver download/install triggered successfully. Windows may continue in background.", "success");
      } else {
        showToast(data?.message || "Driver update started, but some steps reported issues. Try running app as Administrator.", "warning");
      }

      fetchDrivers();
    } catch (err) {
      showToast(toFriendlyFetchError(err, "Drivers service", "http://127.0.0.1:8001"), "error");
    } finally {
      setDriversDownloading(false);
    }
  };

  const handleProtectionScan = async () => {
    try {
      setProtectionScanning(true);
      const payload = {
        apps: normalizedApps.map((app) => ({ name: app.name, version: app.current })),
        maxApps: 20,
      };

      let data = null;
      let lastError = null;
      for (const endpoint of PROTECTION_SCAN_ENDPOINTS) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const parsed = await res.json();
          if (!res.ok) {
            lastError = new Error(parsed?.error || `Protection scan failed at ${endpoint} with status ${res.status}`);
            continue;
          }
          data = parsed;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!data) {
        throw lastError || new Error("Protection scan failed on all endpoints.");
      }

      setProtectionResults(Array.isArray(data.results) ? data.results : []);
      setProtectionSummary(data.summary || { malicious: 0, suspicious: 0, clean: 0, unknown: 0, error: 0 });
      setLastProtectionScan(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast("Software protection scan completed.", "success");
    } catch (err) {
      showToast(toFriendlyFetchError(err, "Protection service", "http://127.0.0.1:8003"), "error");
      setProtectionResults([]);
      setProtectionSummary({ malicious: 0, suspicious: 0, clean: 0, unknown: 0, error: 0 });
    } finally {
      setProtectionScanning(false);
    }
  };

  const healthDeficit = (outdatedAppsCount * 8) + (missingDrivers.length * 15) + (protectionSummary.malicious * 25);
  const systemHealthScore = Math.max(15, Math.min(100, Math.round(100 - healthDeficit)));

  const menuItems = [
    { id: "overview", label: "Overview", icon: <Dashboard /> },
    { id: "installed", label: "Installed Apps", icon: <Storage />, count: apps.length },
    { id: "drivers", label: "Kernel & Drivers", icon: <Build />, count: missingDrivers.length, badgeColor: "#ef4444" },
    { id: "protection", label: "Software Protection", icon: <Security /> },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#0b0f17",
        color: "#f1f5f9",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: 270,
          flexShrink: 0,
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#0e131f",
          py: 3,
          px: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Box>
          {/* Brand Logo & Tag */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1, mb: 3 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                backgroundColor: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Computer sx={{ color: "#ffffff", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  color: "#f8fafc",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  letterSpacing: 0.2,
                  lineHeight: 1.1,
                }}
              >
                System Revamp
              </Typography>
              <Typography
                sx={{
                  color: "#10b981",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  mt: 0.2,
                }}
              >
                Security Core
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.06)", mb: 2 }} />

          {/* Navigation Menu */}
          <List sx={{ p: 0 }}>
            {menuItems.map((item) => {
              const isSelected = selectedMenu === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.8 }}>
                  <ListItemButton
                    onClick={() => setSelectedMenu(item.id)}
                    sx={{
                      borderRadius: "10px",
                      px: 2,
                      py: 1.1,
                      backgroundColor: isSelected ? "rgba(16, 185, 129, 0.12)" : "transparent",
                      border: "1px solid",
                      borderColor: isSelected ? "rgba(16, 185, 129, 0.3)" : "transparent",
                      transition: "all 0.15s ease-in-out",
                      "&:hover": {
                        backgroundColor: isSelected ? "rgba(16, 185, 129, 0.16)" : "rgba(255, 255, 255, 0.04)",
                      },
                    }}
                  >
                    {React.cloneElement(item.icon, {
                      sx: {
                        color: isSelected ? "#10b981" : "#94a3b8",
                        mr: 1.5,
                        fontSize: 20,
                      },
                    })}
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        sx: {
                          color: isSelected ? "#ffffff" : "#94a3b8",
                          fontWeight: isSelected ? 600 : 500,
                          fontSize: "0.88rem",
                        },
                      }}
                    />
                    {item.count !== undefined && item.count > 0 && (
                      <Chip
                        label={item.count}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          backgroundColor: item.badgeColor
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(16, 185, 129, 0.2)",
                          color: item.badgeColor ? "#f87171" : "#34d399",
                          border: `1px solid ${item.badgeColor ? "rgba(239, 68, 68, 0.35)" : "rgba(16, 185, 129, 0.35)"}`,
                        }}
                      />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Sidebar Telemetry & Refresh */}
        <Box>
          <Card
            sx={{
              ...glassCard,
              p: 2,
              mb: 2,
              backgroundColor: "#121824",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase" }}>
                Security Score
              </Typography>
              <Typography
                sx={{
                  color: systemHealthScore >= 80 ? "#10b981" : systemHealthScore >= 60 ? "#f59e0b" : "#ef4444",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                }}
              >
                {systemHealthScore}/100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={systemHealthScore}
              sx={{
                height: 5,
                borderRadius: 3,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                "& .MuiLinearProgress-bar": {
                  backgroundColor: systemHealthScore >= 80 ? "#10b981" : systemHealthScore >= 60 ? "#f59e0b" : "#ef4444",
                },
              }}
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.8, pt: 1.5, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 600 }}>APPS</Typography>
                <Typography sx={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.9rem" }}>{apps.length}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 600 }}>DRIVERS</Typography>
                <Typography sx={{ color: missingDrivers.length ? "#ef4444" : "#10b981", fontWeight: 700, fontSize: "0.9rem" }}>
                  {missingDrivers.length ? `${missingDrivers.length} Missing` : "OK"}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.68rem", fontWeight: 600 }}>STATUS</Typography>
                <Typography sx={{ color: "#10b981", fontWeight: 700, fontSize: "0.8rem", mt: 0.2 }}>
                  Active
                </Typography>
              </Box>
            </Box>
          </Card>

          <Button
            fullWidth
            variant="outlined"
            startIcon={<Refresh sx={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />}
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
              color: "#10b981",
              borderColor: "rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              py: 0.9,
              fontWeight: 600,
              fontSize: "0.82rem",
              textTransform: "none",
              backgroundColor: "rgba(16, 185, 129, 0.04)",
              "&:hover": {
                borderColor: "#10b981",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
              },
            }}
          >
            {refreshing ? "Scanning System..." : "Rescan System"}
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, p: { xs: 2.5, md: 4 }, overflowY: "auto", minWidth: 0 }}>
        {/* Top Header Bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3.5,
            pb: 2,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Dashboard / {menuItems.find((m) => m.id === selectedMenu)?.label || "Overview"}
            </Typography>
            <Typography variant="h5" sx={{ color: "#f8fafc", fontWeight: 700, letterSpacing: -0.3, mt: 0.2 }}>
              {selectedMenu === "overview" && "System Health & Security Overview"}
              {selectedMenu === "installed" && "Installed Applications"}
              {selectedMenu === "drivers" && "Kernel Hardware & Device Drivers"}
              {selectedMenu === "protection" && "Software Protection Center"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: "999px",
                backgroundColor: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                }}
              />
              <Typography sx={{ color: "#34d399", fontSize: "0.75rem", fontWeight: 600 }}>
                DAEMON ONLINE
              </Typography>
            </Box>

            {lastScanTime && (
              <Typography sx={{ color: "#64748b", fontSize: "0.78rem" }}>
                Last Synced: {lastScanTime}
              </Typography>
            )}
          </Box>
        </Box>

        {loading ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "55vh",
              gap: 2,
            }}
          >
            <CircularProgress size={40} sx={{ color: "#10b981" }} />
            <Typography sx={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.95rem" }}>
              Scanning local registry and verifying system status...
            </Typography>
          </Box>
        ) : (
          <Fade in timeout={300}>
            <Box>
              {/* Overview View */}
              {selectedMenu === "overview" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {/* Top 4 KPI Cards Grid */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                      gap: 2,
                    }}
                  >
                    {/* Card 1: Total Apps */}
                    <Card sx={{ ...glassCard, p: 2.2, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
                          Monitored Apps
                        </Typography>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#10b981",
                          }}
                        >
                          <Storage sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: "#f8fafc", fontSize: "1.75rem", fontWeight: 700, mt: 0.8 }}>
                        {apps.length}
                      </Typography>
                      <Typography sx={{ color: "#10b981", fontSize: "0.75rem", fontWeight: 500, mt: 0.4, display: "flex", alignItems: "center", gap: 0.4 }}>
                        <CheckCircle sx={{ fontSize: 12 }} /> Inventory verified
                      </Typography>
                    </Card>

                    {/* Card 2: Outdated Apps */}
                    <Card sx={{ ...glassCard, p: 2.2, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
                          Pending Updates
                        </Typography>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            backgroundColor: "rgba(245, 158, 11, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#f59e0b",
                          }}
                        >
                          <WarningAmber sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: outdatedAppsCount > 0 ? "#f59e0b" : "#f8fafc", fontSize: "1.75rem", fontWeight: 700, mt: 0.8 }}>
                        {outdatedAppsCount}
                      </Typography>
                      <Typography sx={{ color: outdatedAppsCount > 0 ? "#f59e0b" : "#10b981", fontSize: "0.75rem", fontWeight: 500, mt: 0.4 }}>
                        {outdatedAppsCount > 0 ? "Updates available" : "All apps up to date"}
                      </Typography>
                    </Card>

                    {/* Card 3: Missing Drivers */}
                    <Card sx={{ ...glassCard, p: 2.2, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
                          Missing Drivers
                        </Typography>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            backgroundColor: "rgba(239, 68, 68, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#ef4444",
                          }}
                        >
                          <Build sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: missingDrivers.length > 0 ? "#ef4444" : "#f8fafc", fontSize: "1.75rem", fontWeight: 700, mt: 0.8 }}>
                        {missingDrivers.length}
                      </Typography>
                      <Typography sx={{ color: missingDrivers.length > 0 ? "#ef4444" : "#10b981", fontSize: "0.75rem", fontWeight: 500, mt: 0.4 }}>
                        {missingDrivers.length > 0 ? "Hardware risk flagged" : "All drivers verified"}
                      </Typography>
                    </Card>

                    {/* Card 4: Security Health */}
                    <Card sx={{ ...glassCard, p: 2.2, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
                          Security Index
                        </Typography>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            backgroundColor: "rgba(16, 185, 129, 0.12)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#10b981",
                          }}
                        >
                          <ShieldOutlined sx={{ fontSize: 18 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: "#f8fafc", fontSize: "1.75rem", fontWeight: 700, mt: 0.8 }}>
                        {systemHealthScore}%
                      </Typography>
                      <Typography sx={{ color: systemHealthScore >= 80 ? "#10b981" : "#f59e0b", fontSize: "0.75rem", fontWeight: 500, mt: 0.4 }}>
                        {systemHealthScore >= 80 ? "Status: Optimal" : "Attention needed"}
                      </Typography>
                    </Card>
                  </Box>

                  {/* Security Risk Bar Chart Card */}
                  <Card sx={{ ...glassCard, p: 3, ...panelHover }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.05rem" }}>
                          Security & Vulnerability Risk Vector
                        </Typography>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.2 }}>
                          Calculated from unpatched applications, missing kernel drivers, and protection flags.
                        </Typography>
                      </Box>
                      <Chip
                        label="Live Status"
                        size="small"
                        sx={{
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          color: "#10b981",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          fontWeight: 600,
                          fontSize: "0.72rem",
                        }}
                      />
                    </Box>

                    <Box sx={{ width: "100%", height: 260, mt: 1 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 500 }} />
                          <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CustomBarTooltip />} />
                          <Bar dataKey="risk" radius={[6, 6, 0, 0]} barSize={38}>
                            {riskData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Card>

                  {/* Offline Environment Synchronization Card */}
                  <Card sx={{ ...glassCard, p: 3, ...panelHover }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap", mb: 2 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          backgroundColor: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#10b981",
                          flexShrink: 0,
                        }}
                      >
                        <FolderZip sx={{ fontSize: 22 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.05rem" }}>
                          Air-Gapped & Offline Environment Sync
                        </Typography>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.2, maxWidth: 650 }}>
                          Download portable offline deployment packages and remediation scripts for air-gapped or restricted workstations.
                        </Typography>
                      </Box>
                    </Box>

                    {downloading ? (
                      <Box sx={{ p: 2, borderRadius: "8px", backgroundColor: "#0e131f", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Typography sx={{ color: "#10b981", fontWeight: 600, fontSize: "0.85rem" }}>
                            Downloading {downloadLabel}...
                          </Typography>
                          <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                            {Math.round(downloadProgress)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={downloadProgress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            "& .MuiLinearProgress-bar": {
                              backgroundColor: "#10b981",
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
                        <Button
                          variant="contained"
                          startIcon={<CloudDownload />}
                          onClick={() => handleDownloadZip("full")}
                          sx={{
                            backgroundColor: "#10b981",
                            color: "#ffffff",
                            px: 2.5,
                            py: 1,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            borderRadius: "8px",
                            textTransform: "none",
                            boxShadow: "none",
                            "&:hover": {
                              backgroundColor: "#059669",
                              boxShadow: "none",
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
                            color: "#10b981",
                            borderColor: "rgba(16, 185, 129, 0.35)",
                            px: 2.5,
                            py: 1,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            borderRadius: "8px",
                            textTransform: "none",
                            backgroundColor: "rgba(16, 185, 129, 0.04)",
                            "&:hover": {
                              borderColor: "#10b981",
                              backgroundColor: "rgba(16, 185, 129, 0.1)",
                            },
                          }}
                        >
                          Download Delta Pack
                        </Button>

                        <Button
                          variant="outlined"
                          startIcon={<Code />}
                          onClick={handleExportRemediationScript}
                          disabled={scriptDownloading}
                          sx={{
                            color: "#94a3b8",
                            borderColor: "rgba(255, 255, 255, 0.12)",
                            px: 2.5,
                            py: 1,
                            fontWeight: 600,
                            fontSize: "0.85rem",
                            borderRadius: "8px",
                            textTransform: "none",
                            backgroundColor: "transparent",
                            "&:hover": {
                              borderColor: "rgba(255, 255, 255, 0.25)",
                              color: "#f1f5f9",
                              backgroundColor: "rgba(255, 255, 255, 0.04)",
                            },
                          }}
                        >
                          {scriptDownloading ? "Exporting Script..." : "Export Remediation Script (.ps1)"}
                        </Button>
                      </Box>
                    )}
                  </Card>
                </Box>
              )}

              {/* Installed Apps View */}
              {selectedMenu === "installed" && <InstalledAppsTable data={normalizedApps} />}

              {/* Drivers View */}
              {selectedMenu === "drivers" && (
                <MissingDrivers
                  missing={missingDrivers}
                  installed={installedDrivers}
                  riskSummary={driverRiskSummary}
                  onDownloadDrivers={handleDownloadDrivers}
                  downloadingDrivers={driversDownloading}
                />
              )}

              {/* Software Protection View */}
              {selectedMenu === "protection" && (
                <ProtectionCenter
                  results={protectionResults}
                  summary={protectionSummary}
                  onScan={handleProtectionScan}
                  scanning={protectionScanning}
                  lastScanTime={lastProtectionScan}
                />
              )}
            </Box>
          </Fade>
        )}

        {/* Modern Toast Notification */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4500}
          onClose={handleCloseToast}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleCloseToast}
            severity={toast.severity}
            variant="filled"
            sx={{
              width: "100%",
              borderRadius: "10px",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
              fontWeight: 600,
              fontSize: "0.85rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}

export default App;
