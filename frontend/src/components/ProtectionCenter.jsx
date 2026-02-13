import React from "react";
import { Box, Card, Typography, Chip, Button } from "@mui/material";

const statusColors = {
  Malicious: "#dc2626",
  Suspicious: "#ea580c",
  Clean: "#16a34a",
  Unknown: "#0ea5e9",
  Error: "#64748b",
};

const panelStyle = {
  background: "linear-gradient(145deg, rgba(5, 13, 34, 0.9), rgba(8, 23, 52, 0.82))",
  borderRadius: 4,
  padding: 3,
  border: "1px solid rgba(56, 189, 248, 0.24)",
  boxShadow: "0 18px 36px rgba(2, 6, 23, 0.52)",
  backdropFilter: "blur(8px)",
};

const ProtectionCenter = ({
  results = [],
  summary = {},
  onScan = null,
  scanning = false,
  lastScanTime = null,
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
    <Card sx={{ ...panelStyle }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ color: "#e0e7ff", fontWeight: 800 }}>Software Protection</Typography>
          <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>
            {lastScanTime ? `Last scan: ${lastScanTime}` : "No protection scan yet"}
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={onScan}
          disabled={scanning || !onScan}
          sx={{
            background: "linear-gradient(120deg, #0284c7, #2563eb)",
            fontWeight: 700,
            borderRadius: 2,
            "&:hover": { background: "linear-gradient(120deg, #0369a1, #1d4ed8)" },
          }}
        >
          {scanning ? "Scanning Threats..." : "Run Malware Scan"}
        </Button>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
        <Chip label={`Malicious: ${summary.malicious || 0}`} sx={{ backgroundColor: statusColors.Malicious, color: "#fff", fontWeight: 700 }} />
        <Chip label={`Suspicious: ${summary.suspicious || 0}`} sx={{ backgroundColor: statusColors.Suspicious, color: "#fff", fontWeight: 700 }} />
        <Chip label={`Clean: ${summary.clean || 0}`} sx={{ backgroundColor: statusColors.Clean, color: "#fff", fontWeight: 700 }} />
        <Chip label={`Unknown: ${summary.unknown || 0}`} sx={{ backgroundColor: statusColors.Unknown, color: "#fff", fontWeight: 700 }} />
        <Chip label={`Errors: ${summary.error || 0}`} sx={{ backgroundColor: statusColors.Error, color: "#fff", fontWeight: 700 }} />
      </Box>
    </Card>

    <Card sx={{ ...panelStyle }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3, textAlign: "center", color: "#e0e7ff", fontSize: 22 }}>
        Threat Findings
      </Typography>

      {results.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {results.map((item, idx) => (
            <Card
              key={`${item.name}-${idx}`}
              sx={{
                p: 2,
                backgroundColor: "rgba(15, 23, 42, 0.78)",
                borderRadius: 3,
                color: "#e2e8f0",
                border: "1px solid rgba(56, 189, 248, 0.2)",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#bae6fd" }}>{item.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>Version: {item.version}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#94a3b8", wordBreak: "break-all" }}>{item.summary}</Typography>
                </Box>
                <Chip
                  label={item.threatStatus}
                  sx={{
                    fontWeight: 700,
                    color: "#fff",
                    backgroundColor: statusColors[item.threatStatus] || "#64748b",
                  }}
                />
              </Box>
              {item.vtLink && (
                <Typography
                  component="a"
                  href={item.vtLink}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ fontSize: 12, color: "#7dd3fc", mt: 1, display: "inline-block" }}
                >
                  Open VirusTotal report
                </Typography>
              )}
            </Card>
          ))}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: "#94a3b8", textAlign: "center", fontStyle: "italic", py: 3 }}>
          No threat scan results yet.
        </Typography>
      )}
    </Card>
  </Box>
);

export default ProtectionCenter;
