import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import {
  Assessment,
  Build,
  Dns,
  Logout,
  NotificationsActive,
  Refresh,
  Security,
  WarningAmber,
  Wifi,
} from "@mui/icons-material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLOUD_API_ENDPOINTS, CLOUD_WS_ENDPOINTS } from "./apiConfig";

const AUTH_TOKEN_KEY = "cloud_admin_token";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10000,
    },
  },
});

const dashboardTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#22d3ee" },
    secondary: { main: "#f59e0b" },
    error: { main: "#ef4444" },
    success: { main: "#22c55e" },
    warning: { main: "#f97316" },
    background: {
      default: "#04070d",
      paper: "#0d1624",
    },
    text: {
      primary: "#e6edf6",
      secondary: "#90a3ba",
    },
    divider: "rgba(148, 163, 184, 0.2)",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    h4: { fontWeight: 700, letterSpacing: "0.01em" },
    h5: { fontWeight: 700, letterSpacing: "0.01em" },
    h6: { fontWeight: 700, letterSpacing: "0.01em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: "rgba(15, 23, 42, 0.52)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
        },
        head: {
          color: "#9fb2c9",
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          fontWeight: 600,
        },
      },
    },
  },
});

const panelSx = {
  border: "1px solid rgba(148, 163, 184, 0.16)",
  background: "linear-gradient(165deg, rgba(12, 21, 34, 0.94) 0%, rgba(10, 16, 27, 0.88) 100%)",
  boxShadow: "0 20px 36px rgba(2, 6, 23, 0.42)",
  borderRadius: 3,
};

const monoSx = {
  fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const formatTs = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
};

const formatTime = (value) => {
  if (!value) return "--:--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--:--" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toPercent = (value) => {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const riskBand = (score) => {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Critical", color: "#ef4444" };
  if (value >= 60) return { label: "High", color: "#f97316" };
  if (value >= 40) return { label: "Medium", color: "#f59e0b" };
  return { label: "Low", color: "#22c55e" };
};

const riskLevelColor = (level) => {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high" || normalized === "critical") return "#ef4444";
  if (normalized === "medium") return "#f59e0b";
  if (normalized === "low") return "#22c55e";
  return "#9fb2c9";
};

const apiFetch = async (url, token, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const err = new Error(typeof payload === "object" ? payload?.error?.message || payload?.detail || "Request failed" : String(payload));
    err.status = response.status;
    throw err;
  }
  return payload;
};

function Panel({ title, subtitle, action, children, sx }) {
  return (
    <Paper sx={{ ...panelSx, ...sx }}>
      <Box sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.4}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="#e6edf6">
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="caption" color="#8ca1b9">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {action || null}
        </Stack>
        {children}
      </Box>
    </Paper>
  );
}

function StatCard({ title, value, icon, accent }) {
  return (
    <Paper sx={{ ...panelSx, height: "100%", overflow: "hidden", position: "relative" }}>
      <Box
        sx={{
          position: "absolute",
          top: -24,
          right: -18,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(accent, 0.35)} 0%, ${alpha(accent, 0)} 72%)`,
        }}
      />
      <Box sx={{ p: 2.2, position: "relative" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="overline" color="#89a0b8" sx={{ letterSpacing: "0.07em" }}>
            {title}
          </Typography>
          <Box sx={{ color: accent }}>{icon}</Box>
        </Stack>
        <Typography variant="h4" className="metric-value" color="#f8fbff" sx={{ ...monoSx }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

function LoginScreen({ onAuthenticated }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch(CLOUD_API_ENDPOINTS.login, "", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const token = String(payload.access_token || "").trim();
      if (!token) {
        throw new Error("Missing access token");
      }
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      onAuthenticated(token);
    } catch (err) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Card sx={{ ...panelSx, width: 460, borderRadius: 4 }}>
        <CardContent sx={{ p: 3.5 }}>
          <Stack spacing={2.3}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Security sx={{ color: "#22d3ee" }} />
              <Typography variant="h5" color="#f8fbff" fontWeight={700}>
                System Revamp Cloud
              </Typography>
            </Stack>
            <Typography color="#8ca1b9">Admin authentication required to access the global security panel.</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
            <Button variant="contained" onClick={login} disabled={loading} sx={{ py: 1.1 }}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Dashboard({ token, onLogout }) {
  const qc = useQueryClient();
  const isLarge = useMediaQuery((theme) => theme.breakpoints.up("lg"));

  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [alertsConnected, setAlertsConnected] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [popupAlert, setPopupAlert] = useState(null);
  const [patchSoftware, setPatchSoftware] = useState("");

  const handleUnauthorized = useCallback(
    (err) => {
      if (err?.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        onLogout();
      }
    },
    [onLogout]
  );

  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.overview, token), refetchInterval: 30000 });
  const machinesQuery = useQuery({ queryKey: ["machines"], queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machines}?limit=200&offset=0`, token), refetchInterval: 20000 });
  const machines = useMemo(() => (Array.isArray(machinesQuery.data?.items) ? machinesQuery.data.items : []), [machinesQuery.data]);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  useEffect(() => {
    setPatchSoftware("");
  }, [selectedMachineId]);

  const detailQuery = useQuery({
    queryKey: ["detail", selectedMachineId],
    enabled: Boolean(selectedMachineId),
    queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machineDetails}/${selectedMachineId}`, token),
    refetchInterval: 15000,
  });
  const riskQuery = useQuery({
    queryKey: ["risk", selectedMachineId],
    enabled: Boolean(selectedMachineId),
    queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.riskScore}/${selectedMachineId}`, token),
    refetchInterval: 15000,
  });
  const eventsQuery = useQuery({
    queryKey: ["events", selectedMachineId],
    enabled: Boolean(selectedMachineId),
    queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.events}/${selectedMachineId}?limit=250`, token),
    refetchInterval: 15000,
  });
  const patchStatusQuery = useQuery({
    queryKey: ["patch-status", selectedMachineId],
    enabled: Boolean(selectedMachineId),
    queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.patchStatus}/${selectedMachineId}?limit=30`, token),
    refetchInterval: 20000,
  });

  useEffect(() => {
    [overviewQuery.error, machinesQuery.error, detailQuery.error, riskQuery.error, eventsQuery.error, patchStatusQuery.error].forEach(handleUnauthorized);
  }, [overviewQuery.error, machinesQuery.error, detailQuery.error, riskQuery.error, eventsQuery.error, patchStatusQuery.error, handleUnauthorized]);

  const installPatch = useMutation({
    mutationFn: (payload) => apiFetch(CLOUD_API_ENDPOINTS.installPatch, token, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patch-status", selectedMachineId] });
      qc.invalidateQueries({ queryKey: ["detail", selectedMachineId] });
      qc.invalidateQueries({ queryKey: ["events", selectedMachineId] });
    },
    onError: handleUnauthorized,
  });

  useEffect(() => {
    let socket;
    let reconnect;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(CLOUD_WS_ENDPOINTS.liveMachines);
      socket.onopen = () => setLiveConnected(true);
      socket.onclose = () => {
        setLiveConnected(false);
        if (!disposed) reconnect = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.type || payload.type === "connected") return;
          qc.invalidateQueries({ queryKey: ["overview"] });
          qc.invalidateQueries({ queryKey: ["machines"] });
          if (payload.machine_id === selectedMachineId) {
            qc.invalidateQueries({ queryKey: ["detail", selectedMachineId] });
            qc.invalidateQueries({ queryKey: ["risk", selectedMachineId] });
            qc.invalidateQueries({ queryKey: ["events", selectedMachineId] });
          }
        } catch {
          // ignore malformed message
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      if (socket) socket.close();
    };
  }, [qc, selectedMachineId]);

  useEffect(() => {
    let socket;
    let reconnect;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(CLOUD_WS_ENDPOINTS.alerts);
      socket.onopen = () => setAlertsConnected(true);
      socket.onclose = () => {
        setAlertsConnected(false);
        if (!disposed) reconnect = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.type || payload.type === "connected") return;
          setPopupAlert(payload);
          setAlertHistory((prev) => [payload, ...prev].slice(0, 50));
          qc.invalidateQueries({ queryKey: ["machines"] });
          qc.invalidateQueries({ queryKey: ["overview"] });
          if (payload.machine_id === selectedMachineId) {
            qc.invalidateQueries({ queryKey: ["events", selectedMachineId] });
            qc.invalidateQueries({ queryKey: ["risk", selectedMachineId] });
          }
        } catch {
          // ignore malformed message
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnect) clearTimeout(reconnect);
      if (socket) socket.close();
    };
  }, [qc, selectedMachineId]);

  const detail = detailQuery.data;
  const risk = riskQuery.data;
  const events = Array.isArray(eventsQuery.data?.events) ? eventsQuery.data.events : [];
  const patches = Array.isArray(patchStatusQuery.data?.items) ? patchStatusQuery.data.items : [];
  const outdatedApps = Array.isArray(detail?.outdated_software) ? detail.outdated_software : [];
  const installedApps = Array.isArray(detail?.installed_apps) ? detail.installed_apps : [];
  const driverIssues = Array.isArray(detail?.driver_issues) ? detail.driver_issues : [];
  const chartRows = Array.isArray(detail?.system_metrics) ? detail.system_metrics : [];
  const latestMetrics = chartRows.length > 0 ? chartRows[chartRows.length - 1] : null;

  const overview = {
    total_machines: Number(overviewQuery.data?.total_machines || 0),
    machines_online: Number(overviewQuery.data?.machines_online || 0),
    total_vulnerabilities: Number(overviewQuery.data?.total_vulnerabilities || 0),
    average_risk_score: Number(overviewQuery.data?.average_risk_score || 0),
  };

  const riskBreakdown = {
    outdated_apps: Number(risk?.breakdown?.outdated_apps || 0),
    missing_drivers: Number(risk?.breakdown?.missing_drivers || 0),
    cpu_spikes: Number(risk?.breakdown?.cpu_spikes || 0),
    security_events: Number(risk?.breakdown?.security_events || 0),
  };

  const loading = overviewQuery.isLoading || machinesQuery.isLoading || detailQuery.isLoading || riskQuery.isLoading || eventsQuery.isLoading;
  const errorMessage =
    overviewQuery.error?.message ||
    machinesQuery.error?.message ||
    detailQuery.error?.message ||
    riskQuery.error?.message ||
    eventsQuery.error?.message ||
    installPatch.error?.message ||
    "";

  const riskTone = riskBand(risk?.risk_score || 0);

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: "linear-gradient(180deg, rgba(7, 12, 20, 0.96), rgba(7, 12, 20, 0.82))",
          borderBottom: "1px solid rgba(148, 163, 184, 0.16)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <Stack direction="row" alignItems="center" spacing={1.1} sx={{ flexGrow: 1 }}>
            <Security sx={{ color: "#22d3ee" }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                System Revamp Security Cloud
              </Typography>
              <Typography variant="caption" color="#8fa3ba">
                Global multi-machine monitoring console
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<Wifi />}
              size="small"
              label={liveConnected ? "Live stream online" : "Live stream reconnecting"}
              sx={{ bgcolor: alpha(liveConnected ? "#22c55e" : "#f97316", 0.15), color: liveConnected ? "#86efac" : "#fdba74" }}
            />
            <Chip
              icon={<NotificationsActive />}
              size="small"
              label={alertsConnected ? "Alerts online" : "Alerts reconnecting"}
              sx={{ bgcolor: alpha(alertsConnected ? "#22d3ee" : "#f97316", 0.15), color: alertsConnected ? "#67e8f9" : "#fdba74" }}
            />
            <Button startIcon={<Refresh />} onClick={() => qc.invalidateQueries()} sx={{ color: "#c7d6e8" }}>
              Refresh
            </Button>
            <Button startIcon={<Logout />} onClick={onLogout} sx={{ color: "#d6e3f2" }}>
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {loading ? <LinearProgress color="primary" /> : null}

      <Box sx={{ p: { xs: 1.5, md: 2.25 } }}>
        {errorMessage ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        ) : null}

        <Grid container spacing={2.2}>
          <Grid item xs={12} lg={4}>
            <Stack spacing={2.2} sx={isLarge ? { position: "sticky", top: 88 } : null}>
              <Panel title="Machine Control Panel" subtitle="Select a machine to inspect details and actions">
                {machines.length === 0 ? (
                  <Typography color="#90a3ba">No machines registered yet.</Typography>
                ) : (
                  <Stack spacing={1.1} sx={{ maxHeight: 370, overflowY: "auto", pr: 0.5 }}>
                    {machines.map((machine) => {
                      const band = riskBand(machine.risk_score);
                      const selected = machine.id === selectedMachineId;
                      return (
                        <Paper
                          key={machine.id}
                          onClick={() => setSelectedMachineId(machine.id)}
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            cursor: "pointer",
                            border: `1px solid ${selected ? alpha("#22d3ee", 0.62) : "rgba(148, 163, 184, 0.16)"}`,
                            background: selected ? "rgba(14, 24, 38, 0.86)" : "rgba(11, 18, 30, 0.68)",
                            transition: "all 0.16s ease",
                            "&:hover": {
                              borderColor: alpha("#22d3ee", 0.45),
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.8}>
                            <Box sx={{ minWidth: 0, mr: 1 }}>
                              <Typography sx={{ ...monoSx, color: "#e8f0fb", fontSize: 13.5 }} noWrap>
                                {machine.hostname}
                              </Typography>
                              <Typography color="#7f93ab" fontSize={11}>
                                {machine.os || "Unknown OS"}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={band.label}
                              sx={{
                                bgcolor: alpha(band.color, 0.16),
                                color: band.color,
                                border: `1px solid ${alpha(band.color, 0.5)}`,
                                fontWeight: 700,
                              }}
                            />
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={toPercent(machine.risk_score)}
                            sx={{
                              height: 6,
                              borderRadius: 999,
                              bgcolor: "rgba(148, 163, 184, 0.2)",
                              "& .MuiLinearProgress-bar": { backgroundColor: band.color },
                            }}
                          />
                          <Stack direction="row" justifyContent="space-between" mt={0.8}>
                            <Typography color="#91a5bc" fontSize={11}>
                              Last: {formatTime(machine.last_scan)}
                            </Typography>
                            <Typography color="#b7c8db" fontSize={11} sx={monoSx}>
                              Alerts: {Number(machine.alerts || 0)}
                            </Typography>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Panel>

              <Panel title="Risk Heatmap" subtitle="Machine risk intensity snapshot">
                {machines.length === 0 ? (
                  <Typography color="#90a3ba">No machine data available.</Typography>
                ) : (
                  <Stack spacing={1.1}>
                    {machines.slice(0, 12).map((machine) => {
                      const band = riskBand(machine.risk_score);
                      return (
                        <Box key={`heat-${machine.id}`}>
                          <Stack direction="row" justifyContent="space-between" mb={0.4}>
                            <Typography fontSize={12} color="#d6e3f1" sx={monoSx} noWrap>
                              {machine.hostname}
                            </Typography>
                            <Typography fontSize={12} color={band.color} sx={monoSx}>
                              {toPercent(machine.risk_score)}
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={toPercent(machine.risk_score)}
                            sx={{
                              height: 8,
                              borderRadius: 999,
                              bgcolor: "rgba(148, 163, 184, 0.18)",
                              "& .MuiLinearProgress-bar": {
                                background: `linear-gradient(90deg, ${alpha(band.color, 0.68)}, ${band.color})`,
                              },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Panel>

              <Panel title="Security Alerts" subtitle="Real-time critical alerts">
                <Stack spacing={1} sx={{ maxHeight: 280, overflowY: "auto", pr: 0.5 }}>
                  {alertHistory.length === 0 ? <Typography color="#90a3ba">No alerts received in this session.</Typography> : null}
                  {alertHistory.map((alertItem, index) => (
                    <Paper
                      key={`${alertItem.timestamp}-${index}`}
                      sx={{
                        p: 1,
                        borderRadius: 1.7,
                        border: "1px solid rgba(239, 68, 68, 0.44)",
                        background: "linear-gradient(145deg, rgba(127, 29, 29, 0.22), rgba(69, 10, 10, 0.14))",
                      }}
                    >
                      <Typography color="#fecaca" fontSize={12.5} fontWeight={600}>
                        {alertItem.message || "Risk alert"}
                      </Typography>
                      <Typography color="#f0f7ff" fontSize={11.5} sx={monoSx}>
                        {alertItem.hostname || "Unknown"} | risk {alertItem.risk_score ?? "N/A"}
                      </Typography>
                      <Typography color="#fca5a5" fontSize={10.5}>
                        {formatTs(alertItem.timestamp)}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Stack spacing={2.2}>
              <Grid container spacing={2.2}>
                <Grid item xs={12} sm={6} xl={3}>
                  <StatCard title="Total Machines" value={overview.total_machines} icon={<Dns />} accent="#22d3ee" />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <StatCard title="Machines Online" value={overview.machines_online} icon={<Wifi />} accent="#22c55e" />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <StatCard title="Vulnerabilities" value={overview.total_vulnerabilities} icon={<WarningAmber />} accent="#f59e0b" />
                </Grid>
                <Grid item xs={12} sm={6} xl={3}>
                  <StatCard title="Average Risk" value={overview.average_risk_score} icon={<Assessment />} accent="#ef4444" />
                </Grid>
              </Grid>

              <Panel
                title={detail?.hostname ? `Machine Detail: ${detail.hostname}` : "Machine Detail"}
                subtitle={`${detail?.os || "N/A"} | Last scan ${formatTs(detail?.last_scan)}`}
                action={
                  <Chip
                    size="small"
                    label={`${riskTone.label} Risk ${Number(risk?.risk_score || 0)}`}
                    sx={{
                      bgcolor: alpha(riskTone.color, 0.15),
                      color: riskTone.color,
                      border: `1px solid ${alpha(riskTone.color, 0.48)}`,
                      fontWeight: 700,
                    }}
                  />
                }
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} xl={8}>
                    <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                      <Stack direction="row" justifyContent="space-between" mb={1}>
                        <Typography color="#d6e3f1" fontWeight={700}>
                          Live System Metrics
                        </Typography>
                        <Typography color="#8ea3ba" fontSize={12}>
                          CPU | RAM | Disk | Risk
                        </Typography>
                      </Stack>
                      <Box sx={{ height: 270 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRows}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                            <XAxis dataKey="timestamp" stroke="#97acc4" tickFormatter={(value) => formatTime(value)} minTickGap={32} />
                            <YAxis stroke="#97acc4" domain={[0, 100]} />
                            <RechartTooltip labelFormatter={(value) => formatTs(value)} />
                            <Line type="monotone" dataKey="cpu_usage" stroke="#22d3ee" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="ram_usage" stroke="#10b981" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="disk_usage" stroke="#f59e0b" dot={false} strokeWidth={2} />
                            <Line type="monotone" dataKey="risk_score" stroke="#ef4444" dot={false} strokeWidth={2.2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} xl={4}>
                    <Stack spacing={2}>
                      <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                        <Typography color="#d6e3f1" fontWeight={700} mb={1}>
                          Live Monitor
                        </Typography>
                        <Stack spacing={1.2}>
                          <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.4}>
                              <Typography color="#91a5bc" fontSize={12}>
                                CPU
                              </Typography>
                              <Typography color="#d6e3f1" fontSize={12} sx={monoSx}>
                                {toPercent(latestMetrics?.cpu_usage).toFixed(1)}%
                              </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={toPercent(latestMetrics?.cpu_usage)} sx={{ height: 8, borderRadius: 999 }} />
                          </Box>
                          <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.4}>
                              <Typography color="#91a5bc" fontSize={12}>
                                RAM
                              </Typography>
                              <Typography color="#d6e3f1" fontSize={12} sx={monoSx}>
                                {toPercent(latestMetrics?.ram_usage).toFixed(1)}%
                              </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={toPercent(latestMetrics?.ram_usage)} color="success" sx={{ height: 8, borderRadius: 999 }} />
                          </Box>
                          <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.4}>
                              <Typography color="#91a5bc" fontSize={12}>
                                Disk
                              </Typography>
                              <Typography color="#d6e3f1" fontSize={12} sx={monoSx}>
                                {toPercent(latestMetrics?.disk_usage).toFixed(1)}%
                              </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={toPercent(latestMetrics?.disk_usage)} color="warning" sx={{ height: 8, borderRadius: 999 }} />
                          </Box>
                        </Stack>
                      </Paper>

                      <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                        <Typography color="#d6e3f1" fontWeight={700} mb={1}>
                          Risk Contributors
                        </Typography>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography color="#90a3ba" fontSize={12}>
                              Outdated apps
                            </Typography>
                            <Typography color="#d9e7f7" fontSize={12} sx={monoSx}>
                              {riskBreakdown.outdated_apps}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography color="#90a3ba" fontSize={12}>
                              Missing drivers
                            </Typography>
                            <Typography color="#d9e7f7" fontSize={12} sx={monoSx}>
                              {riskBreakdown.missing_drivers}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography color="#90a3ba" fontSize={12}>
                              CPU spikes
                            </Typography>
                            <Typography color="#d9e7f7" fontSize={12} sx={monoSx}>
                              {riskBreakdown.cpu_spikes}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography color="#90a3ba" fontSize={12}>
                              Security events
                            </Typography>
                            <Typography color="#d9e7f7" fontSize={12} sx={monoSx}>
                              {riskBreakdown.security_events}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Divider sx={{ my: 1.2 }} />
                        <Box sx={{ height: 86 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartRows}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                              <XAxis dataKey="timestamp" hide />
                              <YAxis hide domain={[0, 100]} />
                              <Area type="monotone" dataKey="risk_score" stroke="#ef4444" fill="rgba(239, 68, 68, 0.3)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </Box>
                      </Paper>

                      <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                        <Typography color="#d6e3f1" fontWeight={700} mb={1}>
                          Patch Orchestrator
                        </Typography>
                        <Select
                          size="small"
                          fullWidth
                          value={patchSoftware}
                          onChange={(event) => setPatchSoftware(event.target.value)}
                          displayEmpty
                          sx={{ mb: 1.1, color: "#e6edf6" }}
                        >
                          <MenuItem value="">Select outdated software</MenuItem>
                          {outdatedApps.map((item) => (
                            <MenuItem key={item.name} value={item.name}>
                              {item.name}
                            </MenuItem>
                          ))}
                        </Select>
                        <Button
                          fullWidth
                          startIcon={<Build />}
                          variant="contained"
                          disabled={!selectedMachineId || !patchSoftware || installPatch.isPending}
                          onClick={() => installPatch.mutate({ machine_id: selectedMachineId, software: patchSoftware })}
                        >
                          {installPatch.isPending ? "Installing patch..." : "Install patch"}
                        </Button>
                        <Divider sx={{ my: 1.1 }} />
                        <Stack spacing={0.8} sx={{ maxHeight: 120, overflowY: "auto", pr: 0.5 }}>
                          {patches.length === 0 ? <Typography color="#8da2b9" fontSize={12}>No patch actions yet.</Typography> : null}
                          {patches.slice(0, 8).map((item, index) => (
                            <Typography
                              key={`${item.timestamp}-${index}`}
                              fontSize={12}
                              color={item.status === "patch_installed" ? "#86efac" : "#fca5a5"}
                              sx={monoSx}
                            >
                              {item.software} | {item.status}
                            </Typography>
                          ))}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 0.1 }}>
                  <Grid item xs={12} xl={6}>
                    <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)" }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1.1}>
                        <Dns sx={{ color: "#22d3ee", fontSize: 20 }} />
                        <Typography color="#d6e3f1" fontWeight={700}>
                          Installed Apps & Driver Health
                        </Typography>
                      </Stack>
                      <TableContainer sx={{ border: "1px solid rgba(148, 163, 184, 0.12)", borderRadius: 2, maxHeight: 250 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>Application</TableCell>
                              <TableCell>Version</TableCell>
                              <TableCell>Risk</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {installedApps.slice(0, 12).map((app) => (
                              <TableRow key={`${app.name}-${app.current_version}`} hover>
                                <TableCell sx={{ color: "#d9e8f8", ...monoSx }}>{app.name}</TableCell>
                                <TableCell sx={{ color: "#aac0d8", ...monoSx }}>{app.current_version || "-"}</TableCell>
                                <TableCell>
                                  <Chip
                                    size="small"
                                    label={app.risk_level || "Unknown"}
                                    sx={{
                                      color: riskLevelColor(app.risk_level),
                                      bgcolor: alpha(riskLevelColor(app.risk_level), 0.14),
                                      border: `1px solid ${alpha(riskLevelColor(app.risk_level), 0.48)}`,
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                            {installedApps.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} sx={{ color: "#90a3ba" }}>
                                  No application data.
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Divider sx={{ my: 1.2 }} />

                      <Stack direction="row" alignItems="center" spacing={1} mb={0.8}>
                        <WarningAmber sx={{ color: "#f59e0b", fontSize: 20 }} />
                        <Typography color="#d6e3f1" fontWeight={700}>
                          Driver Issues
                        </Typography>
                      </Stack>
                      <Stack spacing={0.8} sx={{ maxHeight: 140, overflowY: "auto", pr: 0.5 }}>
                        {driverIssues.length === 0 ? <Typography color="#90a3ba">No driver issues detected.</Typography> : null}
                        {driverIssues.map((driver, index) => (
                          <Paper
                            key={`${driver.driver_name}-${index}`}
                            sx={{ p: 0.9, borderRadius: 1.5, background: "rgba(120, 53, 15, 0.16)", border: "1px solid rgba(249, 115, 22, 0.32)" }}
                          >
                            <Typography color="#fdba74" fontSize={12.5} sx={monoSx}>
                              {driver.driver_name}
                            </Typography>
                            <Typography color="#fcd9b6" fontSize={11.5}>
                              {driver.status}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} xl={6}>
                    <Paper sx={{ p: 1.2, borderRadius: 2, background: "rgba(7, 14, 24, 0.62)", border: "1px solid rgba(148, 163, 184, 0.14)", height: "100%" }}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1.1}>
                        <NotificationsActive sx={{ color: "#ef4444", fontSize: 20 }} />
                        <Typography color="#d6e3f1" fontWeight={700}>
                          Security Event Timeline
                        </Typography>
                      </Stack>

                      <Stack spacing={1} sx={{ maxHeight: 438, overflowY: "auto", pr: 0.5 }}>
                        {events.length === 0 ? <Typography color="#90a3ba">No security events found for this machine.</Typography> : null}
                        {events.slice(0, 35).map((eventItem, index) => (
                          <Paper
                            key={`${eventItem.timestamp}-${index}`}
                            sx={{
                              p: 1,
                              borderRadius: 1.8,
                              background: "rgba(13, 20, 33, 0.72)",
                              borderLeft: `3px solid ${riskLevelColor(eventItem.risk_level)}`,
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.3}>
                              <Typography color="#e8f0fb" fontSize={12.5} fontWeight={600}>
                                {eventItem.event_type}
                              </Typography>
                              <Chip
                                size="small"
                                label={eventItem.risk_level || "Unknown"}
                                sx={{
                                  fontSize: 11,
                                  color: riskLevelColor(eventItem.risk_level),
                                  bgcolor: alpha(riskLevelColor(eventItem.risk_level), 0.15),
                                  border: `1px solid ${alpha(riskLevelColor(eventItem.risk_level), 0.42)}`,
                                }}
                              />
                            </Stack>
                            <Typography color="#95a9bf" fontSize={11.5} sx={monoSx}>
                              {formatTs(eventItem.timestamp)}
                            </Typography>
                            {eventItem.details ? (
                              <Typography color="#a7bbd0" fontSize={11.5} sx={{ mt: 0.2 }}>
                                {eventItem.details}
                              </Typography>
                            ) : null}
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              </Panel>
            </Stack>
          </Grid>
        </Grid>
      </Box>

      <Snackbar open={Boolean(popupAlert)} autoHideDuration={7000} onClose={() => setPopupAlert(null)} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="error" onClose={() => setPopupAlert(null)} variant="filled" sx={{ minWidth: 300 }}>
          {popupAlert?.message || "Security alert"}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
  };

  return (
    <ThemeProvider theme={dashboardTheme}>
      <QueryClientProvider client={queryClient}>{token ? <Dashboard token={token} onLogout={logout} /> : <LoginScreen onAuthenticated={setToken} />}</QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
