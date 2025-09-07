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
  ListItemText,
} from "@mui/material";
import { CloudDownload, Refresh, Computer, Dashboard, Storage, Build } from "@mui/icons-material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const hoverGlow = {
  transition: "box-shadow 0.3s ease, transform 0.3s ease",
  "&:hover": {
    boxShadow: "0 0 25px rgba(0, 255, 255, 0.8)",
    transform: "translateY(-3px)",
  },
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
      const res = await fetch("http://127.0.0.1:8000/scan");
      const data = await res.json();
      const appsData = Array.isArray(data) ? data : Array.isArray(data.apps) ? data.apps : [];
      setApps(appsData);
      setLastScanTime(new Date().toLocaleString());
    } catch {
      setApps([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  

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

  const riskData = [
    { name: "Critical", risk: missingDrivers.length * 3 },
    { name: "Moderate", risk: apps.filter((app) => app.updateRequired).length },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", color: "#fff" }}>
      {/* Sidebar */}
      <Box sx={{ width: 240, borderRight: "1px solid rgba(0,255,255,0.3)", backgroundColor: "rgba(0,0,0,0.6)", py: 4, px: 2 }}>
        <Typography variant="h5" sx={{ color: "#00ffff", fontWeight: "bold", mb: 3, textAlign: "center" }}>Dashboard</Typography>
        <Divider sx={{ borderColor: "rgba(0,255,255,0.3)", mb: 2 }} />
        <List>
          {[
            { id: "overview", label: "Overview", icon: <Dashboard /> },
            { id: "installed", label: "Installed Apps", icon: <Storage /> },
            { id: "drivers", label: "Missing Drivers", icon: <Build /> },
          ].map((item) => (
            <ListItem key={item.id} button onClick={() => setSelectedMenu(item.id)}
              sx={{
                borderRadius: "10px",
                mb: 1,
                px: 2,
                py: 1,
                backgroundColor: selectedMenu === item.id ? "rgba(0,255,255,0.2)" : "transparent",
                "&:hover": { backgroundColor: "rgba(0,255,255,0.15)" }
              }}>
              {React.cloneElement(item.icon, { sx: { color: "#00ffff", mr: 2 } })}
              <ListItemText primary={item.label} sx={{ color: "#fff" }} />
            </ListItem>
          ))}
        </List>

        {/* Sidebar Stats */}
        <Box sx={{ mt: 4 }}>
          <Card sx={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #00ffff", borderRadius: 2, p: 2, mb: 2, ...hoverGlow }}>
            <Typography sx={{ color: "#00ffff", fontWeight: "bold" }}>Total Apps</Typography>
            <Typography sx={{ color: "#ccc", fontSize: 18 }}>{apps.length}</Typography>
          </Card>
          <Card sx={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #00ffff", borderRadius: 2, p: 2, mb: 2, ...hoverGlow }}>
            <Typography sx={{ color: "#00ffff", fontWeight: "bold" }}>Missing Drivers</Typography>
            <Typography sx={{ color: "#ccc", fontSize: 18 }}>{missingDrivers.length}</Typography>
          </Card>
          <Card sx={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #00ffff", borderRadius: 2, p: 2, ...hoverGlow }}>
            <Typography sx={{ color: "#00ffff", fontWeight: "bold" }}>Last Scan</Typography>
            <Typography sx={{ color: "#ccc", fontSize: 14 }}>{lastScanTime || "N/A"}</Typography>
          </Card>
        </Box>

        <Box sx={{ mt: 4, textAlign: "center" }}>
          <Button startIcon={<Refresh />} onClick={handleRefresh} sx={{ color: "#00ffff", borderColor: "#00ffff", borderRadius: "20px", px: 3, fontWeight: "bold", "&:hover": { backgroundColor: "rgba(0,255,255,0.2)" } }} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
          <Computer sx={{ fontSize: 50, color: "#00ffff", mr: 1, filter: "drop-shadow(0 0 5px #00ffff)" }} />
          <Typography variant="h3" sx={{ color: "#00ffff", fontWeight: "bold", letterSpacing: "1px" }}>System Revamp</Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "70vh", color: "#00ffff" }}>
            <CircularProgress sx={{ color: "#00ffff", mb: 2 }} />
            <Typography sx={{ animation: "pulse 1.5s infinite", "@keyframes pulse": { "0%": { opacity: 0.5 }, "50%": { opacity: 1 }, "100%": { opacity: 0.5 } } }}>Scanning system for installed apps...</Typography>
          </Box>
        ) : (
          <Fade in timeout={500}>
            <Box className="space-y-6">
              {/* Overview */}
              {selectedMenu === "overview" && (
                <>
                  <Card sx={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #00ffff", borderRadius: 2, p: 3, mb: 4, ...hoverGlow }}>
                    <Typography variant="h5" sx={{ color: "#00ffff", mb: 3, fontWeight: "bold" }}>Security Risk Overview</Typography>
                    <Typography sx={{ color: "#ccc", mb: 3 }}>Total risk based on missing drivers and updates required:</Typography>
                    <Box sx={{ width: "100%", height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskData}>
                          <XAxis dataKey="name" stroke="#00ffff" />
                          <YAxis stroke="#00ffff" />
                          <Tooltip contentStyle={{ backgroundColor: "rgba(0,0,0,0.7)", border: "none", color: "#fff" }} />
                          <Bar dataKey="risk" fill="#00ffff" barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Card>

                  <Card sx={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid #00ffff", borderRadius: 2, p: 3, ...hoverGlow }}>
                    <Typography variant="h5" sx={{ color: "#00ffff", mb: 2, fontWeight: "bold" }}>Offline Environment Sync</Typography>
                    <Typography sx={{ color: "#ccc", mb: 2 }}>Download the offline update ZIP package for secure or air-gapped environments.</Typography>
                    {downloading ? (
                      <Box>
                        <Typography sx={{ color: "#00ffff", mb: 1 }}>Downloading ZIP package... {Math.round(downloadProgress)}%</Typography>
                        <LinearProgress variant="determinate" value={downloadProgress} sx={{ height: 8, borderRadius: 5, backgroundColor: "#111", "& .MuiLinearProgress-bar": { backgroundColor: "#00ffff" } }} />
                      </Box>
                    ) : (
                      <Button startIcon={<CloudDownload />} onClick={handleDownloadZip} sx={{ backgroundColor: "#00ffff", px: 3, py: 1, fontWeight: "bold", borderRadius: 5, boxShadow: "0 0 15px rgba(0,255,255,0.7)", "&:hover": { backgroundColor: "#00bcd4", boxShadow: "0 0 25px rgba(0,255,255,1)" } }}>Download ZIP Package</Button>
                    )}
                  </Card>
                </>
              )}

              {/* Installed Apps */}
              {selectedMenu === "installed" && <InstalledAppsTable data={apps} />}

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
