import React from "react";
import { Box, Card, Typography, Chip, Button, CircularProgress, Link } from "@mui/material";
import {
  Security,
  Shield,
  BugReport,
  WarningAmber,
  CheckCircle,
  HelpOutline,
  OpenInNew,
  Radar,
} from "@mui/icons-material";

const statusColors = {
  Malicious: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)", icon: <BugReport sx={{ fontSize: 15 }} /> },
  Suspicious: { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", border: "rgba(249, 115, 22, 0.3)", icon: <WarningAmber sx={{ fontSize: 15 }} /> },
  Clean: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)", icon: <CheckCircle sx={{ fontSize: 15 }} /> },
  Unknown: { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.25)", icon: <HelpOutline sx={{ fontSize: 15 }} /> },
  Error: { color: "#64748b", bg: "rgba(100, 116, 139, 0.1)", border: "rgba(100, 116, 139, 0.2)", icon: <HelpOutline sx={{ fontSize: 15 }} /> },
};

const ProtectionCenter = ({
  results = [],
  summary = {},
  onScan = null,
  scanning = false,
  lastScanTime = null,
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
    {/* Protection Header & Scanner Card */}
    <Card
      sx={{
        backgroundColor: "#121824",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "12px",
        p: 2.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "10px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
            }}
          >
            <Security sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.1rem" }}>
              Software Protection & Threat Shield
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.2 }}>
              {lastScanTime ? `Last signature verification: ${lastScanTime}` : "No threat scan executed yet"}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          onClick={onScan}
          disabled={scanning || !onScan}
          startIcon={scanning ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <Radar />}
          sx={{
            backgroundColor: "#10b981",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.85rem",
            px: 2.5,
            py: 0.9,
            borderRadius: "8px",
            textTransform: "none",
            boxShadow: "none",
            "&:hover": {
              backgroundColor: "#059669",
              boxShadow: "none",
            },
            "&:disabled": {
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "#64748b",
            },
          }}
        >
          {scanning ? "Scanning Threats..." : "Execute Threat Scan"}
        </Button>
      </Box>

      {/* Threat Summary Pills */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2.5, pt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <Chip
          icon={<BugReport sx={{ color: "#f87171 !important", fontSize: 15 }} />}
          label={`Malicious: ${summary.malicious || 0}`}
          sx={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "#f87171",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        />
        <Chip
          icon={<WarningAmber sx={{ color: "#fb923c !important", fontSize: 15 }} />}
          label={`Suspicious: ${summary.suspicious || 0}`}
          sx={{
            backgroundColor: "rgba(249, 115, 22, 0.1)",
            color: "#fb923c",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        />
        <Chip
          icon={<CheckCircle sx={{ color: "#34d399 !important", fontSize: 15 }} />}
          label={`Clean: ${summary.clean || 0}`}
          sx={{
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            color: "#34d399",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        />
        <Chip
          icon={<HelpOutline sx={{ color: "#94a3b8 !important", fontSize: 15 }} />}
          label={`Unknown: ${summary.unknown || 0}`}
          sx={{
            backgroundColor: "rgba(148, 163, 184, 0.08)",
            color: "#94a3b8",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        />
        <Chip
          label={`Errors: ${summary.error || 0}`}
          sx={{
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            color: "#64748b",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontWeight: 500,
            fontSize: "0.75rem",
          }}
        />
      </Box>
    </Card>

    {/* Threat Findings List */}
    <Card
      sx={{
        backgroundColor: "#121824",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "12px",
        p: 2.5,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: "#f8fafc", fontSize: "1rem" }}>
          Threat Inspection Findings
        </Typography>
        <Chip
          label={`${results.length} Objects`}
          size="small"
          sx={{
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            color: "#10b981",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            fontWeight: 600,
            fontSize: "0.72rem",
          }}
        />
      </Box>

      {results.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {results.map((item, idx) => {
            const statusConfig = statusColors[item.threatStatus] || statusColors.Unknown;
            return (
              <Card
                key={`${item.name}-${idx}`}
                sx={{
                  p: 2,
                  backgroundColor: "#0e131f",
                  borderRadius: "8px",
                  border: `1px solid ${statusConfig.border}`,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.92rem", color: "#f8fafc" }}>
                      {item.name}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, mt: 0.3 }}>
                      <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                        v{item.version || "N/A"}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>•</Typography>
                      <Typography sx={{ fontSize: "0.78rem", color: "#cbd5e1" }}>
                        {item.summary || "No behavioral anomalies flagged."}
                      </Typography>
                    </Box>
                  </Box>

                  <Chip
                    icon={statusConfig.icon}
                    label={item.threatStatus}
                    sx={{
                      fontWeight: 600,
                      color: statusConfig.color,
                      backgroundColor: statusConfig.bg,
                      border: `1px solid ${statusConfig.border}`,
                      fontSize: "0.72rem",
                      height: 24,
                    }}
                  />
                </Box>

                {item.vtLink && (
                  <Box sx={{ mt: 1.5, pt: 1, borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <Link
                      href={item.vtLink}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        fontSize: "0.78rem",
                        color: "#10b981",
                        textDecoration: "none",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.4,
                        "&:hover": { color: "#34d399", textDecoration: "underline" },
                      }}
                    >
                      <OpenInNew sx={{ fontSize: 13 }} />
                      View VirusTotal Analysis Report
                    </Link>
                  </Box>
                )}
              </Card>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            backgroundColor: "#0e131f",
            border: "1px dashed rgba(255, 255, 255, 0.1)",
            borderRadius: "10px",
          }}
        >
          <Shield sx={{ fontSize: 40, color: "rgba(16, 185, 129, 0.4)", mb: 1 }} />
          <Typography sx={{ color: "#f8fafc", fontWeight: 600, fontSize: "0.95rem" }}>
            Ready for Threat Scanning
          </Typography>
          <Typography sx={{ color: "#94a3b8", fontSize: "0.8rem", mt: 0.3, maxWidth: 380, mx: "auto" }}>
            Click "Execute Threat Scan" to inspect installed applications against verified threat databases.
          </Typography>
        </Box>
      )}
    </Card>
  </Box>
);

export default ProtectionCenter;
