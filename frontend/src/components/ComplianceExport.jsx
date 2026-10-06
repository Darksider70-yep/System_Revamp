import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Divider,
} from "@mui/material";
import { Download, PictureAsPdf, TableView } from "@mui/icons-material";

const cardStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
};

export default function ComplianceExport({ overview, devices }) {
  const exportCSV = () => {
    if (!devices || devices.length === 0) return;

    const headers = ["Hostname", "Status", "Lab", "OS", "IP Address", "Critical Risks", "Driver Issues", "Last Heartbeat"];
    const rows = devices.map((d) => [
      `"${d.hostname}"`,
      `"${d.is_online ? "Online" : "Offline"}"`,
      `"${d.lab_name || "N/A"}"`,
      `"${d.os_name} ${d.os_version}"`,
      `"${d.ip_address || "N/A"}"`,
      d.critical_risks,
      d.driver_issues,
      `"${d.last_heartbeat}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `system_revamp_compliance_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    window.print();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc", mb: 3 }}>
        📊 Fleet Compliance & Audit Reports
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 1 }}>
                Export CSV Inventory Data
              </Typography>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
                Download raw device inventories, software risk tags, PnP hardware error codes, and connectivity statuses for spreadsheet auditing.
              </Typography>
              <Button variant="contained" color="primary" startIcon={<TableView />} onClick={exportCSV}>
                Download Fleet CSV Report
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={cardStyle}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#f8fafc", fontWeight: 600, mb: 1 }}>
                Print / Save PDF Executive Summary
              </Typography>
              <Typography variant="body2" sx={{ color: "#94a3b8", mb: 3 }}>
                Generates a print-ready PDF executive compliance document showing fleet health percentage, critical risk counts, and top vulnerabilities.
              </Typography>
              <Button variant="outlined" color="secondary" startIcon={<PictureAsPdf />} onClick={printReport}>
                Print / Save as PDF
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
