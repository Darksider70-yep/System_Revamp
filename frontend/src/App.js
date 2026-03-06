import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Bolt,
  Computer,
  Devices,
  Logout,
  NotificationsActive,
  Refresh,
  Security,
  TrendingUp,
  Wifi,
} from "@mui/icons-material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CLOUD_API_ENDPOINTS, CLOUD_WS_ENDPOINTS } from "./apiConfig";

const CARD_STYLE = {
  borderRadius: 3,
  border: "1px solid rgba(148, 163, 184, 0.22)",
  background: "linear-gradient(145deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.82))",
  boxShadow: "0 14px 36px rgba(2, 6, 23, 0.35)",
};

const AUTH_TOKEN_KEY = "cloud_admin_token";

const formatTimestamp = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
};

const riskColor = (value) => {
  const lowered = String(value || "").trim().toLowerCase();
  if (lowered === "high") return "#ef4444";
  if (lowered === "medium") return "#f59e0b";
  if (lowered === "low") return "#22c55e";
  return "#94a3b8";
};

const headersWithToken = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [overview, setOverview] = useState(null);
  const [machines, setMachines] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [machineDetail, setMachineDetail] = useState(null);

  const [dashboardError, setDashboardError] = useState("");
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [socketConnected, setSocketConnected] = useState(false);
  const [lastLiveEvent, setLastLiveEvent] = useState(null);

  const refreshTimerRef = useRef(null);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
    setOverview(null);
    setMachines([]);
    setMachineDetail(null);
    setSelectedMachineId(null);
    setDashboardError("Session expired. Login again.");
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!token) return;
    setLoadingOverview(true);
    try {
      const response = await fetch(CLOUD_API_ENDPOINTS.overview, {
        headers: headersWithToken(token),
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(`Overview request failed (${response.status})`);
      }
      const data = await response.json();
      setOverview(data);
      setDashboardError("");
    } catch (error) {
      setDashboardError(error?.message || "Unable to load overview.");
    } finally {
      setLoadingOverview(false);
    }
  }, [handleUnauthorized, token]);

  const fetchMachines = useCallback(async () => {
    if (!token) return;
    setLoadingMachines(true);
    try {
      const response = await fetch(`${CLOUD_API_ENDPOINTS.machines}?limit=200&offset=0`, {
        headers: headersWithToken(token),
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(`Machine list request failed (${response.status})`);
      }
      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      setMachines(items);

      if (items.length === 0) {
        setSelectedMachineId(null);
        setMachineDetail(null);
        return;
      }

      if (!selectedMachineId || !items.some((item) => item.id === selectedMachineId)) {
        setSelectedMachineId(items[0].id);
      }
      setDashboardError("");
    } catch (error) {
      setDashboardError(error?.message || "Unable to load machine list.");
    } finally {
      setLoadingMachines(false);
    }
  }, [handleUnauthorized, selectedMachineId, token]);

  const fetchMachineDetail = useCallback(
    async (machineId) => {
      if (!token || !machineId) return;
      setLoadingDetail(true);
      try {
        const response = await fetch(`${CLOUD_API_ENDPOINTS.machineDetails}/${machineId}`, {
          headers: headersWithToken(token),
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error(`Machine detail request failed (${response.status})`);
        }
        const data = await response.json();
        setMachineDetail(data);
        setDashboardError("");
      } catch (error) {
        setDashboardError(error?.message || "Unable to load machine detail.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [handleUnauthorized, token]
  );

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    await Promise.all([fetchOverview(), fetchMachines()]);
    if (selectedMachineId) {
      await fetchMachineDetail(selectedMachineId);
    }
    setIsRefreshing(false);
  }, [fetchMachineDetail, fetchMachines, fetchOverview, selectedMachineId, token]);

  useEffect(() => {
    if (!token) return;
    fetchOverview();
    fetchMachines();
  }, [fetchMachines, fetchOverview, token]);

  useEffect(() => {
    if (!token || !selectedMachineId) return;
    fetchMachineDetail(selectedMachineId);
  }, [fetchMachineDetail, selectedMachineId, token]);

  useEffect(() => {
    if (!token) return undefined;

    let socket = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const scheduleRefreshFromLiveEvent = (payload) => {
      setLastLiveEvent(payload);
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(async () => {
        await fetchOverview();
        await fetchMachines();
        if (payload?.machine_id && payload.machine_id === selectedMachineId) {
          await fetchMachineDetail(payload.machine_id);
        }
      }, 500);
    };

    const connect = () => {
      socket = new WebSocket(CLOUD_WS_ENDPOINTS.liveMachines);

      socket.onopen = () => {
        setSocketConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type && payload.type !== "connected") {
            scheduleRefreshFromLiveEvent(payload);
          }
        } catch {
          // Ignore malformed payloads.
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        setSocketConnected(false);
        if (!isDisposed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [fetchMachineDetail, fetchMachines, fetchOverview, selectedMachineId, token]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const response = await fetch(CLOUD_API_ENDPOINTS.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid username or password");
      }

      const data = await response.json();
      const accessToken = String(data.access_token || "").trim();
      if (!accessToken) {
        throw new Error("Cloud auth response missing token");
      }

      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      setToken(accessToken);
      setAuthError("");
    } catch (error) {
      setAuthError(error?.message || "Unable to login");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
    setOverview(null);
    setMachines([]);
    setMachineDetail(null);
    setSelectedMachineId(null);
    setLastLiveEvent(null);
    setDashboardError("");
  };

  const riskDistribution = useMemo(() => {
    const installedApps = Array.isArray(machineDetail?.installed_apps) ? machineDetail.installed_apps : [];
    const counts = { High: 0, Medium: 0, Low: 0, Unknown: 0 };
    installedApps.forEach((item) => {
      const key = String(item?.risk_level || "Unknown").trim();
      if (counts[key] !== undefined) {
        counts[key] += 1;
      } else {
        counts.Unknown += 1;
      }
    });
    return [
      { name: "High", value: counts.High },
      { name: "Medium", value: counts.Medium },
      { name: "Low", value: counts.Low },
      { name: "Unknown", value: counts.Unknown },
    ];
  }, [machineDetail]);

  const selectedMachineSummary = useMemo(
    () => machines.find((machine) => machine.id === selectedMachineId) || null,
    [machines, selectedMachineId]
  );

  if (!token) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 0%, rgba(59, 130, 246, 0.2), rgba(2, 6, 23, 1) 45%), linear-gradient(130deg, #020617 0%, #111827 60%, #1f2937 100%)",
          p: 2,
        }}
      >
        <Card sx={{ ...CARD_STYLE, width: 430, p: 1 }}>
          <CardContent>
            <Stack spacing={2.2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Security sx={{ color: "#38bdf8" }} />
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#f1f5f9" }}>
                  Cloud Security Core
                </Typography>
              </Stack>
              <Typography sx={{ color: "#94a3b8" }}>
                Admin login for global machine monitoring.
              </Typography>

              {authError ? <Alert severity="error">{authError}</Alert> : null}

              <TextField
                label="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ style: { color: "#cbd5e1" } }}
                sx={{
                  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(148, 163, 184, 0.32)" },
                }}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                variant="outlined"
                InputLabelProps={{ style: { color: "#cbd5e1" } }}
                sx={{
                  "& .MuiOutlinedInput-root": { color: "#e2e8f0" },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(148, 163, 184, 0.32)" },
                }}
              />
              <Button
                variant="contained"
                disabled={isLoggingIn}
                onClick={handleLogin}
                sx={{
                  py: 1.2,
                  borderRadius: 2,
                  fontWeight: 700,
                  background: "linear-gradient(120deg, #0ea5e9, #3b82f6)",
                }}
              >
                {isLoggingIn ? "Signing In..." : "Sign In"}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(140deg, #020617 0%, #111827 50%, #0f172a 100%)" }}>
      <AppBar position="sticky" sx={{ background: "rgba(2, 6, 23, 0.9)", backdropFilter: "blur(10px)" }}>
        <Toolbar>
          <Security sx={{ mr: 1.2, color: "#38bdf8" }} />
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }}>Cloud Security Dashboard</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={socketConnected ? "Live websocket connected" : "Live websocket reconnecting"}>
              <Chip
                icon={<Wifi />}
                label={socketConnected ? "Live" : "Offline"}
                size="small"
                sx={{
                  bgcolor: socketConnected ? "rgba(34,197,94,0.2)" : "rgba(248,113,113,0.2)",
                  color: socketConnected ? "#86efac" : "#fca5a5",
                }}
              />
            </Tooltip>
            <Button
              startIcon={<Refresh />}
              onClick={refreshAll}
              disabled={isRefreshing}
              variant="outlined"
              sx={{ borderColor: "rgba(56,189,248,0.5)", color: "#bae6fd" }}
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
            <Button startIcon={<Logout />} onClick={handleLogout} sx={{ color: "#f8fafc" }}>
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      {(loadingOverview || loadingMachines || loadingDetail) && <LinearProgress color="info" />}

      <Box sx={{ p: 2.5 }}>
        {dashboardError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {dashboardError}
          </Alert>
        ) : null}

        {lastLiveEvent ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Live update: {String(lastLiveEvent.type || "event")} on {lastLiveEvent.hostname || "machine"} at{" "}
            {formatTimestamp(lastLiveEvent.timestamp)}
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={CARD_STYLE}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Devices sx={{ color: "#22d3ee" }} />
                  <Typography color="#cbd5e1">Total Machines</Typography>
                </Stack>
                <Typography variant="h4" sx={{ color: "#f8fafc", mt: 1, fontWeight: 800 }}>
                  {overview?.total_machines ?? 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={CARD_STYLE}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Computer sx={{ color: "#4ade80" }} />
                  <Typography color="#cbd5e1">Machines Online</Typography>
                </Stack>
                <Typography variant="h4" sx={{ color: "#f8fafc", mt: 1, fontWeight: 800 }}>
                  {overview?.machines_online ?? 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={CARD_STYLE}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <NotificationsActive sx={{ color: "#fb7185" }} />
                  <Typography color="#cbd5e1">Vulnerabilities</Typography>
                </Stack>
                <Typography variant="h4" sx={{ color: "#f8fafc", mt: 1, fontWeight: 800 }}>
                  {overview?.total_vulnerabilities ?? 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={CARD_STYLE}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TrendingUp sx={{ color: "#f59e0b" }} />
                  <Typography color="#cbd5e1">Average Risk</Typography>
                </Stack>
                <Typography variant="h4" sx={{ color: "#f8fafc", mt: 1, fontWeight: 800 }}>
                  {overview?.average_risk_score ?? 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} lg={5}>
            <Card sx={{ ...CARD_STYLE, height: "100%" }}>
              <CardContent>
                <Typography variant="h6" sx={{ color: "#e2e8f0", fontWeight: 700, mb: 1.5 }}>
                  Machine Fleet
                </Typography>
                <TableContainer component={Paper} sx={{ background: "rgba(15,23,42,0.42)", maxHeight: 540 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Hostname</TableCell>
                        <TableCell>OS</TableCell>
                        <TableCell>Last Scan</TableCell>
                        <TableCell>Risk</TableCell>
                        <TableCell>Alerts</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {machines.map((machine) => (
                        <TableRow
                          key={machine.id}
                          hover
                          selected={machine.id === selectedMachineId}
                          onClick={() => setSelectedMachineId(machine.id)}
                          sx={{ cursor: "pointer" }}
                        >
                          <TableCell>
                            <Stack spacing={0.4}>
                              <Typography sx={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>
                                {machine.hostname}
                              </Typography>
                              <Chip
                                size="small"
                                label={machine.online ? "Online" : "Offline"}
                                sx={{
                                  width: 70,
                                  bgcolor: machine.online ? "rgba(34,197,94,0.2)" : "rgba(248,113,113,0.2)",
                                  color: machine.online ? "#86efac" : "#fca5a5",
                                }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: "#cbd5e1", fontSize: 12 }}>{machine.os}</TableCell>
                          <TableCell sx={{ color: "#cbd5e1", fontSize: 12 }}>{formatTimestamp(machine.last_scan)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              icon={<Bolt sx={{ color: "inherit !important" }} />}
                              label={machine.risk_score ?? 0}
                              sx={{
                                bgcolor:
                                  Number(machine.risk_score || 0) >= 80
                                    ? "rgba(239,68,68,0.2)"
                                    : Number(machine.risk_score || 0) >= 50
                                    ? "rgba(245,158,11,0.2)"
                                    : "rgba(34,197,94,0.2)",
                                color:
                                  Number(machine.risk_score || 0) >= 80
                                    ? "#fca5a5"
                                    : Number(machine.risk_score || 0) >= 50
                                    ? "#fcd34d"
                                    : "#86efac",
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "#f8fafc", fontWeight: 700 }}>{machine.alerts}</TableCell>
                        </TableRow>
                      ))}
                      {!loadingMachines && machines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ textAlign: "center", color: "#94a3b8" }}>
                            No registered machines yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Card sx={CARD_STYLE}>
              <CardContent>
                {!selectedMachineId ? (
                  <Box sx={{ py: 8, textAlign: "center", color: "#94a3b8" }}>
                    {loadingMachines ? <CircularProgress size={26} /> : "Select a machine to view details."}
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                      <Box>
                        <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 800 }}>
                          {machineDetail?.hostname || selectedMachineSummary?.hostname || "Machine Details"}
                        </Typography>
                        <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>
                          Last scan: {formatTimestamp(machineDetail?.last_scan || selectedMachineSummary?.last_scan)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Chip label={machineDetail?.os || selectedMachineSummary?.os || "Unknown OS"} />
                        <Chip
                          label={`Risk ${machineDetail?.risk_score ?? selectedMachineSummary?.risk_score ?? 0}`}
                          sx={{
                            bgcolor: "rgba(15,118,110,0.32)",
                            color: "#99f6e4",
                          }}
                        />
                        <Chip label={`Alerts ${machineDetail?.alerts ?? selectedMachineSummary?.alerts ?? 0}`} />
                      </Stack>
                    </Stack>

                    <Divider sx={{ borderColor: "rgba(148,163,184,0.2)" }} />

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 1.2, background: "rgba(15,23,42,0.4)", borderRadius: 2 }}>
                          <Typography sx={{ color: "#e2e8f0", mb: 1, fontWeight: 700 }}>
                            System Metrics Timeline
                          </Typography>
                          <Box sx={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={machineDetail?.system_metrics || []}>
                                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.2)" />
                                <XAxis
                                  dataKey="timestamp"
                                  stroke="#cbd5e1"
                                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                                />
                                <YAxis stroke="#cbd5e1" domain={[0, 100]} />
                                <RechartTooltip
                                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.35)" }}
                                  labelFormatter={(value) => formatTimestamp(value)}
                                />
                                <Line type="monotone" dataKey="cpu_usage" stroke="#22d3ee" strokeWidth={2} dot={false} name="CPU" />
                                <Line type="monotone" dataKey="ram_usage" stroke="#a78bfa" strokeWidth={2} dot={false} name="RAM" />
                                <Line type="monotone" dataKey="disk_usage" stroke="#fb7185" strokeWidth={2} dot={false} name="Disk" />
                                <Line type="monotone" dataKey="risk_score" stroke="#f59e0b" strokeWidth={2} dot={false} name="Risk" />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 1.2, background: "rgba(15,23,42,0.4)", borderRadius: 2 }}>
                          <Typography sx={{ color: "#e2e8f0", mb: 1, fontWeight: 700 }}>
                            App Risk Split
                          </Typography>
                          <Box sx={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={riskDistribution}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                                <XAxis dataKey="name" stroke="#cbd5e1" />
                                <YAxis stroke="#cbd5e1" />
                                <RechartTooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(148,163,184,0.35)" }} />
                                <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 1.2, background: "rgba(15,23,42,0.4)", borderRadius: 2, minHeight: 220 }}>
                          <Typography sx={{ color: "#e2e8f0", mb: 1, fontWeight: 700 }}>
                            Outdated Software
                          </Typography>
                          <Stack spacing={0.8}>
                            {(machineDetail?.outdated_software || []).slice(0, 10).map((app) => (
                              <Box key={`${app.name}-${app.current_version}`} sx={{ p: 0.8, borderRadius: 1.2, bgcolor: "rgba(30,41,59,0.7)" }}>
                                <Typography sx={{ color: "#f8fafc", fontWeight: 600, fontSize: 13 }}>{app.name}</Typography>
                                <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>
                                  {app.current_version} -> {app.latest_version}
                                </Typography>
                              </Box>
                            ))}
                            {(machineDetail?.outdated_software || []).length === 0 ? (
                              <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No outdated apps in latest scan.</Typography>
                            ) : null}
                          </Stack>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 1.2, background: "rgba(15,23,42,0.4)", borderRadius: 2, minHeight: 220 }}>
                          <Typography sx={{ color: "#e2e8f0", mb: 1, fontWeight: 700 }}>
                            Driver Issues
                          </Typography>
                          <Stack spacing={0.8}>
                            {(machineDetail?.driver_issues || []).slice(0, 10).map((driver) => (
                              <Stack
                                key={`${driver.driver_name}-${driver.status}`}
                                direction="row"
                                justifyContent="space-between"
                                sx={{ p: 0.8, borderRadius: 1.2, bgcolor: "rgba(30,41,59,0.7)" }}
                              >
                                <Typography sx={{ color: "#f8fafc", fontSize: 13 }}>{driver.driver_name}</Typography>
                                <Typography sx={{ color: "#fca5a5", fontSize: 12 }}>{driver.status}</Typography>
                              </Stack>
                            ))}
                            {(machineDetail?.driver_issues || []).length === 0 ? (
                              <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No driver issues in latest scan.</Typography>
                            ) : null}
                          </Stack>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Paper sx={{ p: 1.2, background: "rgba(15,23,42,0.4)", borderRadius: 2 }}>
                      <Typography sx={{ color: "#e2e8f0", mb: 1, fontWeight: 700 }}>Security Events</Typography>
                      <Stack spacing={0.8}>
                        {(machineDetail?.security_events || []).slice(0, 12).map((event, index) => (
                          <Stack key={`${event.timestamp}-${index}`} direction="row" spacing={1} alignItems="center">
                            <Chip
                              size="small"
                              label={event.risk_level}
                              sx={{ bgcolor: `${riskColor(event.risk_level)}33`, color: riskColor(event.risk_level) }}
                            />
                            <Typography sx={{ color: "#e2e8f0", fontSize: 13 }}>{event.event_type}</Typography>
                            <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>{formatTimestamp(event.timestamp)}</Typography>
                          </Stack>
                        ))}
                        {(machineDetail?.security_events || []).length === 0 ? (
                          <Typography sx={{ color: "#94a3b8", fontSize: 13 }}>No security events recorded.</Typography>
                        ) : null}
                      </Stack>
                    </Paper>
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default App;
