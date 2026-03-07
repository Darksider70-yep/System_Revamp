import React, { useEffect, useMemo, useRef, useState } from "react";
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
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
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
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";
import { Bolt, CloudSync, Download, Logout, NotificationsActive, Refresh, Security, UploadFile, Wifi } from "@mui/icons-material";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartTooltip, XAxis, YAxis, ZAxis } from "recharts";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AGENT_API_ENDPOINTS, CLOUD_API_ENDPOINTS, CLOUD_WS_ENDPOINTS } from "./apiConfig";

const AUTH_TOKEN_KEY = "system_revamp_cloud_token";
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10000, refetchOnWindowFocus: false } } });
const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#36d399" }, secondary: { main: "#f59e0b" }, error: { main: "#f43f5e" }, background: { default: "#071019", paper: "#0b1725" } },
  typography: { fontFamily: '"Space Grotesk", "Segoe UI", sans-serif', button: { textTransform: "none", fontWeight: 700 } },
  shape: { borderRadius: 16 },
});
const panelSx = { borderRadius: 4, border: "1px solid rgba(154,176,198,0.16)", background: "linear-gradient(180deg, rgba(11,23,37,0.98), rgba(7,16,25,0.96))" };
const monoSx = { fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace' };

const apiFetch = async (url, { token = "", method = "GET", body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(typeof payload === "object" ? payload?.error?.message || payload?.detail || "Request failed" : String(payload));
    error.status = response.status;
    throw error;
  }
  return payload;
};

const uploadOfflinePackage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(AGENT_API_ENDPOINTS.applyOfflinePackage, { method: "POST", body: formData });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.detail || "Upload failed");
  return payload;
};

const riskTone = (score) => {
  const value = Number(score || 0);
  if (value >= 80) return { label: "Critical", color: "#f43f5e" };
  if (value >= 60) return { label: "High", color: "#f97316" };
  if (value >= 40) return { label: "Medium", color: "#f59e0b" };
  return { label: "Low", color: "#36d399" };
};

const clusterColor = (cluster) => {
  const name = String(cluster || "").toLowerCase();
  if (name === "critical") return "#f43f5e";
  if (name === "high") return "#f97316";
  if (name === "medium") return "#f59e0b";
  return "#36d399";
};

const formatTs = (value) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "N/A" : parsed.toLocaleString();
};

const formatTime = (value) => {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "--" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const Panel = ({ title, subtitle, action, children }) => (
  <Paper sx={panelSx}>
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Box>
          <Typography color="#edf6ff" fontWeight={700}>{title}</Typography>
          {subtitle ? <Typography variant="caption" color="#8ca5bc">{subtitle}</Typography> : null}
        </Box>
        {action || null}
      </Stack>
      {children}
    </Box>
  </Paper>
);

function LoginScreen({ onAuthenticated }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      const payload = await apiFetch(CLOUD_API_ENDPOINTS.login, { method: "POST", body: { username, password } });
      localStorage.setItem(AUTH_TOKEN_KEY, payload.access_token);
      onAuthenticated(payload.access_token);
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #071019, #03070d)", p: 2 }}>
      <Card sx={{ ...panelSx, width: 420 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center"><Security sx={{ color: "#38bdf8" }} /><Typography variant="h5">System Revamp Cloud</Typography></Stack>
            <Typography color="#9ab0c6">Authenticate to access the security operations dashboard.</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="contained" onClick={submit}>Sign in</Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function Dashboard({ token, onLogout }) {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedMachineId, setSelectedMachineId] = useState(null);
  const [patchTarget, setPatchTarget] = useState("");
  const [groupName, setGroupName] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [alertsConnected, setAlertsConnected] = useState(false);
  const [alertFeed, setAlertFeed] = useState([]);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
  const notify = (message, severity = "success") => setToast({ open: true, severity, message });

  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.overview, { token }), refetchInterval: 30000 });
  const heatmapQuery = useQuery({ queryKey: ["heatmap"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.heatmap, { token }), refetchInterval: 20000 });
  const machinesQuery = useQuery({ queryKey: ["machines"], queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machines}?limit=200&offset=0`, { token }), refetchInterval: 20000 });
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.groups, { token }), refetchInterval: 30000 });
  const agentHealthQuery = useQuery({ queryKey: ["agent-health"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.health), refetchInterval: 30000 });
  const packagesQuery = useQuery({ queryKey: ["offline-packages"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.offlinePackages), refetchInterval: 20000 });
  const pendingQuery = useQuery({ queryKey: ["pending-patches"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.pendingPatches), refetchInterval: 20000 });
  const machines = useMemo(() => (Array.isArray(machinesQuery.data?.items) ? machinesQuery.data.items : []), [machinesQuery.data]);

  useEffect(() => { if (!selectedMachineId && machines.length > 0) setSelectedMachineId(machines[0].id); }, [machines, selectedMachineId]);

  const detailQuery = useQuery({ queryKey: ["detail", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machineDetails}/${selectedMachineId}?events_limit=120&history_points=90`, { token }), refetchInterval: 15000 });
  const riskQuery = useQuery({ queryKey: ["risk", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.riskScore}/${selectedMachineId}`, { token }), refetchInterval: 15000 });
  const predictedRiskQuery = useQuery({ queryKey: ["predict-risk", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.predictRisk}/${selectedMachineId}`, { token }), refetchInterval: 30000 });
  const vulnerabilityIntelQuery = useQuery({ queryKey: ["vulnerability-intel", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.vulnerabilities}/${selectedMachineId}/vulnerabilities?limit=15`, { token }), refetchInterval: 45000 });
  const eventsQuery = useQuery({ queryKey: ["events", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.events}/${selectedMachineId}/events?limit=200`, { token }), refetchInterval: 15000 });
  const patchStatusQuery = useQuery({ queryKey: ["patch-status", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.patchStatus}/${selectedMachineId}?limit=30`, { token }), refetchInterval: 15000 });

  const queueScan = useMutation({ mutationFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.queueScan}/${selectedMachineId}/scan`, { token, method: "POST", body: { force_full: true } }), onSuccess: () => notify("Manual scan queued."), onError: (e) => notify(e.message, "error") });
  const queuePatch = useMutation({ mutationFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.queuePatch}/${selectedMachineId}/patch`, { token, method: "POST", body: { software: patchTarget || null, patch_all: !patchTarget } }), onSuccess: () => { notify("Patch command queued."); qc.invalidateQueries({ queryKey: ["patch-status", selectedMachineId] }); }, onError: (e) => notify(e.message, "error") });
  const createGroup = useMutation({
    mutationFn: () => apiFetch(CLOUD_API_ENDPOINTS.groups, { token, method: "POST", body: { name: groupName, policy: { require_latest_software: true, max_risk_score: 80, mandatory_driver_presence: true } } }),
    onSuccess: () => { setGroupName(""); notify("Fleet group created."); qc.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (e) => notify(e.message, "error"),
  });
  const addMachineToGroup = useMutation({
    mutationFn: ({ groupId, machineId }) => apiFetch(`${CLOUD_API_ENDPOINTS.groups}/${groupId}/add-machine`, { token, method: "POST", body: { machine_id: machineId } }),
    onSuccess: () => { notify("Machine assigned to group."); qc.invalidateQueries({ queryKey: ["groups"] }); },
    onError: (e) => notify(e.message, "error"),
  });
  const scanGroup = useMutation({
    mutationFn: (groupId) => apiFetch(`${CLOUD_API_ENDPOINTS.groups}/${groupId}/scan`, { token, method: "POST", body: { force_full: true } }),
    onSuccess: (payload) => notify(`Queued ${payload.queued_commands} machine scans for group.`),
    onError: (e) => notify(e.message, "error"),
  });
  const applyOffline = useMutation({ mutationFn: uploadOfflinePackage, onSuccess: (payload) => { notify(`Offline package applied. ${payload.updates_available} updates scheduled.`); qc.invalidateQueries({ queryKey: ["pending-patches"] }); }, onError: (e) => notify(e.message, "error") });
  const autoPatch = useMutation({ mutationFn: () => apiFetch(AGENT_API_ENDPOINTS.autoPatch, { method: "POST", body: { software: [] } }), onSuccess: (payload) => { notify(`Auto patch completed. Patched ${payload.patched.length}.`); qc.invalidateQueries({ queryKey: ["pending-patches"] }); qc.invalidateQueries({ queryKey: ["patch-status", selectedMachineId] }); }, onError: (e) => notify(e.message, "error") });

  useEffect(() => {
    let ws; let reconnect; let disposed = false;
    const connect = () => {
      ws = new WebSocket(CLOUD_WS_ENDPOINTS.liveMachines);
      ws.onopen = () => setLiveConnected(true);
      ws.onclose = () => { setLiveConnected(false); if (!disposed) reconnect = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = () => {
        qc.invalidateQueries({ queryKey: ["overview"] });
        qc.invalidateQueries({ queryKey: ["heatmap"] });
        qc.invalidateQueries({ queryKey: ["machines"] });
        qc.invalidateQueries({ queryKey: ["groups"] });
        if (selectedMachineId) ["detail", "risk", "predict-risk", "vulnerability-intel", "events", "patch-status"].forEach((key) => qc.invalidateQueries({ queryKey: [key, selectedMachineId] }));
      };
    };
    connect(); return () => { disposed = true; if (reconnect) clearTimeout(reconnect); if (ws) ws.close(); };
  }, [qc, selectedMachineId]);

  useEffect(() => {
    let ws; let reconnect; let disposed = false;
    const connect = () => {
      ws = new WebSocket(CLOUD_WS_ENDPOINTS.alerts);
      ws.onopen = () => setAlertsConnected(true);
      ws.onclose = () => { setAlertsConnected(false); if (!disposed) reconnect = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload?.type || payload.type === "connected") return;
          setAlertFeed((prev) => [payload, ...prev].slice(0, 20));
        } catch {}
      };
    };
    connect(); return () => { disposed = true; if (reconnect) clearTimeout(reconnect); if (ws) ws.close(); };
  }, []);

  const detail = detailQuery.data || {};
  const risk = riskQuery.data || {};
  const predictedRisk = predictedRiskQuery.data || {};
  const events = Array.isArray(eventsQuery.data?.events) ? eventsQuery.data.events : [];
  const patches = Array.isArray(patchStatusQuery.data?.items) ? patchStatusQuery.data.items : [];
  const vulnerabilityFindings = Array.isArray(vulnerabilityIntelQuery.data?.findings) ? vulnerabilityIntelQuery.data.findings : [];
  const metricRows = Array.isArray(detail.system_metrics) ? detail.system_metrics : [];
  const outdatedApps = Array.isArray(detail.outdated_software) ? detail.outdated_software : [];
  const driverIssues = Array.isArray(detail.driver_issues) ? detail.driver_issues : [];
  const groups = Array.isArray(groupsQuery.data?.items) ? groupsQuery.data.items : [];
  const heatmapPoints = Array.isArray(heatmapQuery.data?.points) ? heatmapQuery.data.points : [];
  const clusterCounts = heatmapQuery.data?.clusters || { critical: 0, high: 0, medium: 0, low: 0 };
  const packages = Array.isArray(packagesQuery.data?.items) ? packagesQuery.data.items : [];
  const pendingPatches = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const bars = machines.slice(0, 8).map((item) => ({ name: item.hostname.slice(0, 10), risk: Number(item.risk_score || 0) }));
  const heatmapScatter = heatmapPoints.map((item) => ({ x: item.risk_score, y: item.vulnerability_count, z: item.health_status === "online" ? 2 : 1, name: item.hostname, cluster: item.cluster }));
  const clusterPie = Object.entries(clusterCounts).map(([name, value]) => ({ name, value }));
  const latestMetric = metricRows[metricRows.length - 1] || {};

  const generateOfflinePackage = async () => {
    try {
      const response = await fetch(AGENT_API_ENDPOINTS.generateOfflinePackage);
      if (!response.ok) throw new Error("Offline package generation failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "system_revamp_offline_package.zip";
      anchor.click();
      window.URL.revokeObjectURL(url);
      qc.invalidateQueries({ queryKey: ["offline-packages"] });
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", background: "linear-gradient(180deg, #071019, #03070d)" }}>
      <AppBar position="sticky" elevation={0} sx={{ background: "rgba(7,16,25,0.9)", borderBottom: "1px solid rgba(154,176,198,0.16)" }}>
        <Toolbar>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}><Security sx={{ color: "#38bdf8" }} /><Typography variant="h6">System Revamp Command Center</Typography></Stack>
          <Stack direction="row" spacing={1}><Chip icon={<Wifi />} label={liveConnected ? "Fleet online" : "Fleet reconnecting"} /><Chip icon={<NotificationsActive />} label={alertsConnected ? "Alerts online" : "Alerts reconnecting"} /><Button startIcon={<Refresh />} onClick={() => qc.invalidateQueries()}>Refresh</Button><Button startIcon={<Logout />} onClick={onLogout}>Logout</Button></Stack>
        </Toolbar>
      </AppBar>
      {(overviewQuery.isLoading || machinesQuery.isLoading) ? <LinearProgress /> : null}
      <Box sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}><Panel title="Global Security Overview"><Typography color="#9ab0c6">Total Machines</Typography><Typography variant="h4" sx={monoSx}>{Number(overviewQuery.data?.total_machines || 0)}</Typography></Panel></Grid>
          <Grid item xs={12} md={3}><Panel title="Machine Fleet Status"><Typography color="#9ab0c6">Machines Online</Typography><Typography variant="h4" sx={monoSx}>{Number(overviewQuery.data?.machines_online || 0)}</Typography></Panel></Grid>
          <Grid item xs={12} md={3}><Panel title="Vulnerability Heatmap"><Typography color="#9ab0c6">Vulnerabilities</Typography><Typography variant="h4" sx={monoSx}>{Number(overviewQuery.data?.total_vulnerabilities || 0)}</Typography></Panel></Grid>
          <Grid item xs={12} md={3}><Panel title="Security Alerts"><Typography color="#9ab0c6">Average Risk</Typography><Typography variant="h4" sx={monoSx}>{Number(overviewQuery.data?.average_risk_score || 0)}</Typography></Panel></Grid>

          <Grid item xs={12} lg={4}>
            <Panel title="Machine Fleet Status" subtitle="Select a machine and issue commands" action={<Button size="small" variant="outlined" onClick={() => queueScan.mutate()} disabled={!selectedMachineId}>Queue Scan</Button>}>
              <List sx={{ maxHeight: 380, overflowY: "auto", p: 0 }}>
                {machines.map((machine) => {
                  const tone = riskTone(machine.risk_score || 0);
                  return (
                    <ListItemButton key={machine.id} selected={machine.id === selectedMachineId} onClick={() => setSelectedMachineId(machine.id)} sx={{ mb: 1, borderRadius: 2 }}>
                      <ListItemText primary={machine.hostname} secondary={`${machine.os} | ${machine.online ? "online" : "offline"}`} />
                      <Chip size="small" label={`${tone.label} ${machine.risk_score || 0}`} sx={{ color: tone.color, bgcolor: alpha(tone.color, 0.14) }} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Panel title="Global Security Overview" subtitle="Fleet risk spread">
              <Box sx={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <RechartTooltip />
                    <Bar dataKey="risk">{bars.map((item) => <Cell key={item.name} fill={riskTone(item.risk).color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={8}>
            <Panel title="Global Security Heatmap" subtitle="Risk clusters, vulnerability concentration, machine health">
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <Box sx={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name="Risk Score" domain={[0, 100]} />
                        <YAxis type="number" dataKey="y" name="Vulnerabilities" />
                        <ZAxis type="number" dataKey="z" range={[90, 220]} />
                        <RechartTooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [value, name]} labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""} />
                        <Scatter data={heatmapScatter} shape={(props) => <circle {...props} fill={clusterColor(props.payload.cluster)} />} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={clusterPie} dataKey="value" nameKey="name" outerRadius={76} label>
                          {clusterPie.map((entry) => <Cell key={entry.name} fill={clusterColor(entry.name)} />)}
                        </Pie>
                        <RechartTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Stack spacing={2}>
              <Panel title="Predictive Risk Engine" subtitle="RandomForest vulnerability escalation forecast">
                <Typography color="#9ab0c6">Predicted Escalation</Typography>
                <Typography variant="h4" sx={monoSx}>{Number(predictedRisk.risk_prediction || 0).toFixed(2)}</Typography>
                <Chip sx={{ mt: 1 }} label={`${predictedRisk.risk_level || "Unknown"} (${predictedRisk.model_state || "n/a"})`} />
                <Typography variant="caption" display="block" color="#8ca5bc" sx={{ mt: 1 }}>
                  Training Rows: {predictedRisk.training_rows || 0}
                </Typography>
              </Panel>
              <Panel title="Enterprise Fleet Groups" subtitle="Group machines, assign policy baseline, run group scans">
                <Stack spacing={1}>
                  <TextField size="small" label="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                  <Button variant="contained" onClick={() => createGroup.mutate()} disabled={!groupName.trim()}>Create Group</Button>
                </Stack>
                <Stack spacing={1} sx={{ mt: 1.2, maxHeight: 170, overflowY: "auto" }}>
                  {groups.map((group) => (
                    <Paper key={group.id} sx={{ p: 1, borderRadius: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography>{group.name}</Typography>
                          <Typography variant="caption" color="#8ca5bc">{group.machine_count} machines</Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => scanGroup.mutate(group.id)}>Scan</Button>
                          <Button size="small" disabled={!selectedMachineId} onClick={() => addMachineToGroup.mutate({ groupId: group.id, machineId: selectedMachineId })}>Add Selected</Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                  {groups.length === 0 ? <Typography color="#8ca5bc">No groups configured.</Typography> : null}
                </Stack>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={7}>
            <Panel title="Selected Machine Telemetry" subtitle={detail.hostname || "No machine selected"}>
              <Box sx={{ height: 240, mb: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metricRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                    <YAxis domain={[0, 100]} />
                    <RechartTooltip labelFormatter={formatTs} />
                    <Line type="monotone" dataKey="cpu_usage" stroke="#38bdf8" dot={false} />
                    <Line type="monotone" dataKey="ram_usage" stroke="#36d399" dot={false} />
                    <Line type="monotone" dataKey="risk_score" stroke="#f43f5e" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}><Typography color="#9ab0c6">CPU</Typography><Typography sx={monoSx}>{Number(latestMetric.cpu_usage || 0).toFixed(1)}%</Typography><Typography color="#9ab0c6">RAM</Typography><Typography sx={monoSx}>{Number(latestMetric.ram_usage || 0).toFixed(1)}%</Typography><Typography color="#9ab0c6">Risk</Typography><Typography sx={monoSx}>{risk.risk_score || 0}</Typography><Typography color="#9ab0c6">Driver issues</Typography><Typography sx={monoSx}>{driverIssues.length}</Typography></Grid>
                <Grid item xs={12} md={8}>
                  <TableContainer sx={{ maxHeight: 180 }}>
                    <Table size="small" stickyHeader>
                      <TableHead><TableRow><TableCell>Outdated Software</TableCell><TableCell>Current</TableCell><TableCell>Latest</TableCell></TableRow></TableHead>
                      <TableBody>
                        {outdatedApps.slice(0, 6).map((item) => <TableRow key={`${item.name}-${item.current_version}`}><TableCell>{item.name}</TableCell><TableCell sx={monoSx}>{item.current_version}</TableCell><TableCell sx={monoSx}>{item.latest_version}</TableCell></TableRow>)}
                        {outdatedApps.length === 0 ? <TableRow><TableCell colSpan={3}>No outdated software recorded.</TableCell></TableRow> : null}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            </Panel>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Stack spacing={2}>
              <Panel title="Security Alerts" subtitle="Recent alert stream">
                <Stack spacing={1} sx={{ maxHeight: 180, overflowY: "auto" }}>
                  {(alertFeed.length > 0 ? alertFeed : events.slice(-6).reverse()).map((item, index) => <Paper key={`${item.timestamp || index}`} sx={{ p: 1, borderRadius: 2 }}><Typography>{item.message || item.event_type || item.type}</Typography><Typography variant="caption" color="#8ca5bc">{formatTs(item.timestamp)}</Typography></Paper>)}
                </Stack>
              </Panel>
              <Panel title="Patch Status" subtitle="Queue targeted or fleet patch commands" action={<Button size="small" variant="contained" startIcon={<Bolt />} disabled={!selectedMachineId} onClick={() => queuePatch.mutate()}>Queue Patch</Button>}>
                <TextField select fullWidth size="small" label="Patch target" value={patchTarget} onChange={(e) => setPatchTarget(e.target.value)} sx={{ mb: 1.2 }}>
                  <MenuItem value="">Patch all upgradable packages</MenuItem>
                  {outdatedApps.map((item) => <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>)}
                </TextField>
                <Stack spacing={0.8}>
                  {patches.slice(0, 6).map((item) => <Paper key={item.command_id || `${item.software}-${item.timestamp}`} sx={{ p: 1, borderRadius: 2 }}><Typography>{item.software}</Typography><Typography variant="caption" color={riskTone(item.status === "patch_failed" ? 80 : item.status === "queued" ? 40 : 20).color}>{item.status} | {item.provider}</Typography></Paper>)}
                  {patches.length === 0 ? <Typography color="#8ca5bc">No patch commands recorded.</Typography> : null}
                </Stack>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Panel title="Vulnerability Intelligence Integration" subtitle="NVD + GitHub Security Advisories + OS vendor advisories">
              <TableContainer sx={{ maxHeight: 240 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Software</TableCell>
                      <TableCell>CVE</TableCell>
                      <TableCell>Severity</TableCell>
                      <TableCell>CVSS</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vulnerabilityFindings.slice(0, 30).map((item) => (
                      <TableRow key={`${item.source}-${item.cve}`}>
                        <TableCell>{item.software}</TableCell>
                        <TableCell>{item.cve}</TableCell>
                        <TableCell>{item.severity}</TableCell>
                        <TableCell sx={monoSx}>{item.cvss_score ?? "N/A"}</TableCell>
                        <TableCell>{item.source}</TableCell>
                      </TableRow>
                    ))}
                    {vulnerabilityFindings.length === 0 ? <TableRow><TableCell colSpan={5}>No live advisories matched current software inventory.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Panel>
          </Grid>

          <Grid item xs={12}>
            <Panel title="Offline Sync Panel" subtitle="Generate, import, and apply offline update packages" action={<Chip icon={<CloudSync />} label={agentHealthQuery.data?.checks?.api?.status === "ok" ? "Agent linked to cloud" : "Agent degraded"} />}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography fontWeight={700} mb={1}>Available Update Packages</Typography>
                  <Stack spacing={0.8} sx={{ maxHeight: 180, overflowY: "auto" }}>
                    {packages.map((item) => <Paper key={item.path} sx={{ p: 1, borderRadius: 2 }}><Typography>{item.name}</Typography><Typography variant="caption" color="#8ca5bc">{formatTs(item.modified_at)}</Typography></Paper>)}
                  </Stack>
                  <Button fullWidth sx={{ mt: 1.2 }} variant="contained" startIcon={<Download />} onClick={generateOfflinePackage}>Generate Package</Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography fontWeight={700} mb={1}>Package Import</Typography>
                  <input ref={fileInputRef} type="file" accept=".zip" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) applyOffline.mutate(file); }} />
                  <Button fullWidth variant="outlined" startIcon={<UploadFile />} onClick={() => fileInputRef.current?.click()}>Import Offline Package</Button>
                  <Divider sx={{ my: 1.2 }} />
                  <Button fullWidth variant="contained" color="secondary" startIcon={<Bolt />} onClick={() => autoPatch.mutate()} disabled={autoPatch.isPending}>Run Auto Patch</Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography fontWeight={700} mb={1}>Scheduled Offline Updates</Typography>
                  <Stack spacing={0.8} sx={{ maxHeight: 180, overflowY: "auto" }}>
                    {pendingPatches.map((item) => <Paper key={`${item.name}-${item.current_version}`} sx={{ p: 1, borderRadius: 2 }}><Typography>{item.name}</Typography><Typography variant="caption" color="#8ca5bc" sx={monoSx}>{item.current_version} -> {item.latest_version}</Typography></Paper>)}
                    {pendingPatches.length === 0 ? <Typography color="#8ca5bc">No scheduled offline updates.</Typography> : null}
                  </Stack>
                </Grid>
              </Grid>
            </Panel>
          </Grid>

          <Grid item xs={12}>
            <Panel title="Risk Envelope" subtitle="Historical risk progression">
              <Box sx={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                    <YAxis domain={[0, 100]} />
                    <RechartTooltip labelFormatter={formatTs} />
                    <Area type="monotone" dataKey="risk_score" stroke="#f43f5e" fill="rgba(244,63,94,0.22)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Panel>
          </Grid>
        </Grid>
      </Box>
      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast((prev) => ({ ...prev, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((prev) => ({ ...prev, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const logout = () => { localStorage.removeItem(AUTH_TOKEN_KEY); setToken(""); };
  return <ThemeProvider theme={theme}><QueryClientProvider client={queryClient}>{token ? <Dashboard token={token} onLogout={logout} /> : <LoginScreen onAuthenticated={setToken} />}</QueryClientProvider></ThemeProvider>;
}

export default App;
