import React, { useState, useEffect } from "react";
import InstalledAppsTable from "./components/InstalledAppsTable";
import MissingDrivers from "./components/MissingDrivers";
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
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [missingDrivers, setMissingDrivers] = useState([]);
  const [installedDrivers, setInstalledDrivers] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState("overview");
  const [lastScanTime, setLastScanTime] = useState(null);

  // Fetch installed apps
  const fetchApps = async () => {
    setRefreshing(true);
    setLoading(true);

    try {
      // Call scanner service (8000)
      const scanRes = await fetch("http://127.0.0.1:8000/scan");
      const scanData = await scanRes.json();

      if (!scanData.apps) throw new Error("Scan failed");

      // Convert array to dictionary
      const installedDict = {};
      scanData.apps.forEach(app => {
        installedDict[app.name] = app.version;
      });

      // Call version service (8002)
      const versionRes = await fetch("http://127.0.0.1:8002/check-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installedDict)
      });

      const versionData = await versionRes.json();

      if (!versionData.apps) throw new Error("Version check failed");

      setApps(versionData.apps);
      setLastScanTime(new Date().toLocaleString());

    } catch (err) {
      console.error(err);
      setApps([]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const normalizedApps = apps.map(app => ({
    ...app,
    updateRequired: app.status?.includes("Update Available"),
  }));

  const riskData = [
    { name: "Critical", risk: missingDrivers.length * 3 },
    { name: "Moderate", risk: normalizedApps.filter(app => app.updateRequired).length },
  ];

  // Fetch drivers (missing + installed)
  const fetchDrivers = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8001/drivers");
      const data = await res.json();
      setMissingDrivers(Array.isArray(data.missingDrivers) ? data.missingDrivers : []);
      setInstalledDrivers(Array.isArray(data.installedDrivers) ? data.installedDrivers : []);
    } catch {
      setMissingDrivers([]);
      setInstalledDrivers([]);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchApps();
    fetchDrivers();
  }, []);

  const handleRefresh = () => {
    fetchApps();
    fetchDrivers();
  };

  const handleDownloadZip = () => {
    setDownloading(true);
    setDownloadProgress(0);
    let targetProgress = 0;
    let interval = setInterval(() => {
      setDownloadProgress((prev) =>
        prev < targetProgress ? prev + Math.min(1.5, targetProgress - prev) : prev
      );
    }, 50);

    fetch("http://127.0.0.1:8000/generate-offline-package")
      .then(async (response) => {
        const contentLength = response.headers.get("Content-Length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;
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
        link.setAttribute("download", "offline_update_package.zip");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert("Failed to download ZIP package"))
      .finally(() => {
        clearInterval(interval);
        setTimeout(() => {
          setDownloading(false);
          setDownloadProgress(0);
        }, 500);
      });
  };


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
      {/* Sidebar */}
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

        {/* Sidebar Stats */}
        <Box sx={{ mt: 4 }}>
          <Card sx={{ ...glassCard, p: 2, mb: 2, ...panelHover }}>
            <Typography sx={{ color: "#7dd3fc", fontWeight: 700 }}>Total Apps</Typography>
            <Typography sx={{ color: "#f8fafc", fontSize: 24, fontWeight: 700 }}>{apps.length}</Typography>
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

      {/* Main Content */}
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
              {/* Overview */}
              {selectedMenu === "overview" && (
                <>
                  <Card sx={{ ...glassCard, p: 3, mb: 4, ...panelHover }}>
                    <Typography variant="h5" sx={{ color: "#e0e7ff", mb: 1, fontWeight: 800 }}>
                      Security Risk Overview
                    </Typography>
                    <Typography sx={{ color: "#94a3b8", mb: 3, fontWeight: 500 }}>
                      Total risk based on missing drivers and updates required.
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
                      Offline Environment Sync
                    </Typography>
                    <Typography sx={{ color: "#94a3b8", mb: 2.2, fontWeight: 500 }}>
                      Download the offline update ZIP package for secure or air-gapped environments.
                    </Typography>
                    {downloading ? (
                      <Box>
                        <Typography sx={{ color: "#bae6fd", mb: 1, fontWeight: 600 }}>
                          Downloading ZIP package... {Math.round(downloadProgress)}%
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
                      <Button
                        variant="contained"
                        startIcon={<CloudDownload />}
                        onClick={handleDownloadZip}
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
                        Download ZIP Package
                      </Button>
                    )}
                  </Card>
                </>
              )}

              {/* Installed Apps */}
              {selectedMenu === "installed" && <InstalledAppsTable data={normalizedApps} />}

              {/* Missing Drivers */}
              {selectedMenu === "drivers" && (
                <MissingDrivers missing={missingDrivers} installed={installedDrivers} />
              )}
            </Box>
          </Fade>
        )}
      </Box>
    </Box>
  );
}

export default App;
