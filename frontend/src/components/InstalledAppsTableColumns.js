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
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.25) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#7dd3fc",
              fontWeight: 800,
              fontSize: "0.85rem",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(56, 189, 248, 0.15)",
            }}
          >
            {initial}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                color: "#f8fafc",
                fontWeight: 700,
                fontSize: "0.92rem",
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
          fontSize: "0.83rem",
          fontWeight: 600,
          color: "#94a3b8",
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          px: 1.2,
          py: 0.4,
          borderRadius: "6px",
          border: "1px solid rgba(148, 163, 184, 0.15)",
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
            fontSize: "0.83rem",
            fontWeight: 600,
            color: isOutdated ? "#38bdf8" : "#94a3b8",
            backgroundColor: isOutdated ? "rgba(56, 189, 248, 0.1)" : "rgba(15, 23, 42, 0.7)",
            px: 1.2,
            py: 0.4,
            borderRadius: "6px",
            border: `1px solid ${isOutdated ? "rgba(56, 189, 248, 0.3)" : "rgba(148, 163, 184, 0.15)"}`,
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
            gap: 0.75,
            px: 1.4,
            py: 0.45,
            borderRadius: "999px",
            backgroundColor: isUpToDate ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.14)",
            border: `1px solid ${isUpToDate ? "rgba(16, 185, 129, 0.35)" : "rgba(245, 158, 11, 0.4)"}`,
            color: isUpToDate ? "#34d399" : "#fbbf24",
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: 0.2,
          }}
        >
          {isUpToDate ? (
            <CheckCircle sx={{ fontSize: 14, color: "#34d399" }} />
          ) : (
            <WarningAmber sx={{ fontSize: 14, color: "#fbbf24" }} />
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
      const color = isHigh ? "#f43f5e" : isMed ? "#f59e0b" : "#10b981";
      const glow = isHigh
        ? "0 0 10px rgba(244, 63, 94, 0.5)"
        : isMed
        ? "0 0 10px rgba(245, 158, 11, 0.5)"
        : "0 0 10px rgba(16, 185, 129, 0.4)";

      return (
        <Box sx={{ minWidth: 120 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: color, display: "flex", alignItems: "center", gap: 0.4 }}>
              {isHigh && <GppMaybe sx={{ fontSize: 12 }} />}
              {risk}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
              {percent}%
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              borderRadius: "999px",
              height: 6,
              width: "100%",
              overflow: "hidden",
              border: "1px solid rgba(148, 163, 184, 0.1)",
            }}
          >
            <Box
              sx={{
                width: `${percent}%`,
                height: "100%",
                borderRadius: "999px",
                backgroundColor: color,
                boxShadow: glow,
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
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
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(56, 189, 248, 0.15) 100%)",
          color: "#7dd3fc",
          fontWeight: 700,
          fontSize: "0.8rem",
          borderRadius: "8px",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          px: 1.75,
          py: 0.7,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.6,
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 2px 8px rgba(2, 6, 23, 0.4)",
          "&:hover": {
            background: "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)",
            color: "#ffffff",
            borderColor: "#38bdf8",
            boxShadow: "0 0 16px rgba(56, 189, 248, 0.45)",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        }}
      >
        <PlayArrow sx={{ fontSize: 15 }} />
        Simulate Attack
      </Box>
    ),
  },
];

export default columns;
