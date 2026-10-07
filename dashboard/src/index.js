import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Optional — remove if you don't have index.css

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
