import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  Button,
  Box,
  Typography,
  CircularProgress,
  InputAdornment,
  Chip,
  IconButton,
} from "@mui/material";
import { Search, Clear, Terminal } from "@mui/icons-material";
import { useTable, usePagination, useGlobalFilter, useSortBy } from "react-table";
import columnsData from "./InstalledAppsTableColumns";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const CHART_COLORS = ["#10b981", "#f59e0b"];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <Box
        sx={{
          backgroundColor: "#161f2e",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "8px 12px",
          borderRadius: "8px",
          color: "#f8fafc",
          boxShadow: "0 6px 18px rgba(0, 0, 0, 0.4)",
        }}
      >
        <Typography sx={{ fontSize: "0.78rem", color: "#94a3b8", mb: 0.2 }}>
          {data.name}
        </Typography>
        <Typography sx={{ fontSize: "1rem", fontWeight: 700, color: data.payload.fill || "#10b981" }}>
          {data.value} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#94a3b8" }}>apps</span>
        </Typography>
      </Box>
    );
  }
  return null;
};

const InstalledAppsTable = ({ data = [] }) => {
  const [attackLogs, setAttackLogs] = useState([]);
  const [attackingApp, setAttackingApp] = useState(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  const columns = useMemo(() => columnsData, []);

  // Filter data based on quick tabs
  const filteredData = useMemo(() => {
    if (filterType === "outdated") {
      return data.filter((app) => !app.status?.includes("Up-to-date"));
    }
    if (filterType === "uptodate") {
      return data.filter((app) => app.status?.includes("Up-to-date"));
    }
    if (filterType === "highrisk") {
      return data.filter((app) => app.riskLevel === "High");
    }
    return data;
  }, [data, filterType]);

  const upToDateCount = useMemo(() => data.filter((app) => app.status?.includes("Up-to-date")).length, [data]);
  const outdatedCount = useMemo(() => data.filter((app) => !app.status?.includes("Up-to-date")).length, [data]);

  const chartData = useMemo(
    () => [
      { name: "Up-to-Date", value: upToDateCount },
      { name: "Updates Required", value: outdatedCount },
    ],
    [upToDateCount, outdatedCount]
  );

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [attackLogs]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const handleAttack = useCallback((appName) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setAttackingApp(appName);
    setAttackLogs([`[INIT] Target selected: ${appName}`, "[INFO] Initializing sandboxed simulation environment..."]);
    setIsAttacking(true);

    const es = new EventSource(`http://localhost:8000/simulate-attack/${encodeURIComponent(appName)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      setAttackLogs((prev) => [...prev, event.data]);
      if (event.data.includes("Attack simulation complete!")) {
        setIsAttacking(false);
        es.close();
      }
    };

    es.onerror = () => {
      setAttackLogs((prev) => [...prev, "[ERROR] Simulation connection ended."]);
      setIsAttacking(false);
      es.close();
    };
  }, []);

  const tableData = useMemo(() => filteredData.map((row) => ({ ...row, handleAttack })), [filteredData, handleAttack]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    pageOptions,
    state,
    setGlobalFilter,
    gotoPage,
    setPageSize,
  } = useTable(
    { columns, data: tableData, initialState: { pageSize: 10 } },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  const { globalFilter, pageIndex, pageSize } = state;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Analytics & Metric Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.1fr 2fr" },
          gap: 2.5,
        }}
      >
        {/* Status Doughnut Chart */}
        <Box
          sx={{
            backgroundColor: "#121824",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Box sx={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
            <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.95rem" }}>
              Application Health
            </Typography>
            <Chip
              label={`${data.length} Total`}
              size="small"
              sx={{
                backgroundColor: "rgba(16, 185, 129, 0.12)",
                color: "#10b981",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                fontWeight: 600,
                fontSize: "0.72rem",
              }}
            />
          </Box>

          <Box sx={{ width: "100%", height: 190, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="transparent"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Stat */}
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <Typography sx={{ fontSize: "1.3rem", fontWeight: 700, color: "#f8fafc", lineHeight: 1 }}>
                {data.length ? Math.round((upToDateCount / data.length) * 100) : 0}%
              </Typography>
              <Typography sx={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 500, mt: 0.2 }}>
                Up to Date
              </Typography>
            </Box>
          </Box>

          {/* Chart Legend */}
          <Box sx={{ display: "flex", gap: 2.5, mt: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981" }} />
              <Typography sx={{ fontSize: "0.78rem", color: "#cbd5e1", fontWeight: 500 }}>
                Up-to-Date ({upToDateCount})
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
              <Typography sx={{ fontSize: "0.78rem", color: "#cbd5e1", fontWeight: 500 }}>
                Updates ({outdatedCount})
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Quick Insights Banner */}
        <Box
          sx={{
            backgroundColor: "#121824",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            p: 2.5,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.95rem", mb: 0.4 }}>
              Patch Posture & Security Verification
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.82rem", lineHeight: 1.5 }}>
              Keeping all system applications updated protects against known CVE vulnerability vectors.
              Use the simulation tool in the inventory below to inspect process behaviors.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1.5,
              mt: 2,
            }}
          >
            <Box
              sx={{
                p: 1.5,
                borderRadius: "8px",
                backgroundColor: "rgba(16, 185, 129, 0.06)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
              }}
            >
              <Typography sx={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 600 }}>CURRENT APPS</Typography>
              <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc", mt: 0.3 }}>{upToDateCount}</Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                borderRadius: "8px",
                backgroundColor: "rgba(245, 158, 11, 0.06)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
              }}
            >
              <Typography sx={{ fontSize: "0.7rem", color: "#f59e0b", fontWeight: 600 }}>PATCHES PENDING</Typography>
              <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc", mt: 0.3 }}>{outdatedCount}</Typography>
            </Box>
            <Box
              sx={{
                p: 1.5,
                borderRadius: "8px",
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
              }}
            >
              <Typography sx={{ fontSize: "0.7rem", color: "#ef4444", fontWeight: 600 }}>HIGH RISK</Typography>
              <Typography sx={{ fontSize: "1.35rem", fontWeight: 700, color: "#f8fafc", mt: 0.3 }}>
                {data.filter((a) => a.riskLevel === "High").length}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Filter and Search Bar */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        {/* Quick Filter Chips */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {[
            { id: "all", label: `All (${data.length})` },
            { id: "outdated", label: `Needs Update (${outdatedCount})` },
            { id: "uptodate", label: `Up to Date (${upToDateCount})` },
            { id: "highrisk", label: `High Risk (${data.filter((a) => a.riskLevel === "High").length})` },
          ].map((tab) => {
            const active = filterType === tab.id;
            return (
              <Chip
                key={tab.id}
                label={tab.label}
                onClick={() => setFilterType(tab.id)}
                clickable
                sx={{
                  backgroundColor: active ? "rgba(16, 185, 129, 0.15)" : "#121824",
                  color: active ? "#10b981" : "#94a3b8",
                  border: `1px solid ${active ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
                  fontWeight: active ? 600 : 500,
                  fontSize: "0.8rem",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: active ? "rgba(16, 185, 129, 0.2)" : "#1a2232",
                    color: "#f8fafc",
                  },
                }}
              />
            );
          })}
        </Box>

        {/* Search Field */}
        <TextField
          placeholder="Search applications..."
          variant="outlined"
          size="small"
          value={globalFilter || ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: "#94a3b8", fontSize: 18 }} />
              </InputAdornment>
            ),
            endAdornment: globalFilter ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setGlobalFilter("")} sx={{ color: "#94a3b8" }}>
                  <Clear sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            width: { xs: "100%", sm: 280 },
            "& .MuiOutlinedInput-root": {
              color: "#f8fafc",
              backgroundColor: "#121824",
              borderRadius: "8px",
              fontSize: "0.85rem",
              "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
              "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
              "&.Mui-focused fieldset": { borderColor: "#10b981" },
            },
          }}
        />
      </Box>

      {/* Main Apps Table */}
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: "#121824",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
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
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#94a3b8",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      backgroundColor: "#0e131f",
                      py: 1.5,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {column.render("Header")}
                      {column.isSorted ? (
                        <span style={{ color: "#10b981", fontSize: "0.85rem" }}>
                          {column.isSortedDesc ? " ↓" : " ↑"}
                        </span>
                      ) : null}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody {...getTableBodyProps()}>
            {page.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: "center", py: 4, color: "#94a3b8" }}>
                  <Typography sx={{ fontSize: "0.9rem" }}>
                    No matching applications found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              page.map((row) => {
                prepareRow(row);
                const isCurrentAttacking = attackingApp === row.original.name;
                return (
                  <TableRow
                    {...row.getRowProps()}
                    key={row.id}
                    sx={{
                      backgroundColor: isCurrentAttacking
                        ? "rgba(16, 185, 129, 0.08)"
                        : "transparent",
                      borderLeft: isCurrentAttacking ? "3px solid #10b981" : "3px solid transparent",
                      "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                      },
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    {row.cells.map((cell) => (
                      <TableCell
                        {...cell.getCellProps()}
                        key={cell.column.id}
                        sx={{
                          color: "#e2e8f0",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          py: 1.4,
                        }}
                      >
                        {cell.render("Cell")}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Table Pagination */}
        <TablePagination
          component="div"
          count={pageOptions.length * pageSize}
          page={pageIndex}
          onPageChange={(e, newPage) => gotoPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => setPageSize(Number(e.target.value))}
          rowsPerPageOptions={[5, 10, 20, 50]}
          sx={{
            color: "#94a3b8",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            "& .MuiTablePagination-actions button": {
              color: "#10b981",
              "&:disabled": { color: "#475569" },
            },
            "& .MuiTablePagination-select": { color: "#f8fafc" },
            "& .MuiTablePagination-selectIcon": { color: "#94a3b8" },
          }}
        />
      </TableContainer>

      {/* Attack Simulation Console */}
      {attackingApp && (
        <Paper
          sx={{
            mt: 1,
            backgroundColor: "#0d1117",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            overflow: "hidden",
          }}
        >
          {/* Terminal Window Header Bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.2,
              backgroundColor: "#161b22",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ef4444" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#10b981" }} />
              <Typography
                sx={{
                  ml: 1,
                  fontSize: "0.8rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                }}
              >
                <Terminal sx={{ fontSize: 16 }} />
                simulation://{attackingApp.toLowerCase().replace(/\s+/g, "-")}
              </Typography>
            </Box>

            <Button
              size="small"
              onClick={() => {
                setAttackingApp(null);
                setAttackLogs([]);
                if (eventSourceRef.current) eventSourceRef.current.close();
              }}
              sx={{
                color: "#94a3b8",
                borderColor: "rgba(255, 255, 255, 0.12)",
                fontSize: "0.72rem",
                textTransform: "none",
                fontWeight: 500,
                "&:hover": { color: "#f8fafc", backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "#ef4444" },
              }}
              variant="outlined"
            >
              Close Terminal
            </Button>
          </Box>

          {/* Terminal Console Content */}
          <Box
            sx={{
              p: 2,
              maxHeight: 250,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              backgroundColor: "#0b0f17",
            }}
          >
            {attackLogs.map((log, idx) => {
              const isComplete = log.includes("complete") || log.includes("SUCCESS");
              const isError = log.includes("Error") || log.includes("ERROR");
              const isWarning = log.includes("WARN");

              let color = "#94a3b8";
              if (isComplete) color = "#10b981";
              else if (isError) color = "#f87171";
              else if (isWarning) color = "#fbbf24";
              else if (log.startsWith("[INIT]") || log.startsWith("[INFO]")) color = "#34d399";

              return (
                <Box key={idx} sx={{ color, display: "flex", gap: 1 }}>
                  <span style={{ color: "#475569", userSelect: "none" }}>{`0${idx + 1}`.slice(-2)}</span>
                  <span>{log}</span>
                </Box>
              );
            })}
            {isAttacking && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.8, color: "#10b981" }}>
                <CircularProgress size={12} sx={{ color: "#10b981" }} />
                <span>Simulating exploit vectors against local process...</span>
                <span className="terminal-cursor" />
              </Box>
            )}
            <div ref={logsEndRef} />
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default InstalledAppsTable;
