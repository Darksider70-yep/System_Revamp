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
          background: "rgba(15, 23, 42, 0.95)",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          padding: "10px 14px",
          borderRadius: "10px",
          color: "#f8fafc",
          boxShadow: "0 10px 25px rgba(2, 6, 23, 0.7)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Typography sx={{ fontSize: "0.82rem", color: "#94a3b8", mb: 0.25 }}>
          {data.name}
        </Typography>
        <Typography sx={{ fontSize: "1.1rem", fontWeight: 800, color: data.payload.fill || "#38bdf8" }}>
          {data.value} <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#cbd5e1" }}>applications</span>
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
    setAttackLogs([`[INIT] Target selected: ${appName}`, "[INFO] Establishing simulated sandboxed connection..."]);
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
      setAttackLogs((prev) => [...prev, "[ERROR] Target simulator connection terminated."]);
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5 }}>
      {/* Visual Analytics & Metric Cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.2fr 2fr" },
          gap: 3,
        }}
      >
        {/* Status Doughnut Chart */}
        <Box
          sx={{
            background: "linear-gradient(145deg, rgba(15, 23, 42, 0.75) 0%, rgba(13, 20, 38, 0.65) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: "16px",
            p: 3,
            boxShadow: "0 12px 32px rgba(2, 6, 23, 0.5)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
          }}
        >
          <Box sx={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.05rem" }}>
              Application Integrity
            </Typography>
            <Chip
              label={`${data.length} Total`}
              size="small"
              sx={{
                background: "rgba(56, 189, 248, 0.12)",
                color: "#7dd3fc",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                fontWeight: 700,
                fontSize: "0.75rem",
              }}
            />
          </Box>

          <Box sx={{ width: "100%", height: 210, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="transparent"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index]}
                      style={{
                        filter: `drop-shadow(0 0 8px ${CHART_COLORS[index]}66)`,
                        transition: "all 0.3s ease",
                      }}
                    />
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
              <Typography sx={{ fontSize: "1.4rem", fontWeight: 800, color: "#f8fafc", lineHeight: 1 }}>
                {data.length ? Math.round((upToDateCount / data.length) * 100) : 0}%
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, mt: 0.3 }}>
                Healthy
              </Typography>
            </Box>
          </Box>

          {/* Chart Legend */}
          <Box sx={{ display: "flex", gap: 3, mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#10b981", boxShadow: "0 0 8px #10b981" }} />
              <Typography sx={{ fontSize: "0.8rem", color: "#cbd5e1", fontWeight: 600 }}>
                Up-to-Date ({upToDateCount})
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />
              <Typography sx={{ fontSize: "0.8rem", color: "#cbd5e1", fontWeight: 600 }}>
                Updates ({outdatedCount})
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Quick Insights Banner */}
        <Box
          sx={{
            background: "linear-gradient(145deg, rgba(15, 23, 42, 0.75) 0%, rgba(13, 20, 38, 0.65) 100%)",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            borderRadius: "16px",
            p: 3,
            boxShadow: "0 12px 32px rgba(2, 6, 23, 0.5)",
            backdropFilter: "blur(12px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Typography sx={{ color: "#f8fafc", fontWeight: 800, fontSize: "1.05rem", mb: 0.5 }}>
              Security & Patch Posture
            </Typography>
            <Typography sx={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 1.5 }}>
              Keeping applications patched mitigates up to 85% of standard vulnerability attack vectors.
              Use the automated simulation module below to verify exploit resistance on running processes.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 2,
              mt: 2,
            }}
          >
            <Box
              sx={{
                p: 2,
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", color: "#34d399", fontWeight: 700 }}>VERIFIED SAFE</Typography>
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc", mt: 0.5 }}>{upToDateCount}</Typography>
            </Box>
            <Box
              sx={{
                p: 2,
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", color: "#fbbf24", fontWeight: 700 }}>UPDATES PENDING</Typography>
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc", mt: 0.5 }}>{outdatedCount}</Typography>
            </Box>
            <Box
              sx={{
                p: 2,
                borderRadius: "12px",
                background: "rgba(244, 63, 94, 0.08)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", color: "#fb7185", fontWeight: 700 }}>HIGH RISK APPS</Typography>
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc", mt: 0.5 }}>
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
          gap: 2,
        }}
      >
        {/* Quick Filter Chips */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {[
            { id: "all", label: `All Apps (${data.length})` },
            { id: "outdated", label: `Updates Needed (${outdatedCount})` },
            { id: "uptodate", label: `Up-to-Date (${upToDateCount})` },
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
                  background: active
                    ? "linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)"
                    : "rgba(15, 23, 42, 0.6)",
                  color: active ? "#ffffff" : "#94a3b8",
                  border: `1px solid ${active ? "rgba(56, 189, 248, 0.6)" : "rgba(148, 163, 184, 0.15)"}`,
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.82rem",
                  boxShadow: active ? "0 0 14px rgba(56, 189, 248, 0.35)" : "none",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    background: active
                      ? "linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)"
                      : "rgba(30, 41, 59, 0.8)",
                    color: "#f8fafc",
                  },
                }}
              />
            );
          })}
        </Box>

        {/* Search Field */}
        <TextField
          placeholder="Search application by name..."
          variant="outlined"
          size="small"
          value={globalFilter || ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: "#38bdf8", fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: globalFilter ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setGlobalFilter("")} sx={{ color: "#94a3b8" }}>
                  <Clear sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{
            width: { xs: "100%", sm: 300 },
            "& .MuiOutlinedInput-root": {
              color: "#f8fafc",
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              borderRadius: "10px",
              fontSize: "0.88rem",
              "& fieldset": { borderColor: "rgba(56, 189, 248, 0.25)" },
              "&:hover fieldset": { borderColor: "rgba(56, 189, 248, 0.5)" },
              "&.Mui-focused fieldset": { borderColor: "#38bdf8", boxShadow: "0 0 12px rgba(56, 189, 248, 0.25)" },
            },
          }}
        />
      </Box>

      {/* Main Apps Table */}
      <TableContainer
        component={Paper}
        sx={{
          background: "linear-gradient(145deg, rgba(13, 20, 38, 0.85) 0%, rgba(10, 16, 32, 0.85) 100%)",
          borderRadius: "16px",
          border: "1px solid rgba(56, 189, 248, 0.2)",
          boxShadow: "0 18px 36px rgba(2, 6, 23, 0.55)",
          backdropFilter: "blur(12px)",
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
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.6px",
                      color: "#7dd3fc",
                      borderBottom: "1px solid rgba(56, 189, 248, 0.25)",
                      background: "rgba(15, 23, 42, 0.95)",
                      py: 1.8,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {column.render("Header")}
                      {column.isSorted ? (
                        <span style={{ color: "#38bdf8", fontSize: "0.9rem" }}>
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
                <TableCell colSpan={columns.length} sx={{ textAlign: "center", py: 5, color: "#94a3b8" }}>
                  <Typography sx={{ fontStyle: "italic", fontSize: "0.95rem" }}>
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
                        ? "rgba(99, 102, 241, 0.18)"
                        : "transparent",
                      borderLeft: isCurrentAttacking ? "3px solid #38bdf8" : "3px solid transparent",
                      "&:hover": {
                        backgroundColor: "rgba(56, 189, 248, 0.06)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  >
                    {row.cells.map((cell) => (
                      <TableCell
                        {...cell.getCellProps()}
                        key={cell.column.id}
                        sx={{
                          color: "#e2e8f0",
                          borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
                          py: 1.6,
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
            borderTop: "1px solid rgba(148, 163, 184, 0.1)",
            "& .MuiTablePagination-actions button": {
              color: "#38bdf8",
              "&:disabled": { color: "#475569" },
            },
            "& .MuiTablePagination-select": { color: "#f8fafc" },
            "& .MuiTablePagination-selectIcon": { color: "#7dd3fc" },
          }}
        />
      </TableContainer>

      {/* Cyber Attack Simulation Console */}
      {attackingApp && (
        <Paper
          sx={{
            mt: 2,
            background: "rgba(7, 11, 20, 0.95)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.2)",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          {/* Terminal Window Header Bar */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2.5,
              py: 1.5,
              background: "linear-gradient(90deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)",
              borderBottom: "1px solid rgba(56, 189, 248, 0.25)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ef4444" }} />
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
              <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#10b981" }} />
              <Typography
                sx={{
                  ml: 1.5,
                  fontSize: "0.85rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  color: "#38bdf8",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Terminal sx={{ fontSize: 18 }} />
                sandbox-attack-sim://{attackingApp.toLowerCase().replace(/\s+/g, "-")}
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
                borderColor: "rgba(148, 163, 184, 0.3)",
                fontSize: "0.75rem",
                textTransform: "none",
                fontWeight: 600,
                "&:hover": { color: "#f8fafc", backgroundColor: "rgba(244, 63, 94, 0.15)", borderColor: "#f43f5e" },
              }}
              variant="outlined"
            >
              Terminate Session
            </Button>
          </Box>

          {/* Terminal Console Content */}
          <Box
            sx={{
              p: 2.5,
              maxHeight: 280,
              overflowY: "auto",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.85rem",
              lineHeight: 1.7,
              backgroundColor: "#050811",
            }}
          >
            {attackLogs.map((log, idx) => {
              const isComplete = log.includes("complete") || log.includes("SUCCESS");
              const isError = log.includes("Error") || log.includes("ERROR");
              const isWarning = log.includes("WARN");

              let color = "#94a3b8";
              if (isComplete) color = "#34d399";
              else if (isError) color = "#f87171";
              else if (isWarning) color = "#fbbf24";
              else if (log.startsWith("[INIT]") || log.startsWith("[INFO]")) color = "#38bdf8";

              return (
                <Box key={idx} sx={{ color, display: "flex", gap: 1 }}>
                  <span style={{ color: "#475569", userSelect: "none" }}>{`0${idx + 1}`.slice(-2)}</span>
                  <span>{log}</span>
                </Box>
              );
            })}
            {isAttacking && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1, color: "#38bdf8" }}>
                <CircularProgress size={14} sx={{ color: "#38bdf8" }} />
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
