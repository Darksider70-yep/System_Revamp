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
} from "@mui/material";
import { Logout, Refresh, Security, WarningAmber, Wifi } from "@mui/icons-material";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartTooltip, XAxis, YAxis } from "recharts";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CLOUD_API_ENDPOINTS, CLOUD_WS_ENDPOINTS } from "./apiConfig";

const AUTH_TOKEN_KEY = "cloud_admin_token";
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 10000 } } });

const cardSx = {
  borderRadius: 3,
  border: "1px solid rgba(100, 116, 139, 0.24)",
  background: "linear-gradient(145deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.9))",
  boxShadow: "0 16px 34px rgba(2, 6, 23, 0.45)",
};

const formatTs = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
};

const riskBand = (score) => {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Critical", color: "#ef4444" };
  if (value >= 60) return { label: "High", color: "#f97316" };
  if (value >= 40) return { label: "Medium", color: "#eab308" };
  return { label: "Low", color: "#22c55e" };
};

const riskLevelColor = (level) => {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") return "#ef4444";
  if (normalized === "medium") return "#eab308";
  if (normalized === "low") return "#22c55e";
  return "#94a3b8";
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
        background:
          "radial-gradient(circle at 15% 0%, rgba(30, 64, 175, 0.25), rgba(2, 6, 23, 1) 40%), linear-gradient(130deg, #020617 0%, #0f172a 60%, #111827 100%)",
      }}
    >
      <Card sx={{ ...cardSx, width: 420 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Security sx={{ color: "#38bdf8" }} />
              <Typography variant="h5" sx={{ color: "#f8fafc", fontWeight: 800 }}>
                Cloud Security Core
              </Typography>
            </Stack>
            <Typography sx={{ color: "#94a3b8" }}>Admin authentication required.</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Username" value={username} onChange={(event) => setUsername(event.target.value)} fullWidth />
            <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
            <Button variant="contained" onClick={login} disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Dashboard({ token, onLogout }) {
  const qc = useQueryClient();
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [alertsConnected, setAlertsConnected] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const [popupAlert, setPopupAlert] = useState(null);
  const [patchSoftware, setPatchSoftware] = useState("");

  const handleUnauthorized = useCallback((err) => {
    if (err?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      onLogout();
    }
  }, [onLogout]);

  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.overview, token), refetchInterval: 30000 });
  const machinesQuery = useQuery({ queryKey: ["machines"], queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machines}?limit=200&offset=0`, token), refetchInterval: 20000 });
  const machines = useMemo(() => (Array.isArray(machinesQuery.data?.items) ? machinesQuery.data.items : []), [machinesQuery.data]);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

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
  }, []);

  const detail = detailQuery.data;
  const risk = riskQuery.data;
  const events = Array.isArray(eventsQuery.data?.events) ? eventsQuery.data.events : [];
  const patches = Array.isArray(patchStatusQuery.data?.items) ? patchStatusQuery.data.items : [];
  const outdatedApps = Array.isArray(detail?.outdated_software) ? detail.outdated_software : [];
  const chartRows = Array.isArray(detail?.system_metrics) ? detail.system_metrics : [];
  const latestMetrics = chartRows.length > 0 ? chartRows[chartRows.length - 1] : null;
  const loading = overviewQuery.isLoading || machinesQuery.isLoading || detailQuery.isLoading || riskQuery.isLoading || eventsQuery.isLoading;
  const errorMessage = overviewQuery.error?.message || machinesQuery.error?.message || detailQuery.error?.message || riskQuery.error?.message || eventsQuery.error?.message || installPatch.error?.message || "";

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(150deg, #010409 0%, #0f172a 50%, #111827 100%)" }}>
      <AppBar position="sticky" sx={{ background: "rgba(1, 4, 9, 0.92)" }}>
        <Toolbar>
          <Security sx={{ color: "#38bdf8", mr: 1 }} />
          <Typography sx={{ flexGrow: 1, fontWeight: 800 }}>System Revamp Security Cloud</Typography>
          <Stack direction="row" spacing={1}>
            <Chip icon={<Wifi />} label={liveConnected ? "Live Feed" : "Feed Offline"} size="small" />
            <Chip icon={<WarningAmber />} label={alertsConnected ? "Alerts Online" : "Alerts Offline"} size="small" />
            <Button startIcon={<Refresh />} onClick={() => qc.invalidateQueries()} sx={{ color: "#bae6fd" }}>Refresh</Button>
            <Button startIcon={<Logout />} onClick={onLogout} sx={{ color: "#f8fafc" }}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {loading ? <LinearProgress color="info" /> : null}
      <Box sx={{ p: 2 }}>
        {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>{errorMessage}</Alert> : null}
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><Card sx={cardSx}><CardContent><Typography color="#cbd5e1">Total Machines</Typography><Typography variant="h4" color="#f8fafc">{overviewQuery.data?.total_machines ?? 0}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} md={3}><Card sx={cardSx}><CardContent><Typography color="#cbd5e1">Machines Online</Typography><Typography variant="h4" color="#f8fafc">{overviewQuery.data?.machines_online ?? 0}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} md={3}><Card sx={cardSx}><CardContent><Typography color="#cbd5e1">Vulnerabilities</Typography><Typography variant="h4" color="#f8fafc">{overviewQuery.data?.total_vulnerabilities ?? 0}</Typography></CardContent></Card></Grid>
          <Grid item xs={12} md={3}><Card sx={cardSx}><CardContent><Typography color="#cbd5e1">Average Risk</Typography><Typography variant="h4" color="#f8fafc">{overviewQuery.data?.average_risk_score ?? 0}</Typography></CardContent></Card></Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} lg={4}>
            <Card sx={{ ...cardSx, mb: 2 }}>
              <CardContent>
                <Typography color="#e2e8f0" fontWeight={700} mb={1}>Machine List</Typography>
                <TableContainer component={Paper} sx={{ background: "rgba(15,23,42,0.4)", maxHeight: 360 }}>
                  <Table stickyHeader size="small">
                    <TableHead><TableRow><TableCell>Hostname</TableCell><TableCell>Risk</TableCell><TableCell>Alerts</TableCell></TableRow></TableHead>
                    <TableBody>
                      {machines.map((machine) => (
                        <TableRow key={machine.id} hover selected={machine.id === selectedMachineId} onClick={() => setSelectedMachineId(machine.id)} sx={{ cursor: "pointer" }}>
                          <TableCell><Typography color="#e2e8f0" fontSize={13}>{machine.hostname}</Typography><Typography color="#94a3b8" fontSize={11}>{formatTs(machine.last_scan)}</Typography></TableCell>
                          <TableCell><Chip size="small" label={riskBand(machine.risk_score).label} sx={{ bgcolor: `${riskBand(machine.risk_score).color}33`, color: riskBand(machine.risk_score).color }} /></TableCell>
                          <TableCell sx={{ color: "#f8fafc", fontWeight: 700 }}>{machine.alerts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            <Card sx={cardSx}>
              <CardContent>
                <Typography color="#e2e8f0" fontWeight={700} mb={1}>Risk Heatmap</Typography>
                <Grid container spacing={1}>
                  {machines.map((machine) => (
                    <Grid item xs={6} key={machine.id}>
                      <Paper sx={{ p: 1, borderRadius: 2, bgcolor: `${riskBand(machine.risk_score).color}24`, border: `1px solid ${riskBand(machine.risk_score).color}66` }}>
                        <Typography color="#f8fafc" fontSize={12}>{machine.hostname}</Typography>
                        <Typography color={riskBand(machine.risk_score).color} fontSize={11}>{riskBand(machine.risk_score).label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography variant="h6" color="#f8fafc" fontWeight={800}>{detail?.hostname || "Machine Details"}</Typography>
                <Typography color="#94a3b8" fontSize={12}>{detail?.os || "N/A"} | Last scan: {formatTs(detail?.last_scan)}</Typography>
                <Divider sx={{ my: 1.5, borderColor: "rgba(148,163,184,0.2)" }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>System Metrics Graph</Typography>
                      <Box sx={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartRows}>
                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="timestamp" stroke="#cbd5e1" tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                            <YAxis stroke="#cbd5e1" domain={[0, 100]} />
                            <RechartTooltip labelFormatter={(value) => formatTs(value)} />
                            <Line dataKey="cpu_usage" stroke="#22d3ee" dot={false} />
                            <Line dataKey="ram_usage" stroke="#a78bfa" dot={false} />
                            <Line dataKey="disk_usage" stroke="#f97316" dot={false} />
                            <Line dataKey="risk_score" stroke="#ef4444" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>Live Monitor</Typography>
                      <Typography color="#cbd5e1" fontSize={12}>CPU: {Number(latestMetrics?.cpu_usage || 0).toFixed(1)}%</Typography>
                      <LinearProgress variant="determinate" value={Number(latestMetrics?.cpu_usage || 0)} sx={{ mb: 1 }} />
                      <Typography color="#cbd5e1" fontSize={12}>RAM: {Number(latestMetrics?.ram_usage || 0).toFixed(1)}%</Typography>
                      <LinearProgress variant="determinate" value={Number(latestMetrics?.ram_usage || 0)} color="secondary" sx={{ mb: 1 }} />
                      <Typography color="#cbd5e1" fontSize={12}>Disk: {Number(latestMetrics?.disk_usage || 0).toFixed(1)}%</Typography>
                      <LinearProgress variant="determinate" value={Number(latestMetrics?.disk_usage || 0)} color="warning" />
                    </Paper>
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 0.2 }}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>Risk History Chart</Typography>
                      <Box sx={{ height: 120 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartRows}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                            <XAxis dataKey="timestamp" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Area dataKey="risk_score" stroke="#ef4444" fill="rgba(239,68,68,0.35)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Box>
                      <Typography color="#cbd5e1" fontSize={12}>Current score: {risk?.risk_score ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>Patch Status Indicator</Typography>
                      {patches.slice(0, 5).map((item, idx) => (
                        <Typography key={`${item.timestamp}-${idx}`} color={item.status === "patch_installed" ? "#22c55e" : "#ef4444"} fontSize={12}>
                          {item.software} | {item.status}
                        </Typography>
                      ))}
                      <Divider sx={{ my: 1 }} />
                      <Select size="small" fullWidth value={patchSoftware} onChange={(event) => setPatchSoftware(event.target.value)} displayEmpty sx={{ mb: 1, color: "#e2e8f0" }}>
                        <MenuItem value="">Select outdated software</MenuItem>
                        {outdatedApps.map((item) => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}
                      </Select>
                      <Button
                        variant="contained"
                        disabled={!selectedMachineId || !patchSoftware || installPatch.isPending}
                        onClick={() => installPatch.mutate({ machine_id: selectedMachineId, software: patchSoftware })}
                      >
                        {installPatch.isPending ? "Installing..." : "Install Patch"}
                      </Button>
                    </Paper>
                  </Grid>
                </Grid>

                <Grid container spacing={2} sx={{ mt: 0.2 }}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>Installed Apps / Driver Status</Typography>
                      {(detail?.installed_apps || []).slice(0, 8).map((app) => (
                        <Typography key={`${app.name}-${app.current_version}`} color={riskLevelColor(app.risk_level)} fontSize={12}>
                          {app.name} | {app.risk_level}
                        </Typography>
                      ))}
                      {(detail?.driver_issues || []).slice(0, 5).map((driver) => (
                        <Typography key={`${driver.driver_name}-${driver.status}`} color="#fca5a5" fontSize={12}>
                          Driver issue: {driver.driver_name} ({driver.status})
                        </Typography>
                      ))}
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 1, borderRadius: 2, bgcolor: "rgba(15,23,42,0.4)" }}>
                      <Typography color="#e2e8f0" fontWeight={700} mb={1}>Security Event Timeline</Typography>
                      {events.slice(-12).map((event, idx) => (
                        <Typography key={`${event.timestamp}-${idx}`} color={riskLevelColor(event.risk_level)} fontSize={12}>
                          {formatTs(event.timestamp)} | {event.event_type}
                        </Typography>
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <Card sx={cardSx}>
              <CardContent>
                <Typography color="#e2e8f0" fontWeight={700} mb={1}>Security Alerts Panel</Typography>
                {alertHistory.length === 0 ? <Typography color="#94a3b8">No alerts received in this session.</Typography> : null}
                {alertHistory.map((alert, idx) => (
                  <Paper key={`${alert.timestamp}-${idx}`} sx={{ p: 1, mb: 1, borderRadius: 1.5, bgcolor: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.45)" }}>
                    <Typography color="#fecaca" fontWeight={600}>{alert.message}</Typography>
                    <Typography color="#e2e8f0" fontSize={12}>{alert.hostname} | risk={alert.risk_score} | {formatTs(alert.timestamp)}</Typography>
                  </Paper>
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      <Snackbar open={Boolean(popupAlert)} autoHideDuration={7000} onClose={() => setPopupAlert(null)} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="error" onClose={() => setPopupAlert(null)}>{popupAlert?.message || "Security alert"}</Alert>
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

  return <QueryClientProvider client={queryClient}>{token ? <Dashboard token={token} onLogout={logout} /> : <LoginScreen onAuthenticated={setToken} />}</QueryClientProvider>;
}

export default App;
