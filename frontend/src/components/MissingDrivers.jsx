import React from "react";
import { Card, Typography, CircularProgress, Box, Chip } from "@mui/material";

const hoverGlow = {
  transition: "box-shadow 0.3s ease, transform 0.3s ease",
  "&:hover": {
    boxShadow: "0 0 25px rgba(0,255,255,0.8)",
    transform: "translateY(-2px)",
  },
};

const MissingDrivers = ({ missing = [], installed = [] }) => {
  const statusColors = { Missing: "#ff4d4d", Installed: "#4dff88" };
  const gradientColors = [
    "#ff4d4d",
    "#ff8c00",
    "#ffff4d",
    "#4dff88",
    "#00ffff",
    "#4d88ff",
    "#ff4dff",
  ];

  const getGradient = (idx) => gradientColors[idx % gradientColors.length];

  const renderDriverCard = (driver, key) => (
    <Card
      key={key}
      sx={{
        p: 2,
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(0,0,0,0.85)",
        borderRadius: 3,
        color: "#fff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        border: `1px solid ${getGradient(key)}`,
        ...hoverGlow,
      }}
    >
      <Box>
        <Typography
          sx={{
            fontWeight: "bold",
            fontSize: 16,
            color: "#fff",
            textShadow: `0 0 6px ${getGradient(key)}`,
          }}
        >
          {driver["Driver Name"]}.sys
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#ddd" }}>Device: {driver.Device}</Typography>
      </Box>
      <Chip
        label={driver.Status}
        sx={{
          fontWeight: "bold",
          color: "#000",
          backgroundColor: statusColors[driver.Status],
        }}
      />
    </Card>
  );

  const renderPanel = (title, drivers, emptyMessage) => (
    <Card
      sx={{
        flex: 1,
        background: "#0a0a0a",
        borderRadius: 4,
        padding: 3,
        border: "2px solid #00ffff",
        boxShadow: "0 0 50px rgba(0,255,255,0.5)",
      }}
    >
      <Typography
        variant="h5"
        sx={{
          fontWeight: "bold",
          mb: 3,
          textAlign: "center",
          color: "#00ffff",
          fontSize: 22,
          textShadow: "0 0 8px #00ffff",
        }}
      >
        {title}
      </Typography>

      {drivers.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {drivers.map(renderDriverCard)}
        </Box>
      ) : (
        <Typography variant="body2" sx={{ color: "#aaa", textAlign: "center", fontStyle: "italic", py: 3 }}>
          {emptyMessage}
        </Typography>
      )}
    </Card>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 4, p: 2 }}>
      {renderPanel("Missing Drivers", missing, "All drivers are installed")}
      {renderPanel("Installed Drivers", installed, "No installed drivers found")}
    </Box>
  );
};

export default MissingDrivers;
