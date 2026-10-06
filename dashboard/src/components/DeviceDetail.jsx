import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from "@mui/material";
import {
  ArrowBack,
  Computer,
  Memory,
  Storage,
  AccessTime,
  Security,
  Build,
  Refresh,
  ShieldOutlined,
  CheckCircle,
  WarningAmber,
  ErrorOutline,
} from "@mui/icons-material";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function DeviceDetail({ device, onBack, onQueueCommand }) {
  const [tabIndex, setTabIndex] = useState(0);

  if (!device) return null;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header bar */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ color: "#94a3b8" }}>
            Back to Fleet
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc" }}>
            🖥️ {device.hostname}
          </Typography>
          <Chip
            label={device.is_online ? "Online" : "Offline"}
            size="small"
            sx={{
              bgcolor: device.is_online ? "rgba(16, 185, 129, 0.2)" : "rgba(100, 116, 139, 0.2)",
              color: device.is_online ? "#10b981" : "#94a3b8",
              fontWeight: 700,
            }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => onQueueCommand("rescan", {})}
            sx={{ borderColor: "rgba(255,255,255,0.2)", color: "#f8fafc" }}
          >
            Trigger Scan
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Build />}
            onClick={() => onQueueCommand("upgrade-package", {})}
          >
            Remediate Machine
          </Button>
        </Box>
      </Box>

      {/* System Specs Overview Bar */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>Location</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#38bdf8" }}>
                {device.org_name} → {device.site_name} → {device.lab_name}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>Operating System</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#f8fafc" }}>
                {device.os_name} {device.os_version}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>IP / MAC Address</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#f8fafc" }}>
                {device.ip_address || "—"} ({device.mac_address || "—"})
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card sx={cardStyle}>
            <CardContent sx={{ py: 2 }}>
              <Typography variant="caption" sx={{ color: "#94a3b8" }}>Hardware Memory & Storage</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#10b981" }}>
                {device.system_metrics.ram_total_gb} GB RAM / {device.system_metrics.disk_free_gb} GB Free
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detail Tabs */}
      <Card sx={cardStyle}>
        <Box sx={{ borderBottom: 1, borderColor: "rgba(255, 255, 255, 0.1)" }}>
          <Tabs value={tabIndex} onChange={(e, v) => setTabIndex(v)} textColor="inherit">
            <Tab label={`Installed Software (${device.software.length})`} />
            <Tab label={`Hardware Drivers (${device.drivers.length})`} />
            <Tab label={`Command History (${device.recent_commands.length})`} />
          </Tabs>
        </Box>

        {/* Tab 0: Software */}
        {tabIndex === 0 && (
          <CardContent>
            <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "#94a3b8" }}>Application Name</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Installed Version</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Latest Upstream</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Risk Level</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Code Signature</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Signer / Publisher</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {device.software.map((sw, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>{sw.name}</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{sw.version}</TableCell>
                      <TableCell sx={{ color: "#38bdf8" }}>{sw.latest_version}</TableCell>
                      <TableCell>
                        <Chip
                          label={sw.risk_level}
                          size="small"
                          sx={{
                            bgcolor:
                              sw.risk_level === "Critical"
                                ? "#ef4444"
                                : sw.risk_level === "High"
                                ? "#f59e0b"
                                : sw.risk_level === "Medium"
                                ? "#3b82f6"
                                : "rgba(16, 185, 129, 0.2)",
                            color: sw.risk_level === "Low" ? "#10b981" : "#fff",
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sw.signature_status}
                          size="small"
                          sx={{
                            bgcolor:
                              sw.signature_status === "Valid"
                                ? "rgba(16, 185, 129, 0.15)"
                                : sw.signature_status === "Unsigned"
                                ? "rgba(100, 116, 139, 0.15)"
                                : "rgba(239, 68, 68, 0.2)",
                            color:
                              sw.signature_status === "Valid"
                                ? "#10b981"
                                : sw.signature_status === "Unsigned"
                                ? "#94a3b8"
                                : "#ef4444",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{sw.signer_name || sw.publisher || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* Tab 1: Drivers */}
        {tabIndex === 1 && (
          <CardContent>
            <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "#94a3b8" }}>Device Name</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Status</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Impact</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Error Code</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Diagnostics Reason</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Manufacturer</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {device.drivers.map((drv, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>{drv.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={drv.status}
                          size="small"
                          sx={{
                            bgcolor: drv.status === "Installed" ? "rgba(16, 185, 129, 0.15)" : "#ef4444",
                            color: drv.status === "Installed" ? "#10b981" : "#fff",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={drv.impact}
                          size="small"
                          sx={{
                            bgcolor: drv.impact === "Critical" ? "#ef4444" : (drv.impact === "High" ? "#f59e0b" : "#3b82f6"),
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "#f8fafc" }}>{drv.error_code > 0 ? `Code ${drv.error_code}` : "0 (OK)"}</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{drv.reason || "Functioning normally"}</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{drv.manufacturer}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}

        {/* Tab 2: Command History */}
        {tabIndex === 2 && (
          <CardContent>
            <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: "#94a3b8" }}>Command ID</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Type</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Mode</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Status</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Queued At</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>Result Summary</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {device.recent_commands.map((cmd, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: "#38bdf8", fontFamily: "monospace" }}>{cmd.id.slice(0, 8)}...</TableCell>
                      <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>{cmd.type}</TableCell>
                      <TableCell>
                        <Chip label={cmd.dry_run ? "Dry Run" : "Live"} size="small" variant="outlined" sx={{ color: "#94a3b8" }} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cmd.status}
                          size="small"
                          sx={{
                            bgcolor: cmd.status === "completed" ? "#10b981" : (cmd.status === "failed" ? "#ef4444" : "#f59e0b"),
                            color: "#fff",
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{new Date(cmd.created_at).toLocaleString()}</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>{JSON.stringify(cmd.result)}</TableCell>
                    </TableRow>
                  ))}
                  {device.recent_commands.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ color: "#94a3b8", textAlign: "center", py: 2 }}>
                        No commands dispatched to this device yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        )}
      </Card>
    </Box>
  );
}
