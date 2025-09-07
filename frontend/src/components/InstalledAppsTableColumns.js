// InstalledAppsTableColumns.js
const columns = [
  {
    Header: "Name",
    accessor: "name",
    Cell: ({ value }) => (
      <span style={{ color: "#00ffff", fontWeight: "bold" }}>{value}</span>
    ),
  },
  {
    Header: "Current Version",
    accessor: "current",
    Cell: ({ value }) => <span style={{ color: "#ccc" }}>{value}</span>,
  },
  {
    Header: "Latest Version",
    accessor: "latest",
    Cell: ({ value }) => <span style={{ color: "#ccc" }}>{value}</span>,
  },
  {
    Header: "Status",
    accessor: "status",
    Cell: ({ value }) => (
      <span
        style={{
          color: value.includes("Up-to-date") ? "#4caf50" : "#ff9800",
          fontWeight: "bold",
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
      const barColor =
        value === "High" ? "#f44336" : value === "Medium" ? "#ff9800" : "#4caf50";

      return (
        <div
          style={{
            backgroundColor: "rgba(0,255,255,0.1)",
            borderRadius: "6px",
            height: "10px",
            width: "100%",
          }}
        >
          <div
            style={{
              width: `${riskPercent}%`,
              height: "100%",
              borderRadius: "6px",
              backgroundColor: barColor,
              boxShadow: `0 0 8px ${barColor}, 0 0 15px rgba(0,255,255,0.5)`,
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
        e.target.style.backgroundColor = "#00bcd4";
        e.target.style.boxShadow = "0 0 15px #00ffff, 0 0 30px #00bcd4";
      };
      const handleMouseOut = (e) => {
        e.target.style.backgroundColor = "#00ffff";
        e.target.style.boxShadow = "0 0 10px #00ffff, 0 0 20px #00bcd4";
      };

      return (
        <button
          className="attack-btn"
          onClick={() => row.original.handleAttack(row.original.name)}
          style={{
            backgroundColor: "#00ffff",
            color: "#000",
            fontWeight: "bold",
            borderRadius: "6px",
            textShadow: "0 0 5px #00ffff",
            boxShadow: "0 0 10px #00ffff, 0 0 20px #00bcd4",
            padding: "6px 12px",
            border: "none",
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
