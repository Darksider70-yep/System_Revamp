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
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    boxShadow: "0 20px 40px rgba(2, 6, 23, 0.65), 0 0 20px rgba(56, 189, 248, 0.15)",
    transform: "translateY(-2px)",
    borderColor: "rgba(56, 189, 248, 0.45)",
  },
};

const glassCard = {
  background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(13, 20, 38, 0.7) 100%)",
  border: "1px solid rgba(56, 189, 248, 0.2)",
  borderRadius: "16px",
  backdropFilter: "blur(14px)",
  boxShadow: "0 14px 34px rgba(2, 6, 23, 0.55)",
};

const CustomBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          padding: "10px 14px",
          borderRadius: "10px",
          color: "#f8fafc",
          boxShadow: "0 10px 25px rgba(2, 6, 23, 0.7)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Typography sx={{ fontSize: "0.82rem", color: "#94a3b8", mb: 0.25 }}>
          Risk Level: <strong style={{ color: "#f8fafc" }}>{label}</strong>
        </Typography>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: payload[0].payload.fill || "#38bdf8" }}>
          {payload[0].value} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1" }}>score units</span>
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
    { name: "Critical Driver Risk", risk: missingDrivers.length * 3, fill: "#f43f5e" },
    { name: "Application Updates", risk: outdatedAppsCount * 2, fill: "#f59e0b" },
    { name: "Identified Threats", risk: (protectionSummary.malicious * 4) + (protectionSummary.suspicious * 2), fill: "#8b5cf6" },
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
    } catch (err) {
      alert(err?.message || "Failed to export remediation script");
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
        alert("Driver download/install triggered successfully. Windows may continue in background.");
      } else {
        alert("Driver update started, but some steps reported issues. Try running app as Administrator.");
      }

      fetchDrivers();
    } catch (err) {
      alert(toFriendlyFetchError(err, "Drivers service", "http://127.0.0.1:8001"));
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
    } catch (err) {
      alert(toFriendlyFetchError(err, "Protection service", "http://127.0.0.1:8003"));
      setProtectionResults([]);
      setProtectionSummary({ malicious: 0, suspicious: 0, clean: 0, unknown: 0, error: 0 });
    } finally {
      setProtectionScanning(false);
    }
  };

  // Calculate overall system health index (0 to 100)
  const healthDeficit = (outdatedAppsCount * 8) + (missingDrivers.length * 15) + (protectionSummary.malicious * 25);
  const systemHealthScore = Math.max(15, Math.min(100, Math.round(100 - healthDeficit)));

  const menuItems = [
    { id: "overview", label: "Overview", icon: <Dashboard /> },
    { id: "installed", label: "Installed Apps", icon: <Storage />, count: apps.length },
    { id: "drivers", label: "Kernel & Drivers", icon: <Build />, count: missingDrivers.length, badgeColor: "#f43f5e" },
    { id: "protection", label: "Software Protection", icon: <Security /> },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(56, 189, 248, 0.12), transparent), radial-gradient(ellipse 60% 40% at 80% 10%, rgba(99, 102, 241, 0.14), transparent), linear-gradient(160deg, #070b14 0%, #0a1020 50%, #060b18 100%)",
        color: "#f8fafc",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Sleek Sidebar */}
      <Box
        sx={{
          width: 280,
          flexShrink: 0,
          borderRight: "1px solid rgba(56, 189, 248, 0.15)",
          background: "linear-gradient(180deg, rgba(8, 13, 27, 0.92) 0%, rgba(6, 10, 22, 0.95) 100%)",
          py: 3.5,
          px: 2.2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backdropFilter: "blur(20px)",
          boxShadow: "10px 0 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        <Box>
          {/* Brand Logo & Tag */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 20px rgba(56, 189, 248, 0.4)",
              }}
            >
              <Computer sx={{ color: "#ffffff", fontSize: 24 }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  color: "#f8fafc",
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  letterSpacing: 0.4,
                  lineHeight: 1.1,
                }}
              >
                System Revamp
              </Typography>
              <Typography
                sx={{
                  color: "#38bdf8",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  mt: 0.3,
                }}
              >
                Security Core
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: "rgba(56, 189, 248, 0.12)", mb: 2.5 }} />

          {/* Navigation Menu */}
          <List sx={{ p: 0 }}>
            {menuItems.map((item) => {
              const isSelected = selectedMenu === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton
                    onClick={() => setSelectedMenu(item.id)}
                    sx={{
                      borderRadius: "12px",
                      px: 2,
                      py: 1.2,
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(99, 102, 241, 0.22) 100%)"
                        : "transparent",
                      border: "1px solid",
                      borderColor: isSelected ? "rgba(56, 189, 248, 0.45)" : "transparent",
                      boxShadow: isSelected ? "0 4px 20px rgba(56, 189, 248, 0.2)" : "none",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      "&:hover": {
                        backgroundColor: "rgba(56, 189, 248, 0.08)",
                        borderColor: "rgba(56, 189, 248, 0.25)",
                      },
                    }}
                  >
                    {React.cloneElement(item.icon, {
                      sx: {
                        color: isSelected ? "#38bdf8" : "#94a3b8",
                        mr: 1.75,
                        fontSize: 22,
                        filter: isSelected ? "drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))" : "none",
                      },
                    })}
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        sx: {
                          color: isSelected ? "#f8fafc" : "#94a3b8",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "0.9rem",
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
                          fontWeight: 800,
                          backgroundColor: item.badgeColor
                            ? "rgba(244, 63, 94, 0.25)"
                            : "rgba(56, 189, 248, 0.18)",
                          color: item.badgeColor ? "#fb7185" : "#7dd3fc",
                          border: `1px solid ${item.badgeColor ? "rgba(244, 63, 94, 0.4)" : "rgba(56, 189, 248, 0.3)"}`,
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
              p: 2.2,
              mb: 2,
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 16, 32, 0.85) 100%)",
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase" }}>
                Security Score
              </Typography>
              <Typography
                sx={{
                  color: systemHealthScore >= 80 ? "#34d399" : systemHealthScore >= 60 ? "#fbbf24" : "#fb7185",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                }}
              >
                {systemHealthScore}/100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={systemHealthScore}
              sx={{
                height: 6,
                borderRadius: 4,
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                "& .MuiLinearProgress-bar": {
                  background:
                    systemHealthScore >= 80
                      ? "linear-gradient(90deg, #10b981, #38bdf8)"
                      : "linear-gradient(90deg, #f43f5e, #f59e0b)",
                },
              }}
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2, pt: 1.5, borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600 }}>APPS</Typography>
                <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "0.95rem" }}>{apps.length}</Typography>
              </Box>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600 }}>DRIVERS</Typography>
                <Typography sx={{ color: missingDrivers.length ? "#fb7185" : "#34d399", fontWeight: 800, fontSize: "0.95rem" }}>
                  {missingDrivers.length ? `${missingDrivers.length} Need Fix` : "OK"}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: "#64748b", fontSize: "0.7rem", fontWeight: 600 }}>SYNC</Typography>
                <Typography sx={{ color: "#7dd3fc", fontWeight: 800, fontSize: "0.8rem", mt: 0.2 }}>
                  {lastScanTime ? lastScanTime.split(" ")[0] : "Idle"}
                </Typography>
              </Box>
            </Box>
          </Card>

          <Button
            fullWidth
            variant="outlined"
            startIcon={
              <Refresh
                sx={{
                  animation: refreshing ? "radarSpin 1s linear infinite" : "none",
                }}
              />
            }
            onClick={handleRefresh}
            disabled={refreshing}
            sx={{
              color: "#38bdf8",
              borderColor: "rgba(56, 189, 248, 0.4)",
              borderRadius: "10px",
              py: 1,
              fontWeight: 700,
              fontSize: "0.85rem",
              textTransform: "none",
              background: "rgba(56, 189, 248, 0.04)",
              "&:hover": {
                borderColor: "#38bdf8",
                backgroundColor: "rgba(56, 189, 248, 0.12)",
                boxShadow: "0 0 15px rgba(56, 189, 248, 0.25)",
              },
            }}
          >
            {refreshing ? "Scanning System..." : "Rescan System"}
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, p: { xs: 2.5, md: 4.5 }, overflowY: "auto", minWidth: 0 }}>
        {/* Top Header Bar */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 4,
            pb: 2.5,
            borderBottom: "1px solid rgba(56, 189, 248, 0.12)",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: "0.8rem", color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              Dashboard / {menuItems.find((m) => m.id === selectedMenu)?.label || "Overview"}
            </Typography>
            <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 800, letterSpacing: -0.5, mt: 0.2 }}>
              {selectedMenu === "overview" && "System Health & Security Telemetry"}
              {selectedMenu === "installed" && "Application Repository & Integrity"}
              {selectedMenu === "drivers" && "Kernel Hardware & Device Drivers"}
              {selectedMenu === "protection" && "Threat Defense & Software Verification"}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 1.75,
                py: 0.6,
                borderRadius: "999px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  boxShadow: "0 0 10px #10b981",
                }}
              />
              <Typography sx={{ color: "#34d399", fontSize: "0.78rem", fontWeight: 700, letterSpacing: 0.5 }}>
                DAEMON ONLINE
              </Typography>
            </Box>

            {lastScanTime && (
              <Typography sx={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 500 }}>
                Synced: {lastScanTime}
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
              height: "60vh",
              gap: 2,
            }}
          >
            <CircularProgress size={48} sx={{ color: "#38bdf8" }} />
            <Typography sx={{ color: "#94a3b8", fontWeight: 600, fontSize: "1rem" }}>
              Deep scanning local registry and analyzing system status...
            </Typography>
          </Box>
        ) : (
          <Fade in timeout={400}>
            <Box>
              {/* Overview View */}
              {selectedMenu === "overview" && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
                  {/* Top 4 KPI Cards Grid */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                      gap: 2.5,
                    }}
                  >
                    {/* Card 1: Total Apps */}
                    <Card sx={{ ...glassCard, p: 2.5, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>
                          Monitored Apps
                        </Typography>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "rgba(56, 189, 248, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#38bdf8",
                          }}
                        >
                          <Storage sx={{ fontSize: 20 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: "#f8fafc", fontSize: "2rem", fontWeight: 800, mt: 1 }}>
                        {apps.length}
                      </Typography>
                      <Typography sx={{ color: "#34d399", fontSize: "0.78rem", fontWeight: 600, mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                        <CheckCircle sx={{ fontSize: 13 }} /> System catalog active
                      </Typography>
                    </Card>

                    {/* Card 2: Outdated Apps */}
                    <Card sx={{ ...glassCard, p: 2.5, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>
                          Pending Updates
                        </Typography>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "rgba(245, 158, 11, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fbbf24",
                          }}
                        >
                          <WarningAmber sx={{ fontSize: 20 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: outdatedAppsCount > 0 ? "#fbbf24" : "#f8fafc", fontSize: "2rem", fontWeight: 800, mt: 1 }}>
                        {outdatedAppsCount}
                      </Typography>
                      <Typography sx={{ color: outdatedAppsCount > 0 ? "#fbbf24" : "#34d399", fontSize: "0.78rem", fontWeight: 600, mt: 0.5 }}>
                        {outdatedAppsCount > 0 ? "Patches available for install" : "All apps up-to-date"}
                      </Typography>
                    </Card>

                    {/* Card 3: Missing Drivers */}
                    <Card sx={{ ...glassCard, p: 2.5, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>
                          Missing Drivers
                        </Typography>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "rgba(244, 63, 94, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fb7185",
                          }}
                        >
                          <Build sx={{ fontSize: 20 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: missingDrivers.length > 0 ? "#fb7185" : "#f8fafc", fontSize: "2rem", fontWeight: 800, mt: 1 }}>
                        {missingDrivers.length}
                      </Typography>
                      <Typography sx={{ color: missingDrivers.length > 0 ? "#fb7185" : "#34d399", fontSize: "0.78rem", fontWeight: 600, mt: 0.5 }}>
                        {missingDrivers.length > 0 ? "Hardware risk detected" : "All drivers verified"}
                      </Typography>
                    </Card>

                    {/* Card 4: Security Health */}
                    <Card sx={{ ...glassCard, p: 2.5, ...panelHover }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase" }}>
                          Security Index
                        </Typography>
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            backgroundColor: "rgba(99, 102, 241, 0.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#818cf8",
                          }}
                        >
                          <ShieldOutlined sx={{ fontSize: 20 }} />
                        </Box>
                      </Box>
                      <Typography sx={{ color: "#f8fafc", fontSize: "2rem", fontWeight: 800, mt: 1 }}>
                        {systemHealthScore}%
                      </Typography>
                      <Typography sx={{ color: "#38bdf8", fontSize: "0.78rem", fontWeight: 600, mt: 0.5 }}>
                        {systemHealthScore >= 80 ? "Shield status: Optimal" : "Attention recommended"}
                      </Typography>
                    </Card>
                  </Box>

                  {/* Security Risk Bar Chart Card */}
                  <Card sx={{ ...glassCard, p: 3, ...panelHover }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.15rem" }}>
                          Security & Vulnerability Risk Vector
                        </Typography>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.2 }}>
                          Weighted risk distribution aggregated from unpatched applications and unverified kernel drivers.
                        </Typography>
                      </Box>
                      <Chip
                        label="Live Telemetry"
                        size="small"
                        sx={{
                          backgroundColor: "rgba(56, 189, 248, 0.12)",
                          color: "#7dd3fc",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          fontWeight: 700,
                        }}
                      />
                    </Box>

                    <Box sx={{ width: "100%", height: 280, mt: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }} />
                          <YAxis stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip content={<CustomBarTooltip />} />
                          <Bar dataKey="risk" radius={[8, 8, 0, 0]} barSize={44}>
                            {riskData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.fill}
                                style={{
                                  filter: `drop-shadow(0 0 10px ${entry.fill}66)`,
                                }}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Card>

                  {/* Offline Environment Synchronization Card */}
                  <Card sx={{ ...glassCard, p: 3.5, ...panelHover }}>
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2.5, flexWrap: "wrap", mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "14px",
                          background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.25) 100%)",
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#38bdf8",
                          flexShrink: 0,
                          boxShadow: "0 0 20px rgba(56, 189, 248, 0.25)",
                        }}
                      >
                        <FolderZip sx={{ fontSize: 26 }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.15rem" }}>
                          Air-Gapped & Offline Environment Sync
                        </Typography>
                        <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.3, maxWidth: 650 }}>
                          Generate offline portable deployment archives and remediation scripts for isolated, air-gapped, or restricted intranet workstations.
                        </Typography>
                      </Box>
                    </Box>

                    {downloading ? (
                      <Box sx={{ p: 2.5, borderRadius: "12px", background: "rgba(15, 23, 42, 0.6)", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                          <Typography sx={{ color: "#38bdf8", fontWeight: 700, fontSize: "0.9rem" }}>
                            Generating & Downloading {downloadLabel}...
                          </Typography>
                          <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                            {Math.round(downloadProgress)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={downloadProgress}
                          sx={{
                            height: 10,
                            borderRadius: 6,
                            backgroundColor: "rgba(15, 23, 42, 0.9)",
                            "& .MuiLinearProgress-bar": {
                              background: "linear-gradient(90deg, #6366f1, #38bdf8, #10b981)",
                              boxShadow: "0 0 12px rgba(56, 189, 248, 0.6)",
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
                            background: "linear-gradient(135deg, #6366f1 0%, #0284c7 100%)",
                            color: "#ffffff",
                            px: 3,
                            py: 1.2,
                            fontWeight: 800,
                            fontSize: "0.88rem",
                            borderRadius: "10px",
                            boxShadow: "0 4px 20px rgba(99, 102, 241, 0.35)",
                            border: "1px solid rgba(56, 189, 248, 0.4)",
                            transition: "all 0.25s ease",
                            "&:hover": {
                              background: "linear-gradient(135deg, #4f46e5 0%, #0369a1 100%)",
                              boxShadow: "0 6px 25px rgba(99, 102, 241, 0.5)",
                              transform: "translateY(-1px)",
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
                            color: "#7dd3fc",
                            borderColor: "rgba(56, 189, 248, 0.4)",
                            px: 3,
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            borderRadius: "10px",
                            background: "rgba(56, 189, 248, 0.05)",
                            "&:hover": {
                              borderColor: "#38bdf8",
                              backgroundColor: "rgba(56, 189, 248, 0.12)",
                              boxShadow: "0 0 16px rgba(56, 189, 248, 0.25)",
                              transform: "translateY(-1px)",
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
                            color: "#cbd5e1",
                            borderColor: "rgba(148, 163, 184, 0.3)",
                            px: 3,
                            py: 1.2,
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            borderRadius: "10px",
                            background: "rgba(15, 23, 42, 0.6)",
                            "&:hover": {
                              borderColor: "#f8fafc",
                              backgroundColor: "rgba(30, 41, 59, 0.6)",
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          {scriptDownloading ? "Exporting PowerShell..." : "Export Remediation Script (.ps1)"}
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
      </Box>
    </Box>
  );
}

export default App;
