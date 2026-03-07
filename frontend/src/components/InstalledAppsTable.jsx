import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useGlobalFilter, usePagination, useSortBy, useTable } from "react-table";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import columnsData from "./InstalledAppsTableColumns";

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

const InstalledAppsTable = ({ data, loading = false, error = "", onRefresh = null, onSimulateAttack = null }) => {
  const [attackLoading, setAttackLoading] = useState(false);
  const [attackError, setAttackError] = useState("");
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

  const handleAttack = useCallback(
    async (appRow) => {
      if (!onSimulateAttack) {
        return;
      }
      setAttackDialogOpen(true);
      setAttackLoading(true);
      setAttackError("");
      setAttackResult(null);
      try {
        const result = await onSimulateAttack(appRow);
        setAttackResult(result || null);
      } catch (requestError) {
        setAttackError(requestError.message || "Attack simulation failed.");
      } finally {
        setAttackLoading(false);
      }
    },
    [onSimulateAttack]
  );

  const tableData = useMemo(() => data.map((row) => ({ ...row, handleAttack })), [data, handleAttack]);

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, page, state, setGlobalFilter, gotoPage, setPageSize } =
    useTable({ columns, data: tableData, initialState: { pageSize: 8 } }, useGlobalFilter, useSortBy, usePagination);

  const { globalFilter, pageIndex, pageSize } = state;

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", mb: 2, gap: 1.5 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: 24, md: 30 }, fontWeight: 800, color: "#e2e8f0" }}>
          Installed Applications
        </Typography>
        {onRefresh ? (
          <Button
            variant="outlined"
            onClick={onRefresh}
            disabled={loading}
            sx={{
              color: "#bae6fd",
              borderColor: "rgba(56, 189, 248, 0.45)",
              "&:hover": { borderColor: "#38bdf8" },
            }}
          >
            Refresh
          </Button>
        ) : null}
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box
        sx={{
          background: "linear-gradient(145deg, rgba(5, 13, 34, 0.88), rgba(8, 23, 52, 0.8))",
          border: "1px solid rgba(56, 189, 248, 0.24)",
          borderRadius: 3,
          p: 3,
          mb: 3,
          boxShadow: "0 18px 38px rgba(2, 6, 23, 0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Typography variant="h6" align="center" sx={{ color: "#e2e8f0", mb: 2, fontWeight: 800 }}>
          Update Compliance
        </Typography>
        <Box sx={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={104}
                innerRadius={45}
                paddingAngle={3}
                dataKey="value"
                stroke="#0f172a"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} stroke={COLORS[index]} strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: "#cbd5e1", fontWeight: 700 }} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <TextField
        label="Search applications"
        variant="outlined"
        value={globalFilter || ""}
        onChange={(event) => setGlobalFilter(event.target.value)}
        fullWidth
        sx={{
          mb: 2,
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

      {loading ? (
        <Box sx={{ py: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress sx={{ color: "#38bdf8" }} />
        </Box>
      ) : tableData.length === 0 ? (
        <Alert severity="info">No applications were returned by scanner/version services.</Alert>
      ) : (
        <>
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
                        "&:hover": { backgroundColor: "rgba(30, 64, 175, 0.28)" },
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
            onPageChange={(_, newPage) => gotoPage(newPage)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => setPageSize(Number(event.target.value))}
            rowsPerPageOptions={[8, 15, 25]}
            sx={{
              color: "#cbd5e1",
              mt: 2,
              "& .MuiTablePagination-actions button": { color: "#7dd3fc" },
            }}
          />
        </>
      )}

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
              <Typography>
                <strong>Software:</strong> {attackResult.software || "Unknown"}
              </Typography>
              <Typography>
                <strong>Risk Level:</strong> {attackResult.riskLevel || "Unknown"}
              </Typography>
              <Typography>
                <strong>Vulnerability:</strong> {attackResult.vulnerability || "N/A"}
              </Typography>
              <Typography>
                <strong>Possible Attack:</strong> {attackResult.possibleAttack || "N/A"}
              </Typography>
              <Typography>
                <strong>Recommendation:</strong> {attackResult.recommendation || "N/A"}
              </Typography>
            </Box>
          ) : (
            <Typography sx={{ color: "#94a3b8" }}>No simulation data returned.</Typography>
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
