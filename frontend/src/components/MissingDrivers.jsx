import React from "react";
import { Card, Typography, Box, Chip } from "@mui/material";

const panelStyle = {
  background: "linear-gradient(145deg, rgba(5, 13, 34, 0.9), rgba(8, 23, 52, 0.82))",
  borderRadius: 4,
  padding: 3,
  border: "1px solid rgba(56, 189, 248, 0.24)",
  boxShadow: "0 18px 36px rgba(2, 6, 23, 0.52)",
  backdropFilter: "blur(8px)",
};

const hoverCard = {
  transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
  "&:hover": {
    boxShadow: "0 14px 30px rgba(2, 6, 23, 0.58)",
    transform: "translateY(-2px)",
    borderColor: "rgba(56, 189, 248, 0.38)",
  },
};

const impactColors = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#0ea5e9",
};

const MissingDrivers = ({ missing = [], installed = [], riskSummary = {} }) => {
  const statusColors = { Missing: "#dc2626", Installed: "#15803d" };

  const renderDriverCard = (driver, key) => (
    <Card
      key={key}
      sx={{
        p: 2,
        backgroundColor: "rgba(15, 23, 42, 0.78)",
        borderRadius: 3,
        color: "#e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: "1px solid rgba(56, 189, 248, 0.2)",
        ...hoverCard,
      }}
    >
      <Box>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: "#bae6fd",
          }}
        >
          {driver["Driver Name"]}.sys
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#94a3b8" }}>Device: {driver.Device}</Typography>
        {driver.Status === "Missing" && (
          <Typography sx={{ fontSize: 12, color: "#94a3b8", mt: 0.5 }}>
            Impact: {driver.Impact || "Low"} | Risk Score: {driver.RiskScore ?? 0}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        {driver.Status === "Missing" && driver.Impact && (
          <Chip
            label={driver.Impact}
            sx={{
              fontWeight: 700,
              color: "#ffffff",
              backgroundColor: impactColors[driver.Impact] || "#475569",
            }}
          />
        )}
        <Chip
          label={driver.Status}
          sx={{
            fontWeight: 700,
            color: "#ffffff",
            backgroundColor: statusColors[driver.Status],
          }}
        />
      </Box>
    </Card>
  );

  const renderPanel = (title, drivers, emptyMessage) => (
    <Card sx={{ flex: 1, ...panelStyle }}>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 800,
          mb: 3,
          textAlign: "center",
          color: "#e0e7ff",
          fontSize: 22,
        }}
      >
        {title}
      </Typography>

      {drivers.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>{drivers.map(renderDriverCard)}</Box>
      ) : (
        <Typography variant="body2" sx={{ color: "#94a3b8", textAlign: "center", fontStyle: "italic", py: 3 }}>
          {emptyMessage}
        </Typography>
      )}
    </Card>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 2 }}>
      <Card sx={{ ...panelStyle }}>
        <Typography sx={{ color: "#e0e7ff", fontWeight: 800, mb: 1.5 }}>Driver Risk Intelligence</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip label={`Critical: ${riskSummary.critical || 0}`} sx={{ backgroundColor: "#dc2626", color: "#fff", fontWeight: 700 }} />
          <Chip label={`High: ${riskSummary.high || 0}`} sx={{ backgroundColor: "#ea580c", color: "#fff", fontWeight: 700 }} />
          <Chip label={`Medium: ${riskSummary.medium || 0}`} sx={{ backgroundColor: "#d97706", color: "#fff", fontWeight: 700 }} />
          <Chip label={`Low: ${riskSummary.low || 0}`} sx={{ backgroundColor: "#0ea5e9", color: "#fff", fontWeight: 700 }} />
        </Box>
      </Card>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 4 }}>
      {renderPanel("Missing Drivers", missing, "All drivers are installed")}
      {renderPanel("Installed Drivers", installed, "No installed drivers found")}
      </Box>
    </Box>
  );
};

export default MissingDrivers;
