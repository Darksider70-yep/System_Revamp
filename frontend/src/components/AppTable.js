import React from "react";

export default function AppTable({ data }) {
  return (
    <div className="overflow-x-auto mt-4">
      <table className="table-auto border border-gray-400 w-full">
        <thead>
          <tr className="bg-gray-200">
            <th className="px-4 py-2">Application</th>
            <th className="px-4 py-2">Current Version</th>
            <th className="px-4 py-2">Latest Version</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((app, index) => (
            <tr key={index} className="border-t">
              <td className="px-4 py-2">{app.name}</td>
              <td className="px-4 py-2">{app.current}</td>
              <td className="px-4 py-2">{app.latest}</td>
              <td className="px-4 py-2">{app.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
