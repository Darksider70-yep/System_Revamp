import React, { useState } from "react";
import {
  Card,
  Typography,
  Box,
  Chip,
  Button,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Download,
  Memory,
  CheckCircle,
  Warning,
  ErrorOutline,
  BuildCircle,
} from "@mui/icons-material";

const impactConfig = {
  Critical: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.4)", glow: "0 0 10px rgba(244, 63, 94, 0.4)" },
  High: { color: "#f97316", bg: "rgba(249, 115, 22, 0.12)", border: "rgba(249, 115, 22, 0.4)", glow: "0 0 10px rgba(249, 115, 22, 0.4)" },
  Medium: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.4)", glow: "0 0 10px rgba(245, 158, 11, 0.4)" },
  Low: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.4)", glow: "0 0 10px rgba(56, 189, 248, 0.4)" },
};

const MissingDrivers = ({
  missing = [],
  installed = [],
  riskSummary = {},
  onDownloadDrivers = null,
  downloadingDrivers = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const renderDriverCard = (driver, key) => {
    const isMissing = driver.Status === "Missing";
    const impact = driver.Impact || "Low";
    const cfg = impactConfig[impact] || impactConfig.Low;
    const riskScore = driver.RiskScore ?? (isMissing ? 65 : 10);

    return (
      <Card
        key={key}
        sx={{
          p: 2.5,
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.7) 0%, rgba(13, 20, 38, 0.6) 100%)",
          borderRadius: "14px",
          border: `1px solid ${isMissing ? cfg.border : "rgba(16, 185, 129, 0.25)"}`,
          boxShadow: isMissing ? "0 8px 24px rgba(2, 6, 23, 0.4)" : "none",
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 2,
          transition: "all 0.25s ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: `0 12px 30px rgba(2, 6, 23, 0.6), 0 0 15px ${isMissing ? cfg.color + "33" : "rgba(16, 185, 129, 0.2)"}`,
            borderColor: isMissing ? cfg.color : "#10b981",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              background: isMissing
                ? "linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(249, 115, 22, 0.15) 100%)"
                : "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(56, 189, 248, 0.15) 100%)",
              border: `1px solid ${isMissing ? "rgba(244, 63, 94, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isMissing ? "#fb7185" : "#34d399",
              flexShrink: 0,
            }}
          >
            <Memory sx={{ fontSize: 24 }} />
          </Box>

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: "0.98rem",
                  color: "#f8fafc",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {driver["Driver Name"]}.sys
              </Typography>
              <Chip
                label={driver.Device || "Hardware"}
                size="small"
                sx={{
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  color: "#94a3b8",
                  fontSize: "0.72rem",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                }}
              />
            </Box>

            {isMissing ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 0.5 }}>
                <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Risk Score: <strong style={{ color: cfg.color }}>{riskScore}/100</strong>
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#64748b" }}>•</Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Hardware impact: <strong style={{ color: cfg.color }}>{impact}</strong>
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.78rem", color: "#34d399", mt: 0.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                <CheckCircle sx={{ fontSize: 13 }} /> Driver operating normally
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, alignSelf: { xs: "flex-end", sm: "center" } }}>
          {isMissing && (
            <Chip
              label={`${impact} Impact`}
              sx={{
                fontWeight: 800,
                color: cfg.color,
                backgroundColor: cfg.bg,
                border: `1px solid ${cfg.border}`,
                boxShadow: cfg.glow,
                fontSize: "0.75rem",
              }}
            />
          )}
          <Chip
            label={isMissing ? "Missing" : "Installed"}
            sx={{
              fontWeight: 800,
              color: isMissing ? "#ffffff" : "#34d399",
              backgroundColor: isMissing ? "rgba(220, 38, 38, 0.9)" : "rgba(16, 185, 129, 0.15)",
              border: isMissing ? "1px solid #ef4444" : "1px solid rgba(16, 185, 129, 0.4)",
              fontSize: "0.75rem",
            }}
          />
        </Box>
      </Card>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Top Driver Risk Banner */}
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
            flexWrap: "wrap",
            gap: 2,
            mb: 2.5,
          }}
        >
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 1 }}>
              <BuildCircle sx={{ color: "#38bdf8" }} />
              Driver Risk Intelligence
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.3 }}>
              Scans PCI/USB hardware device tree against verified Windows WHQL repository.
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={onDownloadDrivers}
            disabled={downloadingDrivers || missing.length === 0 || !onDownloadDrivers}
            startIcon={downloadingDrivers ? <CircularProgress size={18} sx={{ color: "#ffffff" }} /> : <Download />}
            sx={{
              background: "linear-gradient(135deg, #10b981 0%, #0284c7 100%)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "0.88rem",
              px: 3,
              py: 1.1,
              borderRadius: "10px",
              boxShadow: "0 4px 20px rgba(16, 185, 129, 0.35)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              transition: "all 0.25s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #059669 0%, #0369a1 100%)",
                boxShadow: "0 6px 25px rgba(16, 185, 129, 0.5)",
                transform: "translateY(-1px)",
              },
              "&:disabled": {
                background: "rgba(30, 41, 59, 0.5)",
                color: "#64748b",
              },
            }}
          >
            {downloadingDrivers ? "Deploying Drivers..." : `Update ${missing.length} Missing Drivers`}
          </Button>
        </Box>

        {/* Driver Risk Level Indicators */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Chip
            label={`Critical: ${riskSummary.critical || 0}`}
            sx={{
              backgroundColor: "rgba(244, 63, 94, 0.14)",
              color: "#fb7185",
              border: "1px solid rgba(244, 63, 94, 0.4)",
              fontWeight: 700,
              boxShadow: (riskSummary.critical || 0) > 0 ? "0 0 10px rgba(244, 63, 94, 0.3)" : "none",
            }}
          />
          <Chip
            label={`High: ${riskSummary.high || 0}`}
            sx={{
              backgroundColor: "rgba(249, 115, 22, 0.14)",
              color: "#fb923c",
              border: "1px solid rgba(249, 115, 22, 0.4)",
              fontWeight: 700,
            }}
          />
          <Chip
            label={`Medium: ${riskSummary.medium || 0}`}
            sx={{
              backgroundColor: "rgba(245, 158, 11, 0.14)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              fontWeight: 700,
            }}
          />
          <Chip
            label={`Low: ${riskSummary.low || 0}`}
            sx={{
              backgroundColor: "rgba(56, 189, 248, 0.14)",
              color: "#7dd3fc",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              fontWeight: 700,
            }}
          />
        </Box>
      </Card>

      {/* Tabs for Missing vs Installed */}
      <Box sx={{ borderBottom: 1, borderColor: "rgba(56, 189, 248, 0.2)" }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            "& .MuiTabs-indicator": {
              backgroundColor: "#38bdf8",
              height: 3,
              borderRadius: "3px 3px 0 0",
              boxShadow: "0 0 10px #38bdf8",
            },
            "& .MuiTab-root": {
              color: "#94a3b8",
              fontWeight: 700,
              fontSize: "0.92rem",
              textTransform: "none",
              minHeight: 48,
              "&.Mui-selected": {
                color: "#38bdf8",
              },
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Warning sx={{ fontSize: 18, color: missing.length ? "#fbbf24" : "#94a3b8" }} />
                <span>Missing Drivers</span>
                <Chip
                  label={missing.length}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.72rem",
                    backgroundColor: missing.length ? "rgba(244, 63, 94, 0.2)" : "rgba(148, 163, 184, 0.1)",
                    color: missing.length ? "#fb7185" : "#94a3b8",
                    fontWeight: 800,
                  }}
                />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CheckCircle sx={{ fontSize: 18, color: "#34d399" }} />
                <span>Installed & Verified</span>
                <Chip
                  label={installed.length}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.72rem",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    fontWeight: 800,
                  }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Driver List Display */}
      {activeTab === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {missing.length > 0 ? (
            missing.map((driver, idx) => renderDriverCard(driver, `missing-${idx}`))
          ) : (
            <Card
              sx={{
                p: 5,
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(13, 20, 38, 0.4) 100%)",
                border: "1px dashed rgba(16, 185, 129, 0.3)",
                borderRadius: "16px",
              }}
            >
              <CheckCircle sx={{ fontSize: 44, color: "#10b981", mb: 1 }} />
              <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.1rem" }}>
                All Hardware Drivers are Installed & Up-to-Date
              </Typography>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", mt: 0.5 }}>
                No missing kernel or device drivers detected on this machine.
              </Typography>
            </Card>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {installed.length > 0 ? (
            installed.map((driver, idx) => renderDriverCard(driver, `installed-${idx}`))
          ) : (
            <Card
              sx={{
                p: 5,
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(13, 20, 38, 0.4) 100%)",
                border: "1px dashed rgba(148, 163, 184, 0.2)",
                borderRadius: "16px",
              }}
            >
              <ErrorOutline sx={{ fontSize: 44, color: "#94a3b8", mb: 1 }} />
              <Typography sx={{ color: "#94a3b8", fontWeight: 600 }}>
                No active driver listings found in registry cache.
              </Typography>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MissingDrivers;
