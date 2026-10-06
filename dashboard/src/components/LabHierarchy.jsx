import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
} from "@mui/material";
import {
  Search,
  Computer,
  LocationOn,
  MeetingRoom,
  CheckCircle,
  Cancel,
  Refresh,
  Build,
} from "@mui/icons-material";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function LabHierarchy({ labs, devices, onSelectDevice, onQueueLabRemediation }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLabId, setSelectedLabId] = useState(null);

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      d.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.ip_address && d.ip_address.includes(searchTerm)) ||
      (d.lab_name && d.lab_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLab = selectedLabId ? d.lab_id === selectedLabId : true;
    return matchesSearch && matchesLab;
  });

  return (
    <Box sx={{ p: 3 }}>
      {/* Top Controls & Lab Filter Pills */}
      <Card sx={{ ...cardStyle, mb: 3 }}>
        <CardContent sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
            <Typography variant="subtitle2" sx={{ color: "#94a3b8", mr: 1 }}>
              Filter by Lab:
            </Typography>
            <Chip
              label="All Labs"
              clickable
              color={selectedLabId === null ? "primary" : "default"}
              onClick={() => setSelectedLabId(null)}
              sx={{ fontWeight: 600 }}
            />
            {labs.map((lab) => (
              <Chip
                key={lab.id}
                label={`${lab.name} (${lab.devices_count || 0})`}
                clickable
                color={selectedLabId === lab.id ? "primary" : "default"}
                onClick={() => setSelectedLabId(lab.id)}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Box>

          <TextField
            size="small"
            placeholder="Search hostname, IP, or lab..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "#94a3b8" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 280,
              bgcolor: "rgba(255,255,255,0.03)",
              borderRadius: 1,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.1)" },
              "& .MuiInputBase-input": { color: "#f8fafc" },
            }}
          />
        </CardContent>
      </Card>

      {/* Devices List Table */}
      <Card sx={cardStyle}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600 }}>
              🖥️ Managed Endpoints ({filteredDevices.length})
            </Typography>
            {selectedLabId && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<Build />}
                onClick={() => onQueueLabRemediation(selectedLabId)}
              >
                Queue Lab Remediation
              </Button>
            )}
          </Box>

          <TableContainer component={Paper} sx={{ bgcolor: "transparent" }}>
            <Table size="medium">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: "#94a3b8" }}>Status</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>Hostname</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>Lab Location</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>OS & Version</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>IP Address</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>Critical Risks</TableCell>
                  <TableCell sx={{ color: "#94a3b8" }}>Driver Issues</TableCell>
                  <TableCell sx={{ color: "#94a3b8", textAlign: "right" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredDevices.map((device) => (
                  <TableRow
                    key={device.id}
                    hover
                    sx={{ "&:hover": { bgcolor: "rgba(255, 255, 255, 0.03)", cursor: "pointer" } }}
                    onClick={() => onSelectDevice(device.id)}
                  >
                    <TableCell>
                      {device.is_online ? (
                        <Chip
                          icon={<CheckCircle sx={{ fontSize: "14px !important", color: "#10b981 !important" }} />}
                          label="Online"
                          size="small"
                          sx={{ bgcolor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontWeight: 600 }}
                        />
                      ) : (
                        <Chip
                          icon={<Cancel sx={{ fontSize: "14px !important", color: "#64748b !important" }} />}
                          label="Offline"
                          size="small"
                          sx={{ bgcolor: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", fontWeight: 600 }}
                        />
                      )}
                    </TableCell>
                    <TableCell sx={{ color: "#f8fafc", fontWeight: 600 }}>{device.hostname}</TableCell>
                    <TableCell sx={{ color: "#38bdf8" }}>{device.lab_name}</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>{device.os_name} {device.os_version}</TableCell>
                    <TableCell sx={{ color: "#94a3b8" }}>{device.ip_address || "—"}</TableCell>
                    <TableCell>
                      {device.critical_risks > 0 ? (
                        <Chip label={`${device.critical_risks} Critical`} size="small" sx={{ bgcolor: "#ef4444", color: "#fff", fontWeight: 700 }} />
                      ) : (
                        <Chip label="Clean" size="small" sx={{ bgcolor: "rgba(16, 185, 129, 0.2)", color: "#10b981", fontWeight: 600 }} />
                      )}
                    </TableCell>
                    <TableCell>
                      {device.driver_issues > 0 ? (
                        <Chip label={`${device.driver_issues} Issues`} size="small" sx={{ bgcolor: "#f59e0b", color: "#fff", fontWeight: 700 }} />
                      ) : (
                        <Typography variant="body2" sx={{ color: "#10b981" }}>OK</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: "right" }}>
                      <Button variant="contained" size="small" sx={{ bgcolor: "#2563eb", textTransform: "none" }}>
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDevices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ color: "#94a3b8", textAlign: "center", py: 4 }}>
                      No machines found matching filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
