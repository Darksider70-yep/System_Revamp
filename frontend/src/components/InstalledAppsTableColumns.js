// InstalledAppsTableColumns.js
const columns = [
  {
    Header: "Name",
    accessor: "name",
    Cell: ({ value }) => <span style={{ color: "#7dd3fc", fontWeight: 700 }}>{value}</span>,
  },
  {
    Header: "Current Version",
    accessor: "current",
    Cell: ({ value }) => <span style={{ color: "#cbd5e1" }}>{value}</span>,
  },
  {
    Header: "Latest Version",
    accessor: "latest",
    Cell: ({ value }) => <span style={{ color: "#cbd5e1" }}>{value}</span>,
  },
  {
    Header: "Status",
    accessor: "status",
    Cell: ({ value }) => (
      <span
        style={{
          color: value.includes("Up-to-date") ? "#4ade80" : "#fbbf24",
          fontWeight: 700,
        }}
      >
        {value}
      </span>
    ),
  },
  {
    Header: "Risk",
    accessor: "riskLevel",
    Cell: ({ value }) => {
      const riskPercent = value === "High" ? 90 : value === "Medium" ? 60 : 20;
      const barColor = value === "High" ? "#f43f5e" : value === "Medium" ? "#f59e0b" : "#22c55e";

      return (
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            borderRadius: "999px",
            height: "10px",
            width: "100%",
          }}
        >
          <div
            style={{
              width: `${riskPercent}%`,
              height: "100%",
              borderRadius: "999px",
              backgroundColor: barColor,
              boxShadow: `0 0 0 1px rgba(2,6,23,0.5), 0 0 10px ${barColor}66`,
              transition: "width 0.3s ease-in-out",
            }}
          />
        </div>
      );
    },
  },
  {
    Header: "Actions",
    accessor: "actions",
    Cell: ({ row }) => {
      const handleMouseOver = (e) => {
        e.target.style.background = "linear-gradient(120deg, #4338ca, #0369a1)";
        e.target.style.boxShadow = "0 10px 18px rgba(67, 56, 202, 0.5)";
      };
      const handleMouseOut = (e) => {
        e.target.style.background = "linear-gradient(120deg, #4f46e5, #0284c7)";
        e.target.style.boxShadow = "0 8px 14px rgba(79, 70, 229, 0.42)";
      };

      return (
        <button
          className="attack-btn"
          onClick={() => row.original.handleAttack(row.original.name)}
          style={{
            background: "linear-gradient(120deg, #4f46e5, #0284c7)",
            color: "#e2e8f0",
            fontWeight: 700,
            borderRadius: "10px",
            boxShadow: "0 8px 14px rgba(79, 70, 229, 0.42)",
            padding: "7px 12px",
            border: "1px solid rgba(125, 211, 252, 0.35)",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
          }}
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
        >
          Simulate Attack
        </button>
      );
    },
  },
];

export default columns;
