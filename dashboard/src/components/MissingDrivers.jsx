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
  PowerSettingsNew,
  ToggleOff,
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
  onEnableDriver = null,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [enablingId, setEnablingId] = useState(null);

  const disabledDrivers = missing.filter((d) => d.Status === "Disabled" || d.ErrorCode === 22);
  const genuinelyMissing = missing.filter((d) => d.Status !== "Disabled" && d.ErrorCode !== 22);

  const handleEnable = async (driver) => {
    const id = driver.DeviceID || driver["Driver Name"];
    setEnablingId(id);
    try {
      if (onEnableDriver) {
        await onEnableDriver(driver);
      }
    } finally {
      setEnablingId(null);
    }
  };

  const renderDriverCard = (driver, key) => {
    const isMissing = driver.Status === "Missing";
    const isDisabled = driver.Status === "Disabled" || driver.ErrorCode === 22;

    const impact = driver.Impact || "Low";
    const cfg = impactConfig[impact] || impactConfig.Low;
    const riskScore = driver.RiskScore ?? (isMissing ? 65 : (isDisabled ? 40 : 0));
    const deviceKey = driver.DeviceID || driver["Driver Name"];
    const isEnablingThis = enablingId === deviceKey;

    return (
      <Card
        key={key}
        sx={{
          p: 2,
          backgroundColor: "#121824",
          borderRadius: "10px",
          border: `1px solid ${
            isMissing
              ? cfg.border
              : isDisabled
              ? "rgba(245, 158, 11, 0.3)"
              : "rgba(255, 255, 255, 0.08)"
          }`,
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 1.5,
          transition: "all 0.15s ease",
          "&:hover": {
            borderColor: isMissing
              ? cfg.color
              : isDisabled
              ? "#f59e0b"
              : "rgba(16, 185, 129, 0.4)",
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "8px",
              backgroundColor: isMissing
                ? "rgba(239, 68, 68, 0.12)"
                : isDisabled
                ? "rgba(245, 158, 11, 0.12)"
                : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${
                isMissing
                  ? "rgba(239, 68, 68, 0.25)"
                  : isDisabled
                  ? "rgba(245, 158, 11, 0.3)"
                  : "rgba(16, 185, 129, 0.25)"
              }`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isMissing ? "#ef4444" : (isDisabled ? "#f59e0b" : "#10b981"),
              flexShrink: 0,
            }}
          >
            {isDisabled ? <ToggleOff sx={{ fontSize: 24 }} /> : <Memory sx={{ fontSize: 20 }} />}
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  color: "#f8fafc",
                  fontFamily: "'JetBrains Mono', monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {driver["Driver Name"]}
              </Typography>
              <Chip
                label={driver.Manufacturer || driver.DeviceClass || "Hardware"}
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

            {isDisabled ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.4, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: 500 }}>
                  Device is currently disabled in Windows
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>•</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Impact: <strong style={{ color: cfg.color }}>{impact}</strong>
                </Typography>
              </Box>
            ) : isMissing ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.4, flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Risk Score: <strong style={{ color: cfg.color }}>{riskScore}/100</strong>
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>•</Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Impact: <strong style={{ color: cfg.color }}>{impact}</strong>
                </Typography>
                {driver.Reason && (
                  <>
                    <Typography sx={{ fontSize: "0.75rem", color: "#64748b" }}>•</Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "#f87171" }}>
                      {driver.Reason}
                    </Typography>
                  </>
                )}
              </Box>
            ) : (
              <Typography sx={{ fontSize: "0.75rem", color: "#10b981", mt: 0.3, display: "flex", alignItems: "center", gap: 0.4 }}>
                <CheckCircle sx={{ fontSize: 12 }} /> Operating normally ({driver.Version || "Verified"})
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, alignSelf: { xs: "flex-end", sm: "center" } }}>
          {/* Action Button for Disabled Drivers */}
          {isDisabled && onEnableDriver && (
            <Button
              size="small"
              variant="contained"
              disabled={isEnablingThis}
              onClick={() => handleEnable(driver)}
              startIcon={isEnablingThis ? <CircularProgress size={14} sx={{ color: "#ffffff" }} /> : <PowerSettingsNew sx={{ fontSize: 16 }} />}
              sx={{
                backgroundColor: "#10b981",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.78rem",
                px: 1.8,
                py: 0.5,
                borderRadius: "6px",
                textTransform: "none",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: "#059669",
                  boxShadow: "none",
                },
              }}
            >
              {isEnablingThis ? "Enabling..." : "Enable Device"}
            </Button>
          )}

          {/* Status Badges */}
          {isDisabled ? (
            <Chip
              label="Disabled"
              sx={{
                fontWeight: 600,
                color: "#fbbf24",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                fontSize: "0.72rem",
                height: 24,
              }}
            />
          ) : isMissing ? (
            <Chip
              label="Missing"
              sx={{
                fontWeight: 600,
                color: "#ffffff",
                backgroundColor: "#dc2626",
                border: "1px solid #ef4444",
                fontSize: "0.72rem",
                height: 24,
              }}
            />
          ) : (
            <Chip
              label="Installed"
              sx={{
                fontWeight: 600,
                color: "#34d399",
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontSize: "0.72rem",
                height: 24,
              }}
            />
          )}
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
              Driver & Hardware Device Intelligence
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.2 }}>
              Monitors active Plug-and-Play devices, driver health, and hardware states in real time.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            {disabledDrivers.length > 0 && onEnableDriver && (
              <Button
                variant="outlined"
                onClick={() => {
                  disabledDrivers.forEach((driver) => handleEnable(driver));
                }}
                disabled={enablingId !== null}
                startIcon={<PowerSettingsNew />}
                sx={{
                  borderColor: "#10b981",
                  color: "#34d399",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  px: 2,
                  py: 0.9,
                  borderRadius: "8px",
                  textTransform: "none",
                  "&:hover": {
                    borderColor: "#059669",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                  },
                }}
              >
                Enable {disabledDrivers.length} Disabled {disabledDrivers.length === 1 ? "Device" : "Devices"}
              </Button>
            )}

            <Button
              variant="contained"
              onClick={onDownloadDrivers}
              disabled={downloadingDrivers || genuinelyMissing.length === 0 || !onDownloadDrivers}
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
              {downloadingDrivers
                ? "Updating Drivers..."
                : genuinelyMissing.length > 0
                ? `Update ${genuinelyMissing.length} Missing Drivers`
                : "All Drivers Up-to-date"}
            </Button>
          </Box>
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
                <span>Problem & Disabled Devices</span>
                <Chip
                  label={missing.length}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: "0.7rem",
                    backgroundColor: missing.length ? (disabledDrivers.length > 0 && genuinelyMissing.length === 0 ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)") : "rgba(255, 255, 255, 0.08)",
                    color: missing.length ? (disabledDrivers.length > 0 && genuinelyMissing.length === 0 ? "#fbbf24" : "#f87171") : "#94a3b8",
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
            missing.map((driver, idx) => renderDriverCard(driver, `problem-${idx}`))
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
                All Hardware Drivers are Installed & Enabled
              </Typography>
              <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", mt: 0.3 }}>
                No missing drivers or disabled devices detected on this system.
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
