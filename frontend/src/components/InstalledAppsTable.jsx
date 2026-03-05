import React, { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { useTable, usePagination, useGlobalFilter, useSortBy } from "react-table";
import columnsData from "./InstalledAppsTableColumns";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#38bdf8", "#f59e0b"];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        sx={{
          backgroundColor: "#020617",
          border: "1px solid rgba(56, 189, 248, 0.36)",
          padding: 1.25,
          borderRadius: 1.5,
          color: "#dbeafe",
          fontWeight: 700,
          boxShadow: "0 12px 26px rgba(2, 6, 23, 0.48)",
        }}
      >
        <div>{label}</div>
        <div>{payload[0].value} apps</div>
      </Box>
    );
  }
  return null;
};

const InstalledAppsTable = ({ data }) => {
  const [attackLoading, setAttackLoading] = useState(false);
  const [attackError, setAttackError] = useState(null);
  const [attackResult, setAttackResult] = useState(null);
  const [attackDialogOpen, setAttackDialogOpen] = useState(false);

  const columns = useMemo(() => columnsData, []);

  const chartData = useMemo(
    () => [
      { name: "Installed / Up-to-date", value: data.filter((app) => app.status?.includes("Up-to-date")).length },
      {
        name: "Not Installed / Update Available",
        value: data.filter((app) => !app.status?.includes("Up-to-date")).length,
      },
    ],
    [data]
  );

  const handleAttack = useCallback(async (appRow) => {
    const software = appRow?.name || "Unknown Software";
    setAttackDialogOpen(true);
    setAttackLoading(true);
    setAttackError(null);
    setAttackResult(null);

    try {
      const response = await fetch("http://127.0.0.1:8000/simulate-attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          software,
          current: appRow?.current,
          latest: appRow?.latest,
          riskLevel: appRow?.riskLevel,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.error || `Simulation failed (${response.status})`);
      }
      setAttackResult(payload);
    } catch (error) {
      setAttackError(error?.message || "Attack simulation failed");
    } finally {
      setAttackLoading(false);
    }
  }, []);

  const tableData = useMemo(() => data.map((row) => ({ ...row, handleAttack })), [data, handleAttack]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    state,
    setGlobalFilter,
    gotoPage,
    setPageSize,
  } = useTable({ columns, data: tableData, initialState: { pageSize: 5 } }, useGlobalFilter, useSortBy, usePagination);

  const { globalFilter, pageIndex, pageSize } = state;

  return (
    <Box sx={{ p: 3, minHeight: "100vh" }}>
      <Box
        sx={{
          background: "linear-gradient(145deg, rgba(5, 13, 34, 0.88), rgba(8, 23, 52, 0.8))",
          border: "1px solid rgba(56, 189, 248, 0.24)",
          borderRadius: 3,
          p: 3,
          mb: 4,
          boxShadow: "0 18px 38px rgba(2, 6, 23, 0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Typography variant="h6" align="center" sx={{ color: "#e2e8f0", mb: 2, fontWeight: 800 }}>
          System Update Status
        </Typography>
        <Box sx={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <defs>
                <filter id="glow" height="300%" width="300%" x="-75%" y="-75%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={110}
                innerRadius={50}
                paddingAngle={3}
                dataKey="value"
                stroke="#0f172a"
                strokeWidth={2}
                filter="url(#glow)"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} stroke={COLORS[index]} strokeWidth={2} />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{
                  color: "#cbd5e1",
                  fontWeight: 700,
                  bottom: -10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <TextField
        label="Search apps"
        variant="outlined"
        value={globalFilter || ""}
        onChange={(e) => setGlobalFilter(e.target.value)}
        fullWidth
        sx={{
          mb: 3,
          "& .MuiOutlinedInput-root": {
            color: "#e2e8f0",
            backgroundColor: "rgba(15, 23, 42, 0.86)",
            borderRadius: 2.5,
            "& fieldset": { borderColor: "rgba(56, 189, 248, 0.3)" },
            "&:hover fieldset": { borderColor: "rgba(56, 189, 248, 0.5)" },
            "&.Mui-focused fieldset": { borderColor: "#22d3ee" },
          },
          "& .MuiInputLabel-root": { color: "#93c5fd", fontWeight: 600 },
        }}
      />

      <TableContainer
        component={Paper}
        sx={{
          background: "linear-gradient(145deg, rgba(7, 15, 36, 0.9), rgba(9, 25, 58, 0.82))",
          borderRadius: 3,
          border: "1px solid rgba(56, 189, 248, 0.24)",
          boxShadow: "0 18px 36px rgba(2, 6, 23, 0.52)",
        }}
      >
        <Table {...getTableProps()}>
          <TableHead>
            {headerGroups.map((headerGroup) => (
              <TableRow {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
                {headerGroup.headers.map((column) => (
                  <TableCell
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    key={column.id}
                    sx={{
                      fontWeight: 800,
                      color: "#bfdbfe",
                      borderBottom: "1px solid rgba(56, 189, 248, 0.24)",
                      background: "linear-gradient(90deg, rgba(8, 19, 44, 0.95), rgba(12, 29, 64, 0.95))",
                    }}
                  >
                    {column.render("Header")}
                    {column.isSorted ? (column.isSortedDesc ? " v" : " ^") : ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody {...getTableBodyProps()}>
            {page.map((row) => {
              prepareRow(row);
              return (
                <TableRow
                  {...row.getRowProps()}
                  key={row.id}
                  sx={{
                    backgroundColor: "rgba(2, 6, 23, 0.34)",
                    "&:hover": {
                      backgroundColor: "rgba(30, 64, 175, 0.28)",
                    },
                    transition: "background-color 0.2s ease-in-out",
                  }}
                >
                  {row.cells.map((cell) => (
                    <TableCell
                      {...cell.getCellProps()}
                      key={cell.column.id}
                      sx={{ color: "#e2e8f0", borderBottom: "1px solid rgba(56, 189, 248, 0.14)" }}
                    >
                      {cell.render("Cell")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={tableData.length}
        page={pageIndex}
        onPageChange={(e, newPage) => gotoPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => setPageSize(Number(e.target.value))}
        rowsPerPageOptions={[5, 10, 20]}
        sx={{
          color: "#cbd5e1",
          mt: 2,
          "& .MuiTablePagination-actions button": { color: "#7dd3fc" },
        }}
      />

      <Dialog
        open={attackDialogOpen}
        onClose={() => setAttackDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            background: "linear-gradient(145deg, rgba(5, 13, 34, 0.96), rgba(8, 23, 52, 0.94))",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            color: "#e2e8f0",
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle sx={{ color: "#dbeafe", fontWeight: 800 }}>Attack Simulation Result</DialogTitle>
        <DialogContent dividers sx={{ borderColor: "rgba(56, 189, 248, 0.2)" }}>
          {attackLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
              <CircularProgress size={22} sx={{ color: "#38bdf8" }} />
              <Typography sx={{ color: "#bae6fd" }}>Running educational simulation...</Typography>
            </Box>
          ) : attackError ? (
            <Typography sx={{ color: "#fda4af" }}>{attackError}</Typography>
          ) : attackResult ? (
            <Box sx={{ display: "grid", gap: 1.2 }}>
              <Typography><strong>Software:</strong> {attackResult.software}</Typography>
              <Typography><strong>Vulnerability:</strong> {attackResult.vulnerability}</Typography>
              <Typography><strong>Risk Level:</strong> {attackResult.riskLevel}</Typography>
              <Typography><strong>Possible Attack:</strong> {attackResult.possibleAttack}</Typography>
              <Typography><strong>Recommendation:</strong> {attackResult.recommendation}</Typography>
            </Box>
          ) : (
            <Typography sx={{ color: "#94a3b8" }}>No simulation output.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => setAttackDialogOpen(false)}
            sx={{
              background: "linear-gradient(120deg, #4f46e5, #0284c7)",
              "&:hover": { background: "linear-gradient(120deg, #4338ca, #0369a1)" },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InstalledAppsTable;