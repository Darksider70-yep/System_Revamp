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
  Critical: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", border: "rgba(239, 68, 68, 0.3)" },
  High: { color: "#f97316", bg: "rgba(249, 115, 22, 0.1)", border: "rgba(249, 115, 22, 0.3)" },
  Medium: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.3)" },
  Low: { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", border: "rgba(16, 185, 129, 0.3)" },
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
          p: 2,
          backgroundColor: "#121824",
          borderRadius: "10px",
          border: `1px solid ${isMissing ? cfg.border : "rgba(255, 255, 255, 0.08)"}`,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 1.5,
          transition: "all 0.15s ease",
          "&:hover": {
            borderColor: isMissing ? cfg.color : "rgba(16, 185, 129, 0.4)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "8px",
              backgroundColor: isMissing ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${isMissing ? "rgba(239, 68, 68, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isMissing ? "#ef4444" : "#10b981",
              flexShrink: 0,
            }}
          >
            <Memory sx={{ fontSize: 20 }} />
          </Box>

          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.92rem",
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
                  backgroundColor: "#161f2e",
                  color: "#94a3b8",
                  fontSize: "0.7rem",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  height: 20,
                }}
              />
            </Box>

            {isMissing ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.3 }}>
                <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Risk Score: <strong style={{ color: cfg.color }}>{riskScore}/100</strong>
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>•</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Impact: <strong style={{ color: cfg.color }}>{impact}</strong>
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.75rem", color: "#10b981", mt: 0.3, display: "flex", alignItems: "center", gap: 0.4 }}>
                <CheckCircle sx={{ fontSize: 12 }} /> Operating normally
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, alignSelf: { xs: "flex-end", sm: "center" } }}>
          {isMissing && (
            <Chip
              label={`${impact} Impact`}
              sx={{
                fontWeight: 600,
                color: cfg.color,
                backgroundColor: cfg.bg,
                border: `1px solid ${cfg.border}`,
                fontSize: "0.72rem",
                height: 24,
              }}
            />
          )}
          <Chip
            label={isMissing ? "Missing" : "Installed"}
            sx={{
              fontWeight: 600,
              color: isMissing ? "#ffffff" : "#34d399",
              backgroundColor: isMissing ? "#dc2626" : "rgba(16, 185, 129, 0.12)",
              border: isMissing ? "1px solid #ef4444" : "1px solid rgba(16, 185, 129, 0.3)",
              fontSize: "0.72rem",
              height: 24,
            }}
          />
        </Box>
      </Card>
    );
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Top Driver Risk Banner */}
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
            flexWrap: "wrap",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 0.8 }}>
              <BuildCircle sx={{ color: "#10b981" }} />
              Driver Risk Intelligence
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.2 }}>
              Verifies local PCI/USB devices against Microsoft WHQL driver catalog.
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={onDownloadDrivers}
            disabled={downloadingDrivers || missing.length === 0 || !onDownloadDrivers}
            startIcon={downloadingDrivers ? <CircularProgress size={16} sx={{ color: "#ffffff" }} /> : <Download />}
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
            {downloadingDrivers ? "Updating Drivers..." : `Update ${missing.length} Missing Drivers`}
          </Button>
        </Box>

        {/* Driver Risk Level Indicators */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip
            label={`Critical: ${riskSummary.critical || 0}`}
            sx={{
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
          <Chip
            label={`High: ${riskSummary.high || 0}`}
            sx={{
              backgroundColor: "rgba(249, 115, 22, 0.12)",
              color: "#fb923c",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
          <Chip
            label={`Medium: ${riskSummary.medium || 0}`}
            sx={{
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
          <Chip
            label={`Low: ${riskSummary.low || 0}`}
            sx={{
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
        </Box>
      </Card>

      {/* Tabs for Missing vs Installed */}
      <Box sx={{ borderBottom: 1, borderColor: "rgba(255, 255, 255, 0.08)" }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            "& .MuiTabs-indicator": {
              backgroundColor: "#10b981",
              height: 2,
            },
            "& .MuiTab-root": {
              color: "#94a3b8",
              fontWeight: 600,
              fontSize: "0.88rem",
              textTransform: "none",
              minHeight: 44,
              "&.Mui-selected": {
                color: "#10b981",
              },
            },
          }}
        >
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <Warning sx={{ fontSize: 16, color: missing.length ? "#fbbf24" : "#94a3b8" }} />
                <span>Missing Drivers</span>
                <Chip
                  label={missing.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.7rem",
                    backgroundColor: missing.length ? "rgba(239, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    color: missing.length ? "#f87171" : "#94a3b8",
                    fontWeight: 600,
                  }}
                />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <CheckCircle sx={{ fontSize: 16, color: "#10b981" }} />
                <span>Installed & Verified</span>
                <Chip
                  label={installed.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.7rem",
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    fontWeight: 600,
                  }}
                />
              </Box>
            }
          />
        </Tabs>
      </Box>

      {/* Driver List Display */}
      {activeTab === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {missing.length > 0 ? (
            missing.map((driver, idx) => renderDriverCard(driver, `missing-${idx}`))
          ) : (
            <Card
              sx={{
                p: 4,
                textAlign: "center",
                backgroundColor: "#121824",
                border: "1px dashed rgba(16, 185, 129, 0.3)",
                borderRadius: "12px",
              }}
            >
              <CheckCircle sx={{ fontSize: 36, color: "#10b981", mb: 1 }} />
              <Typography sx={{ color: "#f8fafc", fontWeight: 600, fontSize: "1rem" }}>
                All Hardware Drivers are Installed & Verified
              </Typography>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.3 }}>
                No missing drivers found on this system.
              </Typography>
            </Card>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {installed.length > 0 ? (
            installed.map((driver, idx) => renderDriverCard(driver, `installed-${idx}`))
          ) : (
            <Card
              sx={{
                p: 4,
                textAlign: "center",
                backgroundColor: "#121824",
                border: "1px dashed rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
              }}
            >
              <ErrorOutline sx={{ fontSize: 36, color: "#94a3b8", mb: 1 }} />
              <Typography sx={{ color: "#94a3b8", fontWeight: 500 }}>
                No driver listings detected in active cache.
              </Typography>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MissingDrivers;
