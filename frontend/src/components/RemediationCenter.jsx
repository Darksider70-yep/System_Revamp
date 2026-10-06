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
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Build, Check, Close, PlayArrow, Warning } from "@mui/icons-material";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function RemediationCenter({ labs, onQueueCommand, onApproveCommand, recentCommands = [] }) {
  const [targetType, setTargetType] = useState("lab");
  const [targetId, setTargetId] = useState("");
  const [commandType, setCommandType] = useState("upgrade-package");
  const [packageId, setPackageId] = useState("OpenJS.NodeJS");
  const [dryRun, setDryRun] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const handleSubmit = async () => {
    try {
      const params = commandType === "upgrade-package" ? { package_id: packageId } : {};
      await onQueueCommand(targetType, targetId || (labs[0]?.id || "fleet"), commandType, params, dryRun, requiresApproval);
      setToastMsg(`Command ${commandType} queued successfully (${dryRun ? "Dry Run" : "Live"}).`);
    } catch (e) {
      setToastMsg(`Failed to queue command: ${e.message}`);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc", mb: 3 }}>
        🛠️ Fleet Remediation & Staged Rollout Center
      </Typography>

      {toastMsg && (
        <Alert severity="info" onClose={() => setToastMsg("")} sx={{ mb: 3 }}>
          {toastMsg}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Command Dispatch Form */}
        <Grid item xs={12} md={5}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 2 }}>
                Queue Fleet Action
              </Typography>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#94a3b8" }}>Target Scope</InputLabel>
                  <Select
                    value={targetType}
                    label="Target Scope"
                    onChange={(e) => setTargetType(e.target.value)}
                    sx={{ color: "#f8fafc" }}
                  >
                    <MenuItem value="lab">Single Lab</MenuItem>
                    <MenuItem value="fleet">Entire Fleet</MenuItem>
                  </Select>
                </FormControl>

                {targetType === "lab" && (
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: "#94a3b8" }}>Select Lab</InputLabel>
                    <Select
                      value={targetId || (labs[0]?.id || "")}
                      label="Select Lab"
                      onChange={(e) => setTargetId(e.target.value)}
                      sx={{ color: "#f8fafc" }}
                    >
                      {labs.map((l) => (
                        <MenuItem key={l.id} value={l.id}>
                          {l.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl fullWidth size="small">
                  <InputLabel sx={{ color: "#94a3b8" }}>Action Type</InputLabel>
                  <Select
                    value={commandType}
                    label="Action Type"
                    onChange={(e) => setCommandType(e.target.value)}
                    sx={{ color: "#f8fafc" }}
                  >
                    <MenuItem value="upgrade-package">Winget Package Upgrade</MenuItem>
                    <MenuItem value="scan-drivers">PnP Hardware Driver Rescan</MenuItem>
                    <MenuItem value="rescan">Full Inventory Telemetry Rescan</MenuItem>
                  </Select>
                </FormControl>

                {commandType === "upgrade-package" && (
                  <TextField
                    size="small"
                    label="Winget Package ID"
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value)}
                    helperText="e.g. OpenJS.NodeJS, Python.Python.3.13, Google.Chrome"
                    sx={{
                      "& .MuiInputBase-input": { color: "#f8fafc" },
                      "& .MuiInputLabel-root": { color: "#94a3b8" },
                    }}
                  />
                )}

                <Box sx={{ bgcolor: "rgba(255,255,255,0.03)", p: 2, borderRadius: 2 }}>
                  <FormControlLabel
                    control={<Switch checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} color="warning" />}
                    label={
                      <Typography variant="body2" sx={{ color: "#f8fafc", fontWeight: 600 }}>
                        Dry-Run Simulation Mode (Safe Preview)
                      </Typography>
                    }
                  />
                  <Typography variant="caption" sx={{ color: "#94a3b8", display: "block", mt: 0.5 }}>
                    When enabled, commands preview execution steps without modifying endpoint systems.
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  color={dryRun ? "warning" : "primary"}
                  startIcon={<PlayArrow />}
                  onClick={handleSubmit}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  {dryRun ? "Run Dry-Run Preview" : "Dispatch Live Remediation"}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Command Queue & Approvals Table */}
        <Grid item xs={12} md={7}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 2 }}>
                Recent Remediation Dispatches & Approvals
              </Typography>

              <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "#94a3b8" }}>Action</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Target</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Mode</TableCell>
                      <TableCell sx={{ color: "#94a3b8" }}>Status</TableCell>
                      <TableCell sx={{ color: "#94a3b8", textAlign: "right" }}>Review</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentCommands.map((cmd) => (
                      <TableRow key={cmd.id}>
                        <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>{cmd.command_type}</TableCell>
                        <TableCell sx={{ color: "#38bdf8" }}>{cmd.target_type}</TableCell>
                        <TableCell>
                          <Chip label={cmd.dry_run ? "Dry Run" : "Live"} size="small" variant="outlined" sx={{ color: "#94a3b8" }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={cmd.status}
                            size="small"
                            sx={{
                              bgcolor:
                                cmd.status === "completed"
                                  ? "#10b981"
                                  : cmd.status === "approved"
                                  ? "#3b82f6"
                                  : cmd.status === "pending"
                                  ? "#f59e0b"
                                  : "#ef4444",
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ textAlign: "right" }}>
                          {cmd.status === "pending" && (
                            <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                              <Button
                                size="small"
                                color="success"
                                variant="contained"
                                onClick={() => onApproveCommand(cmd.id, true)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => onApproveCommand(cmd.id, false)}
                              >
                                Reject
                              </Button>
                            </Box>
                          )}
                          {cmd.status !== "pending" && (
                            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                              {cmd.approved_by ? `By ${cmd.approved_by}` : "Auto"}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentCommands.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ color: "#94a3b8", textAlign: "center", py: 3 }}>
                          No commands in queue.
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
