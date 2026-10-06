import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Chip,
  Paper,
} from "@mui/material";
import { ShieldOutlined, PlayArrow, BugReport } from "@mui/icons-material";
import { api } from "../api/client";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function ExposureAssessment({ devices }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(devices[0]?.id || "");
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);

  const startAssessment = async () => {
    if (!selectedDeviceId) return;
    setStreaming(true);
    setProgress(0);
    setLogs([]);
    setSummary(null);

    try {
      // 1. Obtain ticket token
      const res = await api.request(`/api/v2/exposure/token?device_id=${selectedDeviceId}`, { method: "POST" });
      const ticket = res.ticket;

      // 2. Open EventSource stream
      const serverUrl = process.env.REACT_APP_SERVER_URL || "http://127.0.0.1:8080";
      const es = new EventSource(`${serverUrl}/api/v2/exposure/stream/${selectedDeviceId}?ticket=${ticket}`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress) setProgress(data.progress);
          if (data.message) {
            setLogs((prev) => [...prev, data]);
          }
        } catch (e) {}
      };

      es.addEventListener("summary", (event) => {
        try {
          const data = JSON.parse(event.data);
          setSummary(data);
        } catch (e) {}
      });

      es.addEventListener("end", () => {
        es.close();
        setStreaming(false);
        setProgress(100);
      });

      es.onerror = () => {
        es.close();
        setStreaming(false);
      };
    } catch (e) {
      console.error("Exposure assessment failed:", e);
      setStreaming(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc", mb: 3 }}>
        🛡️ Real Exposure Assessment (NVD / OSV.dev CVE Evaluation)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 2 }}>
                Select Target Endpoint
              </Typography>

              <FormControl fullWidth size="small" sx={{ mb: 3 }}>
                <InputLabel sx={{ color: "#94a3b8" }}>Target Device</InputLabel>
                <Select
                  value={selectedDeviceId}
                  label="Target Device"
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  sx={{ color: "#f8fafc" }}
                >
                  {devices.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.hostname} ({d.lab_name || "Lab"})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                color="secondary"
                fullWidth
                disabled={streaming || !selectedDeviceId}
                startIcon={<PlayArrow />}
                onClick={startAssessment}
                sx={{ py: 1.2, fontWeight: 700 }}
              >
                {streaming ? "Auditing CVE Exposure..." : "Start Exposure Assessment"}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 2 }}>
                Live Assessment Telemetry
              </Typography>

              {streaming && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ mb: 2, height: 6, borderRadius: 3 }}
                />
              )}

              <Paper
                sx={{
                  p: 2,
                  bgcolor: "#0b0f19",
                  border: "1px solid rgba(255,255,255,0.05)",
                  minHeight: 220,
                  maxHeight: 350,
                  overflowY: "auto",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                }}
              >
                {logs.map((log, i) => (
                  <Box key={i} sx={{ mb: 1, color: log.level === "WARN" ? "#f59e0b" : "#38bdf8" }}>
                    <span style={{ color: "#64748b" }}>[{new Date().toLocaleTimeString()}]</span> {log.message}
                  </Box>
                ))}
                {logs.length === 0 && (
                  <Typography variant="body2" sx={{ color: "#64748b", fontStyle: "italic" }}>
                    Select a workstation and trigger assessment to view live CVE evaluation logs...
                  </Typography>
                )}
              </Paper>

              {summary && (
                <Box sx={{ mt: 3, p: 2, bgcolor: "rgba(16, 185, 129, 0.1)", borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: "#10b981", fontWeight: 700 }}>
                    ✅ {summary.status} — {summary.hostname}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#94a3b8", mt: 0.5 }}>
                    Audited {summary.total_packages_audited} software packages. Identified {summary.vulnerabilities_found?.length || 0} CVE vulnerabilities.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
