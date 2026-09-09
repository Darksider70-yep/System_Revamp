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
  Malicious: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.14)", border: "rgba(244, 63, 94, 0.45)", icon: <BugReport sx={{ fontSize: 16 }} /> },
  Suspicious: { color: "#f97316", bg: "rgba(249, 115, 22, 0.14)", border: "rgba(249, 115, 22, 0.45)", icon: <WarningAmber sx={{ fontSize: 16 }} /> },
  Clean: { color: "#10b981", bg: "rgba(16, 185, 129, 0.14)", border: "rgba(16, 185, 129, 0.45)", icon: <CheckCircle sx={{ fontSize: 16 }} /> },
  Unknown: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.14)", border: "rgba(56, 189, 248, 0.45)", icon: <HelpOutline sx={{ fontSize: 16 }} /> },
  Error: { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.14)", border: "rgba(148, 163, 184, 0.3)", icon: <HelpOutline sx={{ fontSize: 16 }} /> },
};

const ProtectionCenter = ({
  results = [],
  summary = {},
  onScan = null,
  scanning = false,
  lastScanTime = null,
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
    {/* Protection Header & Scanner Card */}
    <Card
      sx={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(13, 20, 38, 0.75) 100%)",
        border: "1px solid rgba(56, 189, 248, 0.25)",
        borderRadius: "16px",
        p: 3,
        boxShadow: "0 16px 40px rgba(2, 6, 23, 0.6)",
        backdropFilter: "blur(12px)",
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.3) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#38bdf8",
              boxShadow: "0 0 20px rgba(56, 189, 248, 0.25)",
            }}
          >
            <Security sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.25rem", letterSpacing: 0.3 }}>
              Software Protection & Threat Shield
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.2 }}>
              {lastScanTime ? `Last signature verification: ${lastScanTime}` : "No threat scan performed yet this session"}
            </Typography>
          </Box>
        </Box>

        <Button
          variant="contained"
          onClick={onScan}
          disabled={scanning || !onScan}
          startIcon={scanning ? <CircularProgress size={18} sx={{ color: "#ffffff" }} /> : <Radar />}
          sx={{
            background: "linear-gradient(135deg, #0284c7 0%, #6366f1 100%)",
            fontWeight: 800,
            fontSize: "0.88rem",
            px: 3.2,
            py: 1.1,
            borderRadius: "10px",
            boxShadow: "0 4px 20px rgba(56, 189, 248, 0.35)",
            border: "1px solid rgba(56, 189, 248, 0.5)",
            transition: "all 0.25s ease",
            "&:hover": {
              background: "linear-gradient(135deg, #0369a1 0%, #4f46e5 100%)",
              boxShadow: "0 6px 25px rgba(56, 189, 248, 0.5)",
              transform: "translateY(-1px)",
            },
            "&:disabled": {
              background: "rgba(30, 41, 59, 0.5)",
              color: "#64748b",
            },
          }}
        >
          {scanning ? "Scanning Threats..." : "Execute Threat Scan"}
        </Button>
      </Box>

      {/* Threat Summary Pills */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 3, pt: 2, borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
        <Chip
          icon={<BugReport sx={{ color: "#fb7185 !important", fontSize: 16 }} />}
          label={`Malicious: ${summary.malicious || 0}`}
          sx={{
            backgroundColor: "rgba(244, 63, 94, 0.12)",
            color: "#fb7185",
            border: "1px solid rgba(244, 63, 94, 0.4)",
            fontWeight: 700,
            boxShadow: (summary.malicious || 0) > 0 ? "0 0 12px rgba(244, 63, 94, 0.4)" : "none",
          }}
        />
        <Chip
          icon={<WarningAmber sx={{ color: "#fb923c !important", fontSize: 16 }} />}
          label={`Suspicious: ${summary.suspicious || 0}`}
          sx={{
            backgroundColor: "rgba(249, 115, 22, 0.12)",
            color: "#fb923c",
            border: "1px solid rgba(249, 115, 22, 0.4)",
            fontWeight: 700,
          }}
        />
        <Chip
          icon={<CheckCircle sx={{ color: "#34d399 !important", fontSize: 16 }} />}
          label={`Clean: ${summary.clean || 0}`}
          sx={{
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            color: "#34d399",
            border: "1px solid rgba(16, 185, 129, 0.4)",
            fontWeight: 700,
          }}
        />
        <Chip
          icon={<HelpOutline sx={{ color: "#7dd3fc !important", fontSize: 16 }} />}
          label={`Unknown: ${summary.unknown || 0}`}
          sx={{
            backgroundColor: "rgba(56, 189, 248, 0.12)",
            color: "#7dd3fc",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            fontWeight: 700,
          }}
        />
        <Chip
          label={`Errors: ${summary.error || 0}`}
          sx={{
            backgroundColor: "rgba(148, 163, 184, 0.1)",
            color: "#94a3b8",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            fontWeight: 600,
          }}
        />
      </Box>
    </Card>

    {/* Threat Findings List */}
    <Card
      sx={{
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(13, 20, 38, 0.7) 100%)",
        border: "1px solid rgba(56, 189, 248, 0.2)",
        borderRadius: "16px",
        p: 3,
        boxShadow: "0 16px 40px rgba(2, 6, 23, 0.55)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography sx={{ fontWeight: 800, color: "#f8fafc", fontSize: "1.1rem" }}>
          Threat Inspection Findings
        </Typography>
        <Chip
          label={`${results.length} Scanned Objects`}
          size="small"
          sx={{
            backgroundColor: "rgba(56, 189, 248, 0.12)",
            color: "#7dd3fc",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            fontWeight: 700,
          }}
        />
      </Box>

      {results.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {results.map((item, idx) => {
            const statusConfig = statusColors[item.threatStatus] || statusColors.Unknown;
            return (
              <Card
                key={`${item.name}-${idx}`}
                sx={{
                  p: 2.5,
                  backgroundColor: "rgba(15, 23, 42, 0.65)",
                  borderRadius: "12px",
                  border: `1px solid ${statusConfig.border}`,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "rgba(20, 30, 55, 0.8)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 10px 24px rgba(2, 6, 23, 0.5)",
                  },
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: "1rem", color: "#f8fafc" }}>
                      {item.name}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "'JetBrains Mono', monospace" }}>
                        v{item.version || "N/A"}
                      </Typography>
                      <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>•</Typography>
                      <Typography sx={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                        {item.summary || "No behavioral anomalies flagged."}
                      </Typography>
                    </Box>
                  </Box>

                  <Chip
                    icon={statusConfig.icon}
                    label={item.threatStatus}
                    sx={{
                      fontWeight: 800,
                      color: statusConfig.color,
                      backgroundColor: statusConfig.bg,
                      border: `1px solid ${statusConfig.border}`,
                      fontSize: "0.78rem",
                    }}
                  />
                </Box>

                {item.vtLink && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
                    <Link
                      href={item.vtLink}
                      target="_blank"
                      rel="noreferrer"
                      sx={{
                        fontSize: "0.8rem",
                        color: "#38bdf8",
                        textDecoration: "none",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.5,
                        "&:hover": { color: "#7dd3fc", textDecoration: "underline" },
                      }}
                    >
                      <OpenInNew sx={{ fontSize: 14 }} />
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
            py: 6,
            textAlign: "center",
            background: "rgba(15, 23, 42, 0.3)",
            border: "1px dashed rgba(56, 189, 248, 0.2)",
            borderRadius: "14px",
          }}
        >
          <Shield sx={{ fontSize: 48, color: "rgba(56, 189, 248, 0.4)", mb: 1 }} />
          <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.05rem" }}>
            Ready for Threat Scanning
          </Typography>
          <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.5, maxWidth: 420, mx: "auto" }}>
            Click "Execute Threat Scan" above to query known hashes and analyze behavioral heuristics against security threat databases.
          </Typography>
        </Box>
      )}
    </Card>
  </Box>
);

export default ProtectionCenter;
