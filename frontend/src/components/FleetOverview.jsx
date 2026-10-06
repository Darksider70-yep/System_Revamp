import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import {
  Computer,
  CheckCircle,
  WarningAmber,
  ErrorOutline,
  Shield,
  DevicesOther,
} from "@mui/icons-material";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function FleetOverview({ data, onSelectDevice }) {
  if (!data) return <LinearProgress color="secondary" />;

  const compliance = data.compliance_percent || 100;
  const isHealthy = compliance >= 90;

  return (
    <Box sx={{ p: 3 }}>
      {/* KPI Top Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" variant="body2">Total Machines</Typography>
                <Computer sx={{ color: "#38bdf8" }} />
              </Box>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: "#f8fafc" }}>
                {data.total_devices}
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                {data.online_devices} Online / {data.offline_devices} Offline
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" variant="body2">Fleet Compliance</Typography>
                <CheckCircle sx={{ color: isHealthy ? "#10b981" : "#f59e0b" }} />
              </Box>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: isHealthy ? "#10b981" : "#f59e0b" }}>
                {compliance}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={compliance}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.1)",
                  "& .MuiLinearProgress-bar": { bgcolor: isHealthy ? "#10b981" : "#f59e0b" },
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" variant="body2">Critical Risk Devices</Typography>
                <ErrorOutline sx={{ color: "#ef4444" }} />
              </Box>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: "#ef4444" }}>
                {data.critical_risk_devices}
              </Typography>
              <Typography variant="caption" sx={{ color: "#ef4444" }}>
                Major drift or CVE exposure
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" variant="body2">High Risk Devices</Typography>
                <WarningAmber sx={{ color: "#f59e0b" }} />
              </Box>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: "#f59e0b" }}>
                {data.high_risk_devices}
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                1 major version behind
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={cardStyle}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography color="text.secondary" variant="body2">Threats Flagged</Typography>
                <Shield sx={{ color: "#a855f7" }} />
              </Box>
              <Typography variant="h4" sx={{ mt: 1, fontWeight: 700, color: "#a855f7" }}>
                {data.threats_flagged || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                VirusTotal / Authenticode alert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Outdated Apps & Top Missing Drivers Tables */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2, fontWeight: 600 }}>
                ⚡ Top Outdated Applications Fleet-Wide
              </Typography>
              <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "#94a3b8" }}>Application</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Latest Version</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Risk</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Affected Devices</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data.top_outdated_apps || []).map((app, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>{app.app_name}</TableCell>
                        <TableCell sx={{ color: "#38bdf8" }}>{app.latest_version}</TableCell>
                        <TableCell>
                          <Chip
                            label={app.risk_level}
                            size="small"
                            sx={{
                              bgcolor: app.risk_level === "Critical" ? "#ef4444" : "#f59e0b",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "#f8fafc" }}>{app.affected_devices} machines</TableCell>
                      </TableRow>
                    ))}
                    {(!data.top_outdated_apps || data.top_outdated_apps.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ color: "#94a3b8", textAlign: "center", py: 2 }}>
                          No outdated applications detected across fleet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", mb: 2, fontWeight: 600 }}>
                🔧 Top Missing & Problem Drivers Fleet-Wide
              </Typography>
              <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "#94a3b8" }}>Device / Hardware</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Impact</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Affected Devices</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data.top_missing_drivers || []).map((drv, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ color: "#f8fafc", fontWeight: 500 }}>{drv.device_name}</TableCell>
                        <TableCell>
                          <Chip
                            label={drv.impact}
                            size="small"
                            sx={{
                              bgcolor: drv.impact === "Critical" ? "#ef4444" : (drv.impact === "High" ? "#f97316" : "#3b82f6"),
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.7rem",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "#f8fafc" }}>{drv.affected_devices} machines</TableCell>
                      </TableRow>
                    ))}
                    {(!data.top_missing_drivers || data.top_missing_drivers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ color: "#94a3b8", textAlign: "center", py: 2 }}>
                          No missing or problem drivers detected across fleet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
