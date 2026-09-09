import React from "react";
import { Box, Typography } from "@mui/material";
import { PlayArrow, CheckCircle, WarningAmber, GppMaybe } from "@mui/icons-material";

const columns = [
  {
    Header: "Application",
    accessor: "name",
    Cell: ({ value }) => {
      const initial = (value || "?").charAt(0).toUpperCase();
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              backgroundColor: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
              fontWeight: 700,
              fontSize: "0.8rem",
              flexShrink: 0,
            }}
          >
            {initial}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                color: "#f8fafc",
                fontWeight: 600,
                fontSize: "0.88rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 220,
              }}
            >
              {value}
            </Typography>
          </Box>
        </Box>
      );
    },
  },
  {
    Header: "Current",
    accessor: "current",
    Cell: ({ value }) => (
      <Box
        component="span"
        sx={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "#94a3b8",
          backgroundColor: "#161f2e",
          px: 1,
          py: 0.3,
          borderRadius: "4px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          display: "inline-block",
        }}
      >
        {value || "Not Installed"}
      </Box>
    ),
  },
  {
    Header: "Latest Target",
    accessor: "latest",
    Cell: ({ value, row }) => {
      const isOutdated = row.original.status && !row.original.status.includes("Up-to-date");
      return (
        <Box
          component="span"
          sx={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.8rem",
            fontWeight: 500,
            color: isOutdated ? "#34d399" : "#94a3b8",
            backgroundColor: isOutdated ? "rgba(16, 185, 129, 0.08)" : "#161f2e",
            px: 1,
            py: 0.3,
            borderRadius: "4px",
            border: `1px solid ${isOutdated ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
            display: "inline-block",
          }}
        >
          {value || "—"}
        </Box>
      );
    },
  },
  {
    Header: "Status",
    accessor: "status",
    Cell: ({ value }) => {
      const isUpToDate = (value || "").includes("Up-to-date");
      return (
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.6,
            px: 1.2,
            py: 0.35,
            borderRadius: "999px",
            backgroundColor: isUpToDate ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
            border: `1px solid ${isUpToDate ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
            color: isUpToDate ? "#34d399" : "#fbbf24",
            fontSize: "0.78rem",
            fontWeight: 600,
          }}
        >
          {isUpToDate ? (
            <CheckCircle sx={{ fontSize: 13, color: "#34d399" }} />
          ) : (
            <WarningAmber sx={{ fontSize: 13, color: "#fbbf24" }} />
          )}
          {value || "Unknown"}
        </Box>
      );
    },
  },
  {
    Header: "Risk Assessment",
    accessor: "riskLevel",
    Cell: ({ value }) => {
      const risk = value || "Low";
      const isHigh = risk === "High";
      const isMed = risk === "Medium";
      const percent = isHigh ? 90 : isMed ? 55 : 20;
      const color = isHigh ? "#ef4444" : isMed ? "#f59e0b" : "#10b981";

      return (
        <Box sx={{ minWidth: 110 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.4, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: color, display: "flex", alignItems: "center", gap: 0.3 }}>
              {isHigh && <GppMaybe sx={{ fontSize: 11 }} />}
              {risk}
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              {percent}%
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: "999px",
              height: 4,
              width: "100%",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: "999px",
                backgroundColor: color,
                transition: "width 0.3s ease",
              }}
            />
          </Box>
        </Box>
      );
    },
  },
  {
    Header: "Actions",
    accessor: "actions",
    Cell: ({ row }) => (
      <Box
        component="button"
        onClick={() => row.original.handleAttack(row.original.name)}
        sx={{
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          color: "#10b981",
          fontWeight: 600,
          fontSize: "0.78rem",
          borderRadius: "6px",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          px: 1.4,
          py: 0.5,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          transition: "all 0.15s ease",
          "&:hover": {
            backgroundColor: "#10b981",
            color: "#ffffff",
            borderColor: "#10b981",
          },
        }}
      >
        <PlayArrow sx={{ fontSize: 13 }} />
        Simulate Attack
      </Box>
    ),
  },
];

export default columns;
