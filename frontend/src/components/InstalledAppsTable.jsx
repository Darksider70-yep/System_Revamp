import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TablePagination, TextField, Button, Box, Typography, CircularProgress
} from "@mui/material";
import { useTable, usePagination, useGlobalFilter, useSortBy } from "react-table";
import columnsData from "./InstalledAppsTableColumns";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#00ff00", "#ffa500"]; // green for installed, orange for not installed

// Custom Tooltip for PieChart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box sx={{
        backgroundColor: "#1a1a1a",
        border: "1px solid #00ff00",
        padding: 1,
        borderRadius: 1,
        color: "#00ff00",
        fontWeight: "bold",
      }}>
        <div>{label}</div>
        <div>{payload[0].value} apps</div>
      </Box>
    );
  }
  return null;
};

const InstalledAppsTable = ({ data }) => {
  const [attackLogs, setAttackLogs] = useState([]);
  const [attackingApp, setAttackingApp] = useState(null);
  const [isAttacking, setIsAttacking] = useState(false);
  const eventSourceRef = useRef(null);
  const logsEndRef = useRef(null);

  const columns = useMemo(() => columnsData, []);

  // Pie chart data
  const chartData = useMemo(() => [
    { name: "Installed / Up-to-date", value: data.filter((app) => app.status?.includes("Up-to-date")).length },
    { name: "Not Installed / Update Available", value: data.filter((app) => !app.status?.includes("Up-to-date")).length }
  ], [data]);

  useEffect(() => {
    if (logsEndRef.current) logsEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [attackLogs]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const handleAttack = useCallback((appName) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setAttackingApp(appName);
    setAttackLogs(["💻 Initializing attack simulation..."]);
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
      setAttackLogs((prev) => [...prev, "❌ Error: connection lost"]);
      setIsAttacking(false);
      es.close();
    };
  }, []);

  const tableData = useMemo(() => data.map((row) => ({ ...row, handleAttack })), [data, handleAttack]);

  const {
    getTableProps, getTableBodyProps, headerGroups, prepareRow,
    page, pageOptions, state, setGlobalFilter, gotoPage, setPageSize
  } = useTable(
    { columns, data: tableData, initialState: { pageSize: 5 } },
    useGlobalFilter, useSortBy, usePagination
  );

  const { globalFilter, pageIndex, pageSize } = state;

  return (
    <Box sx={{ p: 3, backgroundColor: "#0a0a0a", minHeight: "100vh" }}>

      {/* Pie Chart */}
      <Box sx={{
        backgroundColor: "rgba(20,20,20,0.7)",
        borderRadius: 3,
        p: 3,
        mb: 4,
        boxShadow: "0 0 30px #00ff00",
      }}>
        <Typography variant="h6" align="center" sx={{ color: "#00ff00", mb: 2, fontWeight: "bold" }}>
          System Update Status
        </Typography>
        <Box sx={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              {/* Glow effect */}
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
                stroke="#00ff00"
                strokeWidth={2}
                filter="url(#glow)"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index]}
                    stroke={COLORS[index]}
                    strokeWidth={2}
                  />
                ))}
              </Pie>

              {/* Correct tooltip */}
              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{
                  color: "#00ff00",
                  fontWeight: "bold",
                  bottom: -10,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Search */}
      <TextField
        label="🔍 Search apps"
        variant="outlined"
        value={globalFilter || ""}
        onChange={(e) => setGlobalFilter(e.target.value)}
        fullWidth
        sx={{
          mb: 3,
          "& .MuiOutlinedInput-root": {
            color: "#fff",
            backgroundColor: "#1a1a1a",
            "& fieldset": { borderColor: "#00ffea" },
            "&:hover fieldset": { borderColor: "#00bcd4" },
            "&.Mui-focused fieldset": { borderColor: "#00ffea" },
          },
          "& .MuiInputLabel-root": { color: "#00ffea" }
        }}
      />

      {/* Table */}
      <TableContainer component={Paper} sx={{ backgroundColor: "rgba(20,20,20,0.8)", borderRadius: 3 }}>
        <Table {...getTableProps()}>
          <TableHead>
            {headerGroups.map(headerGroup => (
              <TableRow {...headerGroup.getHeaderGroupProps()} key={headerGroup.id}>
                {headerGroup.headers.map(column => (
                  <TableCell
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    key={column.id}
                    sx={{
                      fontWeight: "bold",
                      color: "#00ffea",
                      borderBottom: "1px solid #00ffea",
                      background: "linear-gradient(90deg, #0a0a0a, #1a1a1a)"
                    }}
                  >
                    {column.render("Header")}
                    {column.isSorted ? (column.isSortedDesc ? " 🔽" : " 🔼") : ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody {...getTableBodyProps()}>
            {page.map(row => {
              prepareRow(row);
              return (
                <TableRow
                  {...row.getRowProps()}
                  key={row.id}
                  sx={{
                    backgroundColor: attackingApp === row.original.appName ? "#0d003f" : "#1a1a1a",
                    "&:hover": { backgroundColor: "#0d1a57", boxShadow: "0 0 15px #00ffea" },
                    transition: "all 0.2s ease-in-out"
                  }}
                >
                  {row.cells.map(cell => (
                    <TableCell
                      {...cell.getCellProps()}
                      key={cell.column.id}
                      sx={{ color: "#fff", borderBottom: "1px solid #00ffea" }}
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

      {/* Pagination */}
      <TablePagination
        component="div"
        count={pageOptions.length * pageSize}
        page={pageIndex}
        onPageChange={(e, newPage) => gotoPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => setPageSize(Number(e.target.value))}
        rowsPerPageOptions={[5, 10, 20]}
        sx={{
          color: "#00ffea",
          mt: 2,
          "& .MuiTablePagination-actions button": { color: "#00ffea" }
        }}
      />

      {/* Attack Terminal */}
      {attackingApp && (
        <Paper sx={{
          mt: 3,
          p: 2,
          backgroundColor: "rgba(0,0,0,0.9)",
          color: "#00ffea",
          fontFamily: "monospace",
          border: "1px solid #00ffea",
          boxShadow: "0 0 20px #00ffea",
          borderRadius: 2
        }}>
          <Typography variant="h6" sx={{ color: "#00ffea", mb: 1 }}>
            🚀 Attack Simulation: {attackingApp}
          </Typography>
          <Box sx={{ maxHeight: 300, overflowY: "auto", mb: 1 }}>
            {attackLogs.map((log, idx) => (
              <div key={idx}>{log}</div>
            ))}
            <div ref={logsEndRef} />
          </Box>
          {isAttacking && <CircularProgress size={24} sx={{ color: "#00ffea" }} />}
          <Button
            variant="contained"
            onClick={() => {
              setAttackingApp(null);
              setAttackLogs([]);
              if (eventSourceRef.current) eventSourceRef.current.close();
            }}
            sx={{
              mt: 2,
              backgroundColor: "#00bcd4",
              "&:hover": { backgroundColor: "#00ffea" }
            }}
          >
            Close
          </Button>
        </Paper>
      )}

    </Box>
  );
};

export default InstalledAppsTable;
