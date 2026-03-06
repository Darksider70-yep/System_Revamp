import React from "react";
import { Box, Card, Chip, Divider, Stack, Typography } from "@mui/material";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

const gaugeTrack = "rgba(30, 41, 59, 0.9)";

const Gauge = ({ label, value, color }) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const chartData = [{ name: label, value: safeValue, fill: color }];

  return (
    <Box sx={{ width: 180, height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={chartData} startAngle={180} endAngle={0} innerRadius="65%" outerRadius="100%">
          <RadialBar dataKey="value" cornerRadius={10} background={{ fill: gaugeTrack }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <Typography align="center" sx={{ color: "#bfdbfe", fontWeight: 700, mt: -1 }}>
        {label}
      </Typography>
      <Typography align="center" sx={{ color: "#f8fafc", fontWeight: 800, fontSize: 24 }}>
        {safeValue.toFixed(0)}%
      </Typography>
    </Box>
  );
};

const alertColor = (riskLevel) => {
  const level = String(riskLevel || "").toLowerCase();
  if (level === "high") return "error";
  if (level === "medium") return "warning";
  if (level === "low") return "success";
  return "default";
};

const LiveSystemMonitor = ({ metrics, riskScore, alerts, systemInfo }) => {
  return (
    <Card
      sx={{
        p: 3,
        mb: 4,
        borderRadius: 3,
        background: "linear-gradient(145deg, rgba(5, 13, 34, 0.9), rgba(8, 23, 52, 0.86))",
        border: "1px solid rgba(56, 189, 248, 0.22)",
        boxShadow: "0 18px 38px rgba(2, 6, 23, 0.55)",
      }}
    >
      <Typography variant="h5" sx={{ color: "#e0e7ff", mb: 1, fontWeight: 800 }}>
        Live System Monitor
      </Typography>
      <Typography sx={{ color: "#94a3b8", mb: 3, fontWeight: 500 }}>
        Real-time performance telemetry and security alert stream.
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "space-between" }}>
        <Gauge label="CPU Usage" value={metrics.cpu_usage} color="#38bdf8" />
        <Gauge label="RAM Usage" value={metrics.ram_usage} color="#22d3ee" />
        <Gauge label="Disk Usage" value={metrics.disk_usage} color="#0ea5e9" />
      </Box>

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Chip label={`Risk Score: ${riskScore}`} color={riskScore >= 70 ? "error" : riskScore >= 40 ? "warning" : "success"} />
        <Chip label={`Network: ${metrics.network_activity || "low"}`} variant="outlined" />
        <Chip label={`Alerts: ${alerts.length}`} color={alerts.length > 0 ? "warning" : "success"} />
      </Box>

      <Divider sx={{ my: 2, borderColor: "rgba(56, 189, 248, 0.2)" }} />

      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: "#bfdbfe", fontWeight: 700, mb: 1 }}>System Profile</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>Host: {systemInfo.hostname || "Unknown"}</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>OS: {systemInfo.os_version || "Unknown"}</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>CPU: {systemInfo.cpu || "Unknown"}</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>GPU: {systemInfo.gpu || "Unavailable"}</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>RAM: {systemInfo.ram_gb || 0} GB</Typography>
          <Typography sx={{ color: "#cbd5e1" }}>
            Disk Free: {systemInfo.disk_free_gb || 0} / {systemInfo.disk_total_gb || 0} GB
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: "#bfdbfe", fontWeight: 700, mb: 1 }}>Security Alerts</Typography>
          {alerts.length === 0 ? (
            <Typography sx={{ color: "#94a3b8" }}>No active alerts.</Typography>
          ) : (
            alerts.slice(0, 5).map((item, index) => (
              <Box key={`${item.event}-${item.timestamp}-${index}`} sx={{ mb: 1.2 }}>
                <Chip
                  size="small"
                  color={alertColor(item.riskLevel)}
                  label={`${item.event}${item.software ? ` - ${item.software}` : ""}`}
                  sx={{ mb: 0.6 }}
                />
                <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ""}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Stack>
    </Card>
  );
};

export default LiveSystemMonitor;
