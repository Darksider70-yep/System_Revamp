import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  AppBar,
  Toolbar,
  Button,
  Tabs,
  Tab,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  IconButton,
  CircularProgress,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Domain,
  Build,
  Security,
  Assessment,
  Logout,
  Refresh,
} from "@mui/icons-material";

import { api } from "./api/client";
import FleetOverview from "./components/FleetOverview";
import LabHierarchy from "./components/LabHierarchy";
import DeviceDetail from "./components/DeviceDetail";
import RemediationCenter from "./components/RemediationCenter";
import ComplianceExport from "./components/ComplianceExport";
import ExposureAssessment from "./components/ExposureAssessment";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
  const [loginEmail, setLoginEmail] = useState("admin@systemrevamp.local");
  const [loginPassword, setLoginPassword] = useState("Admin@123456");
  const [totpCode, setTotpCode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [labs, setLabs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [recentCommands, setRecentCommands] = useState([]);

  const loadFleetData = async () => {
    if (!api.isAuthenticated()) return;
    setLoading(true);
    try {
      const [ov, lb, dv, cmds] = await Promise.all([
        api.getFleetOverview(),
        api.getLabs(),
        api.getDevices(),
        api.request("/api/v2/commands/list?limit=15"),
      ]);
      setOverview(ov);
      setLabs(lb || []);
      setDevices(dv || []);
      setRecentCommands(cmds || []);
    } catch (e) {
      console.error("Failed to load fleet data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadFleetData();
      const timer = setInterval(loadFleetData, 30000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await api.login(loginEmail, loginPassword, totpCode || null);
      if (res.access_token) {
        api.setSession(res.access_token, res.refresh_token, res.user);
        setIsAuthenticated(true);
      } else {
        setLoginError(res.detail || "Authentication failed.");
      }
    } catch (err) {
      setLoginError("Could not connect to fleet server.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    api.clearSession();
    setIsAuthenticated(false);
  };

  const handleSelectDevice = async (deviceId) => {
    setSelectedDeviceId(deviceId);
    try {
      const dev = await api.getDeviceDetail(deviceId);
      setSelectedDevice(dev);
    } catch (e) {
      console.error("Failed to fetch device detail:", e);
    }
  };

  const handleQueueCommand = async (targetType, targetId, commandType, params, dryRun, requiresApproval = false) => {
    await api.queueCommand(targetType, targetId, commandType, params, dryRun);
    loadFleetData();
  };

  const handleApproveCommand = async (commandId, approved) => {
    await api.approveCommand(commandId, approved);
    loadFleetData();
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "#0b0f19", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Dialog open={true} PaperProps={{ sx: { bgcolor: "#111827", border: "1px solid rgba(255,255,255,0.1)", p: 2, minWidth: 380 } }}>
          <form onSubmit={handleLogin}>
            <DialogTitle sx={{ color: "#f8fafc", fontWeight: 700, textAlign: "center" }}>
              ⚡ System Revamp Fleet
              <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5 }}>
                Central Administrative Console
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              {loginError && <Alert severity="error">{loginError}</Alert>}
              <TextField
                label="Administrator Email"
                size="small"
                fullWidth
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                sx={{ "& .MuiInputBase-input": { color: "#fff" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
              />
              <TextField
                label="Password"
                type="password"
                size="small"
                fullWidth
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                sx={{ "& .MuiInputBase-input": { color: "#fff" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
              />
              <TextField
                label="2FA TOTP Code (Optional)"
                size="small"
                fullWidth
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code if enabled"
                sx={{ "& .MuiInputBase-input": { color: "#fff" }, "& .MuiInputLabel-root": { color: "#94a3b8" } }}
              />
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loginLoading}
                sx={{ bgcolor: "#2563eb", py: 1, fontWeight: 700 }}
              >
                {loginLoading ? <CircularProgress size={24} /> : "Sign In to Fleet"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#0b0f19", color: "#f8fafc" }}>
      {/* Top Navbar */}
      <AppBar position="static" sx={{ bgcolor: "#111827", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: "#38bdf8", letterSpacing: 0.5 }}>
              ⚡ SYSTEM REVAMP <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: 400 }}>v2.0 Fleet</span>
            </Typography>

            <Tabs
              value={selectedDeviceId ? false : activeTab}
              onChange={(e, v) => {
                setSelectedDeviceId(null);
                setSelectedDevice(null);
                setActiveTab(v);
              }}
              textColor="inherit"
              sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minWidth: 100 } }}
            >
              <Tab icon={<DashboardIcon />} iconPosition="start" label="Overview" />
              <Tab icon={<Domain />} iconPosition="start" label="Labs & Endpoints" />
              <Tab icon={<Build />} iconPosition="start" label="Remediation" />
              <Tab icon={<Security />} iconPosition="start" label="Exposure Assessment" />
              <Tab icon={<Assessment />} iconPosition="start" label="Compliance Reports" />
            </Tabs>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={loadFleetData} sx={{ color: "#94a3b8" }}>
              <Refresh />
            </IconButton>
            <Typography variant="caption" sx={{ color: "#94a3b8", mr: 1 }}>
              {api.user?.email || "Admin"}
            </Typography>
            <Button size="small" startIcon={<Logout />} onClick={handleLogout} sx={{ color: "#ef4444" }}>
              Sign Out
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Tab Views */}
      <Container maxWidth="xl" sx={{ mt: 2, pb: 6 }}>
        {selectedDeviceId && selectedDevice ? (
          <DeviceDetail
            device={selectedDevice}
            onBack={() => {
              setSelectedDeviceId(null);
              setSelectedDevice(null);
            }}
            onQueueCommand={(type, params) => handleQueueCommand("device", selectedDeviceId, type, params, false)}
          />
        ) : (
          <>
            {activeTab === 0 && <FleetOverview data={overview} onSelectDevice={handleSelectDevice} />}
            {activeTab === 1 && (
              <LabHierarchy
                labs={labs}
                devices={devices}
                onSelectDevice={handleSelectDevice}
                onQueueLabRemediation={(labId) => {
                  setActiveTab(2);
                }}
              />
            )}
            {activeTab === 2 && (
              <RemediationCenter
                labs={labs}
                onQueueCommand={handleQueueCommand}
                onApproveCommand={handleApproveCommand}
                recentCommands={recentCommands}
              />
            )}
            {activeTab === 3 && <ExposureAssessment devices={devices} />}
            {activeTab === 4 && <ComplianceExport overview={overview} devices={devices} />}
          </>
        )}
      </Container>
    </Box>
  );
}
