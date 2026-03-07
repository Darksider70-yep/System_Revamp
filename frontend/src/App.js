import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
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
import {
  AutoGraph,
  Bolt,
  CloudSync,
  Download,
  Logout,
  NotificationsActive,
  Refresh,
  Search,
  Security,
  UploadFile,
  Wifi,
} from "@mui/icons-material";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Canvas, useFrame } from "@react-three/fiber";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AGENT_API_ENDPOINTS, CLOUD_API_ENDPOINTS, CLOUD_WS_ENDPOINTS } from "./apiConfig";

const AUTH_TOKEN_KEY = "system_revamp_cloud_token";
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10000, refetchOnWindowFocus: false } } });
const monoSx = { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' };
const panelSx = {
  borderRadius: 4,
  border: "1px solid rgba(145,166,191,0.22)",
  background: "linear-gradient(160deg, rgba(9,16,28,.94) 0%, rgba(7,12,21,.95) 100%)",
  boxShadow: "0 14px 40px rgba(0,0,0,.32)",
  backdropFilter: "blur(10px)",
};
const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#31c7d5" }, secondary: { main: "#f5a35b" }, background: { default: "#040912", paper: "#0b1322" } },
  typography: { fontFamily: '"Sora", "Segoe UI", sans-serif', button: { textTransform: "none", fontWeight: 700 } },
  shape: { borderRadius: 16 },
});

const apiFetch = async (url, { token = "", method = "GET", body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.headers.get("Content-Type")?.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(typeof payload === "object" ? payload?.error?.message || payload?.detail || "Request failed" : String(payload));
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
  const v = Number(score || 0);
  if (v >= 85) return { label: "Critical", color: "#ff5a67" };
  if (v >= 65) return { label: "High", color: "#ff9852" };
  if (v >= 40) return { label: "Medium", color: "#f5b642" };
  return { label: "Low", color: "#34d399" };
};
const clusterColor = (cluster) => {
  const n = String(cluster || "").toLowerCase();
  if (n === "critical") return "#ff5a67";
  if (n === "high") return "#ff9852";
  if (n === "medium") return "#f5b642";
  return "#34d399";
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
    <Box sx={{ px: 2, py: 1.4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.2}>
        <Box>
          <Typography sx={{ color: "#eef4ff", fontWeight: 700 }}>{title}</Typography>
          {subtitle ? <Typography variant="caption" sx={{ color: "#95aac6" }}>{subtitle}</Typography> : null}
        </Box>
        {action || null}
      </Stack>
      {children}
    </Box>
  </Paper>
);

const StatCard = ({ title, value, hint, tone }) => (
  <Card sx={{ ...panelSx, borderColor: alpha(tone, 0.36), ":hover": { transform: "translateY(-2px)" }, transition: "all .2s ease" }}>
    <CardContent sx={{ py: 1.5 }}>
      <Typography variant="caption" sx={{ color: "#8fa4c1" }}>{title}</Typography>
      <Typography variant="h4" sx={{ ...monoSx, color: "#edf4ff", mt: 0.3 }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: "#8fa4c1" }}>{hint}</Typography>
    </CardContent>
  </Card>
);

function RiskOrbMesh({ score, prediction }) {
  const core = useRef(null);
  const shell = useRef(null);
  const ring = useRef(null);
  const accent = riskTone(Math.max(score, prediction * 100)).color;
  const intensity = Math.min(1.6, Math.max(0.2, score / 100 + prediction * 0.7));
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (core.current) {
      core.current.rotation.x = t * 0.26;
      core.current.rotation.y = t * 0.42;
      core.current.scale.setScalar(1 + Math.sin(t * 2.3) * 0.05 * intensity);
    }
    if (shell.current) shell.current.rotation.y = -t * 0.2;
    if (ring.current) {
      ring.current.rotation.z = t * 0.5;
      ring.current.rotation.x = Math.PI / 2.8 + Math.sin(t * 1.2) * 0.15;
    }
  });
  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.0, 2]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2 + intensity * 0.22} metalness={0.64} roughness={0.2} />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.33, 1]} />
        <meshBasicMaterial color={accent} wireframe transparent opacity={0.35} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2.8, 0, 0]}>
        <torusGeometry args={[1.8, 0.034, 18, 100]} />
        <meshStandardMaterial color="#7cdff5" emissive="#7cdff5" emissiveIntensity={0.24} metalness={0.7} roughness={0.24} />
      </mesh>
    </group>
  );
}

const Risk3DPanel = ({ riskScore, prediction, level, modelState }) => (
  <Box sx={{ borderRadius: 3, border: "1px solid rgba(145,166,191,0.22)", p: 1, background: "rgba(8,14,24,.72)" }}>
    <Box sx={{ height: 220, borderRadius: 3, overflow: "hidden" }}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }} dpr={[1, 2]}>
        <color attach="background" args={["#07101d"]} />
        <ambientLight intensity={0.45} />
        <pointLight position={[2.3, 2.2, 2.5]} intensity={1.3} color="#8ce9ff" />
        <pointLight position={[-2.2, -2.1, -2]} intensity={0.9} color={riskTone(riskScore).color} />
        <RiskOrbMesh score={riskScore} prediction={prediction} />
      </Canvas>
    </Box>
    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
      <Typography sx={{ ...monoSx, color: "#eff6ff" }}>Risk {riskScore}</Typography>
      <Typography sx={{ ...monoSx, color: "#eff6ff" }}>Forecast {Math.round(prediction * 100)}%</Typography>
    </Stack>
    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
      <Chip size="small" sx={{ backgroundColor: alpha(riskTone(riskScore).color, 0.2), color: riskTone(riskScore).color }} label={level || riskTone(riskScore).label} />
      <Chip size="small" sx={{ backgroundColor: alpha("#31c7d5", 0.2), color: "#97f0ff" }} label={modelState || "n/a"} />
    </Stack>
  </Box>
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
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ ...panelSx, width: 450, borderColor: "rgba(49,199,213,.36)" }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center"><Security sx={{ color: "#8ce9ff" }} /><Typography variant="h5">System Revamp Command Grid</Typography></Stack>
            <Typography sx={{ color: "#9cb0cb" }}>Authenticate to access the security operations dashboard.</Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="contained" size="large" onClick={submit}>Open Dashboard</Button>
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
  const [machineSearch, setMachineSearch] = useState("");
  const [patchTarget, setPatchTarget] = useState("");
  const [groupName, setGroupName] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [alertsConnected, setAlertsConnected] = useState(false);
  const [alertFeed, setAlertFeed] = useState([]);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
  const deferredSearch = useDeferredValue(machineSearch);
  const notify = (message, severity = "success") => setToast({ open: true, severity, message });

  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.overview, { token }), refetchInterval: 30000 });
  const heatmapQuery = useQuery({ queryKey: ["heatmap"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.heatmap, { token }), refetchInterval: 20000 });
  const machinesQuery = useQuery({ queryKey: ["machines"], queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machines}?limit=200&offset=0`, { token }), refetchInterval: 20000 });
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: () => apiFetch(CLOUD_API_ENDPOINTS.groups, { token }), refetchInterval: 30000 });
  const agentHealthQuery = useQuery({ queryKey: ["agent-health"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.health), refetchInterval: 30000 });
  const packagesQuery = useQuery({ queryKey: ["offline-packages"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.offlinePackages), refetchInterval: 20000 });
  const pendingQuery = useQuery({ queryKey: ["pending-patches"], queryFn: () => apiFetch(AGENT_API_ENDPOINTS.pendingPatches), refetchInterval: 20000 });
  const machines = useMemo(() => (Array.isArray(machinesQuery.data?.items) ? machinesQuery.data.items : []), [machinesQuery.data]);
  const filteredMachines = useMemo(() => {
    const tokenized = deferredSearch.trim().toLowerCase();
    if (!tokenized) return machines;
    return machines.filter((m) => `${m.hostname} ${m.os}`.toLowerCase().includes(tokenized));
  }, [machines, deferredSearch]);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) setSelectedMachineId(machines[0].id);
  }, [machines, selectedMachineId]);

  const detailQuery = useQuery({ queryKey: ["detail", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.machineDetails}/${selectedMachineId}?events_limit=120&history_points=90`, { token }), refetchInterval: 15000 });
  const riskQuery = useQuery({ queryKey: ["risk", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.riskScore}/${selectedMachineId}`, { token }), refetchInterval: 15000 });
  const predictedRiskQuery = useQuery({ queryKey: ["predict-risk", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.predictRisk}/${selectedMachineId}`, { token }), refetchInterval: 30000 });
  const vulnerabilityQuery = useQuery({ queryKey: ["vulnerability-intel", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.vulnerabilities}/${selectedMachineId}/vulnerabilities?limit=24`, { token }), refetchInterval: 45000 });
  const eventsQuery = useQuery({ queryKey: ["events", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.events}/${selectedMachineId}/events?limit=200`, { token }), refetchInterval: 15000 });
  const patchStatusQuery = useQuery({ queryKey: ["patch-status", selectedMachineId], enabled: Boolean(selectedMachineId), queryFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.patchStatus}/${selectedMachineId}?limit=40`, { token }), refetchInterval: 15000 });

  const queueScan = useMutation({
    mutationFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.queueScan}/${selectedMachineId}/scan`, { token, method: "POST", body: { force_full: true } }),
    onSuccess: () => notify("Manual scan queued."),
    onError: (e) => notify(e.message, "error"),
  });
  const queuePatch = useMutation({
    mutationFn: () => apiFetch(`${CLOUD_API_ENDPOINTS.queuePatch}/${selectedMachineId}/patch`, { token, method: "POST", body: { software: patchTarget || null, patch_all: !patchTarget } }),
    onSuccess: () => { notify("Patch command queued."); qc.invalidateQueries({ queryKey: ["patch-status", selectedMachineId] }); },
    onError: (e) => notify(e.message, "error"),
  });
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
    onSuccess: (payload) => notify(`Queued ${payload.queued_commands} machine scans.`),
    onError: (e) => notify(e.message, "error"),
  });
  const applyOffline = useMutation({
    mutationFn: uploadOfflinePackage,
    onSuccess: (payload) => { notify(`Offline package applied. ${payload.updates_available} updates scheduled.`); qc.invalidateQueries({ queryKey: ["pending-patches"] }); qc.invalidateQueries({ queryKey: ["offline-packages"] }); },
    onError: (e) => notify(e.message, "error"),
  });
  const autoPatch = useMutation({
    mutationFn: () => apiFetch(AGENT_API_ENDPOINTS.autoPatch, { method: "POST", body: { software: [] } }),
    onSuccess: (payload) => { notify(`Auto patch completed. Patched ${payload.patched.length} package(s).`); qc.invalidateQueries({ queryKey: ["pending-patches"] }); qc.invalidateQueries({ queryKey: ["patch-status", selectedMachineId] }); },
    onError: (e) => notify(e.message, "error"),
  });

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
    connect();
    return () => { disposed = true; if (reconnect) clearTimeout(reconnect); if (ws) ws.close(); };
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
          setAlertFeed((prev) => [payload, ...prev].slice(0, 25));
        } catch {
          return;
        }
      };
    };
    connect();
    return () => { disposed = true; if (reconnect) clearTimeout(reconnect); if (ws) ws.close(); };
  }, []);

  const detail = detailQuery.data || {};
  const risk = riskQuery.data || {};
  const predicted = predictedRiskQuery.data || {};
  const events = Array.isArray(eventsQuery.data?.events) ? eventsQuery.data.events : [];
  const patches = Array.isArray(patchStatusQuery.data?.items) ? patchStatusQuery.data.items : [];
  const groups = Array.isArray(groupsQuery.data?.items) ? groupsQuery.data.items : [];
  const heatmapPoints = Array.isArray(heatmapQuery.data?.points) ? heatmapQuery.data.points : [];
  const clusters = heatmapQuery.data?.clusters || { critical: 0, high: 0, medium: 0, low: 0 };
  const packages = Array.isArray(packagesQuery.data?.items) ? packagesQuery.data.items : [];
  const pendingPatches = Array.isArray(pendingQuery.data?.items) ? pendingQuery.data.items : [];
  const vulnerabilities = Array.isArray(vulnerabilityQuery.data?.findings) ? vulnerabilityQuery.data.findings : [];
  const metrics = Array.isArray(detail.system_metrics) ? detail.system_metrics : [];
  const outdatedApps = Array.isArray(detail.outdated_software) ? detail.outdated_software : [];
  const driverIssues = Array.isArray(detail.driver_issues) ? detail.driver_issues : [];
  const riskScore = Number(risk.risk_score || detail.risk_score || 0);
  const prediction = Number(predicted.risk_prediction || 0);
  const predictionDelta = Math.round(prediction * 100) - riskScore;
  const scatter = heatmapPoints.map((i) => ({ x: i.risk_score, y: i.vulnerability_count, z: i.health_status === "online" ? 2 : 1, name: i.hostname, cluster: i.cluster }));
  const pie = Object.entries(clusters).map(([name, value]) => ({ name, value }));
  const latestMetric = metrics[metrics.length - 1] || {};
  const alerts = alertFeed.length > 0 ? alertFeed : events.slice(-15).reverse();
  const topStats = [
    { title: "Fleet Size", value: Number(overviewQuery.data?.total_machines || 0), hint: "registered endpoints", tone: "#31c7d5" },
    { title: "Machines Online", value: Number(overviewQuery.data?.machines_online || 0), hint: "active in window", tone: "#2fbf71" },
    { title: "Vulnerabilities", value: Number(overviewQuery.data?.total_vulnerabilities || 0), hint: "open findings", tone: "#f5b642" },
    { title: "Average Risk", value: Number(overviewQuery.data?.average_risk_score || 0).toFixed(1), hint: "fleet weighted", tone: riskTone(Number(overviewQuery.data?.average_risk_score || 0)).color },
  ];

  const generateOfflinePackage = async () => {
    try {
      const response = await fetch(AGENT_API_ENDPOINTS.generateOfflinePackage);
      if (!response.ok) throw new Error("Offline package generation failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `system_revamp_offline_${Date.now()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      qc.invalidateQueries({ queryKey: ["offline-packages"] });
      notify("Offline package generated.");
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", pb: 2 }}>
      <AppBar position="sticky" elevation={0} sx={{ background: "rgba(5,11,20,.9)", borderBottom: "1px solid rgba(145,166,191,.22)", backdropFilter: "blur(14px)" }}>
        <Toolbar sx={{ minHeight: "72px !important", px: { xs: 1.4, md: 2.2 } }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ flexGrow: 1 }}>
            <AutoGraph sx={{ color: "#8ce9ff" }} />
            <Box>
              <Typography variant="h6">System Revamp Security Command Grid</Typography>
              <Typography variant="caption" sx={{ color: "#8fa4c1" }}>Top panel operation view</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Chip icon={<Wifi />} label={liveConnected ? "Fleet Live" : "Fleet Reconnecting"} sx={{ backgroundColor: alpha("#31c7d5", 0.15), color: "#a7f4ff", border: "1px solid rgba(49,199,213,.3)" }} />
            <Chip icon={<NotificationsActive />} label={alertsConnected ? "Alerts Live" : "Alerts Reconnecting"} sx={{ backgroundColor: alpha("#f5b642", 0.15), color: "#ffe6a7", border: "1px solid rgba(245,182,66,.3)" }} />
            <Button startIcon={<Refresh />} onClick={() => qc.invalidateQueries()}>Refresh</Button>
            <Button startIcon={<Logout />} onClick={onLogout}>Logout</Button>
          </Stack>
        </Toolbar>
      </AppBar>
      {(overviewQuery.isLoading || machinesQuery.isLoading) ? <LinearProgress /> : null}
      <Box sx={{ p: { xs: 1.5, md: 2.2 } }}>
        <Grid container spacing={2}>
          {topStats.map((s) => <Grid key={s.title} item xs={12} sm={6} lg={3}><StatCard title={s.title} value={s.value} hint={s.hint} tone={s.tone} /></Grid>)}
          <Grid item xs={12} lg={3}>
            <Stack spacing={2}>
              <Panel title="Fleet Panel" subtitle="Search and select machines" action={<Button size="small" variant="outlined" disabled={!selectedMachineId || queueScan.isPending} onClick={() => queueScan.mutate()}>Queue Scan</Button>}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search machine"
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                  sx={{ mb: 1 }}
                />
                <List sx={{ p: 0, maxHeight: 390, overflowY: "auto" }}>
                  {filteredMachines.map((m) => {
                    const tone = riskTone(m.risk_score || 0);
                    return (
                      <ListItemButton key={m.id} selected={m.id === selectedMachineId} onClick={() => setSelectedMachineId(m.id)} sx={{ mb: .8, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: m.id === selectedMachineId ? alpha("#31c7d5", .12) : "rgba(6,11,19,.55)" }}>
                        <ListItemText primary={m.hostname} secondary={`${m.os} • ${m.online ? "online" : "offline"}`} />
                        <Chip size="small" label={`${tone.label} ${m.risk_score || 0}`} sx={{ backgroundColor: alpha(tone.color, .18), color: tone.color }} />
                      </ListItemButton>
                    );
                  })}
                  {filteredMachines.length === 0 ? <Typography sx={{ color: "#8fa4c1", p: .8 }}>No machine match.</Typography> : null}
                </List>
              </Panel>
              <Panel title="Group Panel" subtitle="Fleet grouping and scan orchestration">
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField size="small" label="Group name" fullWidth value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                  <Button variant="contained" disabled={!groupName.trim()} onClick={() => createGroup.mutate()}>Create</Button>
                </Stack>
                <Stack spacing={.8} sx={{ maxHeight: 170, overflowY: "auto" }}>
                  {groups.map((g) => (
                    <Paper key={g.id} sx={{ p: .9, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box><Typography>{g.name}</Typography><Typography variant="caption" sx={{ color: "#8fa4c1" }}>{g.machine_count} machine(s)</Typography></Box>
                        <Stack direction="row" spacing={.6}>
                          <Button size="small" onClick={() => scanGroup.mutate(g.id)}>Scan</Button>
                          <Button size="small" disabled={!selectedMachineId} onClick={() => addMachineToGroup.mutate({ groupId: g.id, machineId: selectedMachineId })}>Add</Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                  {groups.length === 0 ? <Typography sx={{ color: "#8fa4c1" }}>No groups yet.</Typography> : null}
                </Stack>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Stack spacing={2}>
              <Panel title="Risk Core Panel" subtitle="3D risk orb and escalation forecast" action={<Chip size="small" label={`Prediction Δ ${predictionDelta >= 0 ? "+" : ""}${predictionDelta}`} sx={{ backgroundColor: alpha(predictionDelta > 0 ? "#ff9852" : "#34d399", .2), color: predictionDelta > 0 ? "#ffb380" : "#96f4bf" }} />}>
                <Grid container spacing={1.2}>
                  <Grid item xs={12} md={7}><Risk3DPanel riskScore={riskScore} prediction={prediction} level={predicted.risk_level} modelState={predicted.model_state} /></Grid>
                  <Grid item xs={12} md={5}>
                    <Stack spacing={1}>
                      <Paper sx={{ p: 1, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}><Typography variant="caption" sx={{ color: "#8fa4c1" }}>Machine</Typography><Typography>{detail.hostname || "Not selected"}</Typography><Typography variant="caption" sx={{ color: "#8fa4c1" }}>{detail.os || "Unknown OS"}</Typography></Paper>
                      <Paper sx={{ p: 1, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}><Typography variant="caption" sx={{ color: "#8fa4c1" }}>Model</Typography><Typography sx={monoSx}>{predicted.model || "RandomForestClassifier"}</Typography><Typography variant="caption" sx={{ color: "#8fa4c1" }}>Rows {predicted.training_rows || 0} • {predicted.lookback_days || 0}d</Typography></Paper>
                      <Paper sx={{ p: 1, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}><Typography variant="caption" sx={{ color: "#8fa4c1" }}>Breakdown</Typography><Typography>Outdated: {risk.breakdown?.outdated_apps || 0}</Typography><Typography>Drivers: {risk.breakdown?.missing_drivers || 0}</Typography><Typography>Events: {risk.breakdown?.security_events || 0}</Typography></Paper>
                    </Stack>
                  </Grid>
                </Grid>
              </Panel>

              <Panel title="Threat Heatmap Panel" subtitle="Risk clusters and vulnerability concentration">
                <Grid container spacing={1}>
                  <Grid item xs={12} md={8}>
                    <Box sx={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,146,171,.2)" />
                          <XAxis type="number" dataKey="x" name="Risk" domain={[0, 100]} />
                          <YAxis type="number" dataKey="y" name="Vulnerabilities" />
                          <ZAxis type="number" dataKey="z" range={[80, 220]} />
                          <RechartTooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ""} />
                          <Scatter data={scatter} shape={(props) => <circle {...props} fill={clusterColor(props.payload.cluster)} />} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pie} dataKey="value" nameKey="name" outerRadius={70} label>
                            {pie.map((p) => <Cell key={p.name} fill={clusterColor(p.name)} />)}
                          </Pie>
                          <RechartTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                </Grid>
              </Panel>

              <Panel title="Telemetry Panel" subtitle="CPU, RAM, Risk trajectory">
                <Box sx={{ height: 230 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,146,171,.2)" />
                      <XAxis dataKey="timestamp" tickFormatter={formatTime} />
                      <YAxis domain={[0, 100]} />
                      <RechartTooltip labelFormatter={formatTs} />
                      <Line type="monotone" dataKey="cpu_usage" stroke="#79d9ff" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="ram_usage" stroke="#4ade80" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="risk_score" stroke="#ff6b6b" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Typography sx={monoSx}>CPU {Number(latestMetric.cpu_usage || 0).toFixed(1)}%</Typography>
                  <Typography sx={monoSx}>RAM {Number(latestMetric.ram_usage || 0).toFixed(1)}%</Typography>
                  <Typography sx={monoSx}>Outdated {outdatedApps.length}</Typography>
                  <Typography sx={monoSx}>Drivers {driverIssues.length}</Typography>
                </Stack>
                <Box sx={{ height: 90, mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics}>
                      <XAxis dataKey="timestamp" hide />
                      <YAxis hide domain={[0, 100]} />
                      <Area type="monotone" dataKey="risk_score" stroke="#ff6b6b" fill="rgba(255,107,107,.18)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={3}>
            <Stack spacing={2}>
              <Panel title="Alerts Panel" subtitle="Live threat feed">
                <Stack spacing={.8} sx={{ maxHeight: 210, overflowY: "auto" }}>
                  {alerts.map((a, i) => <Paper key={`${a.timestamp || i}-${i}`} sx={{ p: .9, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}><Typography>{a.message || a.event_type || a.type || "Security event"}</Typography><Typography variant="caption" sx={{ color: "#8fa4c1" }}>{formatTs(a.timestamp)}</Typography></Paper>)}
                  {alerts.length === 0 ? <Typography sx={{ color: "#8fa4c1" }}>No alerts available.</Typography> : null}
                </Stack>
              </Panel>
              <Panel title="Patch Panel" subtitle="Command and status view" action={<Button size="small" variant="contained" startIcon={<Bolt />} disabled={!selectedMachineId || queuePatch.isPending} onClick={() => queuePatch.mutate()}>Queue</Button>}>
                <TextField select size="small" fullWidth label="Patch target" value={patchTarget} onChange={(e) => setPatchTarget(e.target.value)} sx={{ mb: 1 }}>
                  <MenuItem value="">Patch all upgradable software</MenuItem>
                  {outdatedApps.map((app) => <MenuItem key={`${app.name}-${app.current_version}`} value={app.name}>{app.name}</MenuItem>)}
                </TextField>
                <Stack spacing={.8} sx={{ maxHeight: 152, overflowY: "auto" }}>
                  {patches.slice(0, 7).map((p) => { const tone = riskTone(p.status === "failed" ? 95 : p.status === "queued" ? 55 : 20); return <Paper key={p.command_id || `${p.software}-${p.timestamp}`} sx={{ p: .9, borderRadius: 2, border: "1px solid rgba(145,166,191,.18)", backgroundColor: "rgba(6,11,19,.55)" }}><Typography>{p.software}</Typography><Typography variant="caption" sx={{ color: tone.color }}>{p.status} • {p.provider}</Typography></Paper>; })}
                  {patches.length === 0 ? <Typography sx={{ color: "#8fa4c1" }}>No patch history.</Typography> : null}
                </Stack>
              </Panel>
              <Panel title="Offline Sync Panel" subtitle="Air-gapped package workflow" action={<Chip size="small" icon={<CloudSync />} label={agentHealthQuery.data?.checks?.api?.status === "ok" ? "Cloud Linked" : "Agent Degraded"} sx={{ backgroundColor: alpha(agentHealthQuery.data?.checks?.api?.status === "ok" ? "#2fbf71" : "#ff9852", .2), color: agentHealthQuery.data?.checks?.api?.status === "ok" ? "#9ef4c2" : "#ffc18e" }} />}>
                <Stack direction="row" spacing={1}>
                  <Button fullWidth variant="contained" startIcon={<Download />} onClick={generateOfflinePackage}>Generate</Button>
                  <Button fullWidth variant="outlined" startIcon={<UploadFile />} onClick={() => fileInputRef.current?.click()}>Import</Button>
                </Stack>
                <input ref={fileInputRef} type="file" accept=".zip" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) applyOffline.mutate(file); }} />
                <Button sx={{ mt: 1 }} fullWidth variant="contained" color="secondary" startIcon={<Bolt />} disabled={autoPatch.isPending} onClick={() => autoPatch.mutate()}>Run Auto Patch</Button>
                <Typography variant="caption" sx={{ color: "#8fa4c1", mt: 1, display: "block" }}>Packages: {packages.length} • Scheduled Updates: {pendingPatches.length}</Typography>
              </Panel>
            </Stack>
          </Grid>

          <Grid item xs={12}>
            <Panel title="Vulnerability Intelligence Panel" subtitle="NVD + GitHub advisories + OS vendor intelligence">
              <TableContainer sx={{ maxHeight: 260 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell>Software</TableCell><TableCell>CVE</TableCell><TableCell>Severity</TableCell><TableCell>CVSS</TableCell><TableCell>Source</TableCell><TableCell>Published</TableCell></TableRow></TableHead>
                  <TableBody>
                    {vulnerabilities.slice(0, 36).map((v) => <TableRow key={`${v.source}-${v.cve}`}><TableCell>{v.software}</TableCell><TableCell>{v.cve}</TableCell><TableCell><Chip size="small" label={v.severity} sx={{ backgroundColor: alpha(riskTone(v.cvss_score ? v.cvss_score * 10 : 0).color, .2), color: riskTone(v.cvss_score ? v.cvss_score * 10 : 0).color }} /></TableCell><TableCell sx={monoSx}>{v.cvss_score ?? "N/A"}</TableCell><TableCell>{v.source}</TableCell><TableCell>{v.published_at ? formatTs(v.published_at) : "N/A"}</TableCell></TableRow>)}
                    {vulnerabilities.length === 0 ? <TableRow><TableCell colSpan={6}>No matched advisories for selected machine.</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </TableContainer>
            </Panel>
          </Grid>
        </Grid>
      </Box>
      <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast((p) => ({ ...p, open: false }))} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((p) => ({ ...p, open: false }))}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const logout = () => { localStorage.removeItem(AUTH_TOKEN_KEY); setToken(""); };
  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        {token ? <Dashboard token={token} onLogout={logout} /> : <LoginScreen onAuthenticated={setToken} />}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
